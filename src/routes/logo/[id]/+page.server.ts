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
  const parentBrand = catalog.brands.find(item => item.id === brand.parentId);
  const summary = (item: typeof brand) => ({
    id: item.id,
    name: item.name,
    identity: { nameZh: item.identity.nameZh, nameEn: item.identity.nameEn },
    defaultAsset: item.defaultAsset,
    entityType: item.entityType,
  });
  const parent = parentBrand && summary(parentBrand);
  const children = catalog.brands.filter(item => item.parentId === brand.id).map(summary);
  return { brand, parent, children, sourceCommit };
}
