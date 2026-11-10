import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadCatalog, repositoryRoot } from './lib/catalog.mjs';

const escapeText = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[|\\`*_[\]{}()!#~]/g, (character) => `&#${character.charCodeAt(0)};`);
const encodePart = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
const assetUrl = (path) => path.split('/').map(encodePart).join('/');
const externalUrl = (url) =>
  new URL(url).href.replace(
    /[()|]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

function resourceTable(catalog) {
  const rows = ['| 预览 | 品牌 | 文件 / 类型 | 许可 | 说明 |', '| --- | --- | --- | --- | --- |'];
  for (const brand of catalog.brands)
    for (const asset of brand.assets) {
      const path = `../${assetUrl(asset.path)}`;
      rows.push(
        `| <img src="${path}" alt="${brand.id}" width="64"> | ${escapeText(brand.name)} | ` +
          `[${escapeText(asset.file)}](${path}) / ${asset.variant} | ` +
          `[${escapeText(asset.rights.license)}](${externalUrl(asset.rights.reference)}) | ${escapeText(asset.rights.notes ?? '')} |`,
      );
    }
  return rows.join('\n');
}

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
    throw new Error('Usage: node scripts/build-index.mjs [--check]');
  const catalog = await loadCatalog();
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  const path = join(repositoryRoot, 'index.json');
  const documentPath = join(repositoryRoot, 'docs/catalog.md');
  const count = catalog.brands.reduce((total, brand) => total + brand.assets.length, 0);
  const document = `# Logo 资源清单\n\n此文件由 \`npm run build:index\` 生成，请修改 \`logo/<id>/metadata.json\` 和原始素材后重新生成。\n\n当前收录 ${catalog.brands.length} 个品牌、${count} 个文件。使用条件以逐文件记录及其来源为准，收录不代表品牌方授权或背书；详见 [第三方资源说明](../NOTICE.md)。\n\n返回 [项目说明](../README.md) · [贡献指南](../CONTRIBUTING.md) · [完整 JSON 索引](../index.json)\n\n${resourceTable(catalog)}\n`;
  if (args.includes('--check')) {
    const current = await readFile(path, 'utf8').catch(() => null);
    if (current !== serialized)
      throw new Error('index.json is missing or stale. Run npm run build:index.');
    const currentDocument = await readFile(documentPath, 'utf8').catch(() => null);
    if (currentDocument !== document)
      throw new Error('docs/catalog.md is missing or stale. Run npm run build:index.');
    console.log('index.json and docs/catalog.md are current.');
  } else {
    await writeFile(path, serialized);
    await mkdir(dirname(documentPath), { recursive: true });
    await writeFile(documentPath, document);
    console.log('Generated index.json and docs/catalog.md.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
