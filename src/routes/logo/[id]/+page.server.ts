import { error } from '@sveltejs/kit';
import { catalogSnapshot } from '#lib/server/catalog.ts';

export async function entries() {
  const { catalog } = await catalogSnapshot();
  return catalog.brands.map(brand => ({ id: brand.id }));
}
export async function load({ params }: { params: { id: string } }) {
  const { catalog, sourceCommit } = await catalogSnapshot();
  const brand = catalog.brands.find(item => item.id === params.id);
  if (!brand) error(404, '没有找到这个品牌');
  const parent = catalog.brands.find(item => item.id === brand.parentId);
  return { brand, parent, sourceCommit };
}
