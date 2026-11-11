import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sortCatalogBrands, matchingBrands } from '../src/lib/catalog-presentation.mjs';

const brands = [
  { id: 'unknown-z', name: 'Zulu' },
  { id: 'yonyou', name: '用友' },
  { id: 'baidu', name: '百度' },
  { id: 'tencent', name: '腾讯' },
  { id: 'kingdee', name: '金蝶' },
  { id: 'huawei', name: '华为' },
  { id: 'constructor', name: 'alpha' },
  { id: '__proto__', name: 'Alpha' },
];

test('directory prioritizes reviewed brand groups with name and ID fallbacks without mutation', () => {
  const before = structuredClone(brands);
  assert.deepEqual(
    sortCatalogBrands(brands).map((brand) => brand.id),
    ['huawei', 'tencent', 'baidu', 'kingdee', 'yonyou', '__proto__', 'constructor', 'unknown-z'],
  );
  assert.deepEqual(brands, before);
  assert.deepEqual(sortCatalogBrands([]), []);
});

test('category, entity, format and shape filters retain directory priority', () => {
  const input = brands.map((brand) => ({
    ...brand,
    entityType: brand.id.startsWith('unknown') ? 'organization' : 'company',
    categories: [brand.id === 'huawei' ? 'hardware' : 'internet'],
    assets: [
      { file: 'logo.png', variant: 'logo' },
      { file: 'icon.svg', variant: 'icon' },
    ],
  }));
  const before = structuredClone(input);
  const matches = matchingBrands(input, {
    category: 'internet',
    type: 'company',
    format: 'PNG',
    shape: 'logo',
  });
  assert.deepEqual(
    matches.map((brand) => brand.id),
    ['tencent', 'baidu', 'kingdee', 'yonyou', '__proto__', 'constructor'],
  );
  assert.ok(matches.every((brand) => brand.assets.length === 1));
  assert.deepEqual(input, before);
});

test('search relevance leads directory priority and equal scores retain it', () => {
  const input = [
    {
      id: 'tencent',
      name: '腾讯',
      aliases: ['共同'],
      assets: [{ file: 'logo.svg', label: '目标' }],
    },
    {
      id: 'kingdee',
      name: '金蝶',
      aliases: ['共同', '目标'],
      assets: [{ file: 'logo.svg' }],
    },
  ];
  assert.deepEqual(
    matchingBrands(input, { q: '目标' }).map((brand) => brand.id),
    ['kingdee', 'tencent'],
  );
  assert.deepEqual(
    matchingBrands(input, { q: '共同' }).map((brand) => brand.id),
    ['tencent', 'kingdee'],
  );
});

test('every current catalog brand has one reviewed priority', async () => {
  const { brandPriorities } = await import('../src/lib/catalog-order.mjs');
  const catalog = JSON.parse(await readFile(new URL('../index.json', import.meta.url), 'utf8'));
  assert.deepEqual(
    [...brandPriorities.keys()].sort(),
    catalog.brands.map((brand) => brand.id).sort(),
  );
  assert.ok([...brandPriorities.values()].every((priority) => Number.isInteger(priority)));
});
