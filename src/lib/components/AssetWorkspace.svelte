<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Brand } from '../types';
  import type { CopyFeedbackApi } from './CopyFeedback.svelte';
  import ActionButton from './ActionButton.svelte';
  import CopyField from './CopyField.svelte';
  import Icon from './Icon.svelte';
  import {
    assetFormat,
    assetLabel,
    assetDisplayLabel,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import { artworkGroups, preferredArtworkAsset, selectedArtwork } from '../catalog-artworks.mjs';
  import { assetPath, fixedAssetUrl, resourceLinks } from '../resource-links.mjs';
  import { escapeHtml, fileInfo, provenanceLabel } from '../catalog-display.mjs';
  import { canCopyPngImage, copyPngImage } from '../clipboard-image.mjs';
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
    feedback,
    assetHref,
    shareHref,
    onSelectAsset,
    onBackgroundChange,
  }: Props = $props();

  const backgroundOptions = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'transparent', label: '透明' },
  ] as const;
  let canCopyImage = $state(false);
  let previewStatus = $state('');
  let dimensions = $state<{ width: number; height: number }>();
  let exporting = $state(false);
  let copyingImage = $state(false);
  let exportSize = $state('1024');
  let previewImage: HTMLImageElement | undefined;
  let alive = true;

  const path = $derived(`${basePath}/${assetPath(asset)}`);
  const format = $derived(assetFormat(asset));
  const artworks = $derived(artworkGroups(brand));
  const artwork = $derived(selectedArtwork(brand, asset)!);
  const formatChoices = $derived(
    [...new Set(artwork.assets.map(assetFormat))].map((value) => ({
      format: value,
      asset: value === format ? asset : preferredArtworkAsset(artwork, value),
    })),
  );
  const fileAlternatives = $derived(artwork.assets.filter((item) => assetFormat(item) === format));
  const alt = $derived(`${brand.name} ${assetLabel(asset)}`);
  const background = $derived(backgroundChoice ?? (asset.background === 'dark' ? 'dark' : 'light'));
  const warnings = $derived(assetWarnings({ ...asset, qualityNotes: [] }));
  const notes = $derived(asset.qualityNotes ?? []);
  const attribution = $derived(
    /^(?:Public domain\b|CC0(?:-|$))/i.test(asset.rights?.license || '')
      ? ''
      : asset.rights?.attribution,
  );
  const license = $derived(
    /^Public domain\b/i.test(asset.rights?.license || '') ? '公共领域' : asset.rights?.license,
  );
  const info = $derived(fileInfo(dimensions ? { ...asset, ...dimensions } : asset));
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
      dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  }

  async function exportPng() {
    if (format !== 'SVG' || !feedback || exporting) return;
    const controller = feedback;
    const token = controller.reset();
    // Copying can replace the toast while this export still belongs to the
    // current keyed workspace. Selection changes destroy it and cancel export.
    const isCurrent = () => alive;
    const size = exportSize === '512' ? 512 : 1024;
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
        await controller.show(`已导出 ${result.width} × ${result.height} px PNG。`);
    } catch {
      if (isCurrent() && controller.isCurrent(token))
        await controller.show('PNG 导出未完成，请下载原始 SVG 后重试。');
    } finally {
      exporting = false;
    }
  }

  async function copyOriginalPng() {
    if (format !== 'PNG' || !feedback || copyingImage) return;
    const controller = feedback;
    const token = controller.reset();
    const isCurrent = () => alive && controller.isCurrent(token);
    copyingImage = true;
    try {
      const result = await copyPngImage({
        url: sourceUrl(),
        clipboard: navigator.clipboard,
        ClipboardItemType: globalThis.ClipboardItem,
        isCurrent,
      });
      if (!isCurrent() || result === 'stale') return;
      await controller.show(
        result === 'copied' ? '已复制原始 PNG 图片。' : '无法复制图片，请下载原图或复制图片地址。',
      );
    } finally {
      copyingImage = false;
    }
  }

  async function copySvg() {
    if (format !== 'SVG' || !feedback) return;
    const controller = feedback;
    const token = controller.reset();
    const isCurrent = () => alive && controller.isCurrent(token);
    try {
      const response = await fetch(sourceUrl());
      if (!response.ok) throw new Error('Source unavailable');
      const value = await response.text();
      if (isCurrent()) await controller.copy(value, 'SVG 代码');
    } catch {
      if (isCurrent()) await controller.show('SVG 代码未能加载，请下载原始 SVG 文件。');
    }
  }

  onMount(() => {
    canCopyImage = canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem);
    if (format !== 'SVG' && previewImage?.complete && previewImage.naturalWidth) {
      dimensions = { width: previewImage.naturalWidth, height: previewImage.naturalHeight };
    }
  });
  onDestroy(() => {
    alive = false;
  });
</script>

<div class="asset-main">
  <div class="preview-column">
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
        decoding="async"
        onload={imageLoaded}
        onerror={() => {
          previewStatus = '预览未能加载，请尝试下载原始文件。';
        }}
      />
    </div>
    <div class="preview-bottom">
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
    <p class="preview-status" id="preview-status" role="status" aria-live="polite">
      {previewStatus}
    </p>
  </div>
  <div class="asset-controls">
    {#if artworks.length > 1}<div class="asset-heading">
        <span class="section-label">选择标识</span>
      </div>{/if}
    {#if artworks.length > 1}
      <div class="variant-list" aria-label="标识样式">
        {#each artworks as item (item.id)}
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
            <span
              >{artworkLabel(item)}<small
                >{[...new Set(item.assets.map(assetFormat))].join(' / ')}{item.defaultAsset
                  .status === 'historical'
                  ? ' · 历史'
                  : ''}</small
              ></span
            ><span class="variant-check" aria-hidden="true">✓</span>
          </a>
        {/each}
      </div>
    {:else}<h2 class="asset-title">{artworkLabel(artwork)}</h2>{/if}
    {#if formatChoices.length > 1}
      <fieldset class="format-choices">
        <legend>文件格式</legend>
        {#each formatChoices as item (item.format)}
          <a
            class="format-option"
            href={assetHref(item.asset.file)}
            data-select-asset={item.asset.file}
            data-selection-kind="format"
            aria-current={item.format === format ? 'true' : 'false'}
            onclick={(event) => onSelectAsset(event, item.asset.file)}>{item.format}</a
          >
        {/each}
      </fieldset>
    {/if}
    <p class="file-info" id="detail-fileinfo">{info}</p>
    {#if fileAlternatives.length > 1}
      <details class="file-options">
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
              ><span>{provenanceLabel(item)}</span><small>{fileInfo(item)}</small></a
            >
          {/each}
        </div>
      </details>
    {/if}
    {#if warnings.length}<ul class="asset-warnings">
        {#each warnings as note (note)}<li>{note}</li>{/each}
      </ul>{/if}
    <div class="download-actions">
      <a
        class="button button-primary"
        id="download-link"
        href={path}
        download={`${brand.id}-${asset.file}`}><Icon name="download" />下载 {format}</a
      >
      <ActionButton
        variant="secondary"
        id="copy-current"
        onclick={() => feedback?.copy(links.current, '图片地址')}
        ><Icon name="link" />复制图片地址</ActionButton
      >
    </div>
    <div class="secondary-actions">
      <ActionButton
        variant="text"
        size="sm"
        id="copy-share"
        onclick={() => feedback?.copy(shareHref(asset.file), '素材分享地址')}>分享</ActionButton
      >
      {#if format === 'SVG'}<ActionButton variant="text" size="sm" id="copy-svg" onclick={copySvg}
          >复制 SVG</ActionButton
        >{/if}
      {#if format === 'PNG'}<ActionButton
          variant="text"
          size="sm"
          id="copy-png-image"
          hidden={!canCopyImage}
          disabled={copyingImage}
          aria-busy={copyingImage}
          onclick={copyOriginalPng}>{copyingImage ? '正在复制…' : '复制 PNG 图片'}</ActionButton
        >{/if}
    </div>
    {#if format === 'SVG'}
      <details class="export-details">
        <summary>导出 PNG</summary>
        <div class="export-actions">
          <label for="export-size"
            >长边<select id="export-size" bind:value={exportSize}
              ><option value="512">512 px</option><option value="1024">1024 px</option></select
            ></label
          ><ActionButton
            variant="secondary"
            size="sm"
            id="export-png"
            disabled={exporting}
            aria-busy={exporting}
            onclick={exportPng}>{exporting ? '正在导出…' : '导出'}</ActionButton
          >
        </div>
        <p class="export-note">等比导出 · 透明背景</p>
      </details>
    {/if}
  </div>
</div>

<details class="resource-details source-details">
  <summary
    >来源与许可{#if attribution}<span>需署名</span>{/if}</summary
  >
  <div class="source-fields">
    <dl class="source-list">
      <dt>来源</dt>
      <dd>
        <a href={external(asset.sourcePage)} target="_blank" rel="noopener noreferrer"
          >{provenanceLabel(asset)}<Icon name="external" /></a
        >
      </dd>
      <dt>原始文件</dt>
      <dd>
        <a href={external(asset.source)} target="_blank" rel="noopener noreferrer"
          >查看来源文件<Icon name="external" /></a
        >
      </dd>
      <dt>许可</dt>
      <dd>
        <a href={external(asset.rights?.reference)} target="_blank" rel="noopener noreferrer"
          >{license}<Icon name="external" /></a
        >
      </dd>
    </dl>
    {#if notes.length}<ul class="asset-notes">
        {#each notes as note, index (index)}<li>{note}</li>{/each}
      </ul>{/if}
    {#if attribution}<div class="attribution">
        <h2>署名</h2>
        <p>{attribution}</p>
      </div>{/if}
    <p class="rights-note">商标权归各品牌所有。</p>
  </div>
</details>

<details class="resource-details">
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
