import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadCatalog } from '../scripts/lib/catalog.mjs';
import {
  assetMetadata,
  brandMetadata,
  fixtureSvg as svg,
  fixtureWebsite as url,
  fixtureReviewDate as date,
} from './helpers/catalog-fixtures.mjs';

async function fixture(t, change = () => {}, data = Buffer.from(svg), file = 'icon.svg') {
  const root = await mkdtemp(join(tmpdir(), 'logodock-identity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, 'logo/example');
  await mkdir(folder, { recursive: true });
  const metadata = brandMetadata({
    name: 'Example',
    aliases: ['An alias is not a verified name'],
    defaultAsset: file,
    assets: [assetMetadata({ file, data, label: 'Original' })],
  });
  change(metadata);
  await writeFile(join(folder, file), data);
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  return root;
}

async function extractedFixture(t, change = () => {}) {
  const root = await fixture(t, (metadata) => {
    metadata.assets.push(
      assetMetadata({
        file: 'symbol.svg',
        provenance: {
          sourceType: 'official',
          processing: 'extracted',
          originalAsset: 'icon.svg',
          originalSha256: metadata.assets[0].sha256,
        },
      }),
    );
    change(metadata);
  });
  await writeFile(join(root, 'logo/example/symbol.svg'), svg);
  return root;
}

test('extracted SVG symbols preserve their registered original relationship', async (t) => {
  const catalog = await loadCatalog(await extractedFixture(t));
  const symbol = catalog.brands[0].assets.find((asset) => asset.file === 'symbol.svg');
  assert.equal(symbol.provenance.processing, 'extracted');
  assert.equal(symbol.provenance.originalAsset, 'icon.svg');
  assert.equal(symbol.provenance.originalSha256, catalog.brands[0].assets[0].sha256);
});

test('extracted symbols require an original SVG with matching acquisition sources', async (t) => {
  for (const change of [
    (m) => {
      delete m.assets[1].provenance.originalAsset;
    },
    (m) => {
      delete m.assets[1].provenance.originalSha256;
    },
    (m) => {
      m.assets[1].provenance.originalSha256 = '0'.repeat(64);
    },
    (m) => {
      m.assets[1].provenance.originalAsset = 'missing.svg';
    },
    (m) => {
      m.assets[1].provenance.originalAsset = 'symbol.svg';
    },
    (m) => {
      m.assets[0].provenance.processing = 'rendered';
    },
    (m) => {
      m.assets[1].sourcePage = 'https://other.example/';
    },
    (m) => {
      m.assets[1].source = 'https://other.example/file.svg';
    },
    (m) => {
      m.assets[1].provenance.processing = 'original';
    },
  ]) {
    await assert.rejects(loadCatalog(await extractedFixture(t, change)), /Invalid catalog:/);
  }
});

test('catalog keeps unverified names null without deriving them from aliases', async (t) => {
  const catalog = await loadCatalog(await fixture(t));
  assert.equal(catalog.schemaVersion, 4);
  assert.deepEqual(catalog.brands[0].identity, {
    nameZh: null,
    nameEn: null,
    legalNames: [],
    sources: [],
  });
  assert.deepEqual(catalog.brands[0].aliases, ['An alias is not a verified name']);
});

test('catalog preserves independently sourced legal roles and reviewed identity sources', async (t) => {
  const identity = {
    nameZh: '示例',
    nameEn: 'Example',
    legalNames: ['group', 'operating-company', 'website-operator', 'company', 'organization'].map(
      (role, i) => ({
        name: `Entity ${i}`,
        language: i % 2 ? 'zh' : 'en',
        role,
        source: url,
        reviewedAt: date,
      }),
    ),
    sources: [{ label: 'Official company profile', url, reviewedAt: date }],
  };
  const catalog = await loadCatalog(
    await fixture(t, (m) => {
      m.identity = identity;
    }),
  );
  assert.deepEqual(catalog.brands[0].identity, identity);
});

test('catalog requires identity shape, valid names, explicit roles, HTTPS sources and real review dates', async (t) => {
  for (const change of [
    (m) => {
      delete m.identity;
    },
    (m) => {
      delete m.identity.nameZh;
    },
    (m) => {
      m.identity.nameEn = '';
    },
    (m) => {
      m.identity.nameZh = 123;
    },
    (m) => {
      m.identity.aliases = [];
    },
    (m) => {
      m.identity.sources = [{ label: 'Source', url: 'http://example.com/', reviewedAt: date }];
    },
    (m) => {
      m.identity.sources = [{ label: 'Source', url, reviewedAt: '2026-02-30' }];
    },
    (m) => {
      m.identity.sources = [{ label: 'Source', url, reviewedAt: date, internal: 'no' }];
    },
    ...['holding', '', null].map((role) => (m) => {
      m.identity.legalNames = [
        { name: 'Legal', language: 'en', role, source: url, reviewedAt: date },
      ];
    }),
    (m) => {
      m.identity.legalNames = [
        { name: 'Legal', language: 'fr', role: 'organization', source: url, reviewedAt: date },
      ];
    },
    (m) => {
      m.identity.legalNames = [
        {
          name: 'Legal',
          language: 'en',
          role: 'group',
          source: 'https://user:pass@example.com/',
          reviewedAt: date,
        },
      ];
    },
    (m) => {
      m.identity.legalNames = [
        { name: 'Legal', language: 'en', role: 'company', source: url, reviewedAt: '2026-13-01' },
      ];
    },
  ]) {
    await assert.rejects(loadCatalog(await fixture(t, change)), /Invalid catalog:/);
  }
});

test('catalog preserves structured asset attributes and optional useful quality notes', async (t) => {
  const root = await fixture(t, (m) =>
    Object.assign(m.assets[0], {
      language: 'bilingual',
      layout: 'horizontal',
      color: 'monochrome',
      provenance: { sourceType: 'commons', processing: 'rendered' },
      qualityNotes: ['Opaque white background.'],
    }),
  );
  const asset = (await loadCatalog(root)).brands[0].assets[0];
  assert.equal(asset.language, 'bilingual');
  assert.equal(asset.layout, 'horizontal');
  assert.equal(asset.color, 'monochrome');
  assert.deepEqual(asset.provenance, { sourceType: 'commons', processing: 'rendered' });
  assert.deepEqual(asset.qualityNotes, ['Opaque white background.']);
  assert.equal(Object.hasOwn(asset, 'width'), false);
});

test('catalog rejects missing or invented asset attributes and unknown provenance properties', async (t) => {
  for (const change of [
    ...['language', 'layout', 'color', 'provenance'].map((key) => (m) => {
      delete m.assets[0][key];
    }),
    (m) => {
      m.assets[0].language = 'unknown';
    },
    (m) => {
      m.assets[0].layout = 'square';
    },
    (m) => {
      m.assets[0].color = 'blue';
    },
    (m) => {
      m.assets[0].provenance.sourceType = 'third-party';
    },
    (m) => {
      m.assets[0].provenance.processing = 'modified';
    },
    (m) => {
      m.assets[0].provenance.verified = true;
    },
    (m) => {
      m.assets[0].qualityNotes = [''];
    },
    (m) => {
      m.assets[0].width = 900;
    },
  ])
    await assert.rejects(loadCatalog(await fixture(t, change)), /Invalid catalog:/);
});

test('raster dimensions come from PNG IHDR and JPEG SOF bytes', async (t) => {
  const png = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12);
  png.writeUInt32BE(195, 16);
  png.writeUInt32BE(71, 20);
  // Baseline SOF segment: precision, height, width, one component.
  const jpg = Buffer.from('ffd8ffc0000b080051016e01011100ffd9', 'hex');
  for (const [file, data, width, height] of [
    ['icon.png', png, 195, 71],
    ['icon.jpg', jpg, 366, 81],
  ]) {
    const asset = (await loadCatalog(await fixture(t, undefined, data, file))).brands[0].assets[0];
    assert.equal(asset.width, width);
    assert.equal(asset.height, height);
  }
});

test('minimal accepted JPEG headers never receive invented dimensions', async (t) => {
  const asset = (
    await loadCatalog(
      await fixture(t, undefined, Buffer.from('ffd8ffe00002ffd9', 'hex'), 'icon.jpg'),
    )
  ).brands[0].assets[0];
  assert.equal(Object.hasOwn(asset, 'width'), false);
  assert.equal(Object.hasOwn(asset, 'height'), false);
});

test('repository retains all 236 entities, precise identities and asset caveats', async () => {
  const catalog = await loadCatalog();
  const byId = Object.fromEntries(catalog.brands.map((b) => [b.id, b]));
  assert.equal(catalog.brands.length, 236);
  const directIntake = catalog.brands.flatMap((brand) =>
    brand.assets.filter((asset) => asset.rights.status === 'unverified'),
  );
  assert.ok(directIntake.length >= 133);
  assert.ok(directIntake.every((asset) => asset.provenance.sourceType === 'official'));
  assert.equal(byId.minimax.identity.nameZh, null);
  assert.equal(byId.codeberg.identity.legalNames[0].language, 'de');
  assert.equal(byId.oppo.identity.nameZh, 'OPPO');
  assert.equal(byId.vivo.identity.nameZh, 'vivo');
  assert.equal(byId.amap.identity.nameEn, 'Amap');
  assert.equal(byId.dewu.identity.nameEn, 'POIZON');
  assert.equal(byId.jd.identity.nameEn, 'JD.com');
  assert.equal(byId.jd.identity.legalNames[0].name, 'JD.com, Inc.');
  assert.equal(byId.jd.identity.legalNames[0].role, 'group');
  assert.equal(byId.baidu.defaultAsset, 'logo-bilingual-brand-library.jpg');
  assert.equal(byId.gitlab.defaultAsset, 'logo-color-official.svg');
  assert.equal(byId.hundsun.defaultAsset, 'wordmark-color-official.png');
  assert.equal(byId.dewu.defaultAsset, 'wordmark-square-official.png');
  const baiduPaw = byId.baidu.assets.find((asset) => asset.file === 'icon-blue-brand-library.jpg');
  assert.equal(baiduPaw.provenance.channel, 'brand-library');
  assert.equal(baiduPaw.language, 'en');
  assert.equal(baiduPaw.display, 'alternative');
  assert.match(baiduPaw.usageWarnings.join(' '), /13mm/);
  assert.deepEqual(byId.git.identity.legalNames, []);
  assert.equal(byId.bytedance.identity.legalNames[0].role, 'website-operator');
  assert.ok(byId['trip-com'].identity.legalNames.some((n) => n.role === 'website-operator'));
  assert.ok(byId.zhipu.identity.legalNames.some((n) => n.name === 'Z.AI Co., Ltd.'));
  const senseTime = byId.sensetime.assets[0];
  assert.equal(senseTime.provenance.sourceType, 'commons');
  assert.equal(senseTime.provenance.processing, 'original');
  const kingdee = byId.kingdee.assets.find(
    (asset) => asset.file === 'logo-color-english-official.svg',
  );
  assert.equal(byId.kingdee.defaultAsset, kingdee.file);
  assert.equal(Object.hasOwn(kingdee, 'width'), false);
  assert.equal(Object.hasOwn(kingdee, 'height'), false);
  assert.deepEqual(kingdee.qualityNotes, ['透明背景。']);
  assert.deepEqual(kingdee.usageWarnings, [
    'SVG 内嵌 1492 × 506 PNG，放大后仍受原始位图像素限制。',
  ]);
  const smallZte = byId.zte.assets.find(
    (asset) => asset.file === 'wordmark-blue-header-official.png',
  );
  assert.equal(smallZte.width, 92);
  assert.equal(smallZte.height, 44);
  assert.match(smallZte.qualityNotes.join(' '), /#008ED3/);
  assert.match(
    byId.zhipu.assets
      .find((asset) => asset.file === 'icon-monochrome-commons.png')
      .qualityNotes.join(' '),
    /chat\.z\.ai/,
  );
});

test('removed redundant originals have no metadata record or repository file', async () => {
  for (const [id, file] of [
    ['sangfor', 'icon-official.png'],
    ['xiaomi', 'icon-orange-2021.png'],
    ['dewu', 'wordmark-square-small-official.png'],
    ['bigo', 'wordmark-blue-micro-official.png'],
    ['kingdee', 'logo-color-english.jpg'],
    ['meituan', 'logo-chinese.png'],
    ['yonyou', 'wordmark-red.jpg'],
    ['minimax', 'logo-gradient-vertical.png'],
    ['lenovo', 'logo-red-2015.png'],
    ['lenovo', 'logo-red-brandworld.png'],
    ['zte', 'wordmark-cyan-2015.png'],
    ['zte', 'wordmark-cyan-commons.svg'],
    ['alibaba', 'wordmark-orange.png'],
    ['bytedance', 'logo-english.png'],
    ['codeberg', 'icon-blue.png'],
    ['codeberg', 'icon-white.png'],
    ['codeberg', 'logo-vertical-blue.png'],
    ['codeberg', 'logo-vertical-white.png'],
    ['didi', 'logo-english.png'],
    ['iqiyi', 'wordmark-green.png'],
    ['oppo', 'wordmark-green-2019.png'],
    ['trip-com', 'wordmark-color.png'],
    ['vivo', 'wordmark-blue-2019.png'],
    ['yonyou', 'wordmark-white-transparent.png'],
    ['tencent', 'wordmark-blue.png'],
  ]) {
    const metadata = JSON.parse(
      await readFile(new URL(`../logo/${id}/metadata.json`, import.meta.url), 'utf8'),
    );
    assert.equal(
      metadata.assets.some((asset) => asset.file === file),
      false,
      `${id}/${file}: removed from metadata`,
    );
    await assert.rejects(access(new URL(`../logo/${id}/${file}`, import.meta.url)), {
      code: 'ENOENT',
    });
  }
});
