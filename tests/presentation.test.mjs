import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sourceInformation } from '../src/lib/catalog-display.mjs';

const presentation = () => import('../src/lib/catalog-presentation.mjs');

test('shared source information keeps distinct licenses and deduplicates matching conditions', () => {
  const entry = {
    label: 'RGB 用稿',
    sourcePage: 'https://example.com/brand/',
    source: 'https://example.com/design.zip',
    rights: {
      status: 'permitted',
      license: 'CC-BY-3.0',
      reference: 'https://example.com/brand/',
      attribution: 'Example designer',
      notes: '保持原始比例。',
    },
  };
  const information = sourceInformation([
    entry,
    {
      ...entry,
      label: 'CMYK 用稿',
      rights: { ...entry.rights, license: 'CC-BY-SA-4.0' },
    },
  ]);
  assert.equal(information.links.length, 2);
  const license = information.links.find((link) => link.url === entry.sourcePage);
  assert.ok(license.primaryLicense);
  assert.deepEqual(license.licenses, [
    { label: 'CC-BY-3.0', files: ['RGB 用稿'] },
    { label: 'CC-BY-SA-4.0', files: ['CMYK 用稿'] },
  ]);
  assert.equal(information.notes.length, 1);
  assert.equal(information.attributions.length, 1);
  const unverified = sourceInformation([
    { ...entry, rights: { ...entry.rights, status: 'unverified', license: '许可未核实' } },
  ]);
  assert.ok(unverified.links.every((link) => !link.primaryLicense));
  assert.doesNotMatch(JSON.stringify(unverified), /许可未核实|许可已确认/);
  const pending = sourceInformation([
    { ...entry, rights: { ...entry.rights, notes: '许可及署名条件待核实。' } },
  ]);
  assert.equal(pending.notes.length, 0);
  const mixed = sourceInformation([
    { ...entry, label: '预览图', rights: { ...entry.rights, status: 'unverified' } },
    entry,
  ]);
  const sharedSource = mixed.links.find((link) => link.url === entry.sourcePage);
  assert.deepEqual(sharedSource.files, ['预览图', 'RGB 用稿']);
  assert.deepEqual(sharedSource.licenses, [{ label: 'CC-BY-3.0', files: ['RGB 用稿'] }]);
});

test('brand detail routes use the singular logo path below the explicit site root', async () => {
  const { brandRoute } = await import('../src/lib/catalog-display.mjs');
  assert.equal(brandRoute({ id: 'jd' }), './logo/jd/');
  assert.equal(brandRoute({ id: 'jd' }, '/logodock/'), '/logodock/logo/jd/');
});

test('directory keeps the reviewed default within the active search, format and shape', async () => {
  const { directoryAsset, matchingBrands, defaultAsset } = await presentation();
  const brand = {
    ...brands[0],
    defaultAsset: 'lockup.svg',
    assets: [
      { file: 'lockup.svg', label: '英文组合', status: 'current', variant: 'logo', aspectRatio: 4 },
      {
        file: 'app.png',
        label: '应用图标',
        status: 'current',
        variant: 'icon',
        width: 512,
        height: 512,
      },
      {
        file: 'white.svg',
        label: '白色图形',
        status: 'current',
        variant: 'icon',
        background: 'dark',
        color: 'white',
        aspectRatio: 1,
      },
      {
        file: 'old.svg',
        label: '旧版图形',
        status: 'historical',
        variant: 'icon',
        color: 'brand',
        aspectRatio: 1,
      },
      {
        file: 'alternative.svg',
        label: '备选图形',
        status: 'current',
        display: 'alternative',
        variant: 'icon',
        color: 'brand',
        aspectRatio: 1,
      },
      {
        file: 'symbol.svg',
        label: '彩色图形',
        status: 'current',
        variant: 'icon',
        color: 'brand',
        aspectRatio: 1,
      },
    ],
  };
  const before = structuredClone(brand);
  assert.equal(directoryAsset(brand).file, 'lockup.svg');
  assert.equal(directoryAsset(brand, '应用').file, 'app.png');
  assert.equal(directoryAsset(brand, '英文').file, 'lockup.svg');
  assert.equal(directoryAsset(matchingBrands([brand], { format: 'PNG' })[0]).file, 'app.png');
  assert.equal(
    directoryAsset(matchingBrands([brand], { shape: 'icon', format: 'SVG', q: '彩色' })[0]).file,
    'symbol.svg',
  );
  assert.equal(
    directoryAsset({ ...brand, assets: [brand.assets[0], brand.assets[3], brand.assets[4]] }).file,
    'lockup.svg',
  );
  assert.equal(defaultAsset(brand).file, 'lockup.svg');
  const grouped = {
    ...brand,
    assets: [brand.assets[0], { ...brand.assets[1], variant: 'logo' }],
    artworks: [
      {
        id: 'same-design',
        label: '同款',
        files: ['lockup.svg', 'app.png'],
        defaultAsset: 'lockup.svg',
      },
    ],
  };
  assert.equal(directoryAsset(grouped).file, 'lockup.svg');
  assert.equal(directoryAsset({ ...grouped, defaultAsset: 'symbol.svg' }).file, 'lockup.svg');
  for (const file of ['old.svg', 'alternative.svg']) {
    assert.equal(directoryAsset({ ...brand, defaultAsset: file }).file, 'lockup.svg');
  }
  assert.equal(directoryAsset(brand, '旧版').file, 'old.svg');
  assert.equal(directoryAsset(brand, '备选').file, 'alternative.svg');
  assert.deepEqual(brand, before);
});

test('directory preview ranges match reviewed originals and stay inside their source canvases', async () => {
  const { directoryPreviewBounds } = await import('../src/lib/catalog-preview.mjs');
  const catalog = JSON.parse(await readFile(new URL('../index.json', import.meta.url), 'utf8'));
  for (const id of ['antgroup', 'baidu', 'nio', 'tencent-music']) {
    const brand = catalog.brands.find((item) => item.id === id);
    const asset = brand.assets.find((item) => item.file === brand.defaultAsset);
    const bounds = directoryPreviewBounds(asset);
    assert.ok(bounds, `${id} still uses the reviewed source SHA-256`);
    assert.ok(bounds.width > 0 && bounds.height > 0);
    assert.ok(bounds.x >= 0 && bounds.y >= 0);
    assert.ok(bounds.x + bounds.width <= bounds.sourceWidth);
    assert.ok(bounds.y + bounds.height <= bounds.sourceHeight);
    if (asset.width && asset.height) {
      assert.equal(bounds.sourceWidth, asset.width);
      assert.equal(bounds.sourceHeight, asset.height);
    } else {
      const svg = await readFile(new URL(`../${asset.path}`, import.meta.url), 'utf8');
      assert.match(svg, new RegExp(`viewBox="0 0 ${bounds.sourceWidth} ${bounds.sourceHeight}"`));
    }
    assert.equal(directoryPreviewBounds({ ...asset, sha256: '0'.repeat(64) }), undefined);
  }
  assert.equal(directoryPreviewBounds({ sha256: '__proto__' }), undefined);
});

test('reviewed directory covers respect matching files and fall back when their source changes', async () => {
  const { directoryAsset, matchingBrands } = await presentation();
  const { brands } = JSON.parse(await readFile(new URL('../index.json', import.meta.url), 'utf8'));
  const covers = {
    xiaomi: 'logo-horizontal-official.svg',
    huawei: 'logo-flat-horizontal-official.svg',
    weibo: 'logo-chinese-horizontal-official.svg',
    'alibaba-cloud': 'logo-chinese-horizontal.svg',
    'ping-an': 'logo-horizontal.svg',
  };
  for (const [id, file] of Object.entries(covers)) {
    const brand = brands.find((item) => item.id === id);
    const before = structuredClone(brand);
    assert.equal(directoryAsset(brand).file, file);
    const changed = {
      ...brand,
      assets: brand.assets.map((asset) =>
        asset.file === file ? { ...asset, sha256: '0'.repeat(64) } : asset,
      ),
    };
    assert.equal(directoryAsset(changed).file, brand.defaultAsset);
    assert.equal(directoryAsset(brand, brand.defaultAsset).file, brand.defaultAsset);
    assert.deepEqual(brand, before);
  }
  const weibo = brands.find((brand) => brand.id === 'weibo');
  assert.equal(
    directoryAsset(matchingBrands([weibo], { format: 'JPG' })[0]).file,
    'icon-appstore.jpg',
  );
  const xiaomi = brands.find((brand) => brand.id === 'xiaomi');
  assert.equal(
    directoryAsset(matchingBrands([xiaomi], { shape: 'icon' })[0]).file,
    'icon-orange-extracted.svg',
  );
});

test('balanced directory sizing uses visible artwork proportions and handles missing dimensions', async () => {
  const { directoryPreviewSize } = await import('../src/lib/catalog-preview.mjs');
  const catalog = JSON.parse(await readFile(new URL('../index.json', import.meta.url), 'utf8'));
  const sizeFor = (id, file) => {
    const brand = catalog.brands.find((item) => item.id === id);
    return directoryPreviewSize(
      brand.assets.find((asset) => asset.file === (file || brand.defaultAsset)),
    );
  };
  assert.deepEqual(sizeFor('haier'), { shape: 'horizontal', width: 156, height: 46 });
  assert.deepEqual(sizeFor('netease'), { shape: 'horizontal', width: 140, height: 56 });
  assert.deepEqual(sizeFor('xiaomi', 'logo-horizontal-official.svg'), {
    shape: 'horizontal',
    width: 156,
    height: 46,
  });
  assert.deepEqual(sizeFor('xiaomi'), { shape: 'symbol', width: 60, height: 60 });
  assert.deepEqual(sizeFor('huawei'), { shape: 'vertical', width: 76, height: 76 });
  assert.deepEqual(sizeFor('tencent-music'), { shape: 'horizontal', width: 140, height: 56 });
  assert.deepEqual(directoryPreviewSize({ variant: 'logo' }), {
    shape: 'horizontal',
    width: 156,
    height: 46,
  });
});

test('extracted symbol labels describe the processing and preserve the original source page', async () => {
  const { sourceLabel, provenanceLabel } = await import('../src/lib/catalog-display.mjs');
  const asset = {
    provenance: {
      sourceType: 'official',
      channel: 'website',
      processing: 'extracted',
      pageTitle: '品牌介绍',
      originalAsset: 'logo.svg',
    },
  };
  assert.equal(sourceLabel(asset), '官网页面用图 · 图形提取版');
  assert.equal(provenanceLabel(asset), '品牌介绍 · 图形提取版');
});

test('source labels use reviewed channels and preserve original or rendered distinctions', async () => {
  const { sourceLabel } = await import('../src/lib/catalog-display.mjs');
  for (const [channel, expected] of [
    ['brand-library', '官方品牌素材下载页'],
    ['repository', '官方仓库'],
    ['website', '官网页面用图'],
    ['app-store', '官方应用商店'],
    ['commons', 'Commons'],
  ]) {
    const sourceType = channel === 'commons' ? 'commons' : 'official';
    assert.equal(
      sourceLabel({ provenance: { sourceType, channel, processing: 'original' } }),
      expected,
    );
    assert.equal(
      sourceLabel({ provenance: { sourceType, channel, processing: 'rendered' } }),
      `${expected} · 渲染图`,
    );
  }
  assert.equal(
    sourceLabel({ provenance: { sourceType: 'official', processing: 'original' } }),
    '官方来源',
  );
  assert.equal(
    sourceLabel({ provenance: { sourceType: 'commons', processing: 'original' } }),
    'Commons',
  );
  assert.equal(sourceLabel({}), '来源');
});

test('website source labels describe reviewed placement and the actual source page', async () => {
  const { sourceLabel, provenanceLabel } = await import('../src/lib/catalog-display.mjs');
  for (const [placement, location] of [
    ['header', '页头 Logo'],
    ['footer', '页脚 Logo'],
  ]) {
    const asset = {
      provenance: {
        sourceType: 'official',
        channel: 'website',
        processing: 'original',
        pageTitle: '小米信任中心',
        placement,
      },
    };
    assert.equal(sourceLabel(asset), `官网${location}`);
    assert.equal(provenanceLabel(asset), `小米信任中心 · ${location} · 原始文件`);
    asset.provenance.processing = 'rendered';
    assert.equal(sourceLabel(asset), `官网${location} · 渲染图`);
    assert.equal(provenanceLabel(asset), `小米信任中心 · ${location} · 渲染文件`);
  }
  assert.equal(
    sourceLabel({ provenance: { sourceType: 'official', channel: 'website' } }),
    '官网页面用图',
  );
  assert.equal(
    provenanceLabel({
      provenance: {
        sourceType: 'official',
        channel: 'brand-library',
        processing: 'original',
        pageTitle: '腾讯媒体资料库',
      },
    }),
    '腾讯媒体资料库 · 原始文件',
  );
});

test('public domain labels identify the distribution assessment while preserving named licenses', async () => {
  const { licenseLabel } = await import('../src/lib/catalog-display.mjs');
  assert.equal(
    licenseLabel({ rights: { status: 'unverified', license: 'Not yet reviewed' } }),
    '许可未核实',
  );
  assert.equal(
    licenseLabel({
      rights: {
        license: 'Public domain (textlogo; third-party assessment)',
        reference: 'https://commons.wikimedia.org/wiki/File:Example.svg',
      },
    }),
    'Commons 公共领域判定',
  );
  assert.equal(
    licenseLabel({
      rights: {
        license: 'Public domain (third-party assessment)',
        reference: 'https://example.com/license',
      },
    }),
    '公共领域（第三方判定）',
  );
  assert.equal(
    licenseLabel({
      rights: { license: 'Public domain', reference: 'https://example.com/license' },
    }),
    '公共领域',
  );
  assert.equal(
    licenseLabel({
      rights: {
        license: 'CC-BY-NC-4.0',
        reference: 'https://commons.wikimedia.org/wiki/File:Example.svg',
      },
    }),
    'CC-BY-NC-4.0',
  );
});
const brands = [
  {
    id: 'z',
    name: 'Zoo',
    aliases: ['动物园'],
    website: 'https://z.example/',
    entityType: 'company',
    categories: ['developer-tools', 'internet'],
    defaultAsset: 'new.svg',
    assets: [
      {
        file: 'old.png',
        path: 'logo/z/old.png',
        status: 'historical',
        label: '旧版图形',
        background: 'any',
        variant: 'icon',
      },
      {
        file: 'new.svg',
        path: 'logo/z/new.svg',
        status: 'current',
        label: '现行图形',
        background: 'light',
        variant: 'icon',
      },
    ],
  },
  {
    id: 'a',
    name: 'Apple Society',
    aliases: [],
    website: 'https://a.example/',
    entityType: 'organization',
    categories: [],
    defaultAsset: 'old.png',
    assets: [
      {
        file: 'old.png',
        path: 'logo/a/old.png',
        status: 'historical',
        label: '历史图形',
        background: 'any',
        variant: 'icon',
      },
    ],
  },
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
  assert.deepEqual(filterOptions(brands), {
    types: ['company', 'organization'],
    formats: ['PNG', 'SVG'],
  });
});

test('industry navigation groups leaves and deduplicates parent counts', async () => {
  const { categoryLabels, categoryOptions, matchingBrands } = await presentation();
  const sample = structuredClone(brands);
  sample[0].categories = ['games', 'social-community'];
  sample[1].categories = ['games', 'consumer-electronics'];
  const before = structuredClone(sample);
  const options = categoryOptions(sample);
  const media = options.find((item) => item.id === 'media');
  assert.equal(categoryLabels['consumer-electronics'], '消费电子');
  assert.equal(media.count, 2);
  assert.deepEqual(
    media.children.map(({ id, count }) => ({ id, count })),
    [
      { id: 'social-community', count: 1 },
      { id: 'games', count: 2 },
    ],
  );
  assert.deepEqual(
    matchingBrands(sample, { category: 'media' }).map((brand) => brand.id),
    ['a', 'z'],
  );
  assert.deepEqual(
    matchingBrands(sample, { category: 'social-community' }).map((brand) => brand.id),
    ['z'],
  );
  assert.deepEqual(categoryOptions([...sample].reverse()), options);
  assert.deepEqual(sample, before);
  assert.deepEqual(categoryOptions([]), [{ id: '', label: '全部品牌', count: 0 }]);
});

test('industry and topic facets keep available entries and intersect real assets', async () => {
  const { categoryOptions, topicOptions, matchingBrands } = await presentation();
  const { filterCategoryOptions } = await import('../src/lib/catalog-taxonomy.mjs');
  const sample = structuredClone(brands);
  sample[0].categories = ['semiconductors'];
  sample[0].topics = ['ai'];
  sample[1].categories = ['developer-tools'];
  sample[1].topics = ['developer-ecosystem'];
  const pool = matchingBrands(sample, { topic: 'ai', format: 'SVG' });
  assert.deepEqual(
    pool.map((brand) => brand.id),
    ['z'],
  );
  const options = categoryOptions(pool, sample);
  assert.equal(options.find((item) => item.id === 'technology').count, 0);
  assert.equal(options.find((item) => item.id === 'electronics').count, 1);
  assert.equal(filterCategoryOptions(options, '芯片')[1].children[0].id, 'semiconductors');
  assert.equal(filterCategoryOptions(options, 'SaaS').length, 1);
  assert.deepEqual(
    topicOptions(pool, sample).map(({ id, count }) => ({ id, count })),
    [
      { id: 'ai', count: 1 },
      { id: 'developer-ecosystem', count: 0 },
    ],
  );
  assert.deepEqual(matchingBrands(sample, { category: 'technology', topic: 'ai' }), []);
});

test('directory URLs preserve industry and topic and canonicalize legacy industry links', async () => {
  const { directoryUrl, readDirectoryState } = await presentation();
  const sample = structuredClone(brands);
  sample[0].categories = ['consumer-electronics'];
  sample[0].topics = ['ai'];
  const state = {
    q: '动物园',
    type: 'company',
    format: 'PNG',
    shape: 'icon',
    category: 'electronics',
    topic: 'ai',
  };
  const url = directoryUrl('https://example.com/logodock/?other=1', state);
  assert.deepEqual(readDirectoryState(url, sample), state);
  assert.equal(url.searchParams.get('other'), '1');
  url.searchParams.set('category', 'hardware');
  assert.deepEqual(readDirectoryState(url, sample), state);
  assert.equal(
    directoryUrl(url, { ...state, category: 'hardware' }).searchParams.get('category'),
    'electronics',
  );
  url.searchParams.set('topic', 'missing-topic');
  assert.deepEqual(readDirectoryState(url, sample), { ...state, topic: '' });
  url.searchParams.set('category', 'removed-category');
  assert.deepEqual(readDirectoryState(url, sample), { ...state, category: '', topic: '' });
});

test('legacy AI category links migrate to the cross-industry topic without losing filters', async () => {
  const { directoryUrl, readDirectoryState, matchingBrands } = await presentation();
  const { brands: catalog } = JSON.parse(
    await readFile(new URL('../index.json', import.meta.url), 'utf8'),
  );
  const url = new URL('https://example.com/?category=ai&q=壁仞&type=company&format=SVG&other=1');
  const state = readDirectoryState(url, catalog);
  assert.deepEqual(state, {
    q: '壁仞',
    type: 'company',
    format: 'SVG',
    shape: '',
    category: '',
    topic: 'ai',
  });
  assert.deepEqual(
    matchingBrands(catalog, state).map((brand) => brand.id),
    ['biren'],
  );
  const canonical = directoryUrl(url, state);
  assert.equal(canonical.searchParams.has('category'), false);
  assert.equal(canonical.searchParams.get('topic'), 'ai');
  assert.equal(canonical.searchParams.get('other'), '1');
  assert.deepEqual(readDirectoryState(canonical, catalog), state);

  const legacy = readDirectoryState('https://example.com/?category=ai', catalog);
  assert.deepEqual(
    matchingBrands(catalog, legacy).map((brand) => brand.id),
    matchingBrands(catalog, { topic: 'ai' }).map((brand) => brand.id),
  );
  url.searchParams.set('topic', 'developer-ecosystem');
  assert.equal(readDirectoryState(url, catalog).topic, 'developer-ecosystem');

  const current = readDirectoryState('https://example.com/?category=ai-products', catalog);
  assert.equal(current.category, 'ai-products');
  assert.equal(current.topic, '');
  assert.ok(
    matchingBrands(catalog, current).every((brand) => brand.categories.includes('ai-products')),
  );
});

test('filters by actual file format and entity type while sorting real names', async () => {
  const { matchingBrands, defaultAsset } = await presentation();
  const result = matchingBrands(brands, { type: 'company', format: 'PNG', q: '动物园' });
  assert.deepEqual(
    result.map((brand) => brand.id),
    ['z'],
  );
  assert.deepEqual(
    result[0].assets.map((asset) => asset.file),
    ['old.png'],
  );
  assert.equal(defaultAsset(result[0]).file, 'old.png');
  assert.deepEqual(
    matchingBrands(brands, {}).map((brand) => brand.name),
    ['Apple Society', 'Zoo'],
  );
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
  assert.deepEqual(
    brands,
    before,
    'Selecting a card preview must not rewrite brand defaults or original assets.',
  );
});

test('asset search terms, category, format and shape intersect on a single real file', async () => {
  const { matchingBrands, directoryAsset, defaultAsset } = await presentation();
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const actual = (await loadCatalog()).brands;
  const alibaba = actual.find((brand) => brand.id === 'alibaba');
  const before = structuredClone(alibaba);
  for (const filters of [
    { q: 'alibaba 中文 svg png' },
    { q: 'alibaba 中文', format: 'SVG', shape: 'icon' },
    { q: 'alibaba', category: 'hardware' },
  ]) {
    assert.deepEqual(matchingBrands(actual, filters), [], JSON.stringify(filters));
  }
  const filters = {
    q: 'alibaba 中文',
    category: 'internet',
    type: 'company',
    format: 'SVG',
    shape: 'wordmark',
  };
  const [chinese] = matchingBrands(actual, filters);
  assert.deepEqual(
    chinese.assets.map((asset) => asset.file),
    ['wordmark-orange-chinese.svg'],
  );
  assert.equal(directoryAsset(chinese, filters.q), chinese.assets[0]);
  assert.equal(defaultAsset(chinese), chinese.assets[0]);
  for (const pngFilters of [{ q: 'alibaba 中文 png' }, { q: 'alibaba 中文', format: 'PNG' }]) {
    const [png] = matchingBrands(actual, pngFilters);
    assert.deepEqual(
      png.assets.map((asset) => asset.file),
      ['logo-chinese-horizontal-official.png', 'logo-chinese-vertical-official.png'],
    );
    assert.equal(directoryAsset(png, pngFilters.q).file, 'logo-chinese-horizontal-official.png');
  }
  assert.deepEqual(alibaba, before);
});

test('filtering out a brand default still selects the reviewed default of a matching artwork', async () => {
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const { matchingBrands, directoryAsset, defaultAsset } = await presentation();
  const catalog = (await loadCatalog()).brands;
  const query = 'codeberg 图标 白色';
  const [white] = matchingBrands(catalog, { q: query });
  assert.equal(directoryAsset(white, query).file, 'icon-white.svg');
  assert.equal(defaultAsset(white).file, 'icon-white.svg');
  assert.deepEqual(matchingBrands(catalog, { q: query, format: 'PNG' }), []);
  assert.deepEqual(matchingBrands(catalog, { q: 'ZTE 青色' }), []);
});

test('small horizontal bitmaps warn even when their long edge exceeds 256 pixels', async () => {
  const { assetWarnings } = await presentation();
  assert.ok(
    assetWarnings({ file: 'wordmark.png', width: 302, height: 92 }).includes(
      '低分辨率原图，请留意实际像素尺寸',
    ),
  );
  assert.ok(
    !assetWarnings({ file: 'wordmark.png', width: 1280, height: 203 }).includes(
      '低分辨率原图，请留意实际像素尺寸',
    ),
  );
});

test('directory URL state round-trips with query and filters and rejects absent categories', async () => {
  const { directoryUrl, readDirectoryState } = await presentation();
  const directory = {
    q: '动物园 旧版',
    category: 'developer-tools',
    topic: '',
    type: 'company',
    format: 'PNG',
    shape: 'icon',
  };
  const url = directoryUrl('https://example.com/logodock/?category=internet&other=1', directory);
  assert.deepEqual(readDirectoryState(url, brands), directory);
  assert.equal(url.searchParams.get('other'), '1');
  for (const category of ['', 'not-a-category']) {
    const invalid = new URL(url);
    invalid.searchParams.set('category', category);
    assert.deepEqual(readDirectoryState(invalid, brands), { ...directory, category: '' });
    assert.equal(
      directoryUrl(url, { ...directory, category }).searchParams.has('category'),
      Boolean(category),
    );
  }
});

test('asset labels come from metadata and history status is not inferred from filenames', async () => {
  const { assetLabel, assetWarnings } = await presentation();
  assert.equal(assetLabel(brands[0].assets[0]), '旧版图形');
  assert.match(
    assetWarnings({
      status: 'historical',
      file: 'icon.svg',
      rights: { license: 'CC-BY-NC-SA-4.0' },
    }).join(' '),
    /历史.*非商业/,
  );
  assert.equal(
    assetWarnings({ status: 'current', file: 'icon-legacy.svg', rights: { license: 'MIT' } })
      .length,
    0,
  );
});

test('ordinary file descriptions and alternative status do not become usage warnings', async () => {
  const { assetWarnings } = await presentation();
  assert.deepEqual(
    assetWarnings({
      file: 'icon.svg',
      display: 'alternative',
      qualityNotes: ['透明背景。', '保留原始留白。'],
    }),
    [],
  );
  assert.deepEqual(
    assetWarnings({
      file: 'icon.svg',
      qualityNotes: ['透明背景。'],
      usageWarnings: ['配色与品牌标准色存在差异。', '配色与品牌标准色存在差异。'],
    }),
    ['配色与品牌标准色存在差异。'],
  );
});

test('usage warnings keep the first occurrence when metadata already warns about low resolution', async () => {
  const { assetWarnings } = await presentation();
  assert.deepEqual(
    assetWarnings({
      status: 'historical',
      file: 'icon.png',
      width: 128,
      height: 64,
      rights: { license: 'CC-BY-NC-SA-4.0' },
      qualityNotes: ['原图含白色背景'],
      usageWarnings: [
        '低分辨率原图，请留意实际像素尺寸',
        '原图边缘存在裁切',
        '历史素材，不代表现行标识',
        '仅限非商业用途',
      ],
    }),
    [
      '历史素材，不代表现行标识',
      '仅限非商业用途',
      '低分辨率原图，请留意实际像素尺寸',
      '原图边缘存在裁切',
    ],
  );
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
    ['橙色图形与英文横版组合 · SVG（官方原件）', '橙色图形与英文横版组合'],
    ['蓝色中英文文字标识 · 官方高清透明 PNG', '蓝色中英文文字标识 · 高清透明'],
    ['红色英文字标（官方透明 PNG）', '红色英文字标（透明）'],
    ['白色英文字标（官方 SVG）', '白色英文字标'],
    ['红底白字标识 · 官方 Brand World PNG 原件', '红底白字标识'],
    ['标准红标识 · 官方官网 SVG 原件', '标准红标识'],
    ['标准蓝文字标识 · 官方官网页头 PNG', '标准蓝文字标识'],
    ['蓝色文字标识 · 官方素材包透明 PNG', '蓝色文字标识 · 透明'],
    ['圆角文字标识 · Commons 青色版本', '圆角文字标识 · 青色版本'],
    ['文字标识（品牌规范中的 SVG 示例）', '文字标识（品牌规范中的 SVG 示例）'],
    ['文字标识 · 品牌规范附注', '文字标识 · 品牌规范附注'],
  ];
  for (const [label, expected] of cases) {
    const asset = { label, variant: 'logo' };
    assert.equal(assetDisplayLabel(asset), expected);
    assert.equal(
      assetLabel(asset),
      label,
      'Original names remain available to alt text and metadata consumers.',
    );
  }
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  for (const brand of (await loadCatalog()).brands) {
    const versions = new Set();
    for (const asset of brand.assets) {
      const label = assetDisplayLabel(asset).trim();
      assert.ok(label, `${brand.id}/${asset.file} still has a version title`);
      const version = `${assetFormat(asset)}: ${label}`;
      assert.ok(
        !versions.has(version),
        `${brand.id}/${asset.file} needs a distinct title within the same format`,
      );
      versions.add(version);
    }
  }
});
