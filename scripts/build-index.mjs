import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCatalog, repositoryRoot } from './lib/catalog.mjs';

const escapeText = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\r\n]+/g, ' ').replace(/[|\\`*_\[\]{}()!#~]/g, (character) => `&#${character.charCodeAt(0)};`);
const encodePart = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const assetUrl = (path) => path.split('/').map(encodePart).join('/');
const externalUrl = (url) => new URL(url).href.replace(/[()|]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

function resourceTable(catalog) {
  const rows = ['| 预览 | 品牌 | 文件 / 类型 | 许可 | 说明 |', '| --- | --- | --- | --- | --- |'];
  for (const brand of catalog.brands) for (const asset of brand.assets) {
    const path = assetUrl(asset.path);
    rows.push(`| <img src="${path}" alt="${brand.id}" width="64" height="64"> | ${escapeText(brand.name)} | `
      + `[${escapeText(asset.file)}](${path}) / ${asset.variant} | `
      + `[${escapeText(asset.rights.license)}](${externalUrl(asset.rights.reference)}) | ${escapeText(asset.rights.notes ?? '')} |`);
  }
  return rows.join('\n');
}

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/build-index.mjs [--check]');
  const catalog = await loadCatalog();
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  const path = join(repositoryRoot, 'index.json');
  const readmePath = join(repositoryRoot, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const region = /<!-- logos:start -->[\s\S]*?<!-- logos:end -->/g;
  if ([...readme.matchAll(region)].length !== 1) throw new Error('README.md must contain exactly one logos:start/end region.');
  const updatedReadme = readme.replace(region, () => `<!-- logos:start -->\n${resourceTable(catalog)}\n<!-- logos:end -->`);
  if (args.includes('--check')) {
    const current = await readFile(path, 'utf8').catch(() => null);
    if (current !== serialized) throw new Error('index.json is missing or stale. Run npm run build:index.');
    if (readme !== updatedReadme) throw new Error('README.md resource table is stale. Run npm run build:index.');
    console.log('index.json and README.md resource table are current.');
  } else {
    await writeFile(path, serialized);
    if (readme !== updatedReadme) await writeFile(readmePath, updatedReadme);
    console.log('Generated index.json and README.md resource table.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
