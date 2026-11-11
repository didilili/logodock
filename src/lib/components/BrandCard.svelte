<script lang="ts">
  import { onMount } from 'svelte';
  import type { Asset, Brand } from '../types';
  import { identityNames } from '../catalog-display.mjs';
  import {
    directoryAsset,
    assetDisplayLabel,
    assetFormat,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import { assetPath } from '../resource-links.mjs';
  import { directoryPreviewBounds, directoryPreviewSize } from '../catalog-preview.mjs';
  import Icon from './Icon.svelte';
  import CopyMenu from './CopyMenu.svelte';

  let {
    brand,
    basePath,
    href,
    oncopy,
    onsave,
    ready,
    query = '',
  }: {
    brand: Brand;
    basePath: string;
    href: string;
    ready: boolean;
    query?: string;
    oncopy: (brand: Brand, asset: Asset, kind: 'current' | 'html' | 'markdown' | 'svg') => void;
    onsave: () => void;
  } = $props();

  let density = $state(1);
  let loadedSize = $state<{ file: string; width: number; height: number }>();
  const asset = $derived(directoryAsset(brand, query));
  const previewBounds = $derived(directoryPreviewBounds(asset));
  const rasterSize = $derived(
    loadedSize && loadedSize.file === asset.file
      ? loadedSize
      : { width: asset.width, height: asset.height },
  );
  const previewSize = $derived(directoryPreviewSize(asset, rasterSize));
  const rasterWidth = $derived(
    assetFormat(asset) === 'SVG' || !rasterSize.width || !rasterSize.height
      ? undefined
      : `${rasterSize.width / density}px`,
  );
  const rasterHeight = $derived(
    assetFormat(asset) === 'SVG' || !rasterSize.width || !rasterSize.height
      ? undefined
      : `${rasterSize.height / density}px`,
  );
  const names = $derived(identityNames(brand));
  const restrictions = $derived(
    assetWarnings(asset).filter(
      (note) => note === '历史素材，不代表现行标识' || note === '仅限非商业用途',
    ),
  );
  const restrictionSummary = $derived(
    restrictions
      .map((note) => (note === '历史素材，不代表现行标识' ? '历史' : '仅非商业'))
      .join(' · '),
  );
  const copyItems = $derived([
    ...(assetFormat(asset) === 'SVG'
      ? [
          {
            id: 'svg',
            label: 'SVG 源码',
            hint: '原始代码',
            onselect: () => oncopy(brand, asset, 'svg'),
          },
        ]
      : []),
    { id: 'html', label: 'HTML', hint: '嵌入图片', onselect: () => oncopy(brand, asset, 'html') },
    {
      id: 'markdown',
      label: 'Markdown',
      hint: '文档引用',
      onselect: () => oncopy(brand, asset, 'markdown'),
    },
    {
      id: 'current',
      label: '图片地址',
      hint: '当前文件',
      onselect: () => oncopy(brand, asset, 'current'),
    },
  ]);

  onMount(() => {
    const updateDensity = () => (density = window.devicePixelRatio || 1);
    updateDensity();
    window.addEventListener('resize', updateDensity);
    return () => window.removeEventListener('resize', updateDensity);
  });
</script>

<article class="brand-card" data-brand={brand.id}>
  <a
    class="brand-link"
    {href}
    onclick={onsave}
    data-brand-link={brand.id}
    aria-label={`查看 ${names.primary}，${assetDisplayLabel(asset)}`}
    data-sveltekit-reload
  >
    <div
      class="brand-art"
      data-background={asset.background === 'dark' ? 'dark' : 'light'}
      data-variant={asset.variant}
      data-shape={previewSize.shape}
      style:--preview-width={`${previewSize.width}px`}
      style:--preview-height={`${previewSize.height}px`}
    >
      <span
        class="preview-frame"
        data-framed={previewBounds ? 'true' : undefined}
        style:--preview-width-ratio={previewBounds
          ? previewBounds.sourceWidth / previewBounds.width
          : undefined}
        style:--preview-height-ratio={previewBounds
          ? previewBounds.sourceWidth / previewBounds.height
          : undefined}
        style:--preview-x={previewBounds
          ? `${-((previewBounds.x + previewBounds.width / 2) / previewBounds.sourceWidth) * 100}%`
          : undefined}
        style:--preview-y={previewBounds
          ? `${-((previewBounds.y + previewBounds.height / 2) / previewBounds.sourceHeight) * 100}%`
          : undefined}
        ><img
          src={`${basePath}/${assetPath(asset)}`}
          alt=""
          loading="lazy"
          decoding="async"
          width="168"
          height="80"
          style:--raster-width={rasterWidth}
          style:--raster-height={rasterHeight}
          data-native-size={assetFormat(asset) !== 'SVG' && !rasterWidth ? 'unknown' : undefined}
          onload={(event) => {
            const image = event.currentTarget as HTMLImageElement;
            if (assetFormat(asset) !== 'SVG' && image.naturalWidth)
              loadedSize = {
                file: asset.file,
                width: image.naturalWidth,
                height: image.naturalHeight,
              };
          }}
        /></span
      >
    </div>
  </a>
  <div class="card-content">
    <div class="brand-identity">
      <h2><a {href} onclick={onsave} data-sveltekit-reload>{names.primary}</a></h2>
      <p class="brand-english">{names.secondary || '\u00a0'}</p>
    </div>
    <div class="card-versions">
      <a
        class="card-materials"
        {href}
        onclick={onsave}
        aria-label={`查看 ${names.primary} 的 ${brand.assets.length} 份素材`}
        data-sveltekit-reload
        ><span>{brand.assets.length} 份素材</span><Icon name="chevron-right" size={14} /></a
      >
      {#if asset.display === 'alternative'}
        <p
          class="card-restrictions"
          title={[...assetWarnings(asset), ...(asset.qualityNotes ?? [])].join('；')}
        >
          备选{restrictionSummary ? ` · ${restrictionSummary}` : ''}
        </p>
      {:else if restrictions.length}
        <p class="card-restrictions" title={restrictions.join('；')}>{restrictionSummary}</p>
      {/if}
    </div>
    <div class="card-actions">
      <a
        class="card-download"
        href={`${basePath}/${assetPath(asset)}`}
        download={`${brand.id}-${asset.file}`}
        aria-label={`下载 ${names.primary} ${assetFormat(asset)} 原文件`}
        ><Icon name="download" size={16} /><span>下载</span><span class="download-format"
          >{assetFormat(asset)}</span
        ></a
      >
      <CopyMenu
        brandId={brand.id}
        items={copyItems}
        label=""
        ariaLabel={`复制 ${names.primary} 标识`}
        class="card-copy"
        disabled={!ready}
      />
    </div>
  </div>
</article>

<style>
  .brand-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    transition: border-color 150ms ease;
  }
  .brand-card:hover {
    border-color: var(--line-strong);
  }
  .brand-link {
    display: block;
    text-decoration: none;
  }
  .brand-art {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 144px;
    padding: 28px 24px;
    background: #fff;
  }
  .brand-art[data-background='dark'] {
    background: #252a32;
  }
  .preview-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--preview-width);
    height: var(--preview-height);
    max-width: 100%;
    overflow: hidden;
  }
  .brand-art img {
    display: block;
    width: 100%;
    height: 100%;
    max-width: min(100%, var(--raster-width, 100%));
    max-height: min(100%, var(--raster-height, 100%));
    object-fit: contain;
  }
  .brand-art img[data-native-size='unknown'] {
    width: auto;
    height: auto;
  }
  .preview-frame[data-framed='true'] img {
    position: absolute;
    top: 50%;
    left: 50%;
    flex-shrink: 0;
    width: min(
      calc(100% * var(--preview-width-ratio)),
      calc(var(--preview-height) * var(--preview-height-ratio)),
      var(--raster-width, 100000px)
    );
    height: auto;
    max-width: none;
    max-height: none;
    transform: translate(var(--preview-x), var(--preview-y));
  }
  .card-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 10px 12px 8px;
  }
  .brand-identity h2 {
    font-size: var(--type-body);
    font-weight: 650;
    line-height: 1.5;
  }
  .brand-identity h2 a {
    display: block;
    overflow: hidden;
    padding: 1px 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
  }
  .brand-identity h2 a:hover {
    color: var(--focus);
  }
  .brand-english {
    overflow: hidden;
    margin-top: 2px;
    color: var(--muted);
    font-size: var(--type-caption);
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-versions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
    margin-top: 2px;
  }
  .card-materials {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 36px;
    color: var(--muted);
    font-size: var(--type-caption);
    text-decoration: none;
    white-space: nowrap;
  }
  .card-materials:hover {
    color: var(--focus);
  }
  .card-restrictions {
    overflow: hidden;
    color: var(--warning-ink);
    font-size: var(--type-caption);
    line-height: 1.6;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 4px;
    margin-top: auto;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }
  .card-download {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 0 4px;
    border-radius: 5px;
    color: var(--muted);
    font-size: var(--type-small);
    text-decoration: none;
  }
  .card-download:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .download-format {
    margin-left: auto;
    font-size: var(--type-caption);
  }
  .card-actions :global(.card-copy) {
    padding: 0;
    border-color: transparent;
    background: transparent;
  }
  .card-actions :global(.card-copy:hover:not(:disabled)),
  .card-actions :global(.card-copy[data-state='open']) {
    background: var(--hover);
  }
  @media (max-width: 720px) {
    .brand-art {
      height: 128px;
      padding: 24px 18px;
    }
    .card-content {
      padding: 8px 9px 6px;
    }
    .brand-identity h2 {
      font-size: var(--type-small);
    }
    .card-versions,
    .card-materials {
      min-height: 40px;
    }
    .card-download {
      gap: 5px;
      padding-inline: 2px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-card {
      transition: none;
    }
  }
</style>
