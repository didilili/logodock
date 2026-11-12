import { filterBrands, matchingAssets, sortBrands } from './catalog-search.mjs';
import { artworkGroups } from './catalog-artworks.mjs';
import { brandPriorities } from './catalog-order.mjs';
import { directoryCover } from './catalog-preview.mjs';
import { assetFacetLabels, directoryFilterKeys, shapeLabels } from './asset-taxonomy.mjs';
export {
  assetDisplayLabel,
  assetDescription,
  assetDetailLabel,
  assetAttributes,
  assetDownloadName,
  shapeLabels,
  usageLabels,
  layoutLabels,
  languageLabels,
  colorLabels,
  statusLabels,
  directoryFilterKeys,
} from './asset-taxonomy.mjs';
import {
  categoryOptions,
  topicOptions,
  matchesCategory,
  normalizeCategory,
} from './catalog-taxonomy.mjs';

export const entityLabels = { company: '公司', product: '产品', organization: '组织' };
export { categoryLabels, categoryOptions, topicLabels, topicOptions } from './catalog-taxonomy.mjs';
export function sortCatalogBrands(brands) {
  return sortBrands(brands).sort(
    (a, b) =>
      (brandPriorities.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (brandPriorities.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
export function assetFormat(asset) {
  return asset.file.split('.').pop().toUpperCase();
}

export function defaultAsset(brand, requestedFile) {
  return (
    brand.assets.find((asset) => asset.file === requestedFile) ||
    brand.assets.find((asset) => asset.file === brand.defaultAsset) ||
    artworkGroups(brand)[0]?.defaultAsset
  );
}

export function directoryAsset(brand, query = '') {
  const candidates = matchingAssets(brand, query);
  const scopedBrand = candidates.length ? { ...brand, assets: candidates } : brand;
  const primary = scopedBrand.assets.filter((asset) => asset.display !== 'alternative');
  const available = primary.length ? primary : scopedBrand.assets;
  const current = available.filter((asset) => asset.status === 'current');
  const eligible = { ...scopedBrand, assets: current.length ? current : available };
  return directoryCover(eligible) || defaultAsset(eligible);
}

export function assetLabel(asset) {
  return asset.label || shapeLabels[asset.variant] || asset.variant;
}

export function assetWarnings(asset) {
  const notes = [];
  if (asset.status === 'historical') notes.push('历史素材，不代表现行标识');
  if (/(?:^|[-\s])NC(?:[-\s]|$)/i.test(asset.rights?.license || '')) notes.push('仅限非商业用途');
  for (const note of asset.usageWarnings || []) if (note && !notes.includes(note)) notes.push(note);
  if (
    assetFormat(asset) !== 'SVG' &&
    asset.width &&
    asset.height &&
    (Math.max(asset.width, asset.height) < 256 ||
      (Math.max(asset.width, asset.height) < 512 && Math.min(asset.width, asset.height) < 128))
  )
    notes.push('低分辨率原图，请留意实际像素尺寸');
  return [...new Set(notes)];
}

export function filterOptions(brands) {
  return {
    types: [...new Set(brands.map((brand) => brand.entityType).filter(Boolean))].sort(),
    formats: [...new Set(brands.flatMap((brand) => brand.assets.map(assetFormat)))].sort(),
  };
}

export function matchingBrands(
  brands,
  {
    q = '',
    type = '',
    format = '',
    shape = '',
    usage = '',
    layout = '',
    language = '',
    color = '',
    status = '',
    category = '',
    topic = '',
  } = {},
) {
  const available = sortCatalogBrands(brands)
    .filter((brand) => !type || brand.entityType === type)
    .filter((brand) => matchesCategory(brand, category))
    .filter((brand) => !topic || brand.topics?.includes(topic))
    .map((brand) => {
      const eligible = brand.assets.filter(
        (asset) =>
          (!format || assetFormat(asset) === format) &&
          (!shape ||
            (shape === 'pure-icon'
              ? asset.variant === 'icon' && asset.language === 'none'
              : asset.variant === shape)) &&
          (!usage || asset.usage === usage) &&
          (!layout || asset.layout === layout) &&
          (!language || asset.language === language) &&
          (!color || asset.color === color) &&
          (!status || asset.status === status),
      );
      const assets = matchingAssets({ ...brand, assets: eligible }, q);
      // Keep reviewed artwork declarations intact; artworkGroups intersects members.
      return assets.length === brand.assets.length ? brand : { ...brand, assets };
    })
    .filter((brand) => brand.assets.length);
  return filterBrands(available, q);
}

export function readDirectoryState(url, brands) {
  const params = new URL(url).searchParams;
  const facetValue = (key) => {
    const value = params.get(key) || '';
    return Object.hasOwn(assetFacetLabels[key], value) ? value : '';
  };
  const options = filterOptions(brands);
  const shapes = [
    ...new Set(brands.flatMap((brand) => brand.assets.map((asset) => asset.variant))),
    'pure-icon',
  ];
  const type = params.get('type') || '';
  const format = params.get('format') || '';
  const shape = params.get('shape') || '';
  // The former AI category spans several industries in the current catalog.
  const legacyAi = params.get('category') === 'ai';
  const category = legacyAi ? '' : normalizeCategory(params.get('category') || '');
  const topic = params.get('topic') || (legacyAi ? 'ai' : '');
  const availableCategories = categoryOptions(brands).flatMap((group) => [
    group,
    ...(group.children ?? []),
  ]);
  return {
    q: params.get('q') || '',
    type: options.types.includes(type) ? type : '',
    format: options.formats.includes(format) ? format : '',
    shape: shapes.includes(shape) ? shape : '',
    usage: facetValue('usage'),
    layout: facetValue('layout'),
    language: facetValue('language'),
    color: facetValue('color'),
    status: facetValue('status'),
    category: availableCategories.some((option) => option.id === category) ? category : '',
    topic: topicOptions(brands).some((option) => option.id === topic) ? topic : '',
  };
}

export function directoryUrl(baseUrl, state) {
  const url = new URL(baseUrl);
  for (const key of directoryFilterKeys) {
    if (state[key])
      url.searchParams.set(key, key === 'category' ? normalizeCategory(state[key]) : state[key]);
    else url.searchParams.delete(key);
  }
  return url;
}
