import { assetFormat } from './catalog-presentation.mjs';

export function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function brandRoute(brand, root = './') {
  const id = encodeURIComponent(brand.id).replace(/\./g, '%2E');
  return `${root}logo/${id}/`;
}
export function identityNames(brand) {
  const zh = brand.identity?.nameZh;
  const en = brand.identity?.nameEn;
  const primary = brand.name || zh || en || '';
  return { primary, secondary: en && en !== primary ? en : '' };
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
const processingSuffixes = { rendered: '渲染图', extracted: '图形提取版' };
const processingLabels = {
  original: '原始文件',
  rendered: '渲染文件',
  extracted: '图形提取版',
};

export function sourceLabel(asset) {
  const placement = sourcePlacements[asset.provenance?.placement];
  const label =
    (asset.provenance?.channel === 'website' && placement && `官网${placement}`) ||
    sourceChannelLabels[asset.provenance?.channel] ||
    sourceChannelLabels[asset.provenance?.sourceType] ||
    '来源';
  const suffix = processingSuffixes[asset.provenance?.processing];
  return suffix ? `${label} · ${suffix}` : label;
}

export function licenseLabel(asset) {
  if (asset.rights?.status === 'unverified') return '许可未核实';
  const license = asset.rights?.license || '';
  if (!/^Public domain\b/i.test(license)) return license;
  if (/^https:\/\/commons\.wikimedia\.org(?:[/?#]|$)/i.test(asset.rights?.reference || ''))
    return 'Commons 公共领域判定';
  return /third-party assessment/i.test(license) ? '公共领域（第三方判定）' : '公共领域';
}

export function provenanceLabel(asset) {
  const processing = processingLabels[asset.provenance?.processing] || '原始文件';
  if (asset.provenance?.pageTitle) {
    const page = [asset.provenance.pageTitle, sourcePlacements[asset.provenance.placement]]
      .filter(Boolean)
      .join(' · ');
    return `${page} · ${processing}`;
  }
  if (asset.provenance?.sourceType === 'official') return `官方来源 · ${processing}`;
  if (asset.provenance?.sourceType === 'commons') return `Wikimedia Commons · ${processing}`;
  return '来源见素材说明';
}

/** Combine related files without repeating source URLs or shared usage conditions.
 * @param {(import('./types').Asset | import('./types').SourceFile)[]} entries
 */
export function sourceInformation(entries) {
  const links = new Map();
  const notes = new Map();
  const attributions = new Map();
  for (const [index, entry] of entries.entries()) {
    const licensed = entry.rights.status === 'permitted';
    const references = [
      {
        url: entry.sourcePage,
        kind: '来源',
        label: 'provenance' in entry ? provenanceLabel(entry) : '原生设计文件来源',
      },
      {
        url: entry.source,
        kind: '来源文件',
        label: 'provenance' in entry ? '查看来源文件' : '查看设计文件来源',
      },
      {
        url: entry.rights.reference,
        kind: licensed ? '许可' : '使用说明',
        label: licensed ? licenseLabel(entry) : '查看使用说明',
      },
    ];
    for (const reference of references) {
      const existing = links.get(reference.url);
      if (!existing)
        links.set(reference.url, { ...reference, licenses: [], files: [], primaryLicense: false });
      const link = links.get(reference.url);
      if (!link.files.includes(entry.label)) link.files.push(entry.label);
      if (licensed && reference.kind === '许可') {
        if (link.kind === '来源') link.description = link.label;
        let declaration = link.licenses.find((item) => item.label === reference.label);
        if (!declaration) {
          declaration = { label: reference.label, files: [] };
          link.licenses.push(declaration);
        }
        if (!declaration.files.includes(entry.label)) declaration.files.push(entry.label);
        link.kind = reference.kind;
        link.label = link.licenses.length === 1 ? reference.label : '查看许可说明';
        link.primaryLicense ||= index === 0;
      }
    }
    const attribution =
      licensed && !/^(?:Public domain\b|CC0(?:-|$))/i.test(entry.rights.license)
        ? entry.rights.attribution
        : '';
    const usageNote = entry.rights.notes
      ?.replace(/(?:^|，相应)许可及署名条件待核实[。.]?$/u, '')
      .trim();
    for (const [collection, text] of [
      [notes, usageNote],
      [attributions, attribution],
    ]) {
      if (!text) continue;
      if (!collection.has(text)) collection.set(text, { text, files: [] });
      collection.get(text).files.push(entry.label);
    }
  }
  return {
    links: [...links.values()],
    notes: [...notes.values()],
    attributions: [...attributions.values()],
    fileCount: entries.length,
  };
}

export {
  shapeLabels,
  usageLabels,
  layoutLabels,
  languageLabels,
  colorLabels,
  statusLabels,
} from './asset-taxonomy.mjs';
