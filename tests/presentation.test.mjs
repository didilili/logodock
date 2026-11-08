import assert from 'node:assert/strict';
import test from 'node:test';

const presentation = () => import('../src/lib/catalog-presentation.mjs');
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
        path: 'logos/z/old.png',
        status: 'historical',
        label: '旧版图形',
        background: 'any',
        variant: 'icon',
      },
      {
        file: 'new.svg',
        path: 'logos/z/new.svg',
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
        path: 'logos/a/old.png',
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

test('category options use actual memberships and the eight declared Chinese labels', async () => {
  const { categoryLabels, categoryOptions } = await presentation();
  assert.deepEqual(categoryLabels, {
    internet: '互联网',
    'code-hosting': '代码托管',
    'developer-tools': '开发工具',
    hardware: '硬件与设备',
    telecommunications: '通信',
    ai: '人工智能',
    'enterprise-software': '企业软件',
    software: '软件与服务',
  });
  assert.deepEqual(categoryOptions(brands), [
    { id: '', label: '全部品牌', count: 2 },
    { id: 'internet', label: '互联网', count: 1 },
    { id: 'developer-tools', label: '开发工具', count: 1 },
  ]);
  assert.deepEqual(categoryOptions([]), [{ id: '', label: '全部品牌', count: 0 }]);
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
  const { artworkGroups } = await import('../src/lib/catalog-artworks.mjs');
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const actual = (await loadCatalog()).brands;
  const alibaba = actual.find((brand) => brand.id === 'alibaba');
  const before = structuredClone(alibaba);
  for (const filters of [
    { q: 'alibaba 中文 png' },
    { q: 'alibaba 中文', format: 'PNG' },
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
  const [englishPng] = matchingBrands(actual, { ...filters, q: 'alibaba', format: 'PNG' });
  assert.deepEqual(
    englishPng.assets.map((asset) => asset.file),
    ['wordmark-orange.png'],
  );
  assert.equal(
    englishPng.artworks,
    alibaba.artworks,
    'Reviewed artwork declarations are preserved.',
  );
  assert.deepEqual(
    artworkGroups(englishPng).map((group) => group.assets.map((asset) => asset.file)),
    [['wordmark-orange.png']],
    'Grouping intersects the eligible files instead of recovering a filtered SVG.',
  );
  assert.deepEqual(alibaba, before);
});

test('restores query, filters, selected brand and selected file from a URL', async () => {
  const { readCatalogState } = await presentation();
  assert.deepEqual(
    readCatalogState(
      'https://example.com/logodock/?q=动物园&brand=z&asset=old.png&type=company&format=PNG',
      brands,
    ),
    {
      q: '动物园',
      type: 'company',
      format: 'PNG',
      category: '',
      brandId: 'z',
      assetFile: 'old.png',
    },
  );
});

test('unknown URL selections and filters fall back to available content', async () => {
  const { readCatalogState } = await presentation();
  assert.deepEqual(
    readCatalogState('https://example.com/?type=bad&format=EXE&brand=missing&asset=../x', brands),
    { q: '', type: '', format: '', category: '', brandId: 'a', assetFile: 'old.png' },
  );
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
  const state = {
    q: '动物园',
    type: '',
    format: '',
    category: '',
    brandId: 'z',
    assetFile: 'old.png',
  };
  const url = catalogUrl('https://example.com/logodock/?q=old&brand=a&asset=x&unrelated=1', state);
  assert.equal(new URL(url).pathname, '/logodock/');
  assert.deepEqual(readCatalogState(url, brands), state);
  assert.equal(new URL(url).searchParams.get('unrelated'), '1');
});

test('category URL state round-trips with query and legacy filters and rejects unknown categories', async () => {
  const { directoryUrl, readDirectoryState, catalogUrl, readCatalogState } = await presentation();
  const directory = {
    q: '动物园 旧版',
    category: 'developer-tools',
    type: 'company',
    format: 'PNG',
    shape: 'icon',
  };
  const url = directoryUrl('https://example.com/logodock/?category=internet&other=1', directory);
  assert.deepEqual(readDirectoryState(url, brands), directory);
  assert.equal(url.searchParams.get('other'), '1');
  const catalog = { ...directory, brandId: 'z', assetFile: 'old.png' };
  assert.deepEqual(readCatalogState(catalogUrl(url, catalog), brands), catalog);
  assert.equal(
    readCatalogState(new URL(`${url}&brand=z&asset=new.svg`), brands).assetFile,
    'old.png',
    'A shared selection cannot recover a file excluded by the active query and filters.',
  );
  for (const category of ['', 'not-a-category']) {
    const invalid = new URL(url);
    invalid.searchParams.set('category', category);
    assert.deepEqual(readDirectoryState(invalid, brands), { ...directory, category: '' });
    assert.equal(directoryUrl(url, { ...directory, category }).searchParams.has('category'), false);
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

test('asset warnings keep the first occurrence when metadata already warns about low resolution', async () => {
  const { assetWarnings } = await presentation();
  assert.deepEqual(
    assetWarnings({
      status: 'historical',
      file: 'icon.png',
      width: 128,
      height: 64,
      rights: { license: 'CC-BY-NC-SA-4.0' },
      qualityNotes: [
        '原图含白色背景',
        '低分辨率原图，请留意实际像素尺寸',
        '原图边缘存在裁切',
        '历史素材，不代表现行标识',
        '仅限非商业用途',
        '原图含白色背景',
      ],
    }),
    [
      '历史素材，不代表现行标识',
      '仅限非商业用途',
      '原图含白色背景',
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
