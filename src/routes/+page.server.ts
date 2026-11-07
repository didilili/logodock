import { catalogSnapshot } from '#lib/server/catalog.ts';
export async function load() {
  const { catalog, sourceCommit } = await catalogSnapshot();
  return { brands: catalog.brands, sourceCommit };
}
