import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { assetMetadata, brandMetadata, fixtureSvg as svg } from './helpers/catalog-fixtures.mjs';

const moduleUrl = new URL('../scripts/lib/catalog.mjs', import.meta.url);
const loader = async (root) => (await import(moduleUrl)).loadCatalog(root);
const digest = (data) => createHash('sha256').update(data).digest('hex');

async function fixture(t, ids = ['example']) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logos'));
  for (const id of ids) {
    await mkdir(join(root, 'logos', id));
    await asset(root, id, svg);
  }
  return root;
}

async function asset(root, id, data, patch = {}) {
  const metadata = brandMetadata({ id, assets: [assetMetadata({ data })], ...patch });
  await writeFile(join(root, 'logos', id, 'icon.svg'), data);
  await writeFile(join(root, 'logos', id, 'metadata.json'), JSON.stringify(metadata));
  return metadata;
}

async function mutate(root, change, id = 'example') {
  const path = join(root, 'logos', id, 'metadata.json');
  const data = JSON.parse(await readFile(path, 'utf8'));
  change(data);
  await writeFile(path, JSON.stringify(data));
}

test('valid catalog preserves metadata and adds repository-relative asset paths', async (t) => {
  const root = await fixture(t);
  const result = await loader(root);
  assert.equal(result.schemaVersion, 3);
  assert.equal(result.brands[0].assets[0].path, 'logos/example/icon.svg');
  assert.equal(result.brands[0].assets[0].rights.status, 'permitted');
});

test('empty logos directory is a valid initialization state', async (t) => {
  const root = await fixture(t, []);
  assert.deepEqual(await loader(root), { schemaVersion: 3, brands: [] });
  await writeFile(join(root, 'logos/.gitkeep'), '');
  assert.deepEqual(await loader(root), { schemaVersion: 3, brands: [] });
  await writeFile(join(root, 'logos/.gitkeep'), 'hidden content');
  await assert.rejects(loader(root), /Invalid catalog:/);
});

test('brand and asset order is deterministic independently of metadata key order', async (t) => {
  const root = await fixture(t, ['z-brand', 'a-brand']);
  await mutate(
    root,
    (meta) => {
      meta.assets.push({ ...meta.assets[0], file: 'a.svg', variant: 'logo' });
      meta.assets.reverse();
    },
    'z-brand',
  );
  await writeFile(join(root, 'logos/z-brand/a.svg'), svg);
  const first = JSON.stringify(await loader(root));
  await mutate(
    root,
    (meta) => {
      meta.assets.reverse();
    },
    'z-brand',
  );
  const path = join(root, 'logos/a-brand/metadata.json');
  const entries = Object.entries(JSON.parse(await readFile(path, 'utf8'))).reverse();
  await writeFile(path, JSON.stringify(Object.fromEntries(entries)));
  assert.equal(JSON.stringify(await loader(root)), first);
  assert.deepEqual(
    (await loader(root)).brands.map((brand) => brand.id),
    ['a-brand', 'z-brand'],
  );
});

test('rejects missing assets, duplicate assets, mismatched IDs, and repeated IDs', async (t) => {
  for (const change of [
    (meta) => {
      meta.assets = [];
    },
    (meta) => {
      meta.assets.push(meta.assets[0]);
    },
    (meta) => {
      meta.id = 'other';
    },
  ]) {
    const root = await fixture(t);
    await mutate(root, change);
    await assert.rejects(loader(root), /Invalid catalog:/);
  }
  const root = await fixture(t, ['one', 'two']);
  await mutate(
    root,
    (meta) => {
      meta.id = 'one';
    },
    'two',
  );
  await assert.rejects(loader(root), /Invalid catalog:/);
});

test('rejects path traversal, backslashes, and unsupported asset extensions', async (t) => {
  for (const file of ['../escape.svg', 'nested/icon.svg', '..\\icon.svg', 'icon.html']) {
    const root = await fixture(t);
    await mutate(root, (meta) => {
      meta.assets[0].file = file;
    });
    await assert.rejects(loader(root), /Invalid catalog:/);
  }
});

test('rejects symlinks at the logos root, brand directory, and asset levels', async (t) => {
  for (const level of ['root', 'brand', 'asset']) {
    const root = await fixture(t);
    const target =
      level === 'root'
        ? join(root, 'logos')
        : level === 'brand'
          ? join(root, 'logos/example')
          : join(root, 'logos/example/icon.svg');
    await rm(target, { recursive: true });
    await symlink(tmpdir(), target);
    await assert.rejects(loader(root), /symbolic link/i);
  }
});

test('rejects edited hashes, incorrect sizes, missing assets, and orphan files', async (t) => {
  for (const mode of ['hash', 'size', 'missing', 'orphan']) {
    const root = await fixture(t);
    if (mode === 'hash')
      await writeFile(join(root, 'logos/example/icon.svg'), svg.replace('8 8', '9 9'));
    if (mode === 'size')
      await mutate(root, (meta) => {
        meta.assets[0].bytes++;
      });
    if (mode === 'missing') await rm(join(root, 'logos/example/icon.svg'));
    if (mode === 'orphan') await writeFile(join(root, 'logos/example/unlisted.svg'), svg);
    await assert.rejects(loader(root), /Invalid catalog:/);
  }
});

test('raster extensions require matching format signatures and basic headers', async (t) => {
  const png = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12);
  png.writeUInt32BE(1, 16);
  png.writeUInt32BE(1, 20);
  const webp = Buffer.alloc(22);
  webp.write('RIFF');
  webp.writeUInt32LE(14, 4);
  webp.write('WEBPVP8 ', 8);
  webp.writeUInt32LE(2, 16);
  const jpeg = Buffer.from('ffd8ffe00002ffd9', 'hex');
  const cases = [
    ['png', png],
    ['webp', webp],
    ['jpg', jpeg],
  ];
  for (const [extension, valid] of cases) {
    for (const data of [
      valid,
      Buffer.from('not an image'),
      valid.subarray(0, Math.min(8, valid.length - 1)),
      extension === 'png'
        ? Buffer.concat([valid.subarray(0, 16), Buffer.alloc(17)])
        : Buffer.from(png),
    ]) {
      const root = await fixture(t);
      await rm(join(root, 'logos/example/icon.svg'));
      await writeFile(join(root, `logos/example/icon.${extension}`), data);
      await mutate(root, (meta) => {
        meta.defaultAsset = `icon.${extension}`;
        Object.assign(meta.assets[0], {
          file: `icon.${extension}`,
          bytes: data.length,
          sha256: digest(data),
        });
      });
      if (data === valid) assert.equal((await loader(root)).brands.length, 1);
      else await assert.rejects(loader(root), /image header/i);
    }
  }
});

test('rejects invalid public metadata and malformed JSON', async (t) => {
  for (const change of [
    (meta) => {
      meta.name = '';
    },
    (meta) => {
      meta.aliases = ['same', 'same'];
    },
    (meta) => {
      meta.assets[0].variant = 'banner';
    },
    (meta) => {
      meta.assets[0].sha256 = 'A'.repeat(64);
    },
    (meta) => {
      meta.assets[0].bytes = 0;
    },
    (meta) => {
      meta.privateNotes = 'not public schema';
    },
  ]) {
    const root = await fixture(t);
    await mutate(root, change);
    await assert.rejects(loader(root), /Invalid catalog:/);
  }
  const root = await fixture(t);
  await writeFile(join(root, 'logos/example/metadata.json'), '{');
  await assert.rejects(loader(root), /Invalid catalog:/);
});

test('requires complete permission records and real ISO calendar dates', async (t) => {
  for (const change of [
    (rights) => {
      rights.status = 'unknown';
    },
    (rights) => {
      rights.license = '';
    },
    (rights) => {
      delete rights.reference;
    },
    (rights) => {
      rights.attribution = ' ';
    },
    (rights) => {
      rights.reviewedAt = '2026-02-30';
    },
  ]) {
    const root = await fixture(t);
    await mutate(root, (meta) => change(meta.assets[0].rights));
    await assert.rejects(loader(root), /Invalid catalog:/);
  }
});

test('URLs must be absolute HTTPS URLs without embedded credentials', async (t) => {
  for (const url of [
    'http://example.com',
    '/local',
    'javascript:alert(1)',
    'https:example.com',
    'https://exam\nple.com',
    'https://user:pass@example.com/',
  ]) {
    for (const field of ['website', 'source', 'sourcePage', 'reference']) {
      const root = await fixture(t);
      await mutate(root, (meta) => {
        if (field === 'website') meta.website = url;
        else if (field === 'reference') meta.assets[0].rights.reference = url;
        else meta.assets[0][field] = url;
      });
      await assert.rejects(loader(root), /Invalid catalog:/);
    }
  }
});

test('rejects malformed SVG, DTD declarations, and processing instructions', async (t) => {
  for (const data of [
    '<svg><path></svg>',
    '<!DOCTYPE svg><svg/>',
    '<?xml-stylesheet href="https://example.com/x.css"?><svg/>',
    '<html/>',
  ]) {
    const root = await fixture(t);
    await asset(root, 'example', data);
    await assert.rejects(loader(root), /svg/i);
  }
});

test('rejects active SVG elements, event handlers, unsafe CSS, and foreign namespaces', async (t) => {
  for (const body of [
    '<script/>',
    '<foreignObject/>',
    '<animate/>',
    '<style>@import "https://example.com/x.css";</style>',
    '<path onload="alert(1)"/>',
    '<path style="fill:url(https://example.com/x)"/>',
    '<x:path xmlns:x="https://evil.example"/>',
  ]) {
    const root = await fixture(t);
    await asset(root, 'example', `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    await assert.rejects(loader(root), /svg/i);
  }
});

test('rejects external SVG references including XML entity and CSS escape tricks', async (t) => {
  for (const body of [
    '<image href="https://example.com/a.png"/>',
    '<use href="//example.com/a.svg#x"/>',
    '<use href="&#x68;ttps://example.com/x"/>',
    '<path fill="url(https://example.com/x)"/>',
    '<path fill="u\\72l(https://example.com/x)"/>',
    '<image href="data:image/svg+xml;base64,PHN2Zy8+"/>',
  ]) {
    const root = await fixture(t);
    await asset(root, 'example', `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    await assert.rejects(loader(root), /svg/i);
  }
});

test('allows fragment references and embedded PNG images in passive SVG', async (t) => {
  const root = await fixture(t);
  await asset(
    root,
    'example',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><path id="p" d="M0 0"/></defs><use xlink:href="#p" fill="url(#g)"/><image href="data:image/png;base64,iVBORw0KGgo="/></svg>',
  );
  assert.equal((await loader(root)).brands.length, 1);
});

test('build-index generates the resource document without rewriting README and checks drift outside repository CWD', async (t) => {
  const root = await fixture(t);
  await cp(new URL('../scripts', import.meta.url), join(root, 'scripts'), { recursive: true });
  await cp(new URL('../schema', import.meta.url), join(root, 'schema'), { recursive: true });
  await cp(new URL('../src/lib', import.meta.url), join(root, 'src/lib'), { recursive: true });
  await symlink(new URL('../node_modules', import.meta.url).pathname, join(root, 'node_modules'));
  const build = join(root, 'scripts/build-index.mjs');
  const validate = join(root, 'scripts/validate.mjs');
  const readme =
    '# Preserve intro\n\nHandwritten usage and contribution links.\n\nPreserve footer\n';
  await writeFile(join(root, 'README.md'), readme);
  await rm(join(root, 'logos/example/icon.svg'));
  const unusualFile = 'icon "(1).svg';
  await writeFile(join(root, 'logos/example', unusualFile), svg);
  await mutate(root, (meta) => {
    meta.name = 'Example | <img src=x>\n**bold**';
    meta.assets[0].file = unusualFile;
    meta.defaultAsset = unusualFile;
    meta.assets[0].rights.license = 'License | [inject](javascript:alert(1))';
    meta.assets[0].rights.notes = 'Historical | <script>\nUse conditions';
  });
  const built = spawnSync(process.execPath, [build], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), readme);
  const document = join(root, 'docs/catalog.md');
  const generated = await readFile(document, 'utf8');
  assert.match(generated, /^# Logo 资源清单\n/);
  assert.match(generated, /width="64">/);
  assert.doesNotMatch(generated, /height="64"/);
  assert.match(generated, /\.\.\/logos\/example\/icon%20%22%281%29.svg/);
  assert.match(generated, /Historical &#124; &lt;script&gt; Use conditions/);
  assert.doesNotMatch(generated, /<img src=x>|\*\*bold\*\*|\[inject\]\(javascript:/);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), readme);
  const currentIndex = await readFile(join(root, 'index.json'), 'utf8');
  const checked = spawnSync(process.execPath, [build, '--check'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(await readFile(document, 'utf8'), generated);
  assert.equal(await readFile(join(root, 'index.json'), 'utf8'), currentIndex);
  await writeFile(document, '# Stale resource list\n');
  const staleTable = spawnSync(process.execPath, [build, '--check'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(staleTable.status, 1);
  assert.match(staleTable.stderr, /catalog\.md/);
  assert.equal(await readFile(document, 'utf8'), '# Stale resource list\n');
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), readme);
  await writeFile(document, generated);
  await writeFile(join(root, 'index.json'), '{}\n');
  const stale = spawnSync(process.execPath, [build, '--check'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /index/i);
  assert.equal(await readFile(join(root, 'index.json'), 'utf8'), '{}\n');
  assert.equal(await readFile(document, 'utf8'), generated);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), readme);
  const valid = spawnSync(process.execPath, [validate], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
  await mutate(root, (meta) => {
    meta.categories = ['untranslated-industry'];
  });
  const untranslated = spawnSync(process.execPath, [validate], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(
    untranslated.status,
    1,
    'Repository validation must reject untranslated categories.',
  );
  assert.match(untranslated.stderr, /untranslated-industry/);
  for (const category of ['industrial-automation', '工业设计']) {
    await mutate(root, (meta) => {
      meta.categories = [category];
    });
    const translated = spawnSync(process.execPath, [validate], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    assert.equal(translated.status, 0, translated.stderr);
  }
});
