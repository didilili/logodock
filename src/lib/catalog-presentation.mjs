import { filterBrands, matchingAssets, sortBrands } from './catalog-search.mjs';
import { artworkGroups } from './catalog-artworks.mjs';

export const entityLabels = { company: '公司', product: '产品', organization: '组织' };
export const categoryLabels = {
  internet: '互联网',
  'code-hosting': '代码托管',
  'developer-tools': '开发工具',
  hardware: '硬件与设备',
  telecommunications: '通信',
  ai: '人工智能',
  'enterprise-software': '企业软件',
  software: '软件与服务',
  automotive: '汽车',
  'e-commerce': '电子商务',
  entertainment: '娱乐',
  'industrial-automation': '工业自动化',
  'social-media': '社交媒体',
};
export const sortCatalogBrands = sortBrands;
const variantLabels = { icon: '图形标识', wordmark: '文字标识', logo: '组合标识' };

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
  const hasCurrent = scopedBrand.assets.some(
    (asset) => asset.status === 'current' && asset.display !== 'alternative',
  );
  const squareAssets = scopedBrand.assets.filter((asset) => {
    const ratio =
      asset.aspectRatio ?? (asset.width && asset.height ? asset.width / asset.height : undefined);
    return (
      asset.display !== 'alternative' &&
      (!hasCurrent || asset.status === 'current') &&
      Number.isFinite(ratio) &&
      Math.abs(ratio - 1) < 0.0001
    );
  });
  const squares = artworkGroups({ ...scopedBrand, assets: squareAssets })
    .map((group) => group.defaultAsset)
    .sort(
      (a, b) =>
        Number(a.variant !== 'icon') - Number(b.variant !== 'icon') ||
        Number(a.background === 'dark') - Number(b.background === 'dark') ||
        Number(assetFormat(a) !== 'SVG') - Number(assetFormat(b) !== 'SVG') ||
        Number(a.color !== 'brand') - Number(b.color !== 'brand'),
    );
  return squares[0] ?? defaultAsset(scopedBrand);
}

export function assetLabel(asset) {
  return asset.label || variantLabels[asset.variant] || asset.variant;
}

export function assetDisplayLabel(asset) {
  // Format and provenance have dedicated places in the interface.
  return assetLabel(asset)
    .replace(/\s*[（(](?:Commons (?:原件|渲染)|官方\s*(?:(?:内嵌)?原生 PNG|SVG|原件))[）)]/gi, '')
    .replace(/[（(]官方透明 PNG[）)]/gi, '（透明）')
    .replace(/\s*·\s*([^·]+)$/u, (suffix, description) => {
      const detail = description
        .replace(/^(?:官方 Brand World|官方官网(?:页头)?|官方素材包|Commons)\s*/iu, '')
        .replace(/^官方(?=高清透明(?:\s|$))/u, '')
        .replace(/\b(?:SVG|PNG|JPEG|JPG)\b/gi, '')
        .replace(/\s*原件\s*$/u, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (detail === description) return suffix;
      return detail ? ` · ${detail}` : '';
    })
    .trim();
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

export function categoryOptions(brands) {
  const counts = new Map();
  for (const brand of brands)
    for (const category of new Set(brand.categories ?? []))
      counts.set(category, (counts.get(category) ?? 0) + 1);
  // Known labels keep their established order; metadata supplies any other tags.
  const categories = [
    ...Object.keys(categoryLabels).filter((id) => counts.has(id)),
    ...[...counts.keys()].filter((id) => !Object.hasOwn(categoryLabels, id)).sort(),
  ];
  return [
    { id: '', label: '全部品牌', count: brands.length },
    ...categories.map((id) => ({
      id,
      label: Object.hasOwn(categoryLabels, id) ? categoryLabels[id] : id,
      count: counts.get(id),
    })),
  ];
}

export function matchingBrands(
  brands,
  { q = '', type = '', format = '', shape = '', category = '' } = {},
) {
  const available = sortBrands(brands)
    .filter((brand) => !type || brand.entityType === type)
    .filter((brand) => !category || brand.categories?.includes(category))
    .map((brand) => {
      const eligible = brand.assets.filter(
        (asset) =>
          (!format || assetFormat(asset) === format) && (!shape || asset.variant === shape),
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
  const options = filterOptions(brands);
  const shapes = [
    ...new Set(brands.flatMap((brand) => brand.assets.map((asset) => asset.variant))),
  ];
  const type = params.get('type') || '';
  const format = params.get('format') || '';
  const shape = params.get('shape') || '';
  const category = params.get('category') || '';
  return {
    q: params.get('q') || '',
    type: options.types.includes(type) ? type : '',
    format: options.formats.includes(format) ? format : '',
    shape: shapes.includes(shape) ? shape : '',
    category: categoryOptions(brands).some((option) => option.id === category) ? category : '',
  };
}

export function directoryUrl(baseUrl, state) {
  const url = new URL(baseUrl);
  for (const key of ['q', 'type', 'format', 'shape', 'category']) {
    if (state[key]) url.searchParams.set(key, state[key]);
    else url.searchParams.delete(key);
  }
  return url;
}
