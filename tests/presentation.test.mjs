import assert from 'node:assert/strict';
import test from 'node:test';

const presentation = () => import('../src/lib/catalog-presentation.mjs');

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

test('category options use actual memberships and the declared Chinese labels', async () => {
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
    automotive: '汽车',
    'e-commerce': '电子商务',
    entertainment: '娱乐',
    'industrial-automation': '工业自动化',
    'social-media': '社交媒体',
  });
  assert.deepEqual(categoryOptions(brands), [
    { id: '', label: '全部品牌', count: 2 },
    { id: 'internet', label: '互联网', count: 1 },
    { id: 'developer-tools', label: '开发工具', count: 1 },
  ]);
  assert.deepEqual(categoryOptions([]), [{ id: '', label: '全部品牌', count: 0 }]);
});

test('custom categories stay visible, count each brand once and filter exact memberships', async () => {
  const { categoryOptions, matchingBrands } = await presentation();
  const custom = structuredClone(brands);
  custom[0].categories = ['internet', '设计 & 工具', 'Developer tools', '设计 & 工具'];
  custom[1].categories = ['设计 & 工具', 'constructor'];
  const before = structuredClone(custom);
  assert.deepEqual(categoryOptions(custom), [
    { id: '', label: '全部品牌', count: 2 },
    { id: 'internet', label: '互联网', count: 1 },
    { id: 'Developer tools', label: 'Developer tools', count: 1 },
    { id: 'constructor', label: 'constructor', count: 1 },
    { id: '设计 & 工具', label: '设计 & 工具', count: 2 },
  ]);
  assert.deepEqual(
    categoryOptions([...custom].reverse()),
    categoryOptions(custom),
    'Category ordering must not depend on the brand order.',
  );
  assert.deepEqual(
    matchingBrands(custom, { category: 'Developer tools' }).map((brand) => brand.id),
    ['z'],
  );
  assert.deepEqual(
    matchingBrands(custom, { category: '设计 & 工具' }).map((brand) => brand.id),
    ['a', 'z'],
  );
  assert.deepEqual(matchingBrands(custom, { category: 'unregistered' }), []);
  assert.deepEqual(custom, before);
});

test('directory URLs round-trip custom categories and reject categories absent from the catalog on read', async () => {
  const { directoryUrl, readDirectoryState } = await presentation();
  const custom = structuredClone(brands);
  custom[0].categories = ['设计 & 工具'];
  const state = {
    q: '动物园',
    type: 'company',
    format: 'PNG',
    shape: 'icon',
    category: '设计 & 工具',
  };
  const url = directoryUrl('https://example.com/logodock/?other=1', state);
  assert.equal(url.searchParams.get('category'), '设计 & 工具');
  assert.equal(url.searchParams.get('other'), '1');
  assert.deepEqual(readDirectoryState(url, custom), state);
  const stale = directoryUrl(url, { ...state, category: 'removed-category' });
  assert.deepEqual(readDirectoryState(stale, custom), { ...state, category: '' });
  assert.equal(directoryUrl(url, { ...state, category: '' }).searchParams.has('category'), false);
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

test('filtering out a brand default still selects the reviewed default of a matching artwork', async () => {
  const { loadCatalog } = await import('../scripts/lib/catalog.mjs');
  const { matchingBrands, directoryAsset, defaultAsset } = await presentation();
  const catalog = (await loadCatalog()).brands;
  const query = 'codeberg 图标 白色';
  const [white] = matchingBrands(catalog, { q: query });
  assert.equal(directoryAsset(white, query).file, 'icon-white.svg');
  assert.equal(defaultAsset(white).file, 'icon-white.svg');
  const [png] = matchingBrands(catalog, { q: query, format: 'PNG' });
  assert.equal(directoryAsset(png, query).file, 'icon-white.png');
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
