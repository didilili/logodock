import { loadCatalog } from './lib/catalog.mjs';
import { categoryLabels, industryGroups, topicLabels } from '../src/lib/catalog-taxonomy.mjs';

try {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/validate.mjs');
  const catalog = await loadCatalog();
  const industryIds = industryGroups.flatMap((group) => [
    group.id,
    ...group.children.map((child) => child.id),
  ]);
  if (new Set(industryIds).size !== industryIds.length)
    throw new Error('Duplicate industry IDs in src/lib/catalog-taxonomy.mjs.');
  const untranslated = Object.entries({ ...categoryLabels, ...topicLabels }).filter(
    ([, label]) => !/\p{Script=Han}/u.test(label),
  );
  if (untranslated.length)
    throw new Error(
      `Missing Chinese category labels: ${untranslated.map(([id]) => id).join(', ')}. Add labels in src/lib/catalog-taxonomy.mjs.`,
    );
  const count = catalog.brands.reduce((total, brand) => total + brand.assets.length, 0);
  console.log(`Validated ${catalog.brands.length} brands and ${count} assets.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
