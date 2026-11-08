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
