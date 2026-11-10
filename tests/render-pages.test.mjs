import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { loadCatalog, repositoryRoot } from '../scripts/lib/catalog.mjs';
import { toPosixPath } from '../scripts/lib/paths.mjs';
import { sourceLabel, licenseLabel } from '../src/lib/catalog-display.mjs';
import { artworkSourceFiles } from '../src/lib/catalog-artworks.mjs';
import { assetPath } from '../src/lib/resource-links.mjs';
import { directoryAsset } from '../src/lib/catalog-presentation.mjs';

// These tests inspect one production build. `npm test` builds it once before
// running the suite; fixtures for pure catalog logic do not rebuild SvelteKit.
const output = join(repositoryRoot, '_site');
const catalog = await loadCatalog();
const readOutput = (path) => readFile(join(output, path), 'utf8');
const escaped = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const withoutScripts = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
async function filesBelow(directory, relative = '') {
  const files = [];
  for (const item of await readdir(join(directory, relative), { withFileTypes: true })) {
    const path = toPosixPath(join(relative, item.name));
    if (item.isDirectory()) files.push(...(await filesBelow(directory, path)));
    else files.push(path);
  }
  return files.sort();
}

test('production output includes the home and all 59 independent detail pages', async () => {
  assert.equal(
    catalog.brands.length,
    59,
    'Update this inventory deliberately when entries change.',
  );
  const files = await filesBelow(output);
  assert.deepEqual(
    files.filter((path) => path.endsWith('.html')),
    ['index.html', ...catalog.brands.map((brand) => `logo/${brand.id}/index.html`)].sort(),
  );
  const html = await readOutput('index.html');
  assert.match(html, /<html\b[^>]*lang="zh-CN"/);
  assert.match(html, /<h1\b/);
  for (const brand of catalog.brands) {
    assert.ok(
      withoutScripts(html).includes(
        escaped(brand.identity.nameZh || brand.identity.nameEn || brand.name),
      ),
      brand.id,
    );
    const selected = directoryAsset(brand);
    const query =
      selected.file === brand.defaultAsset
        ? ''
        : `\\?asset=${selected.file.replaceAll('.', '\\.')}`;
    assert.match(html, new RegExp(`href="[^"?#]*logo/${brand.id}/${query}"`));
  }
  assert.equal(await readOutput('.nojekyll'), '');
});

test('production HTML loads generated SvelteKit modules and CSS rather than the retired client renderer', async () => {
  const html = await readOutput('index.html');
  const files = await filesBelow(output);
  const scripts = files.filter((path) => /^_app\/.*\.js$/.test(path));
  const styles = files.filter((path) => /^_app\/.*\.css$/.test(path));
  assert.ok(scripts.length > 0, 'Expected generated _app JavaScript in the static artifact.');
  assert.ok(styles.length > 0, 'Expected generated _app CSS in the static artifact.');
  assert.match(html, /_app\/[^"'\s<>]+\.js/);
  assert.match(html, /_app\/[^"'\s<>]+\.css/);
  assert.doesNotMatch(html, /id="catalog-data"|src="[^"\n]*app\.mjs"/);
  assert.ok(
    !files.includes('render-pages.mjs'),
    'The old string renderer is not a browser dependency.',
  );
});

test('static index, source metadata and every original file keep their paths and bytes', async () => {
  const index = await readFile(join(output, 'index.json'));
  assert.deepEqual(index, await readFile(join(repositoryRoot, 'index.json')));
  assert.deepEqual(JSON.parse(index), catalog);
  let originals = 0;
  let active = 0;
  for (const brand of catalog.brands) {
    const path = `logo/${brand.id}/metadata.json`;
    assert.deepEqual(
      await readFile(join(output, path)),
      await readFile(join(repositoryRoot, path)),
      path,
    );
    const metadata = JSON.parse(await readFile(join(repositoryRoot, path), 'utf8'));
    for (const asset of metadata.assets) {
      const assetPath = `logo/${brand.id}/${asset.file}`;
      const original = await readFile(join(repositoryRoot, assetPath));
      const published = await readFile(join(output, assetPath));
      assert.deepEqual(published, original, assetPath);
      assert.equal(published.byteLength, asset.bytes, assetPath);
      assert.equal(createHash('sha256').update(published).digest('hex'), asset.sha256, assetPath);
      originals++;
    }
    active += brand.assets.length;
  }
  assert.equal(originals, 145);
  assert.equal(active, 145);
});

test('each detail keeps downloads, brand names, sources and rights without exposing maintenance records', async () => {
  const home = await readOutput('index.html');
  const homeTitle = home.match(/<title>([^<]*)<\/title>/)?.[1];
  const homeDescription = home.match(/name="description"\s+content="([^"]*)"/)?.[1];
  for (const brand of catalog.brands) {
    const html = await readOutput(`logo/${brand.id}/index.html`);
    const visible = withoutScripts(html);
    const selected = brand.assets.find((asset) => asset.file === brand.defaultAsset);
    assert.match(html, /<title>[^<]+LogoDock<\/title>/, brand.id);
    assert.notEqual(html.match(/<title>([^<]*)<\/title>/)?.[1], homeTitle);
    assert.notEqual(html.match(/name="description"\s+content="([^"]*)"/)?.[1], homeDescription);
    assert.ok(
      visible.includes(escaped(brand.identity.nameZh || brand.identity.nameEn || brand.name)),
      brand.id,
    );
    const download = visible.match(/<a\b[^>]*\bid="download-link"[^>]*>/)?.[0];
    assert.ok(download, `${brand.id}: default download anchor`);
    assert.match(
      download,
      new RegExp(`href="[^"?#]*logo/${brand.id}/${selected.file.replaceAll('.', '\\.')}"`),
    );
    assert.match(download, /\bdownload(?:[\s=>])/);
    assert.ok(visible.includes(escaped(selected.sourcePage)), `${brand.id}: source page`);
    assert.ok(
      visible.includes(escaped(sourceLabel(selected))),
      `${brand.id}: visible source channel`,
    );
    assert.ok(visible.includes(escaped(selected.source)), `${brand.id}: original source`);
    if (selected.rights.status === 'permitted')
      assert.ok(visible.includes(escaped(licenseLabel(selected))), `${brand.id}: license`);
    assert.doesNotMatch(visible, /许可未核实|许可已确认/, brand.id);
    assert.ok(
      visible.includes(escaped(selected.rights.reference)),
      `${brand.id}: license reference`,
    );
    assert.doesNotMatch(
      visible,
      /品牌与主体信息|名称核对来源|未记录已核实|未单独登记公司主体|核对日期/,
      brand.id,
    );
    if (selected.rights.notes && !selected.rights.notes.includes('许可及署名条件待核实'))
      assert.ok(
        visible.includes(escaped(selected.rights.notes)),
        `${brand.id}: recorded usage conditions are available`,
      );
    if (selected.rights.notes?.includes('官方协议列有书面同意要求'))
      assert.ok(visible.includes('官方协议列有书面同意要求'), `${brand.id}: known condition`);
    assert.doesNotMatch(visible, /许可及署名条件待核实/, brand.id);
    const publicDomain = /public domain|CC[ -]?0/i.test(selected.rights.license);
    assert.equal(
      visible.includes(escaped(selected.rights.attribution)),
      !publicDomain && selected.rights.status !== 'unverified',
      `${brand.id}: only necessary attribution is displayed`,
    );
    for (const asset of brand.assets)
      assert.ok(
        visible.includes(`logo/${brand.id}/${asset.file}`),
        `${brand.id}: noJS original variant`,
      );
    assert.doesNotMatch(html, /rel="canonical"/);
  }
});

test('detail hydration contains only the requested brand, not a serialized whole catalog', async () => {
  for (const brand of catalog.brands) {
    const html = await readOutput(`logo/${brand.id}/index.html`);
    assert.ok(!html.includes('id="catalog-data"'), `${brand.id}: retired full catalog script`);
    for (const other of catalog.brands.filter((item) => item.id !== brand.id)) {
      assert.ok(
        !html.includes(other.assets[0].sha256),
        `${brand.id} must not serialize ${other.id}'s assets`,
      );
      assert.ok(
        !html.includes(`logo/${other.id}/metadata.json`),
        `${brand.id} must not include another metadata document`,
      );
    }
  }
});

test('reviewed artwork groups and no-JavaScript file links contain only active choices', async () => {
  for (const [id, count] of [
    ['alibaba', 2],
    ['codeberg', 4],
    ['tencent', 3],
  ]) {
    const visible = withoutScripts(await readOutput(`logo/${id}/index.html`));
    assert.equal(
      [...visible.matchAll(/\bdata-select-artwork="[^"]+"/g)].length,
      count,
      `${id}: one selector per artwork`,
    );
  }
  for (const brand of catalog.brands) {
    const visible = withoutScripts(await readOutput(`logo/${brand.id}/index.html`));
    const hrefs = [...visible.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]);
    for (const asset of brand.assets) {
      const suffix = `logo/${brand.id}/${asset.file}`;
      assert.ok(
        hrefs.some((href) => href.endsWith(suffix)),
        `${suffix}: a no-JavaScript original-file link is retained`,
      );
    }
  }
});

test('native design downloads preserve original files and render only the selected artwork attachments', async () => {
  for (const brand of catalog.brands) {
    const visible = withoutScripts(await readOutput(`logo/${brand.id}/index.html`));
    const interactive = visible.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
    const selected = artworkSourceFiles(brand, brand.defaultAsset);
    assert.deepEqual(
      [...interactive.matchAll(/\bdata-source-file="([^"]+)"/g)].map((match) => match[1]),
      selected.map((entry) => escaped(entry.file)),
      `${brand.id}: only current artwork attachments appear in the workspace`,
    );
    const fallback = visible.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/i)?.[1] ?? '';
    for (const entry of brand.sourceFiles ?? []) {
      const original = await readFile(join(repositoryRoot, entry.path));
      const published = await readFile(join(output, entry.path));
      assert.deepEqual(published, original, entry.path);
      assert.equal(published.byteLength, entry.bytes, entry.path);
      assert.equal(createHash('sha256').update(published).digest('hex'), entry.sha256, entry.path);
      const download = [...fallback.matchAll(/<a\b[^>]*\bdownload[^>]*>/g)].find((match) =>
        match[0].includes(`/${assetPath(entry)}"`),
      );
      assert.ok(download, `${entry.path}: no-JavaScript download link`);
      if (entry.rights.status === 'permitted')
        assert.ok(fallback.includes(escaped(licenseLabel(entry))), `${entry.path}: license`);
      assert.doesNotMatch(fallback, /许可未核实|许可已确认/, entry.path);
      assert.ok(fallback.includes(escaped(entry.sourcePage)), `${entry.path}: source page`);
    }
  }
});
