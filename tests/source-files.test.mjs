import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog } from '../scripts/lib/catalog.mjs';
import { prepareSite } from '../scripts/prepare-site.mjs';
import * as artworks from '../src/lib/catalog-artworks.mjs';
import { filterOptions, matchingBrands } from '../src/lib/catalog-presentation.mjs';
import { createPreviewServer } from '../scripts/lib/preview-server.mjs';
import { assetMetadata, brandMetadata, fixtureSvg } from './helpers/catalog-fixtures.mjs';

const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const eps = Buffer.from('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 8 8\nshowpage\n%%EOF\n');
const aiPostscript = Buffer.from(
  '%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator(R) 8.0\n%%BoundingBox: 0 0 8 8\n%%EOF\n',
);
const aiEpsPostscript = Buffer.from(
  '%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: Adobe Illustrator(R) 8.0\n%%EOF\n',
);
const binaryEps = Buffer.alloc(30 + eps.length);
Buffer.from('c5d0d3c6', 'hex').copy(binaryEps);
binaryEps.writeUInt32LE(30, 4);
binaryEps.writeUInt32LE(eps.length, 8);
eps.copy(binaryEps, 30);

function sourceFile(file = 'design.ai', data = pdf, overrides = {}) {
  return {
    file,
    label: '原生设计文件 RGB',
    assetFiles: ['icon.svg'],
    source: 'https://example.com/design.ai',
    sourcePage: 'https://example.com/brand/',
    sha256: createHash('sha256').update(data).digest('hex'),
    bytes: data.length,
    rights: { ...assetMetadata().rights, status: 'unverified', license: '许可未核实' },
    ...overrides,
  };
}

async function fixture(t, { file = 'design.ai', data = pdf, change = () => {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-source-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, 'logo/example');
  await mkdir(folder, { recursive: true });
  const metadata = brandMetadata({ sourceFiles: [sourceFile(file, data)] });
  change(metadata);
  await writeFile(join(folder, 'icon.svg'), fixtureSvg);
  await writeFile(join(folder, file), data);
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  return { root, folder, metadata };
}

test('source files preserve original bytes and permissions separately from renderable assets', async (t) => {
  for (const [file, data] of [
    ['design.ai', pdf],
    ['design-postscript.ai', aiPostscript],
    ['design-eps-postscript.ai', aiEpsPostscript],
    ['design.eps', eps],
    ['design-preview.eps', binaryEps],
    ['guideline.pdf', pdf],
  ]) {
    const { root } = await fixture(t, { file, data });
    const brand = (await loadCatalog(root)).brands[0];
    assert.equal(brand.assets.length, 1);
    assert.equal(brand.defaultAsset, 'icon.svg');
    assert.deepEqual(brand.sourceFiles, [
      { ...sourceFile(file, data), path: `logo/example/${file}` },
    ]);
    assert.equal(artworks.artworkGroups(brand).length, 1);
    assert.deepEqual(filterOptions([brand]).formats, ['SVG']);
    assert.deepEqual(matchingBrands([brand], { format: 'AI' }), []);
  }
});

test('source files remain optional for existing metadata and have deterministic output ordering', async (t) => {
  const { root, folder, metadata } = await fixture(t);
  metadata.sourceFiles.push(sourceFile('a.pdf', pdf));
  await writeFile(join(folder, 'a.pdf'), pdf);
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  const first = await loadCatalog(root);
  assert.deepEqual(
    first.brands[0].sourceFiles.map((item) => item.file),
    ['a.pdf', 'design.ai'],
  );
  metadata.sourceFiles.reverse();
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  assert.deepEqual(await loadCatalog(root), first);
  delete metadata.sourceFiles;
  await rm(join(folder, 'a.pdf'));
  await rm(join(folder, 'design.ai'));
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  assert.equal(Object.hasOwn((await loadCatalog(root)).brands[0], 'sourceFiles'), false);
});

test('source file registration rejects traversal, unsupported formats and invalid associations', async (t) => {
  const changes = [
    ...[
      '../design.ai',
      'nested/design.ai',
      '..\\design.ai',
      '.design.ai',
      'design.html',
      'design.svg',
    ].map((file) => (metadata) => {
      metadata.sourceFiles[0].file = file;
    }),
    (metadata) => {
      metadata.sourceFiles = [];
    },
    (metadata) => {
      metadata.sourceFiles.push({ ...metadata.sourceFiles[0] });
    },
    (metadata) => {
      metadata.sourceFiles[0].assetFiles = [];
    },
    (metadata) => {
      metadata.sourceFiles[0].assetFiles = ['missing.svg'];
    },
    (metadata) => {
      metadata.sourceFiles[0].assetFiles = ['icon.svg', 'icon.svg'];
    },
    (metadata) => {
      metadata.sourceFiles[0].assetFiles = ['design.ai'];
    },
    (metadata) => {
      metadata.sourceFiles[0].source = 'http://example.com/design.ai';
    },
    (metadata) => {
      metadata.sourceFiles[0].sourcePage = 'https://user:pass@example.com/';
    },
    (metadata) => {
      metadata.sourceFiles[0].rights.status = 'unknown';
    },
    (metadata) => {
      metadata.sourceFiles[0].rights.reviewedAt = '2026-02-30';
    },
    (metadata) => {
      delete metadata.sourceFiles[0].rights.reference;
    },
    (metadata) => {
      metadata.sourceFiles[0].label = ' ';
    },
    (metadata) => {
      metadata.sourceFiles[0].extra = true;
    },
  ];
  for (const change of changes) {
    const { root } = await fixture(t, { change });
    await assert.rejects(loadCatalog(root), /Invalid catalog:/);
  }
});

test('source files require registered regular files with matching hashes and sizes', async (t) => {
  for (const mode of ['hash', 'size', 'missing', 'unlisted', 'symlink']) {
    const { root, folder, metadata } = await fixture(t);
    if (mode === 'hash')
      await writeFile(join(folder, 'design.ai'), pdf.toString().replace('1.7', '1.6'));
    if (mode === 'size') metadata.sourceFiles[0].bytes++;
    if (mode === 'missing') await rm(join(folder, 'design.ai'));
    if (mode === 'unlisted') delete metadata.sourceFiles;
    if (mode === 'symlink') {
      await rm(join(folder, 'design.ai'));
      await symlink(join(folder, 'icon.svg'), join(folder, 'design.ai'));
    }
    await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
    await assert.rejects(loadCatalog(root), /Invalid catalog:/);
  }
});

test('source file extensions require matching PDF, Illustrator or EPS signatures', async (t) => {
  for (const [file, data] of [
    ['design.ai', Buffer.from('<html>not a design file</html>')],
    ['design.ai', eps],
    ['design.pdf', eps],
    ['design.pdf', Buffer.from('%PDF-1.7\ntruncated')],
    ['design.eps', pdf],
    ['design.eps', aiPostscript],
    ['design.eps', binaryEps.subarray(0, 29)],
    ['design.eps', binaryEps.subarray(0, binaryEps.length - 1)],
  ]) {
    const { root } = await fixture(t, { file, data });
    await assert.rejects(loadCatalog(root), /source file header/i);
  }
});

test('attachments follow the selected artwork across format changes without leaking to another artwork', () => {
  const brand = brandMetadata({
    assets: [
      assetMetadata(),
      assetMetadata({ file: 'icon.png' }),
      assetMetadata({ file: 'white.svg' }),
    ],
    artworks: [
      { id: 'icon', label: '图形', files: ['icon.svg', 'icon.png'], defaultAsset: 'icon.svg' },
    ],
    sourceFiles: [sourceFile(), sourceFile('white.ai', pdf, { assetFiles: ['white.svg'] })],
  });
  assert.equal(typeof artworks.artworkSourceFiles, 'function');
  for (const file of ['icon.svg', 'icon.png']) {
    assert.deepEqual(
      artworks.artworkSourceFiles(brand, file).map((item) => item.file),
      ['design.ai'],
    );
  }
  assert.deepEqual(
    artworks.artworkSourceFiles(brand, 'white.svg').map((item) => item.file),
    ['white.ai'],
  );
  const filtered = { ...brand, assets: [brand.assets[1]] };
  assert.deepEqual(
    artworks.artworkSourceFiles(filtered, 'icon.png').map((item) => item.file),
    ['design.ai'],
  );
  assert.deepEqual(artworks.artworkSourceFiles(brandMetadata(), 'icon.svg'), []);
});

test('source files are included in the index and static staging and remain downloadable unchanged', async (t) => {
  const { root } = await fixture(t);
  const catalog = await prepareSite(root);
  const original = await readFile(join(root, 'static/logo/example/design.ai'));
  assert.deepEqual(original, pdf);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'static/index.json'), 'utf8')), catalog);
  const server = createPreviewServer(join(root, 'static'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/logo/example/design.ai`);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);

  for (const directory of ['scripts', 'schema', 'src/lib']) {
    await cp(new URL(`../${directory}`, import.meta.url), join(root, directory), {
      recursive: true,
    });
  }
  await symlink(new URL('../node_modules', import.meta.url).pathname, join(root, 'node_modules'));
  const built = spawnSync(process.execPath, [join(root, 'scripts/build-index.mjs')], {
    encoding: 'utf8',
  });
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'index.json'), 'utf8')), catalog);
  const document = await readFile(join(root, 'docs/catalog.md'), 'utf8');
  assert.match(document, /1 个品牌、1 个文件/);
});

test('public detail HTML omits internal review labels while preserving named licenses and attribution', async () => {
  const catalog = JSON.parse(
    await readFile(new URL('../_site/index.json', import.meta.url), 'utf8'),
  );
  for (const brand of catalog.brands) {
    const html = await readFile(
      new URL(`../_site/logo/${brand.id}/index.html`, import.meta.url),
      'utf8',
    );
    const publicHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.equal(
      /许可未核实|许可已确认/.test(publicHtml),
      false,
      `${brand.id}: review status belongs to metadata`,
    );
    const selected = brand.assets.find((asset) => asset.file === brand.defaultAsset);
    if (/^CC[- ]BY/.test(selected.rights.license)) {
      assert.ok(publicHtml.includes(selected.rights.license), `${brand.id}: named license`);
      assert.ok(
        publicHtml.includes(selected.rights.attribution),
        `${brand.id}: required attribution`,
      );
    }
  }
});

test('no-JavaScript native downloads share source and usage information for matching attachments', async () => {
  const brand = JSON.parse(
    await readFile(new URL('../_site/logo/baidu/metadata.json', import.meta.url), 'utf8'),
  );
  const html = await readFile(new URL('../_site/logo/baidu/index.html', import.meta.url), 'utf8');
  const fallback = html.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/i)?.[1] ?? '';
  const externalLinks = [...fallback.matchAll(/\bhref="(https:\/\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const sourcePage of new Set(brand.sourceFiles.map((entry) => entry.sourcePage)))
    assert.equal(
      externalLinks.filter((href) => href === sourcePage).length,
      1,
      `${sourcePage}: one shared source link`,
    );
  assert.equal(
    new Set(externalLinks).size,
    externalLinks.length,
    'source and usage links do not repeat a URL',
  );
  for (const entry of brand.sourceFiles) {
    assert.ok(
      fallback.includes(`download="${brand.id}-${entry.file}"`),
      `${entry.file}: direct download`,
    );
    assert.ok(fallback.includes(entry.label), `${entry.file}: purpose label`);
    assert.ok(
      fallback.includes(entry.file.split('.').at(-1).toUpperCase()),
      `${entry.file}: format`,
    );
  }
});
