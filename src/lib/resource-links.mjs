export function assetPath(asset) {
  const path = String(asset.path || '');
  if (
    !path ||
    /^(?:\/|[a-z][a-z\d+.-]*:)/i.test(path) ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Asset paths must stay inside the catalog');
  }
  return path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function siteRootUrl(pageUrl, relativeRoot = './') {
  if (!['./', '../../'].includes(relativeRoot)) throw new Error('Unknown site root');
  return new URL(relativeRoot, pageUrl).href;
}

export function fixedAssetUrl(asset, sourceCommit) {
  return /^[a-f\d]{40}$/i.test(sourceCommit || '')
    ? `https://raw.githubusercontent.com/didilili/logodock/${sourceCommit}/${assetPath(asset)}`
    : null;
}

export function resourceLinks({ asset, brand, baseUrl, sourceCommit }) {
  const path = assetPath(asset);
  const current = new URL(path, baseUrl).href;
  const fixed = fixedAssetUrl(asset, sourceCommit);
  const address = fixed || current;
  const alt = `${brand.name} ${asset.label || 'Logo'}`;
  return {
    current,
    fixed,
    html: `<img src="${escapeHtml(address)}" alt="${escapeHtml(alt)}">`,
    markdown: `![${alt.replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ')}](${address})`,
  };
}

export async function copyText(value, clipboard) {
  try {
    if (!clipboard?.writeText) return false;
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
