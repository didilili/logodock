import { loadCatalog } from './lib/catalog.mjs';
import { categoryOptions } from '../src/lib/catalog-presentation.mjs';

try {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/validate.mjs');
  const catalog = await loadCatalog();
  const untranslated = categoryOptions(catalog.brands).filter(
    (category) => !/\p{Script=Han}/u.test(category.label),
  );
  if (untranslated.length)
    throw new Error(
      `Missing Chinese category labels: ${untranslated.map((category) => category.id).join(', ')}. Add labels in src/lib/catalog-presentation.mjs.`,
    );
  const count = catalog.brands.reduce((total, brand) => total + brand.assets.length, 0);
  console.log(`Validated ${catalog.brands.length} brands and ${count} assets.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
