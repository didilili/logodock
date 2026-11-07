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
