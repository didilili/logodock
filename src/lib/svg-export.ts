export interface PngExport {
  blob: Blob;
  width: number;
  height: number;
}

/** Render an SVG without changing its aspect ratio or painting its background. */
export async function renderSvgPng(
  url: string,
  size: 512 | 1024 | 2048,
  isCurrent: () => boolean,
): Promise<PngExport | null> {
  let objectUrl: string | undefined;
  try {
    const response = await fetch(url);
    if (!isCurrent()) return null;
    if (!response.ok) throw new Error('Source unavailable');
    const svg = await response.text();
    if (!isCurrent()) return null;
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const node = parsed.documentElement;
    if (node.localName !== 'svg' || parsed.querySelector('parsererror'))
      throw new Error('Invalid SVG');
    const source = node as unknown as SVGSVGElement;
    const viewBox = source
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    let width = viewBox?.[2] ?? 0;
    let height = viewBox?.[3] ?? 0;
    if (!(width > 0 && height > 0)) {
      const sourceWidth = source.width.baseVal;
      const sourceHeight = source.height.baseVal;
      if (
        [sourceWidth, sourceHeight].some(
          (length) => length.unitType === SVGLength.SVG_LENGTHTYPE_PERCENTAGE,
        )
      )
        throw new Error('Unknown aspect ratio');
      width = sourceWidth.value;
      height = sourceHeight.value;
      // Dimension-only originals need a viewBox before changing their dimensions.
      if (width > 0 && height > 0) source.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0))
      throw new Error('Unknown aspect ratio');
    const outputWidth = Math.max(1, Math.round((size * width) / Math.max(width, height)));
    const outputHeight = Math.max(1, Math.round((size * height) / Math.max(width, height)));
    source.setAttribute('width', String(outputWidth));
    source.setAttribute('height', String(outputHeight));
    objectUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(source)], { type: 'image/svg+xml' }),
    );
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!isCurrent()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG export failed'))),
        'image/png',
      ),
    );
    return isCurrent() ? { blob, width: outputWidth, height: outputHeight } : null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
