// PNG originals keep their source Blob. Other formats can supply a PNG loader.
export function canCopyPngImage(clipboard, ClipboardItemType) {
  try {
    return (
      typeof clipboard?.write === 'function' &&
      typeof ClipboardItemType === 'function' &&
      (typeof ClipboardItemType.supports !== 'function' || ClipboardItemType.supports('image/png'))
    );
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   url?: string,
 *   clipboard?: Clipboard,
 *   ClipboardItemType?: typeof ClipboardItem,
 *   fetcher?: typeof fetch,
 *   loadPng?: () => Promise<Blob>,
 *   isCurrent?: () => boolean,
 * }} options
 */
export async function copyPngImage({
  url,
  clipboard,
  ClipboardItemType,
  fetcher = globalThis.fetch,
  loadPng,
  isCurrent = () => true,
}) {
  if (!canCopyPngImage(clipboard, ClipboardItemType)) return 'unsupported';
  if (!isCurrent()) return 'stale';
  try {
    // Queue write synchronously in the click's activation scope. WebKit loses
    // activation if fetch/blob are awaited before calling clipboard.write.
    const png = (async () => {
      let blob;
      if (loadPng) {
        blob = await loadPng();
      } else {
        const response = await fetcher(url);
        if (!isCurrent()) throw new Error('Stale image selection');
        if (!response.ok) throw new Error('PNG source unavailable');
        blob = await response.blob();
      }
      if (!isCurrent()) throw new Error('Stale image selection');
      if (blob.type !== 'image/png') throw new Error('Source is not a PNG');
      return blob;
    })();
    // If construction or clipboard permission fails immediately, a subsequent
    // source rejection must still be handled without an unhandled promise.
    png.catch(() => {});
    await clipboard.write([new ClipboardItemType({ 'image/png': png })]);
    return isCurrent() ? 'copied' : 'stale';
  } catch {
    return isCurrent() ? 'failed' : 'stale';
  }
}
