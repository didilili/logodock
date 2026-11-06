import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, repositoryRoot } from './lib/catalog.mjs';

export async function buildSite(root = repositoryRoot) {
  const catalog = await loadCatalog(root);
  const template = await readFile(join(root, 'site/index.html'), 'utf8');
  const assetCount = catalog.brands.reduce((total, brand) => total + brand.assets.length, 0);
  let sourceCommit = '';
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { /* A source archive can be built without Git metadata. */ }
  const replacements = {
    CATALOG_JSON: JSON.stringify(catalog).replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'),
    BRAND_COUNT: String(catalog.brands.length), ASSET_COUNT: String(assetCount), SOURCE_COMMIT: sourceCommit,
  };
  const html = template.replace(/__(CATALOG_JSON|BRAND_COUNT|ASSET_COUNT|SOURCE_COMMIT)__/g,
    (_, key) => replacements[key]);
  const outputDirectory = join(root, '_site');
  await rm(outputDirectory, { recursive: true, force: true });
  await cp(join(root, 'site'), outputDirectory, { recursive: true });
  for (const brand of catalog.brands) {
    await mkdir(join(outputDirectory, 'logos', brand.id), { recursive: true });
    const metadata = join('logos', brand.id, 'metadata.json');
    await copyFile(join(root, metadata), join(outputDirectory, metadata));
    for (const asset of brand.assets) {
      await copyFile(join(root, asset.path), join(outputDirectory, asset.path));
    }
  }
  await writeFile(join(outputDirectory, 'index.html'), html);
  await writeFile(join(outputDirectory, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(join(outputDirectory, '.nojekyll'), '');
  return { outputDirectory, catalog, sourceCommit };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { catalog } = await buildSite();
    console.log(`Built _site: ${catalog.brands.length} companies.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
