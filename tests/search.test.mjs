import assert from 'node:assert/strict';
import test from 'node:test';
import * as search from '../src/lib/catalog-search.mjs';

const brands = [
  {
    id: 'z-first',
    name: 'Alpha',
    aliases: ['阿尔法', 'AF'],
    website: 'https://www.alpha.example/',
    assets: [{ file: 'icon.svg', rights: { license: 'MIT' } }],
  },
  {
    id: 'a-last',
    name: 'Zulu',
    aliases: [],
    website: 'https://zulu.example/',
    assets: [{ file: 'alpha.png', rights: { license: 'Alpha terms' } }],
  },
];

test('searches Chinese aliases, abbreviations and website domains', () => {
  for (const query of ['阿尔法', 'ＡＦ', 'alpha.example', 'WWW.ALPHA.EXAMPLE', 'af svg mit']) {
    assert.deepEqual(search.filterBrands(brands, query), [brands[0]]);
  }
});

test('ranks name and alias matches ahead of filenames and licenses', () => {
  assert.deepEqual(search.filterBrands([...brands].reverse(), 'alpha'), brands);
});

test('sorts by actual names without changing the original catalog', () => {
  const input = [...brands].reverse();
  assert.deepEqual(search.sortBrands(input), brands);
  assert.deepEqual(input, [...brands].reverse());
});

test('searches verified bilingual identity and legal names even without aliases', () => {
  const huawei = {
    ...brands[0],
    id: 'huawei',
    name: '华为',
    aliases: [],
    identity: {
      nameZh: '华为',
      nameEn: 'Huawei',
      legalNames: [{ name: 'Huawei Investment & Holding Co., Ltd.' }],
    },
  };
  for (const query of ['Huawei Investment', '华为', 'HUAWEI', 'holding'])
    assert.deepEqual(search.filterBrands([huawei], query), [huawei]);
  assert.deepEqual(search.filterBrands([huawei], 'not-a-company'), []);
});

test('file-specific search terms must match one file while brand terms remain shared', () => {
  const brand = {
    ...brands[0],
    assets: [
      { file: 'chinese.svg', label: '中文文字标识', rights: { license: 'MIT' } },
      { file: 'english.png', label: '英文文字标识', rights: { license: 'CC-BY-4.0' } },
    ],
  };
  for (const query of ['阿尔法 中文 svg', 'alpha.example 英文 png', 'ＡＦ 中文 mit'])
    assert.deepEqual(search.filterBrands([brand], query), [brand]);
  for (const query of ['阿尔法 中文 png', 'alpha 中文 cc-by', 'alpha 英文 mit'])
    assert.deepEqual(search.filterBrands([brand], query), [], query);
});

test('concise labels keep provenance and file descriptions searchable on the same file', () => {
  const brand = {
    ...brands[0],
    assets: [
      {
        file: 'english.svg',
        label: '英文',
        provenance: { sourceType: 'official', processing: 'original' },
        qualityNotes: ['透明背景，画布含留白。'],
      },
      {
        file: 'english.png',
        label: '英文',
        provenance: { sourceType: 'commons', processing: 'rendered' },
      },
    ],
  };
  const before = structuredClone(brand);
  for (const query of ['阿尔法 官方 原件', 'AF official original', 'alpha 透明 留白'])
    assert.deepEqual(search.matchingAssets(brand, query), [brand.assets[0]], query);
  for (const query of ['阿尔法 Commons 渲染', 'alpha commons rendered'])
    assert.deepEqual(search.matchingAssets(brand, query), [brand.assets[1]], query);
  assert.deepEqual(search.matchingAssets(brand, 'alpha 官方 png'), []);
  assert.deepEqual(search.matchingAssets(brand, 'alpha Commons 留白'), []);
  assert.deepEqual(brand, before);
});

test('positive transparency queries exclude negated descriptions and preserve other terms', () => {
  const brand = {
    ...brands[0],
    assets: [
      { file: 'clear.png', qualityNotes: ['透明背景，画布含留白。'] },
      { file: 'white.jpg', qualityNotes: ['不透明白底，画布含留白。'] },
      { file: 'red.png', qualityNotes: ['非透明背景，红底。'] },
    ],
  };
  const before = structuredClone(brand);
  for (const query of ['alpha 透明', 'alpha 透明背景', 'alpha 透明 留白'])
    assert.deepEqual(search.matchingAssets(brand, query), [brand.assets[0]], query);
  for (const query of ['alpha 不透明', 'alpha 不透明白底', 'alpha 白底'])
    assert.deepEqual(search.matchingAssets(brand, query), [brand.assets[1]], query);
  for (const query of ['alpha 非透明', 'alpha 非透明背景', 'alpha 红底'])
    assert.deepEqual(search.matchingAssets(brand, query), [brand.assets[2]], query);
  assert.deepEqual(search.matchingAssets(brand, 'alpha 透明 jpg'), []);
  assert.deepEqual(brand, before);
});

test('catalog transparency searches return the matching downloadable files', async () => {
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const { matchingBrands } = await import('../src/lib/catalog-presentation.mjs');
  const { brands: catalog } = await loadCatalog();
  for (const query of ['金蝶 透明', '小红书 透明', '快手 透明 jpg'])
    assert.deepEqual(matchingBrands(catalog, { q: query }), [], query);
  for (const [query, files] of [
    ['快手 透明', ['icon-orange-official.png']],
    ['快手 不透明', ['logo-english-official.jpg']],
    ['金蝶 不透明 白底', ['logo-color-english.jpg']],
    ['小红书 红底', ['wordmark-square-appstore.jpg']],
  ]) {
    const matches = matchingBrands(catalog, { q: query });
    assert.equal(matches.length, 1, query);
    assert.deepEqual(
      matches[0].assets.map((asset) => asset.file),
      files,
      query,
    );
  }
});

test('shortened catalog labels preserve language, shape, layout and color searches', async () => {
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const { brands: catalog } = await loadCatalog();
  for (const [id, query, count] of [
    ['tencent', '腾讯 中英', 3],
    ['tencent', '腾讯 英文', 3],
    ['yonyou', '用友 英文', 2],
    ['alibaba', '阿里巴巴 橙色', 2],
    ['codeberg', 'codeberg 图标 白色', 1],
    ['minimax', 'minimax 竖版', 1],
  ]) {
    const brand = catalog.find((item) => item.id === id);
    assert.equal(search.matchingAssets(brand, query).length, count, query);
  }
  const alibaba = catalog.find((item) => item.id === 'alibaba');
  assert.deepEqual(search.matchingAssets(alibaba, '阿里巴巴 中文 png'), []);
});
