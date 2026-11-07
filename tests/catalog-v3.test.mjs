import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadCatalog } from '../scripts/lib/catalog.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
const url = 'https://example.com/';
const date = '2026-11-07';
const digest = (data) => createHash('sha256').update(data).digest('hex');

async function fixture(t, change = () => {}, data = Buffer.from(svg), file = 'icon.svg') {
  const root = await mkdtemp(join(tmpdir(), 'logodock-v3-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, 'logos/example');
  await mkdir(folder, { recursive: true });
  const metadata = {
    schemaVersion: 3, id: 'example', name: 'Example', aliases: ['An alias is not a verified name'], website: url,
    identity: { nameZh: null, nameEn: null, legalNames: [], sources: [] },
    entityType: 'company', categories: [], defaultAsset: file,
    assets: [{ file, label: 'Original', variant: 'icon', status: 'current', background: 'any',
      language: 'none', layout: 'standalone', color: 'brand', provenance: { sourceType: 'official', processing: 'original' },
      source: url, sourcePage: url, sha256: digest(data), bytes: data.length,
      rights: { status: 'permitted', license: 'Example permission', reference: url, attribution: 'Example', reviewedAt: date } }],
  };
  change(metadata);
  await writeFile(join(folder, file), data);
  await writeFile(join(folder, 'metadata.json'), JSON.stringify(metadata));
  return root;
}

test('v3 keeps unverified names null without deriving them from aliases', async (t) => {
  const catalog = await loadCatalog(await fixture(t));
  assert.equal(catalog.schemaVersion, 3);
  assert.deepEqual(catalog.brands[0].identity, { nameZh: null, nameEn: null, legalNames: [], sources: [] });
  assert.deepEqual(catalog.brands[0].aliases, ['An alias is not a verified name']);
});

test('v3 preserves independently sourced legal roles and reviewed identity sources', async (t) => {
  const identity = {
    nameZh: '示例', nameEn: 'Example',
    legalNames: ['group', 'operating-company', 'website-operator', 'company', 'organization'].map((role, i) =>
      ({ name: `Entity ${i}`, language: i % 2 ? 'zh' : 'en', role, source: url, reviewedAt: date })),
    sources: [{ label: 'Official company profile', url, reviewedAt: date }],
  };
  const catalog = await loadCatalog(await fixture(t, (m) => { m.identity = identity; }));
  assert.deepEqual(catalog.brands[0].identity, identity);
});

test('v3 requires identity shape, valid names, explicit roles, HTTPS sources and real review dates', async (t) => {
  for (const change of [
    (m) => { delete m.identity; },
    (m) => { delete m.identity.nameZh; },
    (m) => { m.identity.nameEn = ''; },
    (m) => { m.identity.nameZh = 123; },
    (m) => { m.identity.aliases = []; },
    (m) => { m.identity.sources = [{ label: 'Source', url: 'http://example.com/', reviewedAt: date }]; },
    (m) => { m.identity.sources = [{ label: 'Source', url, reviewedAt: '2026-02-30' }]; },
    (m) => { m.identity.sources = [{ label: 'Source', url, reviewedAt: date, internal: 'no' }]; },
    ...['holding', '', null].map((role) => (m) => { m.identity.legalNames = [{ name: 'Legal', language: 'en', role, source: url, reviewedAt: date }]; }),
    (m) => { m.identity.legalNames = [{ name: 'Legal', language: 'fr', role: 'organization', source: url, reviewedAt: date }]; },
    (m) => { m.identity.legalNames = [{ name: 'Legal', language: 'en', role: 'group', source: 'https://user:pass@example.com/', reviewedAt: date }]; },
    (m) => { m.identity.legalNames = [{ name: 'Legal', language: 'en', role: 'company', source: url, reviewedAt: '2026-13-01' }]; },
  ]) {
    await assert.rejects(loadCatalog(await fixture(t, change)), /Invalid catalog:/);
  }
});

test('v3 preserves structured asset attributes and optional useful quality notes', async (t) => {
  const root = await fixture(t, (m) => Object.assign(m.assets[0], {
    language: 'bilingual', layout: 'horizontal', color: 'monochrome',
    provenance: { sourceType: 'commons', processing: 'rendered' }, qualityNotes: ['Opaque white background.'],
  }));
  const asset = (await loadCatalog(root)).brands[0].assets[0];
  assert.equal(asset.language, 'bilingual');
  assert.equal(asset.layout, 'horizontal');
  assert.equal(asset.color, 'monochrome');
  assert.deepEqual(asset.provenance, { sourceType: 'commons', processing: 'rendered' });
  assert.deepEqual(asset.qualityNotes, ['Opaque white background.']);
  assert.equal(Object.hasOwn(asset, 'width'), false);
});

test('v3 rejects missing or invented asset attributes and unknown provenance properties', async (t) => {
  for (const change of [
    ...['language', 'layout', 'color', 'provenance'].map((key) => (m) => { delete m.assets[0][key]; }),
    (m) => { m.assets[0].language = 'unknown'; },
    (m) => { m.assets[0].layout = 'square'; },
    (m) => { m.assets[0].color = 'blue'; },
    (m) => { m.assets[0].provenance.sourceType = 'third-party'; },
    (m) => { m.assets[0].provenance.processing = 'modified'; },
    (m) => { m.assets[0].provenance.verified = true; },
    (m) => { m.assets[0].qualityNotes = ['']; },
    (m) => { m.assets[0].width = 900; },
  ]) await assert.rejects(loadCatalog(await fixture(t, change)), /Invalid catalog:/);
});

test('raster dimensions come from PNG IHDR and JPEG SOF bytes', async (t) => {
  const png = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(13, 8); png.write('IHDR', 12); png.writeUInt32BE(195, 16); png.writeUInt32BE(71, 20);
  // Baseline SOF segment: precision, height, width, one component.
  const jpg = Buffer.from('ffd8ffc0000b080051016e01011100ffd9', 'hex');
  for (const [file, data, width, height] of [['icon.png', png, 195, 71], ['icon.jpg', jpg, 366, 81]]) {
    const asset = (await loadCatalog(await fixture(t, undefined, data, file))).brands[0].assets[0];
    assert.equal(asset.width, width);
    assert.equal(asset.height, height);
  }
});

test('minimal accepted JPEG headers never receive invented dimensions', async (t) => {
  const asset = (await loadCatalog(await fixture(t, undefined, Buffer.from('ffd8ffe00002ffd9', 'hex'), 'icon.jpg'))).brands[0].assets[0];
  assert.equal(Object.hasOwn(asset, 'width'), false);
  assert.equal(Object.hasOwn(asset, 'height'), false);
});

test('repository migration retains all 23 entities, precise identities and asset caveats', async () => {
  const catalog = await loadCatalog();
  const byId = Object.fromEntries(catalog.brands.map((b) => [b.id, b]));
  assert.equal(catalog.brands.length, 23);
  assert.equal(byId.minimax.identity.nameZh, null);
  assert.equal(byId.codeberg.identity.legalNames[0].language, 'de');
  assert.equal(byId.oppo.identity.nameZh, 'OPPO');
  assert.equal(byId.vivo.identity.nameZh, 'vivo');
  assert.deepEqual(byId.git.identity.legalNames, []);
  assert.equal(byId.bytedance.identity.legalNames[0].role, 'website-operator');
  assert.ok(byId['trip-com'].identity.legalNames.some((n) => n.role === 'website-operator'));
  assert.ok(byId.zhipu.identity.legalNames.some((n) => n.name === 'Z.AI Co., Ltd.'));
  const senseTime = byId.sensetime.assets[0];
  assert.equal(senseTime.provenance.sourceType, 'commons');
  assert.equal(senseTime.provenance.processing, 'original');
  assert.equal(byId.kingdee.assets[0].width, 2528);
  assert.equal(byId.kingdee.assets[0].height, 1371);
  assert.match(byId.kingdee.assets[0].qualityNotes.join(' '), /CMYK/);
  const oldZte = byId.zte.assets.find((asset) => asset.file === 'wordmark-cyan-2015.png');
  assert.match(oldZte.qualityNotes.join(' '), /#008ED3/);
  assert.equal(oldZte.color, 'other');
  assert.match(byId.lenovo.assets[0].qualityNotes.join(' '), /#E1251B/);
  assert.equal(byId.lenovo.assets[0].color, 'other');
  assert.match(byId.zhipu.assets[0].qualityNotes.join(' '), /chat\.z\.ai/);
});
