import assert from 'node:assert/strict';
import test from 'node:test';

const presentation = () => import('../src/lib/catalog-presentation.mjs');
const brands = [
  { id: 'z', name: 'Zoo', aliases: ['动物园'], website: 'https://z.example/', entityType: 'company', categories: ['developer-tools'], defaultAsset: 'new.svg', assets: [
    { file: 'old.png', path: 'logos/z/old.png', status: 'historical', label: '旧版图形', background: 'any', variant: 'icon' },
    { file: 'new.svg', path: 'logos/z/new.svg', status: 'current', label: '现行图形', background: 'light', variant: 'icon' },
  ] },
  { id: 'a', name: 'Apple Society', aliases: [], website: 'https://a.example/', entityType: 'organization', categories: [], defaultAsset: 'old.png', assets: [
    { file: 'old.png', path: 'logos/a/old.png', status: 'historical', label: '历史图形', background: 'any', variant: 'icon' },
  ] },
];

test('uses the declared default instead of asset order, including historical-only brands', async () => {
  const { defaultAsset } = await presentation();
  assert.equal(defaultAsset(brands[0]).file, 'new.svg');
  assert.equal(defaultAsset(brands[1]).file, 'old.png');
  assert.equal(defaultAsset(brands[0], 'old.png').file, 'old.png');
  assert.equal(defaultAsset(brands[0], 'unknown').file, 'new.svg');
});

test('generates only available entity and file-format filters', async () => {
  const { filterOptions } = await presentation();
  assert.deepEqual(filterOptions(brands), { types: ['company', 'organization'], formats: ['PNG', 'SVG'] });
});

test('filters by actual file format and entity type while sorting real names', async () => {
  const { matchingBrands, defaultAsset } = await presentation();
  const result = matchingBrands(brands, { type: 'company', format: 'PNG', q: '动物园' });
  assert.deepEqual(result.map((brand) => brand.id), ['z']);
  assert.deepEqual(result[0].assets.map((asset) => asset.file), ['old.png']);
  assert.equal(defaultAsset(result[0]).file, 'old.png');
  assert.deepEqual(matchingBrands(brands, {}).map((brand) => brand.name), ['Apple Society', 'Zoo']);
  assert.equal(brands[0].assets.length, 2);
});

test('directory previews select the matching file while brand-only searches retain the configured default', async () => {
  const { directoryAsset, matchingBrands } = await presentation();
  const before = structuredClone(brands);
  assert.equal(directoryAsset(brands[0], '动物园').file, 'new.svg');
  assert.equal(directoryAsset(brands[0], 'Zoo old.png').file, 'old.png');
  assert.equal(directoryAsset(brands[0], '旧版').file, 'old.png');
  assert.equal(directoryAsset(brands[0], '').file, 'new.svg');
  const filtered = matchingBrands(brands, { format: 'PNG', q: 'Zoo' });
  assert.equal(directoryAsset(filtered[0], 'Zoo').file, 'old.png');
  assert.deepEqual(brands, before, 'Selecting a card preview must not rewrite brand defaults or original assets.');
});

test('restores query, filters, selected brand and selected file from a URL', async () => {
  const { readCatalogState } = await presentation();
  assert.deepEqual(readCatalogState('https://example.com/logodock/?q=动物园&brand=z&asset=old.png&type=company&format=PNG', brands),
    { q: '动物园', type: 'company', format: 'PNG', brandId: 'z', assetFile: 'old.png' });
});

test('unknown URL selections and filters fall back to available content', async () => {
  const { readCatalogState } = await presentation();
  assert.deepEqual(readCatalogState('https://example.com/?type=bad&format=EXE&brand=missing&asset=../x', brands),
    { q: '', type: '', format: '', brandId: 'a', assetFile: 'old.png' });
  const empty = readCatalogState('https://example.com/?q=missing&brand=z', brands);
  assert.equal(empty.brandId, '');
  assert.equal(empty.assetFile, '');
});

test('an asset parameter belongs to its brand and cannot select a different fallback brand version', async () => {
  const { readCatalogState } = await presentation();
  const state = readCatalogState('https://example.com/?brand=missing&asset=old.png', [brands[0]]);
  assert.equal(state.brandId, 'z');
  assert.equal(state.assetFile, 'new.svg');
});

test('share URLs preserve the query and selected asset and round trip safely', async () => {
  const { catalogUrl, readCatalogState } = await presentation();
  const state = { q: '动物园', type: '', format: '', brandId: 'z', assetFile: 'old.png' };
  const url = catalogUrl('https://example.com/logodock/?q=old&brand=a&asset=x&unrelated=1', state);
  assert.equal(new URL(url).pathname, '/logodock/');
  assert.deepEqual(readCatalogState(url, brands), state);
  assert.equal(new URL(url).searchParams.get('unrelated'), '1');
});

test('asset labels come from metadata and history status is not inferred from filenames', async () => {
  const { assetLabel, assetWarnings } = await presentation();
  assert.equal(assetLabel(brands[0].assets[0]), '旧版图形');
  assert.match(assetWarnings({ status: 'historical', file: 'icon.svg', rights: { license: 'CC-BY-NC-SA-4.0' } }).join(' '), /历史.*非商业/);
  assert.equal(assetWarnings({ status: 'current', file: 'icon-legacy.svg', rights: { license: 'MIT' } }).length, 0);
});

test('short version titles retain meaningful differences and leave original metadata intact', async () => {
  const { assetDisplayLabel, assetLabel, assetFormat } = await presentation();
  const cases = [
    ['2022 绿色中英文字标 · SVG（Commons 原件）', '2022 绿色中英文字标'],
    ['绿色中英文文字标识 · PNG（Commons 渲染）', '绿色中英文文字标识'],
    ['官方白色横版组合标识', '官方白色横版组合标识'],
    ['官方黑色竖版组合标识', '官方黑色竖版组合标识'],
    ['旧版图标', '旧版图标'],
    ['Commons 青色字标（非官方标准蓝）', 'Commons 青色字标（非官方标准蓝）'],
    ['中文公司组合标识 · 黑色 SVG 原件', '中文公司组合标识 · 黑色'],
    ['中文公司组合标识 · 白色 SVG 原件', '中文公司组合标识 · 白色'],
    ['蓝色中英文文字标识 · 官方高清透明 PNG', '蓝色中英文文字标识 · 官方高清透明'],
  ];
  for (const [label, expected] of cases) {
    const asset = { label, variant: 'logo' };
    assert.equal(assetDisplayLabel(asset), expected);
    assert.equal(assetLabel(asset), label, 'Original names remain available to alt text and metadata consumers.');
  }
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  for (const brand of (await loadCatalog()).brands) {
    const versions = new Set();
    for (const asset of brand.assets) {
      const label = assetDisplayLabel(asset).trim();
      assert.ok(label, `${brand.id}/${asset.file} still has a version title`);
      const version = `${assetFormat(asset)}: ${label}`;
      assert.ok(!versions.has(version), `${brand.id}/${asset.file} needs a distinct title within the same format`);
      versions.add(version);
    }
  }
});
