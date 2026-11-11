<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { DropdownMenu, Popover } from 'bits-ui';
  import type { Brand } from '../types';
  import type { CopyFeedbackApi } from './CopyFeedback.svelte';
  import CopyField from './CopyField.svelte';
  import CopyMenu from './CopyMenu.svelte';
  import Icon from './Icon.svelte';
  import SourceInfo from './SourceInfo.svelte';
  import {
    assetFormat,
    assetLabel,
    assetDisplayLabel,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import {
    artworkGroups,
    primaryArtworkGroups,
    alternativeArtworkGroups,
    isAlternativeArtwork,
    preferredArtworkAsset,
    selectedArtwork,
    artworkSourceFiles,
  } from '../catalog-artworks.mjs';
  import { assetPath, fixedAssetUrl, resourceLinks } from '../resource-links.mjs';
  import {
    escapeHtml,
    fileInfo,
    provenanceLabel,
    sourceLabel,
    sourceInformation,
  } from '../catalog-display.mjs';
  import { canCopyPngImage } from '../clipboard-image.mjs';
  import { renderSvgPng } from '../svg-export';

  type Asset = Brand['assets'][number];
  type Artwork = ReturnType<typeof artworkGroups>[number];
  type PreviewBackground = 'light' | 'dark' | 'transparent';
  interface Props {
    brand: Brand;
    asset: Asset;
    sourceCommit: string;
    basePath: string;
    pageUrl: string;
    backgroundChoice?: PreviewBackground;
    sourceDetailsOpen?: boolean;
    feedback?: CopyFeedbackApi;
    assetHref: (file: string) => string;
    shareHref: (file: string) => string;
    onSelectAsset: (event: MouseEvent, file: string) => void;
    onBackgroundChange: (value: PreviewBackground) => void;
  }
  let {
    brand,
    asset,
    sourceCommit,
    basePath,
    pageUrl,
    backgroundChoice,
    sourceDetailsOpen = $bindable(true),
    feedback,
    assetHref,
    shareHref,
    onSelectAsset,
    onBackgroundChange,
  }: Props = $props();

  const backgroundOptions = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'transparent', label: '棋盘格' },
  ] as const;
  let canCopyImage = $state(false);
  let previewStatus = $state('');
  let dimensions = $state<{ file: string; width: number; height: number }>();
  let density = $state(1);
  let exporting = $state(false);
  let previewImage: HTMLImageElement | undefined;
  let downloadLink: HTMLAnchorElement | undefined;
  let alive = true;

  const path = $derived(`${basePath}/${assetPath(asset)}`);
  const format = $derived(assetFormat(asset));
  const copying = $derived(feedback?.pending(path) ?? false);
  const artworks = $derived(primaryArtworkGroups(brand));
  const alternativeArtworks = $derived(alternativeArtworkGroups(brand));
  const artwork = $derived(selectedArtwork(brand, asset)!);
  const originalAsset = $derived(
    brand.assets.find((entry) => entry.file === asset.provenance.originalAsset),
  );
  const sourceFiles = $derived(artworkSourceFiles(brand, asset));
  const sourceInfo = $derived(sourceInformation([asset, ...sourceFiles]));
  const canGeneratePng = $derived(
    format === 'SVG' && !artwork.assets.some((item) => assetFormat(item) === 'PNG'),
  );
  const formatChoices = $derived(
    [...new Set(artwork.assets.map(assetFormat))].map((value) => ({
      format: value,
      asset: value === format ? asset : preferredArtworkAsset(artwork, value),
    })),
  );
  const fileAlternatives = $derived(artwork.assets.filter((item) => assetFormat(item) === format));
  const alt = $derived(`${brand.name} ${assetLabel(asset)}`);
  const background = $derived(backgroundChoice ?? (asset.background === 'dark' ? 'dark' : 'light'));
  const warnings = $derived(assetWarnings(asset));
  const rasterSize = $derived(dimensions && dimensions.file === asset.file ? dimensions : asset);
  const rasterWidth = $derived(
    format === 'SVG' || !rasterSize.width || !rasterSize.height
      ? undefined
      : `${rasterSize.width / density}px`,
  );
  const rasterHeight = $derived(
    format === 'SVG' || !rasterSize.width || !rasterSize.height
      ? undefined
      : `${rasterSize.height / density}px`,
  );
  const info = $derived(fileInfo({ ...asset, width: rasterSize.width, height: rasterSize.height }));
  const links = $derived.by(() => {
    if (pageUrl)
      return resourceLinks({
        asset,
        brand,
        baseUrl: new URL(`${basePath}/`, pageUrl).href,
        sourceCommit,
      });
    const fixed = fixedAssetUrl(asset, sourceCommit);
    const address = fixed || path;
    return {
      current: path,
      fixed,
      html: `<img src="${escapeHtml(address)}" alt="${escapeHtml(alt)}">`,
      markdown: `![${alt.replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ')}](${address})`,
    };
  });

  function external(value?: string) {
    return /^https:\/\/[^\s\\]+$/i.test(value || '') ? value : '#';
  }
  function sourceUrl() {
    return new URL(path, pageUrl || location.href).href;
  }
  function artworkLabel(item: Artwork) {
    return item.assets.length > 1 ? item.label : assetDisplayLabel(item.defaultAsset);
  }
  function artworkFile(item: Artwork) {
    return item.id === artwork.id ? asset : preferredArtworkAsset(item, format);
  }
  function imageLoaded(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    previewStatus = '';
    if (format !== 'SVG' && image.naturalWidth)
      dimensions = { file: asset.file, width: image.naturalWidth, height: image.naturalHeight };
  }

  async function downloadGeneratedPng() {
    if (!canGeneratePng || !feedback || exporting) return;
    const controller = feedback;
    const token = controller.reset();
    // Copying can replace the toast while this export still belongs to the
    // current keyed workspace. Selection changes destroy it and cancel export.
    const isCurrent = () => alive;
    const size = 2048;
    exporting = true;
    try {
      const result = await renderSvgPng(sourceUrl(), size, isCurrent);
      if (!result || !isCurrent()) return;
      const pngUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `${brand.id}-${asset.file.replace(/\.svg$/i, '')}-export-${size}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 10000);
      if (controller.isCurrent(token))
        await controller.show(
          `已下载 ${result.width} × ${result.height} px PNG（由 SVG 生成 · 长边 ${size}px）。`,
        );
    } catch {
      if (isCurrent() && controller.isCurrent(token))
        await controller.show('PNG 生成未完成，请下载原始 SVG 后重试。');
    } finally {
      exporting = false;
    }
  }

  function restoreDownloadFocus(event: Event) {
    if (!exporting) return;
    event.preventDefault();
    downloadLink?.focus({ preventScroll: true });
  }

  function copyImage() {
    return feedback?.copyImage({
      url: sourceUrl(),
      format,
      downloadName: `${brand.id}-${asset.file}`,
    });
  }

  function copySvg() {
    return feedback?.copySvg({
      url: sourceUrl(),
      downloadName: `${brand.id}-${asset.file}`,
    });
  }

  const copyItems = $derived([
    {
      id: 'image',
      label: '复制图片',
      hint: !canCopyImage
        ? '浏览器不支持'
        : format === 'PNG'
          ? '原始 PNG'
          : format === 'SVG'
            ? 'PNG · 长边 2048px'
            : 'PNG · 原始尺寸',
      disabled: !canCopyImage || copying,
      onselect: copyImage,
    },
    ...(format === 'SVG'
      ? [{ id: 'svg', label: 'SVG 源码', hint: '原始代码', disabled: copying, onselect: copySvg }]
      : []),
    {
      id: 'current',
      label: '图片地址',
      hint: '当前原文件的地址',
      onselect: () => feedback?.copy(links.current, '图片地址'),
    },
    {
      id: 'markdown',
      label: 'Markdown 引用',
      hint: links.fixed ? '固定版本链接' : '当前文件链接',
      onselect: () => feedback?.copy(links.markdown, 'Markdown 引用'),
    },
    {
      id: 'html',
      label: 'HTML 代码',
      hint: links.fixed ? '固定版本链接' : '当前文件链接',
      onselect: () => feedback?.copy(links.html, 'HTML 代码'),
    },
    ...(links.fixed
      ? [
          {
            id: 'fixed',
            label: '固定版本地址',
            hint: '当前版本原件',
            onselect: () => feedback?.copy(links.fixed || '', '固定版本地址'),
          },
        ]
      : []),
    {
      id: 'share',
      label: '素材分享地址',
      hint: '含当前选择',
      onselect: () => feedback?.copy(shareHref(asset.file), '素材分享地址'),
    },
  ]);

  onMount(() => {
    const updateDensity = () => (density = window.devicePixelRatio || 1);
    updateDensity();
    window.addEventListener('resize', updateDensity);
    canCopyImage = canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem);
    if (format !== 'SVG' && previewImage?.complete && previewImage.naturalWidth) {
      dimensions = {
        file: asset.file,
        width: previewImage.naturalWidth,
        height: previewImage.naturalHeight,
      };
    }
    return () => window.removeEventListener('resize', updateDensity);
  });
  onDestroy(() => {
    alive = false;
  });
</script>

{#snippet artworkOption(item: Artwork)}
  {@const file = artworkFile(item)}
  <a
    class="variant-option"
    href={assetHref(file.file)}
    data-select-artwork={item.id}
    data-select-asset={file.file}
    data-selection-kind="artwork"
    aria-current={item.id === artwork.id ? 'true' : 'false'}
    onclick={(event) => onSelectAsset(event, file.file)}
  >
    <span
      class="variant-thumb"
      data-background={item.defaultAsset.background === 'dark' ? 'dark' : 'light'}
      ><img
        src={`${basePath}/${assetPath(item.defaultAsset)}`}
        alt=""
        width="52"
        height="36"
        loading="lazy"
      /></span
    >
    <span class="variant-label"
      >{artworkLabel(item)}<small
        >{[...new Set(item.assets.map(assetFormat))].join(' / ')}{item.defaultAsset.status ===
        'historical'
          ? ' · 历史'
          : ''}{isAlternativeArtwork(item) ? ' · 备选' : ''}</small
      ></span
    ><span class="variant-check" aria-hidden="true">✓</span>
  </a>
{/snippet}

<div class="asset-main">
  <section class="preview-column" aria-label="标识预览">
    <div class="preview-stage">
      <div
        class="detail-canvas"
        id="detail-canvas"
        data-background={background}
        data-variant={asset.variant}
      >
        <img
          id="detail-image"
          bind:this={previewImage}
          src={path}
          {alt}
          width="640"
          height="360"
          style:--raster-width={rasterWidth}
          style:--raster-height={rasterHeight}
          data-native-size={format !== 'SVG' && !rasterWidth ? 'unknown' : undefined}
          decoding="async"
          onload={imageLoaded}
          onerror={() => {
            previewStatus = '预览未能加载，请尝试下载原始文件。';
          }}
        />
      </div>
      <div class="preview-bottom">
        <div class="preview-heading">
          <span class="preview-label" aria-hidden="true">预览背景</span>
          <Popover.Root>
            <Popover.Trigger class="preview-help" aria-label="预览背景说明">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                aria-hidden="true"
                ><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></svg
              >
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                class="preview-help-content"
                role="dialog"
                aria-label="预览背景说明"
                side="top"
                align="start"
                sideOffset={8}
                collisionPadding={12}>背景仅用于预览，下载保留原始文件。</Popover.Content
              >
            </Popover.Portal>
          </Popover.Root>
        </div>
        <fieldset class="preview-controls">
          <legend>预览背景</legend>
          {#each backgroundOptions as option (option.value)}
            <label title={option.label}
              ><input
                type="radio"
                name="preview-background"
                value={option.value}
                checked={background === option.value}
                onchange={() => onBackgroundChange(option.value)}
              /><span class="background-swatch" data-swatch={option.value}></span><span
                >{option.label}</span
              ></label
            >
          {/each}
        </fieldset>
      </div>
    </div>
    <p class="preview-status" id="preview-status" role="status" aria-live="polite">
      {previewStatus}
    </p>
  </section>
  <div class="asset-controls">
    <section class="asset-action-panel" aria-label="取用当前文件">
      <div class="file-meta">
        <p class="file-info" id="detail-fileinfo">
          {info}{#if asset.display === 'alternative'}<span>备选文件</span>{/if}
        </p>
        <a
          id="detail-source-link"
          href={external(asset.sourcePage)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`查看来源，${sourceLabel(asset)}`}
          >{sourceLabel(asset)}<Icon name="external" size={14} /></a
        >
      </div>
      {#if asset.qualityNotes?.length}
        <p class="asset-description">{asset.qualityNotes.join(' ')}</p>
      {/if}
      {#if warnings.length}<ul class="asset-warnings">
          {#each warnings as note (note)}<li>{note}</li>{/each}
        </ul>{/if}
      <div class="download-actions">
        <div class="download-button" class:has-options={canGeneratePng}>
          <a
            class="button button-primary"
            id="download-link"
            bind:this={downloadLink}
            href={path}
            download={`${brand.id}-${asset.file}`}><Icon name="download" />下载 {format}</a
          >
          {#if canGeneratePng}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                id="download-options"
                class="button button-primary download-options-trigger"
                aria-label="选择下载格式"
                disabled={!feedback || exporting}
                aria-busy={exporting}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
                >
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  class="download-menu-content"
                  data-download-menu-content=""
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                  onCloseAutoFocus={restoreDownloadFocus}
                >
                  <DropdownMenu.Item
                    class="download-menu-item"
                    data-download-kind="png"
                    textValue="下载 PNG"
                    onSelect={downloadGeneratedPng}
                  >
                    <span>下载 PNG</span><small>由 SVG 生成 · 长边 2048px</small>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          {/if}
        </div>
        <CopyMenu
          id="detail-copy-menu"
          items={copyItems}
          busy={copying}
          disabled={!feedback}
          ariaLabel="复制当前标识"
          class="detail-copy-trigger"
        />
      </div>
      {#if exporting}<p class="download-status" role="status">正在生成 PNG…</p>{/if}
    </section>
    <section class="version-section" aria-label="选择标识">
      {#if artworks.length > 1 || alternativeArtworks.length}
        <div class="section-heading">
          <h2>选择标识</h2>
          <span>{artworks.length} 项</span>
        </div>
        <div class="variant-list" aria-label="标识样式">
          {#each artworks as item (item.id)}
            {@render artworkOption(item)}
          {/each}
        </div>
      {:else}<h2 class="asset-title">{artworkLabel(artwork)}</h2>{/if}
      {#if alternativeArtworks.length}
        <details class="artwork-alternatives" open={isAlternativeArtwork(artwork)}>
          <summary>更多版本 <span>{alternativeArtworks.length} 项</span></summary>
          <div class="variant-list" aria-label="备选标识">
            {#each alternativeArtworks as item (item.id)}
              {@render artworkOption(item)}
            {/each}
          </div>
        </details>
      {/if}
    </section>
    {#if formatChoices.length > 1 || fileAlternatives.length > 1}
      <section class="file-section" aria-label="文件选择">
        {#if formatChoices.length > 1}
          <fieldset class="format-choices">
            <legend>文件格式</legend>
            <div class="format-option-list">
              {#each formatChoices as item (item.format)}
                <a
                  class="format-option"
                  href={assetHref(item.asset.file)}
                  data-select-asset={item.asset.file}
                  data-selection-kind="format"
                  aria-current={item.format === format ? 'true' : 'false'}
                  onclick={(event) => onSelectAsset(event, item.asset.file)}
                  >{item.format}{#if item.asset.display === 'alternative'}<small>备选</small
                    >{/if}</a
                >
              {/each}
            </div>
          </fieldset>
        {/if}
        {#if fileAlternatives.length > 1}
          <details class="file-options" open={asset.display === 'alternative'}>
            <summary>更多文件</summary>
            <div class="file-option-list">
              {#each fileAlternatives as item (item.file)}
                <a
                  class="file-option"
                  href={assetHref(item.file)}
                  data-select-asset={item.file}
                  data-selection-kind="file"
                  aria-current={item.file === asset.file ? 'true' : 'false'}
                  onclick={(event) => onSelectAsset(event, item.file)}
                  ><span
                    >{assetDisplayLabel(item)}{item.display === 'alternative'
                      ? ' · 备选'
                      : ''}</span
                  ><small>{provenanceLabel(item)} · {fileInfo(item)}</small></a
                >
              {/each}
            </div>
          </details>
        {/if}
      </section>
    {/if}
    {#if sourceFiles.length}
      <section class="source-files" aria-label="原生设计文件">
        <h2>原生设计文件</h2>
        <ul>
          {#each sourceFiles as entry (entry.file)}
            <li data-source-file={entry.file}>
              <a
                class="source-file-download"
                href={`${basePath}/${assetPath(entry)}`}
                download={`${brand.id}-${entry.file}`}
                ><span>{entry.label}</span><span
                  >下载 {assetFormat(entry)}<Icon name="download" size={14} /></span
                ></a
              >
              <div class="source-file-meta">
                <span>{fileInfo(entry)}</span>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    <details class="resource-details source-details" bind:open={sourceDetailsOpen}>
      <summary
        >来源与使用说明{#if sourceInfo.attributions.length}<span>需署名</span>{/if}</summary
      >
      <div class="source-fields">
        {#if originalAsset}
          <dl class="source-list original-source">
            <dt>原始素材</dt>
            <dd>
              <a
                href={assetHref(originalAsset.file)}
                data-original-asset={originalAsset.file}
                data-selection-kind="artwork"
                onclick={(event) => onSelectAsset(event, originalAsset.file)}
                >{assetDisplayLabel(originalAsset)}</a
              >
            </dd>
          </dl>
        {/if}
        <SourceInfo information={sourceInfo} licenseId="detail-license-link" />
      </div>
    </details>
  </div>
</div>

<div class="detail-extras">
  <details class="resource-details embed-details">
    <summary>嵌入代码</summary>
    <div class="resource-fields">
      <CopyField
        id="current-address"
        label="图片地址"
        value={links.current}
        oncopy={(value, label) => feedback?.copy(value, label)}
      />
      {#if links.fixed}<CopyField
          id="fixed-address"
          label="固定版本地址"
          value={links.fixed}
          oncopy={(value, label) => feedback?.copy(value, label)}
        />
        <p class="link-hint" id="snippet-hint">嵌入代码使用固定版本。</p>{/if}
      <CopyField
        id="html-example"
        label="HTML"
        value={links.html}
        multiline
        oncopy={(value, label) => feedback?.copy(value, label)}
      />
      <CopyField
        id="markdown-example"
        label="Markdown"
        value={links.markdown}
        multiline
        oncopy={(value, label) => feedback?.copy(value, label)}
      />
    </div>
  </details>
</div>

<style>
  .asset-main {
    display: grid;
    grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr);
    align-items: start;
    gap: 40px;
  }
  .preview-column,
  .asset-controls {
    min-width: 0;
  }
  .preview-stage {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
  }
  .detail-canvas {
    display: grid;
    place-items: center;
    height: 300px;
    padding: 38px;
    background: #f7f8fa;
  }
  .detail-canvas[data-background='dark'] {
    background: #22262c;
  }
  .detail-canvas[data-background='transparent'] {
    background-color: #fff;
    background-image: conic-gradient(#e7e9ed 25%, transparent 0 50%, #e7e9ed 0 75%, transparent 0);
    background-size: 16px 16px;
  }
  .detail-canvas img {
    display: block;
    width: 100%;
    height: 100%;
    max-width: var(--raster-width, 100%);
    max-height: min(224px, var(--raster-height, 224px));
    object-fit: contain;
  }
  .detail-canvas[data-variant='icon'] img {
    width: 150px;
    height: 150px;
    max-width: min(80%, var(--raster-width, 150px));
  }
  .detail-canvas img[data-native-size='unknown'] {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 224px;
  }
  .detail-canvas[data-variant='icon'] img[data-native-size='unknown'] {
    max-width: min(80%, 150px);
    max-height: 150px;
  }
  .preview-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 62px;
    padding: 8px 14px;
    border-top: 1px solid var(--line);
  }
  .preview-label {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .preview-heading {
    display: flex;
    align-items: center;
  }
  .preview-heading :global(.preview-help) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    min-height: 40px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .preview-heading :global(.preview-help:hover) {
    background: var(--hover);
    color: var(--ink);
  }
  :global(.preview-help-content) {
    z-index: 50;
    max-width: min(260px, calc(100vw - 24px));
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 8px 28px #15264312;
    font-size: 12px;
    line-height: 1.65;
  }
  .preview-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 3px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .preview-controls legend {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
  .preview-controls label {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .preview-controls label:has(input:checked) {
    color: var(--accent, var(--focus));
    border-color: var(--line-strong);
    background: var(--accent-soft, var(--hover));
  }
  .preview-controls input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    appearance: none;
    border: 0;
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
  }
  .background-swatch {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    border: 1px solid #b8bec7;
    border-radius: 50%;
    background: #fff;
  }
  .background-swatch[data-swatch='dark'] {
    background: #22262c;
  }
  .background-swatch[data-swatch='transparent'] {
    background: conic-gradient(#cbd0d7 25%, #fff 0 50%, #cbd0d7 0 75%, #fff 0);
    background-size: 6px 6px;
  }
  .preview-status {
    margin-top: 9px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }
  .preview-status:empty {
    display: none;
  }
  .asset-controls {
    display: grid;
    gap: 22px;
  }
  .version-section {
    order: 1;
  }
  .file-section {
    order: 2;
  }
  .asset-action-panel {
    order: 3;
  }
  .source-files {
    order: 4;
  }
  .source-details {
    order: 5;
  }
  .source-files h2 {
    margin-bottom: 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  .source-files ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .source-files li + li {
    margin-top: 12px;
  }
  .source-file-download {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .source-file-download > span:last-child {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
  }
  .source-file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .source-file-meta {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  .section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .section-heading h2,
  .format-choices legend {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  .section-heading > span {
    color: var(--muted);
    font-size: 12px;
  }
  .asset-title {
    margin: 0;
    color: var(--ink);
    font-size: 16px;
    line-height: 1.6;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .variant-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .artwork-alternatives {
    margin-top: 10px;
  }
  .artwork-alternatives > summary {
    width: fit-content;
    min-height: 42px;
    padding-block: 10px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .artwork-alternatives > summary > span {
    margin-left: 6px;
  }
  .variant-option {
    position: relative;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 10px;
    align-items: center;
    gap: 9px;
    min-width: 0;
    min-height: 66px;
    padding: 9px;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
  }
  .variant-option:hover {
    border-color: var(--line-strong);
  }
  .variant-option[aria-current='true'] {
    border-color: var(--accent, var(--focus));
    color: var(--accent, var(--focus));
    background: var(--accent-soft, var(--hover));
  }
  .variant-thumb {
    display: grid;
    place-items: center;
    width: 44px;
    height: 40px;
    padding: 4px;
    border-radius: 4px;
    background: #f7f8fa;
  }
  .variant-thumb[data-background='dark'] {
    background: #22262c;
  }
  .variant-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .variant-label {
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.6;
  }
  .variant-label small {
    display: block;
    margin-top: 2px;
    color: var(--muted);
    font-size: 12px;
  }
  .variant-check {
    visibility: hidden;
    color: var(--accent, var(--focus));
    font-size: 12px;
  }
  .variant-option[aria-current='true'] .variant-check {
    visibility: visible;
  }
  .format-choices {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .format-choices legend {
    margin-bottom: 12px;
    padding: 0;
  }
  .format-option-list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }
  .format-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 62px;
    min-height: 42px;
    padding: 9px 13px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 400;
    text-decoration: none;
  }
  .format-option:hover {
    border-color: var(--line-strong);
  }
  .format-option small {
    font-size: 11px;
  }
  .format-option[aria-current='true'] {
    border-color: var(--accent, var(--focus));
    color: var(--accent, var(--focus));
    background: var(--accent-soft, var(--hover));
  }
  .file-options {
    margin-top: 8px;
    color: var(--muted);
    font-size: 12px;
  }
  .file-options > summary {
    width: fit-content;
    min-height: 42px;
    padding-block: 10px;
    cursor: pointer;
  }
  .file-option-list {
    display: grid;
    gap: 6px;
    margin-top: 5px;
  }
  .file-option {
    display: grid;
    gap: 4px;
    min-height: 54px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 5px;
    text-decoration: none;
  }
  .file-option[aria-current='true'] {
    border-color: var(--accent, var(--focus));
    color: var(--accent, var(--focus));
  }
  .file-option:hover {
    background: var(--hover);
  }
  .file-option small {
    color: var(--muted);
    font-size: 12px;
  }
  .file-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    column-gap: 12px;
    margin-top: 3px;
  }
  #detail-source-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 40px;
    max-width: 100%;
    padding-inline: 4px;
    border-radius: 4px;
    color: var(--muted);
    font-size: 12px;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
  }
  #detail-source-link:hover {
    color: var(--ink);
  }
  .file-info {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px 10px;
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .file-info > span {
    padding-left: 10px;
    border-left: 1px solid var(--line);
  }
  .asset-description {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }
  .asset-action-panel .asset-warnings {
    margin: 12px 0 0;
    padding: 9px 12px 9px 26px;
    font-size: 12px;
    line-height: 1.65;
  }
  .download-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 8px;
    margin-top: 12px;
  }
  .download-button > a,
  .download-actions :global(.detail-copy-trigger) {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding: 10px 14px;
    font-size: 13px;
  }
  .download-button {
    display: flex;
    min-width: 0;
  }
  .download-button > a {
    flex: 1;
  }
  .download-button.has-options > a {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .download-button :global(.download-options-trigger) {
    flex: 0 0 44px;
    min-height: 46px;
    padding: 0;
    border-left-color: color-mix(in srgb, var(--on-accent) 25%, var(--accent));
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .download-button :global(.download-options-trigger:disabled) {
    cursor: default;
  }
  :global(.download-menu-content) {
    z-index: 60;
    max-width: calc(100vw - 24px);
    max-height: var(--bits-dropdown-menu-content-available-height, calc(100vh - 24px));
    overflow-y: auto;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    color: var(--ink);
    box-shadow:
      0 8px 32px #17223524,
      0 2px 5px #1722350a;
    outline: none;
  }
  :global(.download-menu-item) {
    display: grid;
    gap: 3px;
    min-height: 44px;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.5;
    cursor: pointer;
    outline: none;
    user-select: none;
  }
  :global(.download-menu-item[data-highlighted]) {
    background: var(--hover);
    color: var(--focus);
  }
  :global(.download-menu-item small),
  .download-status {
    color: var(--muted);
    font-size: 12px;
  }
  .download-status {
    margin-top: 8px;
  }
  .resource-details > summary {
    min-height: 44px;
    padding-block: 12px;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
  }
  .source-details {
    margin-top: 0;
  }
  .source-details summary > span {
    margin-left: 8px;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--muted);
    background: var(--surface);
    font-size: 12px;
  }
  .source-fields {
    padding-block: 10px 16px;
  }
  .source-list {
    display: grid;
    grid-template-columns: 62px minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    font-size: 13px;
  }
  .source-list dt {
    color: var(--muted);
  }
  .source-list dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .source-list a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .original-source {
    margin-bottom: 12px;
  }
  .detail-extras {
    margin-top: 38px;
  }
  .detail-extras > details {
    min-width: 0;
    border-top: 1px solid var(--line);
  }
  .resource-fields {
    display: grid;
    gap: 16px;
    padding-block: 12px 18px;
  }
  .link-hint {
    margin-top: -6px;
    color: var(--muted);
    font-size: 12px;
  }
  @media (max-width: 980px) and (min-width: 721px) {
    .asset-main {
      gap: 26px;
    }
    .detail-canvas {
      padding: 26px;
    }
    .variant-option {
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 7px;
      padding: 8px;
    }
    .variant-thumb {
      width: 36px;
    }
    .variant-check {
      position: absolute;
      top: 3px;
      right: 5px;
    }
  }
  @media (max-width: 720px) {
    .asset-main {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .asset-controls {
      display: contents;
    }
    .preview-column {
      width: 100%;
    }
    .detail-canvas {
      height: 168px;
      padding: 24px;
    }
    .detail-canvas img {
      max-height: min(120px, var(--raster-height, 120px));
    }
    .detail-canvas img[data-native-size='unknown'] {
      max-height: 120px;
    }
    .detail-canvas[data-variant='icon'] img {
      width: 98px;
      height: 98px;
    }
    .detail-canvas[data-variant='icon'] img[data-native-size='unknown'] {
      width: auto;
      height: auto;
      max-width: min(80%, 98px);
      max-height: 98px;
    }
    .preview-bottom {
      min-height: 54px;
      padding: 6px 10px;
    }
    .preview-controls {
      gap: 1px;
    }
    .preview-controls label {
      min-height: 40px;
      padding: 7px;
      gap: 4px;
    }
    .preview-label {
      font-size: 12px;
    }
    .asset-action-panel {
      order: 1;
      width: 100%;
    }
    .version-section {
      order: 2;
      width: 100%;
    }
    .file-section {
      order: 3;
      width: 100%;
    }
    .source-details {
      order: 4;
      width: 100%;
    }
    .variant-option {
      grid-template-columns: 38px minmax(0, 1fr);
      min-height: 68px;
      gap: 7px;
      padding: 8px;
    }
    .variant-thumb {
      width: 38px;
      height: 38px;
    }
    .variant-check {
      position: absolute;
      top: 4px;
      right: 5px;
      font-size: 12px;
    }
    .download-actions {
      margin-top: 12px;
    }
    .download-button > a,
    .download-actions :global(.detail-copy-trigger) {
      padding-inline: 10px;
    }
    .detail-extras {
      margin-top: 24px;
    }
  }
  @media (max-width: 360px) {
    .preview-label {
      display: none;
    }
    .preview-bottom {
      justify-content: center;
    }
    .variant-list {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
