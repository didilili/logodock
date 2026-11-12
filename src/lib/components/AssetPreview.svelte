<script lang="ts">
  import type { Asset } from '../types';
  import { directoryPreviewBounds } from '../catalog-preview.mjs';

  let {
    asset,
    src,
    alt = '',
    id,
    fullCanvas = false,
    maxWidth = 520,
    maxHeight = 260,
    density = 1,
    loading = 'eager',
    onload,
    onerror,
  }: {
    asset: Asset;
    src: string;
    alt?: string;
    id?: string;
    fullCanvas?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    density?: number;
    loading?: 'eager' | 'lazy';
    onload?: (event: Event) => void;
    onerror?: () => void;
  } = $props();

  let naturalSize = $state<{ file: string; width: number; height: number }>();
  const bounds = $derived(fullCanvas ? undefined : directoryPreviewBounds(asset));
  const width = $derived(naturalSize?.file === asset.file ? naturalSize.width : asset.width || 0);
  const height = $derived(
    naturalSize?.file === asset.file ? naturalSize.height : asset.height || 0,
  );
  const ratio = $derived(
    bounds ? bounds.width / bounds.height : asset.aspectRatio || width / height || 3,
  );
  const nativeWidth = $derived(
    asset.file.endsWith('.svg') ? Infinity : (bounds?.width || width || Infinity) / density,
  );
  const displayWidth = $derived(Math.min(maxWidth, maxHeight * ratio, nativeWidth));
</script>

<span
  class="artwork-preview"
  data-framed={bounds ? 'true' : undefined}
  style:width={`min(100%, ${displayWidth}px)`}
  style:aspect-ratio={ratio}
>
  <img
    {id}
    {src}
    {alt}
    {loading}
    decoding="async"
    width={asset.width || bounds?.sourceWidth || 640}
    height={asset.height || bounds?.sourceHeight || 360}
    style:width={bounds ? `${(bounds.sourceWidth / bounds.width) * 100}%` : '100%'}
    style:height={bounds ? `${(bounds.sourceHeight / bounds.height) * 100}%` : '100%'}
    style:left={bounds ? `${(-bounds.x / bounds.width) * 100}%` : '0'}
    style:top={bounds ? `${(-bounds.y / bounds.height) * 100}%` : '0'}
    onload={(event) => {
      const image = event.currentTarget as HTMLImageElement;
      if (image.naturalWidth)
        naturalSize = { file: asset.file, width: image.naturalWidth, height: image.naturalHeight };
      onload?.(event);
    }}
    {onerror}
  />
</span>

<style>
  .artwork-preview {
    position: relative;
    display: block;
    flex: 0 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  img {
    position: absolute;
    display: block;
    max-width: none;
    object-fit: contain;
  }
</style>
