import { assetFormat } from './catalog-presentation.mjs';

export function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
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
  try {
    return new URL(brand.website).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function fileInfo(asset) {
  const pixels =
    asset.width && asset.height && assetFormat(asset) !== 'SVG'
      ? `${asset.width} × ${asset.height} px · `
      : '';
  return `${pixels}${assetFormat(asset)} · ${(Number(asset.bytes || 0) / 1024).toFixed(1)} KB`;
}

const sourceChannelLabels = {
  'brand-library': '官方品牌素材下载页',
  repository: '官方仓库',
  website: '官网页面用图',
  'app-store': '官方应用商店',
  commons: 'Commons',
  official: '官方来源',
};

const sourcePlacements = { header: '页头 Logo', footer: '页脚 Logo' };

export function sourceLabel(asset) {
  const placement = sourcePlacements[asset.provenance?.placement];
  const label =
    (asset.provenance?.channel === 'website' && placement && `官网${placement}`) ||
    sourceChannelLabels[asset.provenance?.channel] ||
    sourceChannelLabels[asset.provenance?.sourceType] ||
    '来源';
  return asset.provenance?.processing === 'rendered' ? `${label} · 渲染图` : label;
}

export function licenseLabel(asset) {
  const license = asset.rights?.license || '';
  if (!/^Public domain\b/i.test(license)) return license;
  if (/^https:\/\/commons\.wikimedia\.org(?:[/?#]|$)/i.test(asset.rights?.reference || ''))
    return 'Commons 公共领域判定';
  return /third-party assessment/i.test(license) ? '公共领域（第三方判定）' : '公共领域';
}

export function provenanceLabel(asset) {
  if (asset.provenance?.pageTitle) {
    const page = [asset.provenance.pageTitle, sourcePlacements[asset.provenance.placement]]
      .filter(Boolean)
      .join(' · ');
    const processing = asset.provenance.processing === 'rendered' ? '渲染文件' : '原始文件';
    return `${page} · ${processing}`;
  }
  if (asset.provenance?.sourceType === 'official')
    return asset.provenance.processing === 'rendered'
      ? '官方来源 · 渲染文件'
      : '官方来源 · 原始文件';
  if (asset.provenance?.sourceType === 'commons')
    return asset.provenance.processing === 'rendered'
      ? 'Wikimedia Commons · 渲染文件'
      : 'Wikimedia Commons · 原始文件';
  return '来源见素材说明';
}

export const shapeLabels = { icon: '图形', wordmark: '文字', logo: '图文组合' };
