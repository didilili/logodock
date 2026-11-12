import assert from 'node:assert/strict';
import test from 'node:test';
import { assetMetadata, brandMetadata } from './helpers/catalog-fixtures.mjs';
import {
  assetDisplayLabel,
  matchingBrands,
  readDirectoryState,
  directoryUrl,
} from '../src/lib/catalog-presentation.mjs';

test('display titles name composition and language while layout stays in supporting attributes', async () => {
  assert.equal(
    assetDisplayLabel(
      assetMetadata({
        variant: 'logo',
        language: 'zh',
        layout: 'horizontal',
        label: '页头小尺寸组合',
      }),
    ),
    '中文组合标',
  );
  assert.equal(
    assetDisplayLabel(
      assetMetadata({ variant: 'wordmark', language: 'bilingual', layout: 'vertical' }),
    ),
    '中英双语字标',
  );
  assert.equal(assetDisplayLabel(assetMetadata()), '图形标');
  assert.equal(assetDisplayLabel(assetMetadata({ language: 'en' })), '图形标');
  assert.equal(
    assetDisplayLabel(
      assetMetadata({
        usage: 'app-icon',
        variant: 'wordmark',
        language: 'zh',
        label: '圆角应用字标',
      }),
    ),
    '应用图标',
  );
});

test('manual details retain background, slogan and alignment differences without repeated structure', async () => {
  const { assetDetailLabel, assetAttributes, assetDownloadName } =
    await import('../src/lib/asset-taxonomy.mjs');
  const asset = assetMetadata({
    file: 'original.svg',
    variant: 'logo',
    language: 'en',
    layout: 'horizontal',
    color: 'black',
    label: '官方黑色英文横版组合标识 · 居中对齐（含口号）',
  });
  assert.equal(assetDetailLabel(asset), '居中对齐（含口号）');
  assert.equal(assetDetailLabel({ ...asset, label: '红底白字英文组合' }), '红底白字');
  assert.equal(assetDetailLabel({ ...asset, label: '白底黑字英文组合' }), '白底黑字');
  assert.equal(assetDetailLabel({ ...asset, label: '官方黑色英文横版组合标识' }), '');
  assert.equal(assetDetailLabel({ ...asset, label: '英文横向排列组合标' }), '');
  assert.equal(assetDetailLabel({ ...asset, label: '黑色中英文字' }), '');
  assert.equal(assetDetailLabel({ ...asset, label: '蓝色英文及口号' }), '蓝色含口号');
  assert.equal(
    assetDetailLabel({ ...asset, label: '黑底白字·英文口号居中' }),
    '黑底白字·英文口号居中',
  );
  assert.equal(
    assetDetailLabel({ ...asset, label: '黑底白字·中文口号居中' }),
    '黑底白字·中文口号居中',
  );
  assert.equal(assetAttributes(asset), '横向 · 黑色');
  assert.equal(
    assetDownloadName({ id: 'example' }, asset),
    'example-logo-en-horizontal-black-居中对齐-含口号.svg',
  );
});

test('complete descriptions retain layout and meaningful differences for images and references', async () => {
  const taxonomy = await import('../src/lib/asset-taxonomy.mjs');
  assert.equal(typeof taxonomy.assetDescription, 'function');
  const asset = assetMetadata({
    variant: 'logo',
    language: 'zh',
    layout: 'horizontal',
    label: '中文横版组合标',
  });
  assert.equal(taxonomy.assetDescription(asset), '中文组合标 · 横向');
  assert.equal(
    taxonomy.assetDescription({ ...asset, layout: 'vertical', label: '中文上下排列组合标' }),
    '中文组合标 · 上下排列',
  );
  assert.equal(
    taxonomy.assetDescription({ ...asset, label: '中文横版组合标（含口号）' }),
    '中文组合标 · 横向 · （含口号）',
  );
  assert.equal(taxonomy.assetAttributes(assetMetadata({ language: 'en' })), '含英文字母 · 品牌色');
  assert.equal(
    taxonomy.assetAttributes(
      assetMetadata({ usage: 'app-icon', variant: 'wordmark', language: 'zh' }),
    ),
    '中文 · 字标 · 品牌色',
  );
});

const facetBrand = () =>
  brandMetadata({
    assets: [
      assetMetadata({ file: 'symbol.svg' }),
      assetMetadata({ file: 'letter.svg', language: 'en' }),
      assetMetadata({ file: 'app.png', usage: 'app-icon', variant: 'wordmark', language: 'zh' }),
      assetMetadata({
        file: 'horizontal.svg',
        variant: 'logo',
        language: 'bilingual',
        layout: 'horizontal',
        color: 'white',
      }),
      assetMetadata({
        file: 'old.svg',
        variant: 'logo',
        language: 'zh',
        layout: 'vertical',
        color: 'black',
        status: 'historical',
      }),
    ],
  });

test('new asset facets intersect on one downloadable file and pure symbols exclude letter symbols', () => {
  const brand = facetBrand();
  assert.deepEqual(
    matchingBrands([brand], { shape: 'pure-icon' }).flatMap((item) =>
      item.assets.map((asset) => asset.file),
    ),
    ['symbol.svg'],
  );
  assert.deepEqual(
    matchingBrands([brand], { usage: 'app-icon', language: 'zh', format: 'PNG' })[0].assets.map(
      (asset) => asset.file,
    ),
    ['app.png'],
  );
  assert.deepEqual(matchingBrands([brand], { layout: 'horizontal', language: 'zh' }), []);
  assert.deepEqual(
    matchingBrands([brand], {
      layout: 'horizontal',
      language: 'bilingual',
      color: 'white',
      status: 'current',
    })[0].assets.map((asset) => asset.file),
    ['horizontal.svg'],
  );
  assert.deepEqual(
    matchingBrands([brand], {
      layout: 'vertical',
      color: 'black',
      status: 'historical',
    })[0].assets.map((asset) => asset.file),
    ['old.svg'],
  );
  assert.deepEqual(matchingBrands([brand], { usage: 'app-icon', shape: 'pure-icon' }), []);
  assert.equal(matchingBrands([brand], { shape: 'icon' })[0].assets.length, 2);
});

test('directory URLs round-trip every facet and validate values against the shared vocabulary', () => {
  const state = {
    q: '',
    category: '',
    topic: '',
    type: '',
    format: '',
    shape: 'pure-icon',
    usage: 'app-icon',
    layout: 'standalone',
    language: 'none',
    color: 'brand',
    status: 'current',
  };
  const url = directoryUrl('https://example.com/?other=keep', state);
  assert.deepEqual(readDirectoryState(url, [facetBrand()]), state);
  assert.equal(url.searchParams.get('other'), 'keep');
  url.searchParams.set('language', 'fr');
  url.searchParams.set('usage', 'avatar');
  assert.deepEqual(readDirectoryState(url, [facetBrand()]), { ...state, language: '', usage: '' });
});

test('search finds structured app usage without inferring it from an app-store source', async () => {
  const { matchingAssets } = await import('../src/lib/catalog-search.mjs');
  const actualApp = assetMetadata({ file: 'rounded.svg', usage: 'app-icon', label: '圆角版本' });
  const sourceOnly = assetMetadata({
    file: 'ordinary.svg',
    provenance: { sourceType: 'official', processing: 'original', channel: 'app-store' },
  });
  const brand = brandMetadata({ assets: [actualApp, sourceOnly] });
  assert.deepEqual(matchingAssets(brand, '应用图标'), [actualApp]);
});
