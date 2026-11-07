import { assetFormat } from './catalog-presentation.mjs';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function brandRoute(brand, root = './') {
  const id = encodeURIComponent(brand.id).replace(/\./g, '%2E');
  return `${root}logos/${id}/`;
}
export function identityNames(brand) {
  const zh = brand.identity?.nameZh;
  const en = brand.identity?.nameEn;
  return { primary: zh || en || brand.name, secondary: zh && en && zh !== en ? en : '' };
}
export function websiteDomain(brand) {
  try { return new URL(brand.website).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function fileInfo(asset) {
  const pixels = asset.width && asset.height && assetFormat(asset) !== 'SVG' ? `${asset.width} × ${asset.height} px · ` : '';
  return `${pixels}${assetFormat(asset)} · ${(Number(asset.bytes || 0) / 1024).toFixed(1)} KB`;
}
export function provenanceLabel(asset) {
  if (asset.provenance?.sourceType === 'official') return asset.provenance.processing === 'rendered' ? '官方来源 · 渲染文件' : '官方来源 · 原始文件';
  if (asset.provenance?.sourceType === 'commons') return asset.provenance.processing === 'rendered' ? 'Wikimedia Commons · 渲染文件' : 'Wikimedia Commons · 原始文件';
  return '来源见素材说明';
}

export const shapeLabels = { icon: '图形', wordmark: '字标', logo: '组合' };
