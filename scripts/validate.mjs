import { loadCatalog } from './lib/catalog.mjs';

try {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/validate.mjs');
  const catalog = await loadCatalog();
  const count = catalog.brands.reduce((total, brand) => total + brand.assets.length, 0);
  console.log(`Validated ${catalog.brands.length} brands and ${count} assets.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
