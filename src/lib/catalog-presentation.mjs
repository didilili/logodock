import { filterBrands, normalizeQuery, sortBrands } from './catalog-search.mjs';
import { artworkGroups } from './catalog-artworks.mjs';

export const entityLabels = { company: '公司', product: '产品', organization: '组织' };
export const sortCatalogBrands = sortBrands;
const variantLabels = { icon: '图形标识', wordmark: '文字标识', logo: '组合标识' };

export function assetFormat(asset) {
  return asset.file.split('.').pop().toUpperCase();
}

export function defaultAsset(brand, requestedFile) {
  return brand.assets.find((asset) => asset.file === requestedFile)
    || brand.assets.find((asset) => asset.file === brand.defaultAsset)
    || brand.assets.find((asset) => asset.status === 'current')
    || brand.assets[0];
}

export function directoryAsset(brand, query = '') {
  const fallback = defaultAsset(brand);
  const identity = normalizeQuery([
    brand.id, brand.name, brand.website, brand.identity?.nameZh, brand.identity?.nameEn,
    ...(brand.aliases || []), ...(brand.identity?.legalNames || []).map(item => item.name),
  ].join(' '));
  const terms = normalizeQuery(query).split(' ').filter(term => term && !identity.includes(term));
  if (!terms.length) return fallback;
  const scored = brand.assets.map(asset => {
    const text = normalizeQuery([asset.file, asset.label, asset.rights?.license].join(' '));
    return { asset, score: terms.filter(term => text.includes(term)).length };
  });
  const bestScore = Math.max(0, ...scored.map(item => item.score));
  if (!bestScore) return fallback;
  const candidates = scored.filter(item => item.score === bestScore).map(item => item.asset);
  return candidates.find(asset => asset.file === fallback.file)
    || artworkGroups(brand).map(group => group.defaultAsset).find(asset => candidates.includes(asset))
    || candidates[0];
}

export function assetLabel(asset) {
  return asset.label || variantLabels[asset.variant] || asset.variant;
}

export function assetDisplayLabel(asset) {
  // Format and provenance have dedicated places in the interface.
  return assetLabel(asset)
    .replace(/\s*[（(](?:Commons (?:原件|渲染)|官方(?:内嵌)?原生 PNG)[）)]/gi, '')
    .replace(/\s*·\s*([^·]+)$/u, (suffix, description) => {
      if (!/\b(?:SVG|PNG|JPEG|JPG)\b/i.test(description)) return suffix;
      const detail = description.replace(/\b(?:SVG|PNG|JPEG|JPG)\b/gi, '').replace(/原件/g, '').replace(/\s+/g, ' ').trim();
      return detail ? ` · ${detail}` : '';
    })
    .trim();
}

export function assetWarnings(asset) {
  const notes = [];
  if (asset.status === 'historical') notes.push('历史素材，不代表现行标识');
  if (/(?:^|[-\s])NC(?:[-\s]|$)/i.test(asset.rights?.license || '')) notes.push('仅限非商业用途');
  for (const note of asset.qualityNotes || []) if (note && !notes.includes(note)) notes.push(note);
  if (assetFormat(asset) !== 'SVG' && asset.width && asset.height && Math.max(asset.width, asset.height) < 256) notes.push('低分辨率原图，请留意实际像素尺寸');
  return notes;
}

export function filterOptions(brands) {
  return {
    types: [...new Set(brands.map((brand) => brand.entityType).filter(Boolean))].sort(),
    formats: [...new Set(brands.flatMap((brand) => brand.assets.map(assetFormat)))].sort(),
  };
}

export function matchingBrands(brands, { q = '', type = '', format = '', shape = '' } = {}) {
  const available = sortBrands(brands).filter((brand) => !type || brand.entityType === type)
    .map((brand) => format || shape ? { ...brand, assets: brand.assets.filter((asset) => (!format || assetFormat(asset) === format) && (!shape || asset.variant === shape)) } : brand)
    .filter((brand) => brand.assets.length);
  return filterBrands(available, q);
}

export function readDirectoryState(url, brands) {
  const params = new URL(url).searchParams;
  const options = filterOptions(brands);
  const shapes = [...new Set(brands.flatMap(brand => brand.assets.map(asset => asset.variant)))];
  const type = params.get('type') || '';
  const format = params.get('format') || '';
  const shape = params.get('shape') || '';
  return {
    q: params.get('q') || '',
    type: options.types.includes(type) ? type : '',
    format: options.formats.includes(format) ? format : '',
    shape: shapes.includes(shape) ? shape : '',
  };
}

export function directoryUrl(baseUrl, state) {
  const url = new URL(baseUrl);
  for (const key of ['q', 'type', 'format', 'shape']) {
    if (state[key]) url.searchParams.set(key, state[key]);
    else url.searchParams.delete(key);
  }
  return url;
}

// Compatibility helpers for consumers of the original single-page selection state.
export function readCatalogState(url, brands) {
  const params = new URL(url).searchParams;
  const { shape, ...directory } = readDirectoryState(url, brands);
  const state = { ...directory, ...(shape ? { shape } : {}), brandId: '', assetFile: '' };
  const matches = matchingBrands(brands, state);
  const requested = matches.find((brand) => brand.id === params.get('brand'));
  const selected = requested || matches[0];
  if (selected) {
    state.brandId = selected.id;
    state.assetFile = defaultAsset(selected, requested ? params.get('asset') : undefined).file;
  }
  return state;
}

export function catalogUrl(baseUrl, state) {
  const url = directoryUrl(baseUrl, state);
  for (const [key, value] of Object.entries({ q: state.q, type: state.type, format: state.format, brand: state.brandId, asset: state.assetFile })) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return url.href;
}
