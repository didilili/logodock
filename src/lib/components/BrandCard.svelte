<script lang="ts">
  import { onMount } from 'svelte';
  import type { Asset, Brand } from '../types';
  import { identityNames } from '../catalog-display.mjs';
  import {
    directoryAsset,
    assetDescription,
    assetDownloadName,
    assetFormat,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import { assetPath } from '../resource-links.mjs';
  import { directoryPreviewBounds, directoryPreviewSize } from '../catalog-preview.mjs';
  import Icon from './Icon.svelte';
  import CopyMenu from './CopyMenu.svelte';
  import type { CopyResult } from './CopyFeedback.svelte';

  let {
    brand,
    basePath,
    href,
    oncopy,
    getRevision,
    onsave,
    ready,
    canCopyImage = false,
    copying = false,
    query = '',
  }: {
    brand: Brand;
    basePath: string;
    href: string;
    ready: boolean;
    canCopyImage?: boolean;
    copying?: boolean;
    query?: string;
    getRevision?: () => number | undefined;
    oncopy: (
      brand: Brand,
      asset: Asset,
      kind: 'current' | 'html' | 'markdown' | 'svg' | 'image',
    ) => CopyResult | void | Promise<CopyResult | void>;
    onsave: () => void;
  } = $props();

  let density = $state(1);
  let loadedSize = $state<{ file: string; width: number; height: number }>();
  let failedFile = $state('');
  const asset = $derived(directoryAsset(brand, query));
  const previewFailed = $derived(failedFile === asset.file);
  const assetTitle = $derived(assetDescription(asset));
  $effect(() => {
    if (asset.file) failedFile = '';
  });
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
            label: '复制 SVG 源码',
            hint: '原始代码',
            disabled: copying,
            onselect: () => oncopy(brand, asset, 'svg'),
          },
        ]
      : []),
    {
      id: 'image',
      label: '复制图片',
      hint: !canCopyImage
        ? '浏览器不支持'
        : assetFormat(asset) === 'PNG'
          ? '原始 PNG'
          : assetFormat(asset) === 'SVG'
            ? 'PNG · 长边 2048px'
            : 'PNG · 原始尺寸',
      disabled: !canCopyImage || copying,
      onselect: () => oncopy(brand, asset, 'image'),
    },
    {
      id: 'current',
      label: '图片地址',
      hint: '当前文件',
      onselect: () => oncopy(brand, asset, 'current'),
    },
    {
      id: 'markdown',
      label: 'Markdown 引用',
      hint: '文档引用',
      onselect: () => oncopy(brand, asset, 'markdown'),
    },
    {
      id: 'html',
      label: 'HTML 代码',
      hint: '嵌入图片',
      onselect: () => oncopy(brand, asset, 'html'),
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
    aria-label={`${previewFailed ? '预览未能加载，' : ''}查看 ${names.primary}，${assetTitle}`}
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
      {#if previewFailed}
        <span class="card-preview-error">
          <span>预览未能加载</span>
          <span>查看素材详情</span>
        </span>
      {:else}<span
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
            onerror={() => {
              failedFile = asset.file;
            }}
          /></span
        >{/if}
    </div>
    <div class="brand-identity">
      <div class="card-brand-heading">
        <h2 title={names.primary}>{names.primary}</h2>
        <Icon name="chevron-right" size={14} />
      </div>
      {#if names.secondary}<p class="brand-english" title={names.secondary}>
          {names.secondary}
        </p>{/if}
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
  </a>
  <div class="card-actions">
    <a
      class="card-download"
      href={`${basePath}/${assetPath(asset)}`}
      download={assetDownloadName(brand, asset)}
      aria-label={`下载 ${names.primary} ${assetTitle} ${assetFormat(asset)} 原文件`}
      ><Icon name="download" size={16} /><span>下载 {assetFormat(asset)}</span></a
    >
    <CopyMenu
      brandId={brand.id}
      items={copyItems}
      {getRevision}
      label="复制"
      ariaLabel={`复制 ${names.primary} 标识`}
      class="card-copy"
      disabled={!ready}
    />
  </div>
</article>

<style>
  .card-brand-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-brand-heading :global(svg) {
    color: var(--muted);
  }
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
  .brand-card:hover,
  .brand-card:focus-within {
    border-color: var(--line-strong);
  }
  .brand-link {
    display: block;
    flex: 1;
    min-width: 0;
    text-decoration: none;
  }
  .brand-link:focus-visible {
    outline-offset: -3px;
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
  .card-preview-error {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: var(--type-caption);
    text-align: center;
  }
  .card-preview-error > span:last-child {
    color: var(--focus);
    text-decoration: underline;
    text-underline-offset: 3px;
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
  .brand-identity {
    min-height: 66px;
    padding: 12px 14px;
  }
  .brand-identity h2 {
    font-size: var(--type-body);
    font-weight: 650;
    line-height: 1.5;
  }
  .brand-identity h2 {
    display: block;
    overflow: hidden;
    padding: 1px 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .brand-link:hover h2 {
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
  .card-restrictions {
    overflow: hidden;
    color: var(--warning-ink);
    font-size: var(--type-caption);
    line-height: 1.6;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 4px;
  }
  .card-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 4px;
    margin-top: auto;
    padding: 5px 8px;
    border-top: 1px solid var(--line);
  }
  .card-download {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 0 6px;
    border-radius: 5px;
    color: var(--ink);
    font-size: var(--type-small);
    text-decoration: none;
    white-space: nowrap;
  }
  .card-download:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .card-actions :global(.card-copy) {
    min-width: 0;
    gap: 5px;
    padding: 0 6px;
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
    .brand-identity {
      min-height: 60px;
      padding: 10px;
    }
    .brand-identity h2 {
      font-size: var(--type-small);
    }
    .card-actions {
      padding: 4px;
      gap: 2px;
    }
    .card-download {
      font-size: var(--type-caption);
      padding-inline: 2px;
    }
    .card-download :global(svg),
    .card-actions :global(.card-copy[data-copy-state='idle'] > .copy-feedback-icon),
    .card-actions :global(.card-copy:not([data-copy-state='idle']) > .copy-menu-chevron) {
      display: none;
    }
    .card-actions :global(.card-copy > .copy-feedback-icon) {
      width: 12px;
      height: 12px;
    }
    .card-actions :global(.card-copy) {
      font-size: var(--type-caption);
      padding-inline: 0;
      gap: 2px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-card {
      transition: none;
    }
  }
</style>
