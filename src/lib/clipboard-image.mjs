// Clipboard image copying accepts only the original PNG Blob. Other formats
// retain their original download / URL / SVG-code actions instead of conversion.
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

export async function copyPngImage({
  url,
  clipboard,
  ClipboardItemType,
  fetcher = globalThis.fetch,
  isCurrent = () => true,
}) {
  if (!canCopyPngImage(clipboard, ClipboardItemType)) return 'unsupported';
  if (!isCurrent()) return 'stale';
  try {
    // Queue write synchronously in the click's activation scope. WebKit loses
    // activation if fetch/blob are awaited before calling clipboard.write.
    const originalPng = (async () => {
      const response = await fetcher(url);
      if (!isCurrent()) throw new Error('Stale image selection');
      if (!response.ok) throw new Error('PNG source unavailable');
      const blob = await response.blob();
      if (!isCurrent()) throw new Error('Stale image selection');
      if (blob.type !== 'image/png') throw new Error('Source is not a PNG');
      return blob;
    })();
    // If construction or clipboard permission fails immediately, a subsequent
    // source rejection must still be handled without an unhandled promise.
    originalPng.catch(() => {});
    await clipboard.write([new ClipboardItemType({ 'image/png': originalPng })]);
    return isCurrent() ? 'copied' : 'stale';
  } catch {
    return isCurrent() ? 'failed' : 'stale';
  }
}
