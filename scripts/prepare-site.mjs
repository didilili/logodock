import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, repositoryRoot } from './lib/catalog.mjs';

// static/ is generated staging for SvelteKit. logos/ remains the only source.
export async function prepareSite(root = repositoryRoot) {
  const catalog = await loadCatalog(root);
  const output = join(root, 'static');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const brand of catalog.brands) {
    const folder = join(output, 'logos', brand.id);
    await mkdir(folder, { recursive: true });
    await copyFile(join(root, 'logos', brand.id, 'metadata.json'), join(folder, 'metadata.json'));
    for (const asset of brand.assets) await copyFile(join(root, asset.path), join(folder, asset.file));
  }
  await writeFile(join(output, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(join(output, '.nojekyll'), '');
  return catalog;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const catalog = await prepareSite(); console.log(`Prepared ${catalog.brands.length} brands for SvelteKit.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
