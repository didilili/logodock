import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadCatalog } from '../scripts/lib/catalog.mjs';
import { assetMetadata, brandMetadata, fixtureSvg as svg } from './helpers/catalog-fixtures.mjs';

const grouping = () => import('../src/lib/catalog-artworks.mjs');
const sample = () => ({
  id: 'sample',
  defaultAsset: 'blue.svg',
  assets: [
    { file: 'blue.png', label: 'Blue PNG', color: 'brand', status: 'current' },
    { file: 'blue.svg', label: 'Blue SVG', color: 'brand', status: 'current' },
    { file: 'white.svg', label: 'White SVG', color: 'white', status: 'current' },
    { file: 'blue-other.png', label: 'Blue alternate source', color: 'brand', status: 'current' },
  ],
  artworks: [
    {
      id: 'blue',
      label: '蓝色标识',
      files: ['blue.png', 'blue.svg', 'blue-other.png'],
      defaultAsset: 'blue.svg',
    },
  ],
});

test('only explicitly reviewed files form one visual choice; every file remains available', async () => {
  const { artworkGroups } = await grouping();
  const brand = sample();
  const groups = artworkGroups(brand);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].assets.map((asset) => asset.file),
    ['blue.png', 'blue.svg', 'blue-other.png'],
  );
  assert.equal(groups[0].label, '蓝色标识');
  assert.equal(groups[0].defaultAsset, brand.assets[1]);
  assert.equal(groups[1].id, 'file:white.svg');
  assert.equal(groups[1].defaultAsset, brand.assets[2]);
  const withoutReview = { ...brand, artworks: undefined };
  assert.equal(
    artworkGroups(withoutReview).length,
    4,
    'Similar names/attributes cannot establish artwork identity.',
  );
});

test('file-specific legacy selections resolve to their visual choice without changing the representation', async () => {
  const { selectedArtwork } = await grouping();
  const brand = sample();
  assert.equal(selectedArtwork(brand, 'blue.png').id, 'blue');
  assert.equal(selectedArtwork(brand, brand.assets[3]).id, 'blue');
  assert.equal(selectedArtwork(brand, 'white.svg').id, 'file:white.svg');
  assert.equal(selectedArtwork(brand, 'missing.svg').id, 'blue');
  assert.equal(selectedArtwork(brand).id, 'blue');
});

test('format selection respects reviewed defaults even when one format has multiple sources', async () => {
  const { artworkGroups, preferredArtworkAsset } = await grouping();
  const brand = sample();
  const blue = artworkGroups(brand)[0];
  assert.equal(preferredArtworkAsset(blue).file, 'blue.svg');
  assert.equal(preferredArtworkAsset(blue, 'png').file, 'blue.png');
  assert.equal(
    preferredArtworkAsset(blue, 'WEBP').file,
    'blue.svg',
    'An unavailable format must not invent a file.',
  );
  const officialPreferred = { ...blue, defaultAsset: brand.assets[3] };
  assert.equal(preferredArtworkAsset(officialPreferred, 'PNG').file, 'blue-other.png');
});

test('filtered catalog subsets keep group identity and resolve only available files', async () => {
  const { artworkGroups, selectedArtwork } = await grouping();
  const brand = sample();
  const pngOnly = { ...brand, assets: brand.assets.filter((asset) => asset.file.endsWith('.png')) };
  const groups = artworkGroups(pngOnly);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'blue');
  assert.deepEqual(
    groups[0].assets.map((asset) => asset.file),
    ['blue.png', 'blue-other.png'],
  );
  assert.equal(groups[0].defaultAsset.file, 'blue.png');
  assert.equal(selectedArtwork(pngOnly, 'blue.svg').id, 'blue');
  const singleton = artworkGroups({ ...brand, assets: [brand.assets[3]] })[0];
  assert.equal(
    singleton.id,
    'blue',
    'A format filter must not turn a reviewed group into a different identity.',
  );
  assert.equal(singleton.defaultAsset.file, 'blue-other.png');
});

test('primary choices lead with the brand default while source alternatives remain selectable', async () => {
  const { artworkGroups, primaryArtworkGroups, alternativeArtworkGroups, selectedArtwork } =
    await grouping();
  const brand = sample();
  brand.defaultAsset = 'white.svg';
  brand.assets[0].display = 'alternative';
  brand.assets[3].display = 'alternative';
  brand.assets.push({ file: 'old-source.svg', label: 'Source color', display: 'alternative' });
  assert.deepEqual(
    artworkGroups(brand).map((group) => group.id),
    ['file:white.svg', 'blue', 'file:old-source.svg'],
  );
  assert.deepEqual(
    primaryArtworkGroups(brand).map((group) => group.id),
    ['file:white.svg', 'blue'],
  );
  assert.deepEqual(
    alternativeArtworkGroups(brand).map((group) => group.id),
    ['file:old-source.svg'],
  );
  assert.equal(selectedArtwork(brand, 'old-source.svg').defaultAsset.file, 'old-source.svg');
  const filtered = { ...brand, assets: [brand.assets.at(-1)] };
  assert.equal(primaryArtworkGroups(filtered)[0].defaultAsset.file, 'old-source.svg');
  assert.deepEqual(alternativeArtworkGroups(filtered), []);
});

test('format fallback favors a primary usable file over an earlier low-quality source', async () => {
  const { artworkGroups, preferredArtworkAsset } = await grouping();
  const brand = sample();
  brand.assets[0].display = 'alternative';
  const group = artworkGroups(brand)[0];
  assert.equal(preferredArtworkAsset(group, 'PNG').file, 'blue-other.png');
  const filtered = { ...brand, assets: [brand.assets[0], brand.assets[3]] };
  assert.equal(artworkGroups(filtered)[0].defaultAsset.file, 'blue-other.png');
});

test('a fallback representation favors vector and larger current files without overriding a reviewed default', async () => {
  const { preferredArtworkAsset } = await grouping();
  const files = [
    { file: 'tiny.png', width: 92, height: 44, status: 'current' },
    { file: 'large.png', width: 1535, height: 907, status: 'current' },
    { file: 'art.svg', status: 'current' },
  ];
  const group = { assets: files, defaultAsset: files[2] };
  assert.equal(preferredArtworkAsset(group, 'PNG'), files[1]);
  assert.equal(preferredArtworkAsset({ ...group, defaultAsset: files[0] }, 'PNG'), files[0]);
});

test('grouping leaves source records untouched and allows UI labels for singleton files', async () => {
  const { artworkGroups } = await grouping();
  const brand = sample();
  const snapshot = JSON.stringify(brand);
  Object.freeze(brand.assets);
  Object.freeze(brand.artworks[0].files);
  const groups = artworkGroups(brand, (asset) => asset.label.replace(' SVG', ''));
  assert.equal(groups[1].label, 'White');
  assert.equal(groups[0].label, '蓝色标识');
  assert.equal(JSON.stringify(brand), snapshot);
  assert.equal(groups[0].assets[0], brand.assets[0]);
});

async function fixture(t, change = () => {}) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-artworks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, 'logo/example');
  await mkdir(folder, { recursive: true });
  const assets = ['blue.svg', 'blue-other.svg', 'white.svg'].map((file) =>
    assetMetadata({ file, label: file, color: file === 'white.svg' ? 'white' : 'brand' }),
  );
  const metadata = brandMetadata({
    name: 'Example',
    defaultAsset: 'blue.svg',
    assets,
    artworks: [
      {
        id: 'blue',
        label: '蓝色标识',
        files: ['blue.svg', 'blue-other.svg'],
        defaultAsset: 'blue.svg',
      },
    ],
  });
  change(metadata);
  for (const asset of assets) await writeFile(join(folder, asset.file), svg);
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  return root;
}

test('catalog preserves optional reviewed grouping without altering individual file records', async (t) => {
  const brand = (await loadCatalog(await fixture(t))).brands[0];
  assert.deepEqual(brand.artworks, [
    {
      id: 'blue',
      label: '蓝色标识',
      files: ['blue.svg', 'blue-other.svg'],
      defaultAsset: 'blue.svg',
    },
  ]);
  assert.equal(brand.assets.length, 3);
  assert.equal(brand.assets[0].rights.license, 'Example permission');
  const ungrouped = (
    await loadCatalog(
      await fixture(t, (metadata) => {
        delete metadata.artworks;
      }),
    )
  ).brands[0];
  assert.equal(Object.hasOwn(ungrouped, 'artworks'), false);
});

test('catalog rejects ambiguous or dangling artwork membership and defaults', async (t) => {
  const invalid = [
    (m) => {
      m.artworks = [];
    },
    (m) => {
      m.artworks[0].files = ['blue.svg'];
    },
    (m) => {
      m.artworks[0].files = ['blue.svg', 'blue.svg'];
    },
    (m) => {
      m.artworks[0].files.push('missing.svg');
    },
    (m) => {
      m.artworks[0].defaultAsset = 'white.svg';
    },
    (m) => {
      m.artworks[0].id = 'with space';
    },
    (m) => {
      m.artworks[0].label = ' ';
    },
    (m) => {
      m.artworks[0].unreviewed = true;
    },
    (m) => {
      m.artworks.push({ ...m.artworks[0], files: [...m.artworks[0].files] });
    },
    (m) => {
      m.artworks.push({ ...m.artworks[0], id: 'also-blue', files: [...m.artworks[0].files] });
    },
    ...[
      ['variant', 'logo'],
      ['language', 'en'],
      ['layout', 'horizontal'],
      ['color', 'white'],
      ['status', 'historical'],
    ].map(([key, value]) => (m) => {
      m.assets[1][key] = value;
    }),
  ];
  for (const change of invalid)
    await assert.rejects(loadCatalog(await fixture(t, change)), /Invalid catalog:/);
});

test('reviewed repository keeps distinct artworks after redundant format renditions are removed', async () => {
  const { artworkGroups } = await grouping();
  const brands = Object.fromEntries((await loadCatalog()).brands.map((brand) => [brand.id, brand]));
  const expected = {
    alibaba: 6,
    bytedance: 6,
    codeberg: 6,
    didi: 6,
    iqiyi: 3,
    oppo: 2,
    vivo: 1,
    'trip-com': 2,
    zte: 3,
    tencent: 12,
  };
  for (const [id, count] of Object.entries(expected))
    assert.equal(artworkGroups(brands[id]).length, count, id);
  assert.ok(artworkGroups(brands.tencent).every((group) => group.assets.length === 1));
  const { selectedArtwork, primaryArtworkGroups, alternativeArtworkGroups } = await grouping();
  for (const [id, removed, replacement] of [
    ['meituan', 'logo-chinese.png', 'logo-chinese-official.png'],
    ['trip-com', 'wordmark-color.svg', 'wordmark-white-official.png'],
    ['yonyou', 'wordmark-red.jpg', 'wordmark-red-transparent.png'],
  ]) {
    const brand = brands[id];
    assert.ok(!brand.assets.some((asset) => asset.file === removed));
    assert.equal(selectedArtwork(brand, replacement).defaultAsset.file, replacement);
  }
  assert.equal(
    selectedArtwork(brands.yonyou, 'wordmark-white-transparent.png').defaultAsset.file,
    brands.yonyou.defaultAsset,
  );
  assert.equal(
    selectedArtwork(brands.yonyou, 'wordmark-white.svg').defaultAsset.file,
    'wordmark-white.svg',
  );
  for (const [id, alternativeCount] of [
    ['lenovo', 0],
    ['minimax', 8],
    ['zte', 1],
  ]) {
    const brand = brands[id];
    assert.equal(primaryArtworkGroups(brand)[0].defaultAsset.file, brand.defaultAsset);
    assert.equal(alternativeArtworkGroups(brand).length, alternativeCount, id);
    assert.ok(
      alternativeArtworkGroups(brand).every((group) =>
        group.assets.every((asset) => asset.display === 'alternative'),
      ),
    );
  }
  for (const brand of Object.values(brands)) {
    const files = artworkGroups(brand).flatMap((group) => group.assets.map((asset) => asset.file));
    assert.deepEqual(
      [...files].sort(),
      brand.assets.map((asset) => asset.file).sort(),
      `${brand.id}: every active original remains selectable`,
    );
  }
});
