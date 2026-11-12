<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { DropdownMenu } from 'bits-ui';
  import type { Brand, Asset } from '../types';
  import type { CopyFeedbackApi } from './CopyFeedback.svelte';
  import { assetFormat, assetDownloadName, assetDescription } from '../catalog-presentation.mjs';
  import { selectedArtwork } from '../catalog-artworks.mjs';
  import { assetPath, fixedAssetUrl, resourceLinks } from '../resource-links.mjs';
  import { escapeHtml } from '../catalog-display.mjs';
  import { canCopyPngImage } from '../clipboard-image.mjs';
  import { renderSvgPng } from '../svg-export';
  import Icon from './Icon.svelte';
  import CopyMenu from './CopyMenu.svelte';

  let {
    brand,
    asset,
    sourceCommit,
    basePath,
    pageUrl,
    feedback,
    shareHref,
    id,
    primary = false,
  }: {
    brand: Brand;
    asset: Asset;
    sourceCommit: string;
    basePath: string;
    pageUrl: string;
    feedback?: CopyFeedbackApi;
    shareHref: (file: string) => string;
    id: string;
    primary?: boolean;
  } = $props();

  let canCopyImage = $state(false);
  let exporting = $state(false);
  let downloadLink: HTMLAnchorElement | undefined;
  let alive = true;
  const path = $derived(`${basePath}/${assetPath(asset)}`);
  const format = $derived(assetFormat(asset));
  const artwork = $derived(selectedArtwork(brand, asset)!);
  const copying = $derived(feedback?.pending(path) ?? false);
  const canGeneratePng = $derived(
    format === 'SVG' && !artwork.assets.some((item) => assetFormat(item) === 'PNG'),
  );
  const alt = $derived(`${brand.name} ${assetDescription(asset)}`);
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
  function sourceUrl() {
    return new URL(path, pageUrl || location.href).href;
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
      link.download = `${assetDownloadName(brand, asset).replace(/\.svg$/i, '')}-export-${size}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 10000);
      if (controller.isCurrent(token))
        await controller.show(
          `已下载 ${result.width} × ${result.height} px PNG（由 SVG 生成 · 长边 ${size}px）。`,
          'success',
        );
    } catch {
      if (isCurrent() && controller.isCurrent(token))
        await controller.show('PNG 生成未完成，请下载原始 SVG 后重试。', 'error');
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
      downloadName: assetDownloadName(brand, asset),
    });
  }

  function copySvg() {
    return feedback?.copySvg({
      url: sourceUrl(),
      downloadName: assetDownloadName(brand, asset),
    });
  }

  const copyItems = $derived([
    ...(format === 'SVG'
      ? [
          {
            id: 'svg',
            label: '复制 SVG 源码',
            hint: '原始代码',
            disabled: copying,
            onselect: copySvg,
          },
        ]
      : []),
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
    canCopyImage = canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem);
  });
  onDestroy(() => {
    alive = false;
  });
</script>

<div class="asset-actions" class:primary>
  <div class="download-button" class:has-options={canGeneratePng}>
    <!-- eslint-disable svelte/no-navigation-without-resolve -- Original asset download uses the validated catalog path. -->
    <a
      id={id === 'detail' ? 'download-link' : `${id}-download`}
      bind:this={downloadLink}
      class="button"
      class:button-primary={primary}
      class:button-secondary={!primary}
      href={path}
      download={assetDownloadName(brand, asset)}
      aria-label={`下载 ${brand.name} ${assetDescription(asset)} ${format} 原文件`}
    >
      <Icon name="download" size={16} />下载 {format}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
    {#if canGeneratePng}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          id={id === 'detail' ? 'download-options' : `${id}-download-options`}
          class={[
            'button',
            primary ? 'button-primary' : 'button-secondary',
            'download-options-trigger',
          ]}
          aria-label="选择下载格式"
          disabled={!feedback || exporting}
          aria-busy={exporting}
        >
          <Icon name="chevron-down" size={14} />
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
    id={id === 'detail' ? 'detail-copy-menu' : `${id}-copy-menu`}
    items={copyItems}
    getRevision={() => feedback?.currentRevision()}
    disabled={!feedback}
    ariaLabel={`复制 ${brand.name} ${assetDescription(asset)}`}
  />
</div>
{#if exporting}<p class="download-status" role="status">正在生成 PNG…</p>{/if}

<style>
  .asset-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .download-button {
    display: flex;
    min-width: 0;
  }
  .download-button > a {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 8px 10px;
    font-size: 13px;
  }
  .asset-actions :global(.copy-menu-trigger) {
    min-height: 40px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--ink);
  }
  .download-button.has-options > a {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .download-button :global(.download-options-trigger) {
    flex: 0 0 32px;
    padding: 0;
    min-height: 40px;
    margin-left: -1px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .primary .download-button > a,
  .primary :global(.copy-menu-trigger),
  .primary :global(.download-options-trigger) {
    min-height: 46px;
  }
  .primary :global(.download-options-trigger) {
    border-left-color: color-mix(in srgb, var(--on-accent) 25%, var(--accent));
  }
  .download-status {
    color: var(--muted);
    font-size: 12px;
  }
  :global(.download-menu-content) {
    z-index: 90;
    max-width: calc(100vw - 24px);
    max-height: var(--bits-dropdown-menu-content-available-height, calc(100dvh - 24px));
    overflow-y: auto;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    color: var(--ink);
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
  :global(.download-menu-item small) {
    color: var(--muted);
    font-size: 12px;
  }
  @media (max-width: 600px) {
    .download-button > a,
    .asset-actions :global(.copy-menu-trigger),
    .download-button :global(.download-options-trigger) {
      min-height: 44px;
    }
  }
</style>
