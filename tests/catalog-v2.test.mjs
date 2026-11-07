import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, repositoryRoot } from '../scripts/lib/catalog.mjs';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
const website = 'https://example.com/';
const digest = createHash('sha256').update(svg).digest('hex');
const cli = fileURLToPath(new URL('../scripts/prepare-asset.mjs', import.meta.url));

async function fixture(t, ids = ['example']) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-v2-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logos'));
  for (const id of ids) {
    const folder = join(root, 'logos', id);
    await mkdir(folder);
    await writeFile(join(folder, 'icon.svg'), svg);
    await writeFile(
      join(folder, 'metadata.json'),
      JSON.stringify({
        schemaVersion: 3,
        id,
        name: id,
        aliases: [],
        website,
        identity: { nameZh: null, nameEn: null, legalNames: [], sources: [] },
        entityType: 'product',
        categories: ['Developer tools'],
        defaultAsset: 'icon.svg',
        assets: [
          {
            file: 'icon.svg',
            label: 'Current icon',
            variant: 'icon',
            status: 'current',
            background: 'any',
            language: 'none',
            layout: 'standalone',
            color: 'brand',
            provenance: { sourceType: 'official', processing: 'original' },
            source: website,
            sourcePage: website,
            sha256: digest,
            bytes: Buffer.byteLength(svg),
            rights: {
              status: 'permitted',
              license: 'Example permission',
              reference: website,
              attribution: 'Example Company',
              reviewedAt: '2026-11-07',
            },
          },
        ],
      }),
    );
  }
  return root;
}

async function mutate(root, change, id = 'example') {
  const path = join(root, 'logos', id, 'metadata.json');
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  change(metadata);
  await writeFile(path, JSON.stringify(metadata));
}

test('v3 preserves explicit entity, tags, readable versions and the selected default', async (t) => {
  const root = await fixture(t, ['company', 'example']);
  await mutate(root, (metadata) => {
    metadata.parentId = 'company';
  });
  const catalog = await loadCatalog(root);
  const product = catalog.brands.find((brand) => brand.id === 'example');
  assert.equal(catalog.schemaVersion, 3);
  assert.equal(product.schemaVersion, 3);
  assert.equal(product.parentId, 'company');
  assert.equal(product.entityType, 'product');
  assert.deepEqual(product.categories, ['Developer tools']);
  assert.equal(product.defaultAsset, 'icon.svg');
  assert.equal(product.assets[0].label, 'Current icon');
  assert.equal(product.assets[0].status, 'current');
  assert.equal(product.assets[0].background, 'any');
});

test('v3 rejects unsupported versions, wrong types, unknown fields and invalid enums', async (t) => {
  for (const change of [
    (m) => {
      delete m.schemaVersion;
    },
    (m) => {
      m.schemaVersion = 1;
    },
    (m) => {
      m.entityType = 'brand';
    },
    (m) => {
      m.categories = 'Tools';
    },
    (m) => {
      m.categories = ['tools', 'tools'];
    },
    (m) => {
      m.categories = [' '];
    },
    (m) => {
      m.parentId = '';
    },
    (m) => {
      m.defaultAsset = 'missing.svg';
    },
    (m) => {
      delete m.assets[0].label;
    },
    (m) => {
      m.assets[0].label = ' ';
    },
    (m) => {
      m.assets[0].status = 'old';
    },
    (m) => {
      m.assets[0].background = 'blue';
    },
    (m) => {
      m.assets[0].otherField = true;
    },
  ]) {
    const root = await fixture(t);
    await mutate(root, change);
    await assert.rejects(loadCatalog(root), /Invalid catalog:/);
  }
});

test('parent references must exist and form an acyclic graph', async (t) => {
  for (const mode of ['missing', 'self', 'cycle']) {
    const root = await fixture(t, ['example', 'company']);
    await mutate(root, (m) => {
      m.parentId = mode === 'missing' ? 'missing' : mode === 'self' ? 'example' : 'company';
    });
    if (mode === 'cycle')
      await mutate(
        root,
        (m) => {
          m.parentId = 'example';
        },
        'company',
      );
    await assert.rejects(loadCatalog(root), /parent|cycle/i);
  }
});

test('trailing newlines do not bypass the schema HTTPS and filename boundaries', async (t) => {
  const root = await fixture(t);
  await mutate(root, (m) => {
    m.website = `${website}\n`;
  });
  await assert.rejects(loadCatalog(root), /Invalid catalog:/);
  await mutate(root, (m) => {
    m.website = website;
    m.defaultAsset = 'icon.svg\n';
    m.assets[0].file = 'icon.svg\n';
  });
  await writeFile(join(root, 'logos/example/icon.svg\n'), svg);
  await rm(join(root, 'logos/example/icon.svg'));
  await assert.rejects(loadCatalog(root), /Invalid catalog:/);
});

test('catalog rejects dot-prefixed asset filenames that the preview server cannot serve', async (t) => {
  const root = await fixture(t);
  await mutate(root, (m) => {
    m.defaultAsset = '.logo.svg';
    m.assets[0].file = '.logo.svg';
  });
  await writeFile(join(root, 'logos/example/.logo.svg'), svg);
  await rm(join(root, 'logos/example/icon.svg'));
  await assert.rejects(loadCatalog(root), /Invalid catalog:/);
});

test('an explicit historical default is allowed only when no current asset exists', async (t) => {
  const root = await fixture(t);
  await mutate(root, (m) => {
    m.assets[0].status = 'historical';
  });
  assert.equal((await loadCatalog(root)).brands[0].assets[0].status, 'historical');
  await writeFile(join(root, 'logos/example/current.svg'), svg);
  await mutate(root, (m) => {
    m.assets.push({ ...m.assets[0], file: 'current.svg', status: 'current' });
  });
  await assert.rejects(loadCatalog(root), /defaultAsset.*current/i);
  await mutate(root, (m) => {
    m.defaultAsset = 'current.svg';
  });
  assert.equal((await loadCatalog(root)).brands[0].defaultAsset, 'current.svg');
});

test('prepare-asset creates an isolated draft with exact bytes and pending manual rights', async (t) => {
  const root = await fixture(t, []);
  const input = join(root, 'source.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  const run = spawnSync(
    process.execPath,
    [
      cli,
      input,
      '--id',
      'sample',
      '--name',
      'Sample',
      '--output',
      output,
      '--entity-type',
      'organization',
      '--label',
      'Original icon',
    ],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  const draft = JSON.parse(await readFile(join(output, 'metadata.json'), 'utf8'));
  assert.equal(draft.schemaVersion, 3);
  assert.equal(draft.entityType, 'organization');
  assert.deepEqual(draft.identity, { nameZh: null, nameEn: null, legalNames: [], sources: [] });
  assert.equal(draft.assets[0].language, 'none');
  assert.equal(draft.assets[0].layout, 'standalone');
  assert.equal(draft.assets[0].color, 'brand');
  assert.deepEqual(draft.assets[0].provenance, { sourceType: '', processing: '' });
  assert.equal(draft.defaultAsset, 'source.svg');
  assert.deepEqual(draft.categories, []);
  assert.equal(draft.assets[0].label, 'Original icon');
  assert.equal(draft.assets[0].sha256, digest);
  assert.equal(draft.assets[0].bytes, Buffer.byteLength(svg));
  assert.equal(draft.assets[0].rights.status, 'pending-review');
  assert.equal(draft.assets[0].source, '');
  assert.equal(draft.assets[0].rights.reference, '');
  assert.equal(await readFile(join(output, 'source.svg'), 'utf8'), svg);
  assert.match(run.stdout, /manual|review|人工|审核/i);
  await mkdir(join(root, 'logos/sample'));
  await writeFile(join(root, 'logos/sample/source.svg'), svg);
  await writeFile(join(root, 'logos/sample/metadata.json'), JSON.stringify(draft));
  await assert.rejects(loadCatalog(root), /Invalid catalog:/);
});

test('prepare-asset never overwrites, validates image content and gives readable usage errors', async (t) => {
  const root = await fixture(t, []);
  const input = join(root, 'source.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  await mkdir(output);
  await writeFile(join(output, 'metadata.json'), 'preserve me');
  const args = [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output];
  const existing = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(existing.status, 1);
  assert.match(existing.stderr, /already exists|已存在/i);
  assert.equal(await readFile(join(output, 'metadata.json'), 'utf8'), 'preserve me');
  await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
  const invalid = spawnSync(process.execPath, [...args.slice(0, -1), join(root, 'invalid')], {
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /SVG/);
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--output/);
  const unknown = spawnSync(process.execPath, [cli, '--permitted'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.doesNotMatch(unknown.stderr, /at file:|node:internal/);
});

test('prepare-asset blocks catalog destinations including symlinked parents', async (t) => {
  const root = await fixture(t, []);
  const input = join(root, 'source.svg');
  await writeFile(input, svg);
  const alias = join(root, 'catalog-alias');
  await symlink(join(repositoryRoot, 'logos'), alias);
  const output = join(alias, `draft-test-no-write-${process.pid}`);
  const run = spawnSync(
    process.execPath,
    [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /outside logos/);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
});

test('prepare-asset rejects hidden image filenames before writing a draft', async (t) => {
  const root = await fixture(t, []);
  const input = join(root, '.logo.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  const run = spawnSync(
    process.execPath,
    [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /non-hidden.*filename|filename.*dot/i);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  assert.equal(await readFile(input, 'utf8'), svg);
});
