<script lang="ts">
  import { onMount } from 'svelte';
  import type { Asset, ArtworkGroup, Brand } from '../types';
  import { identityNames } from '../catalog-display.mjs';
  import {
    directoryAsset,
    assetDisplayLabel,
    assetFormat,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import { primaryArtworkGroups, preferredArtworkAsset } from '../catalog-artworks.mjs';
  import { assetPath } from '../resource-links.mjs';
  import Icon from './Icon.svelte';
  import CopyMenu from './CopyMenu.svelte';

  let {
    brand,
    basePath,
    href,
    assetHref,
    oncopy,
    onsave,
    ready,
    query = '',
    onAssetChange,
  }: {
    brand: Brand;
    basePath: string;
    href: string;
    assetHref: (asset: Asset) => string;
    ready: boolean;
    query?: string;
    oncopy: (brand: Brand, asset: Asset, kind: 'current' | 'html' | 'markdown' | 'svg') => void;
    onsave: () => void;
    onAssetChange?: () => void;
  } = $props();

  let selection = $state<{ key: string; file: string } | null>(null);
  let density = $state(1);
  let loadedSize = $state<{ file: string; width: number; height: number }>();
  const selectionKey = $derived(
    JSON.stringify([brand.id, query, brand.assets.map((item) => item.file)]),
  );
  const preferredAsset = $derived(directoryAsset(brand, query));
  const asset = $derived.by(() => {
    const currentSelection = selection;
    return (
      (currentSelection?.key === selectionKey &&
        brand.assets.find((item) => item.file === currentSelection.file)) ||
      preferredAsset
    );
  });
  const artworks = $derived.by(() => {
    const groups = primaryArtworkGroups(brand, assetDisplayLabel);
    const preferred = groups.find((group) =>
      group.assets.some((entry) => entry.file === preferredAsset.file),
    );
    return preferred ? [preferred, ...groups.filter((group) => group !== preferred)] : groups;
  });
  const rasterSize = $derived(
    loadedSize && loadedSize.file === asset.file
      ? loadedSize
      : { width: asset.width, height: asset.height },
  );
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
  const alternativeSummary = $derived(asset.usageWarnings?.[0] ?? asset.qualityNotes?.[0] ?? '');
  const artwork = $derived(
    artworks.find((item) => item.assets.some((file) => file.file === asset.file)),
  );
  const names = $derived(identityNames(brand));
  const detailHref = $derived(selection?.key === selectionKey ? assetHref(asset) : href);
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

  function selectArtwork(event: MouseEvent, group: ArtworkGroup) {
    if (
      !ready ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onAssetChange?.();
    selection = {
      key: selectionKey,
      file: preferredArtworkAsset(group, assetFormat(asset)).file,
    };
  }

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
    href={detailHref}
    onclick={onsave}
    data-brand-link={brand.id}
    aria-label={`查看 ${names.primary}，${assetDisplayLabel(asset)}`}
    data-sveltekit-reload
  >
    <div
      class="brand-art"
      data-background={asset.background === 'dark' ? 'dark' : 'light'}
      data-variant={asset.variant}
    >
      <img
        src={`${basePath}/${assetPath(asset)}`}
        alt=""
        loading="lazy"
        decoding="async"
        width="190"
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
      />
      <span class="asset-format">{assetFormat(asset)}</span>
    </div>
  </a>
  <div class="card-content">
    <div class="brand-identity">
      <h2><a href={detailHref} onclick={onsave} data-sveltekit-reload>{names.primary}</a></h2>
      <p class="brand-english">{names.secondary || '\u00a0'}</p>
    </div>
    <div class="card-versions">
      {#if asset.display === 'alternative'}
        <p
          class="card-alternative"
          title={[...assetWarnings(asset), ...(asset.qualityNotes ?? [])].join('；')}
        >
          <strong
            >备选 · {asset.width && asset.height
              ? `${asset.width} × ${asset.height} px`
              : assetFormat(asset)}{restrictionSummary ? ` · ${restrictionSummary}` : ''}</strong
          >{alternativeSummary ? ` · ${alternativeSummary}` : ''}
        </p>
      {:else if restrictions.length}
        <p class="card-restrictions" title={restrictions.join('；')}>{restrictionSummary}</p>
      {:else if artworks.length > 1}
        <div class="version-thumbnails" aria-label={`${names.primary}的标识版本`}>
          {#each artworks.slice(0, 2) as group (group.id)}
            <a
              class="version-thumbnail"
              href={`${basePath}/${assetPath(group.defaultAsset)}`}
              data-background={group.defaultAsset.background === 'dark' ? 'dark' : 'light'}
              data-card-artwork={group.id}
              aria-current={group.id === artwork?.id ? 'true' : 'false'}
              aria-label={`预览${group.label}`}
              title={group.label}
              onclick={(event) => selectArtwork(event, group)}
            >
              <img
                src={`${basePath}/${assetPath(group.defaultAsset)}`}
                alt=""
                loading="lazy"
                decoding="async"
                width="30"
                height="22"
                style:max-width={assetFormat(group.defaultAsset) !== 'SVG' &&
                group.defaultAsset.width
                  ? `min(100%, ${group.defaultAsset.width / density}px)`
                  : undefined}
                style:max-height={assetFormat(group.defaultAsset) !== 'SVG' &&
                group.defaultAsset.height
                  ? `min(24px, ${group.defaultAsset.height / density}px)`
                  : undefined}
              />
            </a>
          {/each}
          {#if artworks.length > 2}
            <a
              class="more-versions"
              href={detailHref}
              onclick={onsave}
              aria-label={`查看 ${names.primary} 的其他标识`}
              data-sveltekit-reload>+{artworks.length - 2}</a
            >
          {/if}
        </div>
      {:else}
        <p class="single-version" title={artwork?.label || assetDisplayLabel(asset)}>
          {artwork?.label || assetDisplayLabel(asset)}
        </p>
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
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }
  .brand-card:hover {
    border-color: var(--line-strong);
    box-shadow: 0 4px 16px #21314608;
  }
  .brand-link {
    display: block;
    text-decoration: none;
  }
  .brand-art {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 122px;
    padding: 27px 23px;
    border-bottom: 1px solid var(--line);
    background: #f8f9fb;
  }
  .brand-art[data-background='dark'] {
    background: #252a32;
  }
  .brand-art img {
    display: block;
    width: 190px;
    height: 68px;
    max-width: min(100%, var(--raster-width, 190px));
    max-height: min(68px, var(--raster-height, 68px));
    object-fit: contain;
  }
  .brand-art[data-variant='icon'] img {
    width: 68px;
  }
  .brand-art img[data-native-size='unknown'] {
    width: auto;
    height: auto;
    max-width: min(100%, 190px);
    max-height: 68px;
  }
  .brand-art[data-variant='icon'] img[data-native-size='unknown'] {
    max-width: min(100%, 68px);
  }
  .asset-format {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 1px 5px;
    border: 1px solid #e4e8ed;
    border-radius: 3px;
    background: #fffdfc;
    color: #647185;
    font-size: var(--type-caption);
    line-height: 1.5;
  }
  .brand-art[data-background='dark'] .asset-format {
    border-color: #ffffff24;
    background: #ffffff12;
    color: #c8d0dc;
  }
  .card-content {
    padding: 10px 11px 9px;
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
    min-height: 44px;
    margin-top: 6px;
  }
  .card-alternative {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    color: var(--muted);
    font-size: var(--type-caption);
    line-height: 1.5;
  }
  .card-alternative strong {
    color: var(--warning-ink);
    font-weight: 600;
  }
  .version-thumbnails {
    display: flex;
    gap: 4px;
  }
  .version-thumbnail {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: #f8f9fb;
  }
  .version-thumbnail[data-background='dark'] {
    background: #252a32;
  }
  .version-thumbnail[aria-current='true'] {
    border-color: var(--focus);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus) 12%, transparent);
  }
  .version-thumbnail img {
    display: block;
    width: 100%;
    height: 24px;
    max-width: 100%;
    max-height: 24px;
    object-fit: contain;
  }
  .more-versions {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
    border-radius: 4px;
    color: var(--muted);
    font-size: var(--type-caption);
    text-decoration: none;
  }
  .more-versions:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .single-version {
    overflow: hidden;
    color: var(--muted);
    font-size: var(--type-caption);
    line-height: 1.6;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-restrictions {
    color: var(--warning-ink);
    font-size: var(--type-caption);
    line-height: 1.6;
    white-space: nowrap;
  }
  .card-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 5px;
    margin-top: 7px;
    padding-top: 7px;
    border-top: 1px solid var(--line);
  }
  .card-download {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--muted);
    font-size: var(--type-small);
    text-decoration: none;
  }
  .card-download:hover {
    border-color: var(--line-strong);
    background: var(--hover);
    color: var(--ink);
  }
  .download-format {
    margin-left: auto;
    font-size: var(--type-caption);
  }
  @media (max-width: 720px) {
    .brand-art {
      height: 112px;
      padding: 25px 20px;
    }
    .brand-art img {
      height: 62px;
      max-height: min(62px, var(--raster-height, 62px));
    }
    .brand-art[data-variant='icon'] img {
      width: 62px;
    }
    .brand-art img[data-native-size='unknown'] {
      max-height: 62px;
    }
    .brand-art[data-variant='icon'] img[data-native-size='unknown'] {
      max-width: min(100%, 62px);
    }
    .card-content {
      padding: 8px 9px;
    }
    .brand-identity h2 {
      font-size: var(--type-small);
    }
    .version-thumbnail {
      width: 44px;
      height: 44px;
    }
    .more-versions {
      min-width: 44px;
      min-height: 44px;
    }
    .card-download {
      gap: 5px;
      padding-inline: 7px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .brand-card {
      transition: none;
    }
  }
</style>
