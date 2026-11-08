import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadCatalog } from '../scripts/lib/catalog.mjs';
import {
  brandMetadata,
  fixtureSvg as svg,
  fixtureWebsite as website,
} from './helpers/catalog-fixtures.mjs';

async function fixture(t, ids = ['example']) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-validation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logos'));
  for (const id of ids) {
    const folder = join(root, 'logos', id);
    await mkdir(folder);
    await writeFile(join(folder, 'icon.svg'), svg);
    await writeFile(
      join(folder, 'metadata.json'),
      JSON.stringify(brandMetadata({ id, entityType: 'product', categories: ['Developer tools'] })),
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

test('catalog preserves explicit entity, tags, readable versions and the selected default', async (t) => {
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

test('catalog rejects unsupported versions, wrong types, unknown fields and invalid enums', async (t) => {
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

test('display is optional for existing records, preserved for alternatives and cannot replace the brand default', async (t) => {
  const root = await fixture(t);
  assert.equal(Object.hasOwn((await loadCatalog(root)).brands[0].assets[0], 'display'), false);
  await writeFile(join(root, 'logos/example/alternative.svg'), svg);
  await mutate(root, (m) => {
    m.assets.push({ ...m.assets[0], file: 'alternative.svg', display: 'alternative' });
  });
  const brand = (await loadCatalog(root)).brands[0];
  assert.equal(
    brand.assets.find((asset) => asset.file === 'alternative.svg').display,
    'alternative',
  );
  await mutate(root, (m) => {
    m.defaultAsset = 'alternative.svg';
  });
  await assert.rejects(loadCatalog(root), /defaultAsset.*primary/i);
});

test('an artwork must recommend a primary member when one exists but all-alternative groups are allowed', async (t) => {
  const root = await fixture(t);
  for (const file of ['blue.svg', 'blue-small.svg'])
    await writeFile(join(root, 'logos/example', file), svg);
  await mutate(root, (m) => {
    m.assets.push(
      { ...m.assets[0], file: 'blue.svg' },
      { ...m.assets[0], file: 'blue-small.svg', display: 'alternative' },
    );
    m.artworks = [
      {
        id: 'blue',
        label: 'Blue',
        files: ['blue.svg', 'blue-small.svg'],
        defaultAsset: 'blue-small.svg',
      },
    ];
  });
  await assert.rejects(loadCatalog(root), /defaultAsset.*primary/i);
  await mutate(root, (m) => {
    m.assets.find((asset) => asset.file === 'blue.svg').display = 'alternative';
  });
  assert.equal((await loadCatalog(root)).brands[0].artworks[0].defaultAsset, 'blue-small.svg');
});
