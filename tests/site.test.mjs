import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const search = () => import('../site/catalog-search.mjs');
const build = async (root) => (await import('../scripts/build-site.mjs')).buildSite(root);
const brands = [
  { id: 'example', name: 'Example Inc.', aliases: ['示例公司', 'Example Company'],
    assets: [{ file: 'icon.svg', rights: { license: 'MIT' } }] },
  { id: 'another', name: 'Another Company', aliases: ['另一家公司'],
    assets: [{ file: 'wordmark.svg', rights: { license: 'CC BY 4.0' } }] },
];

async function fixture(t, patch = {}) {
  const root = await mkdtemp(join(tmpdir(), 'company-logos-site-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logos/example'), { recursive: true });
  await mkdir(join(root, 'site/assets'), { recursive: true });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
  const metadata = { id: 'example', name: '示例公司', aliases: ['Example'], website: 'https://example.com/',
    assets: ['icon', 'wordmark'].map((variant) => ({ file: `${variant}.svg`, variant,
      source: 'https://example.com/icon.svg', sourcePage: 'https://example.com/',
      sha256: createHash('sha256').update(svg).digest('hex'), bytes: Buffer.byteLength(svg),
      rights: { status: 'permitted', license: 'MIT', reference: 'https://example.com/license',
        attribution: 'Example', reviewedAt: '2026-11-06' } })), ...patch };
  await writeFile(join(root, 'logos/example/metadata.json'), JSON.stringify(metadata));
  for (const asset of metadata.assets) await writeFile(join(root, 'logos/example', asset.file), svg);
  await writeFile(join(root, 'site/index.html'), '<!doctype html><link rel="stylesheet" href="./assets/style.css">'
    + '<p>__BRAND_COUNT__ / __ASSET_COUNT__</p><meta name="source" content="__SOURCE_COMMIT__">'
    + '<script id="catalog" type="application/json">__CATALOG_JSON__</script><script type="module" src="./app.mjs"></script>');
  await writeFile(join(root, 'site/assets/style.css'), 'body { color: black; }');
  await writeFile(join(root, 'site/app.mjs'), 'export const ready = true;');
  return root;
}

test('normalizes Unicode, casing, and repeated whitespace', async () => {
  assert.equal((await search()).normalizeQuery('  ＥＸＡＭＰＬＥ\t公司\n  Logo '), 'example 公司 logo');
});

test('matches names, IDs, Chinese aliases, and all search terms', async () => {
  const { filterBrands } = await search();
  for (const query of ['EXAMPLE', '示例公司', 'example 公司', 'example icon MIT']) {
    assert.deepEqual(filterBrands(brands, query), [brands[0]]);
  }
  assert.deepEqual(filterBrands(brands, 'another 示例'), []);
});

test('empty queries return all brands and unknown queries return none', async () => {
  const { filterBrands } = await search();
  assert.deepEqual(filterBrands(brands, ' \t '), brands);
  assert.deepEqual(filterBrands(brands, 'absent'), []);
  assert.deepEqual(filterBrands([], ''), []);
});

test('search preserves input data and returns original brand objects', async () => {
  const input = structuredClone(brands);
  const snapshot = structuredClone(input);
  for (const brand of input) {
    Object.freeze(brand.aliases);
    for (const asset of brand.assets) { Object.freeze(asset.rights); Object.freeze(asset); }
    Object.freeze(brand.assets); Object.freeze(brand);
  }
  Object.freeze(input);
  const result = (await search()).filterBrands(input, 'example');
  assert.equal(result[0], input[0]);
  assert.deepEqual(input, snapshot);
});

test('builds from validated source files and copies static files, assets, and metadata', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'index.json'), '{"stale":true}');
  await build(root);
  const output = join(root, '_site');
  const catalog = JSON.parse(await readFile(join(output, 'index.json'), 'utf8'));
  assert.equal(catalog.brands[0].name, '示例公司');
  for (const path of ['logos/example/icon.svg', 'logos/example/wordmark.svg', 'logos/example/metadata.json',
    'assets/style.css', 'app.mjs']) {
    const source = path.startsWith('logos/') ? path : `site/${path}`;
    assert.deepEqual(await readFile(join(output, path)), await readFile(join(root, source)));
  }
  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(html, /<p>1 \/ 2<\/p>/);
  assert.match(html, /name="source" content=""/);
  assert.doesNotMatch(html, /__(?:CATALOG_JSON|BRAND_COUNT|ASSET_COUNT|SOURCE_COMMIT)__/);
  assert.equal(await readFile(join(output, '.nojekyll'), 'utf8'), '');
});

test('inline catalog JSON cannot close its script element', async (t) => {
  const name = '</script><img src=x onerror="alert(1)">\u2028\u2029';
  const root = await fixture(t, { name });
  await build(root);
  const html = await readFile(join(root, '_site/index.html'), 'utf8');
  const json = html.match(/<script id="catalog" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(json, /[<\u2028\u2029]/);
  assert.match(json, /\\u003c\/script>/);
  assert.equal(JSON.parse(json).brands[0].name, name);
});

test('output asset paths resolve below a repository subpath', async (t) => {
  const root = await fixture(t);
  await build(root);
  const catalog = JSON.parse(await readFile(join(root, '_site/index.json'), 'utf8'));
  for (const asset of catalog.brands[0].assets) {
    const url = new URL(asset.path, 'https://example.com/company-logos/');
    assert.equal(url.pathname, `/company-logos/${asset.path}`);
    await access(join(root, '_site', asset.path));
  }
});

test('rebuild removes stale output without changing repository source files', async (t) => {
  const root = await fixture(t);
  await build(root);
  await writeFile(join(root, '_site/stale.txt'), 'old output');
  const template = await readFile(join(root, 'site/index.html'), 'utf8');
  const metadata = await readFile(join(root, 'logos/example/metadata.json'), 'utf8');
  await build(root);
  await assert.rejects(access(join(root, '_site/stale.txt')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'site/index.html'), 'utf8'), template);
  assert.equal(await readFile(join(root, 'logos/example/metadata.json'), 'utf8'), metadata);
});
