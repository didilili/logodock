export function normalizeQuery(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

const names = new Intl.Collator('zh-CN', { sensitivity: 'base', numeric: true });
const sourceLabels = { official: '官方', commons: 'Commons' };
const processingLabels = {
  original: '原件 原始文件',
  rendered: '渲染',
  extracted: '图形提取版',
};
const shapeLabels = {
  icon: '图形 图标 图形标 独立图形 独立符号',
  wordmark: '文字 字标',
  logo: '组合标识 图文组合',
};
const languageLabels = {
  none: '无字',
  zh: '中文',
  en: '英文',
  bilingual: '中英 中英文 中文 英文',
};
const layoutLabels = {
  standalone: '独立',
  horizontal: '横版 横向',
  vertical: '竖版 竖向 上下排列',
};
const fileColorLabels = {
  orange: '橙色',
  red: '红色',
  blue: '蓝色',
  green: '绿色',
  black: '黑色',
  white: '白色',
  gray: '灰色',
  grey: '灰色',
};

export function sortBrands(brands) {
  return [...brands].sort((a, b) => names.compare(a.name, b.name) || names.compare(a.id, b.id));
}

function primaryText(brand) {
  return normalizeQuery(
    [
      brand.name,
      brand.identity?.nameZh,
      brand.identity?.nameEn,
      ...(brand.aliases || []),
      ...(brand.identity?.legalNames || []).map((item) => item.name),
      brand.id,
    ].join(' '),
  );
}

// Brand identity and domain are shared; remaining terms must describe one file.
// Returning the original asset objects lets every directory action use that file.
export function matchingAssets(brand, query) {
  const identity = `${primaryText(brand)} ${normalizeQuery(brand.website)}`;
  const terms = normalizeQuery(query)
    .split(' ')
    .filter((term) => term && !identity.includes(term));
  if (!terms.length) return [...brand.assets];
  return brand.assets.filter((asset) => {
    const text = normalizeQuery(
      [
        asset.file,
        asset.label,
        assetDisplayLabel(asset),
        assetAttributes(asset),
        usageLabels[asset.usage],
        asset.color,
        colorLabels[asset.color],
        asset.rights?.license,
        asset.variant,
        shapeLabels[asset.variant],
        asset.variant === 'icon' && asset.language === 'en' ? '字母符号' : '',
        asset.variant === 'icon' && asset.language !== 'none' ? '文字符号' : '',
        languageLabels[asset.language],
        layoutLabels[asset.layout],
        ...asset.file
          .toLowerCase()
          .split(/[-_.]/u)
          .map((word) => fileColorLabels[word]),
        asset.provenance?.sourceType,
        asset.provenance?.processing,
        sourceLabels[asset.provenance?.sourceType],
        processingLabels[asset.provenance?.processing],
        ...(asset.qualityNotes || []),
      ].join(' '),
    );
    // Keep negated descriptions searchable without treating them as transparent artwork.
    const transparencyText = text.replace(/(?:不|非)透明/gu, '');
    return terms.every((term) => {
      const positiveTransparency = term.includes('透明') && !/(?:不|非)透明/u.test(term);
      return (positiveTransparency ? transparencyText : text).includes(term);
    });
  });
}

export function filterBrands(brands, query) {
  const terms = normalizeQuery(query).split(' ').filter(Boolean);
  if (!terms.length) return [...brands];
  return brands
    .map((brand, index) => {
      const primary = primaryText(brand);
      const matches = matchingAssets(brand, query).length > 0;
      const score = terms.reduce((sum, term) => sum + (primary.includes(term) ? 1 : 0), 0);
      return { brand, index, matches, score };
    })
    .filter((match) => match.matches)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.brand);
}
import { assetAttributes, assetDisplayLabel, colorLabels, usageLabels } from './asset-taxonomy.mjs';
