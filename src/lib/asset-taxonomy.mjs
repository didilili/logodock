export const shapeLabels = { icon: '图形标', wordmark: '字标', logo: '组合标' };
export const usageLabels = { 'app-icon': '应用图标' };
export const layoutLabels = { horizontal: '横向', vertical: '上下排列', standalone: '独立' };
export const languageLabels = { zh: '中文', en: '英文', bilingual: '中英双语', none: '无文字' };
export const colorLabels = {
  brand: '品牌色',
  black: '黑色',
  white: '白色',
  monochrome: '单色',
  other: '其他配色',
};
export const statusLabels = { current: '现行', historical: '历史' };
const languageNames = { zh: '中文', en: '英文', bilingual: '中英双语', none: '' };
const symbolTextLabels = { en: '含英文字母', zh: '含中文', bilingual: '含中英文字' };

export const assetFacetLabels = {
  usage: usageLabels,
  layout: layoutLabels,
  language: languageLabels,
  color: colorLabels,
  status: statusLabels,
};

export const directoryFilterKeys = [
  'q',
  'type',
  'format',
  'shape',
  'usage',
  'layout',
  'language',
  'color',
  'status',
  'category',
  'topic',
];

/** Preserve a readable fallback for callers that only provide a file and label. */
function cleanLabel(label = '') {
  return label
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

/** Short titles name reviewed composition and language, with layout kept in attributes. */
export function assetDisplayLabel(asset) {
  if (asset.usage === 'app-icon') return usageLabels['app-icon'];
  if (!asset.variant || !asset.language || !asset.layout)
    return cleanLabel(asset.label) || shapeLabels[asset.variant] || '标识';
  if (asset.variant === 'icon') return shapeLabels.icon;
  const language = languageNames[asset.language] || '';
  return `${language}${shapeLabels[asset.variant] || '标识'}`;
}

/** Keep source-specific differences that the structured attributes cannot express. */
export function assetDetailLabel(asset) {
  let detail = cleanLabel(asset.label)
    .replace(/[（(](?:Google Play|App Store|Commons|官方[^）)]*)[）)]/giu, '')
    .replace(/官方(?:官网(?:页头)?|素材包|品牌素材库|Brand World)?|官网(?:页头)?|Commons/giu, '')
    .replace(/中英双语|中英文(?!字)|中英|中文(?!口号|标语)|英文(?!口号|标语)|无文字|无字/gu, '')
    .replace(
      /应用(?:图标|标识|字标)|独立符号|字母符号|文字符号|图形标识|文字标识|组合标识|图文组合|独立图形|图形标|文字标|文字|组合标|图形|字标|组合|标识|图标/gu,
      '',
    )
    .replace(/横向排列|上下排列|横版|竖版|横式|竖式|横向|竖向|独立/gu, '')
    .replace(/\b(?:SVG|PNG|JPEG|JPG|WEBP)\b|原件|矢量/giu, '')
    .replace(/品牌色|彩色/gu, '');
  if (asset.color === 'white') detail = detail.replace(/白色|反白/gu, '');
  if (asset.color === 'black') detail = detail.replace(/黑色/gu, '');
  if (asset.color === 'monochrome') detail = detail.replace(/单色/gu, '');
  return detail
    .replace(/[与及和]口号/gu, '含口号')
    .replace(/[（(]\s*[）)]/gu, '')
    .replace(/(?:^|\s*[·，,]\s*)[与及和的]?\s*(?=$|[·，,])/gu, '')
    .replace(/^[\s·，,、与及和的]+|[\s·，,、与及和的]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Compact attributes supplement the title without repeating its composition. */
export function assetAttributes(asset) {
  return [
    asset.layout !== 'standalone' ? layoutLabels[asset.layout] : '',
    ...(asset.usage === 'app-icon'
      ? [
          languageNames[asset.language] || languageLabels[asset.language],
          shapeLabels[asset.variant],
        ]
      : []),
    asset.usage !== 'app-icon' && asset.variant === 'icon' ? symbolTextLabels[asset.language] : '',
    colorLabels[asset.color],
    asset.status === 'historical' ? statusLabels.historical : '',
    asset.provenance?.processing === 'extracted' ? '图形提取版' : '',
    asset.display === 'alternative' ? '备选' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Image descriptions and copied references keep differences omitted from short titles. */
export function assetDescription(asset) {
  if (!asset.variant || !asset.language || !asset.layout) return assetDisplayLabel(asset);
  const attributes = assetAttributes(asset)
    .split(' · ')
    .filter((attribute) => attribute && attribute !== colorLabels.brand);
  return [assetDisplayLabel(asset), ...attributes, assetDetailLabel(asset)]
    .filter(Boolean)
    .join(' · ');
}

/** Artwork titles retain group-specific differences while sharing the naming vocabulary. */
export function artworkDisplayLabel(asset, label) {
  if (!asset.variant || !asset.language || !asset.layout) return label || assetDisplayLabel(asset);
  const detail = assetDetailLabel({ ...asset, label });
  return [assetDisplayLabel(asset), detail].filter(Boolean).join(' · ');
}

/** Download names are readable without changing the registered source path or bytes. */
export function assetDownloadName(brand, asset) {
  const extension = asset.file.split('.').pop();
  const detail = assetDetailLabel(asset)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const parts = [
    brand.id,
    asset.usage || asset.variant,
    asset.language,
    asset.layout,
    asset.color,
    asset.status === 'historical' ? 'historical' : '',
    detail,
  ];
  return `${parts.filter(Boolean).join('-')}.${extension}`;
}
