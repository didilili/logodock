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

/**
 * @param {{
 *   loadText: () => Promise<string>,
 *   clipboard?: Clipboard,
 *   ClipboardItemType?: typeof ClipboardItem,
 *   isCurrent?: () => boolean,
 * }} options
 * @returns {Promise<{status: 'copied' | 'failed' | 'stale', value?: string}>}
 */
export async function copyDeferredText({
  loadText,
  clipboard,
  ClipboardItemType,
  isCurrent = () => true,
}) {
  if (!isCurrent()) return { status: 'stale' };
  let canWriteDeferred = false;
  try {
    canWriteDeferred =
      typeof clipboard?.write === 'function' &&
      typeof ClipboardItemType === 'function' &&
      (typeof ClipboardItemType.supports !== 'function' ||
        ClipboardItemType.supports('text/plain'));
  } catch {
    // A failed capability probe can still leave writeText or manual copying available.
  }

  const text = (async () => loadText())();
  text.catch(() => {});
  if (!canWriteDeferred) {
    const value = await text;
    if (!isCurrent()) return { status: 'stale' };
    const copied = await copyText(value, clipboard);
    return isCurrent() ? { status: copied ? 'copied' : 'failed', value } : { status: 'stale' };
  }

  const textBlob = text.then((value) => {
    if (!isCurrent()) throw new Error('Stale text selection');
    return new Blob([value], { type: 'text/plain' });
  });
  textBlob.catch(() => {});
  let copied = false;
  try {
    // Submit within the click. Loading the source can outlast user activation.
    await clipboard.write([new ClipboardItemType({ 'text/plain': textBlob })]);
    copied = true;
  } catch {
    // Wait for the source below so permission failures retain the manual fallback.
  }
  const value = await text;
  return isCurrent() ? { status: copied ? 'copied' : 'failed', value } : { status: 'stale' };
}
