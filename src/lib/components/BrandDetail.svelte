<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { pushState } from '$app/navigation';
  import type { Brand } from '../types';
  import { assetPath } from '../resource-links.mjs';
  import {
    defaultAsset,
    assetDisplayLabel,
    assetFormat,
    entityLabels,
  } from '../catalog-presentation.mjs';
  import {
    brandRoute,
    identityNames,
    websiteDomain,
    sourceInformation,
  } from '../catalog-display.mjs';
  import AssetWorkspace from './AssetWorkspace.svelte';
  import SourceInfo from './SourceInfo.svelte';
  import CopyFeedback, { type CopyFeedbackApi } from './CopyFeedback.svelte';

  interface Props {
    brand: Brand;
    parent?: Brand;
    sourceCommit: string;
    basePath: string;
  }
  let { brand, parent, sourceCommit, basePath }: Props = $props();
  let selectedFile = $state('');
  let pageUrl = $state('');
  let workspaceVersion = $state(0);
  let backgroundChoice = $state<'light' | 'dark' | 'transparent'>();
  let sourceDetailsOpen = $state(false);
  let feedback = $state<CopyFeedbackApi>();
  let workspace: HTMLDivElement | undefined;
  const names = $derived(identityNames(brand));
  const selectedAsset = $derived(defaultAsset(brand, selectedFile));
  const nativeSourceFiles = $derived(
    (brand.sourceFiles ?? []).map((entry) => {
      const labels = brand.assets
        .filter((asset) => entry.assetFiles.includes(asset.file))
        .map(assetDisplayLabel);
      return { ...entry, label: `${[...new Set(labels)].join('、')} · ${entry.label}` };
    }),
  );

  function external(value?: string) {
    return /^https:\/\/[^\s\\]+$/i.test(value || '') ? value : '#';
  }
  function withDirectoryState(path: string) {
    if (!pageUrl) return path;
    const result = new URL(path, pageUrl);
    const current = new URL(pageUrl);
    for (const key of ['q', 'type', 'format', 'shape', 'category']) {
      const value = current.searchParams.get(key);
      if (value) result.searchParams.set(key, value);
    }
    return result.href;
  }
  function detailHref(target: Brand, file?: string) {
    const path = brandRoute(target, `${basePath}/`);
    const url = withDirectoryState(path);
    if (!pageUrl) return url;
    const result = new URL(url);
    if (file && file !== target.defaultAsset) result.searchParams.set('asset', file);
    return result.href;
  }
  function assetHref(file: string) {
    if (pageUrl) return detailHref(brand, file);
    const asset = brand.assets.find((item) => item.file === file);
    return asset ? `${basePath}/${assetPath(asset)}` : `${basePath}/`;
  }
  function syncFromLocation() {
    feedback?.reset();
    pageUrl = location.href;
    selectedFile = new URL(pageUrl).searchParams.get('asset') || '';
    workspaceVersion += 1;
  }
  async function selectAsset(event: MouseEvent, file: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const kind = (event.currentTarget as HTMLAnchorElement).dataset.selectionKind;
    const url = detailHref(brand, file);
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- detailHref preserves the resolved base path and current query.
    if (url !== location.href) pushState(url, {});
    feedback?.reset();
    selectedFile = file;
    pageUrl = location.href;
    workspaceVersion += 1;
    await tick();
    const selected = [
      ...(workspace?.querySelectorAll<HTMLAnchorElement>('[data-select-asset]') ?? []),
    ].find((link) => link.dataset.selectAsset === file && link.dataset.selectionKind === kind);
    if (kind === 'file') {
      const details = selected?.closest('details');
      if (details) details.open = true;
    }
    const focusTarget = selected ?? workspace?.querySelector<HTMLAnchorElement>('#download-link');
    focusTarget?.focus({ preventScroll: true });
  }

  onMount(() => {
    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  });
</script>

{#snippet externalIcon()}
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"><path d="M13 5h6v6m0-6-9 9M9 5H5v14h14v-4" /></svg
  >
{/snippet}

<main id="main" class="shell detail-main">
  <a
    class="back-link"
    id="back-directory"
    href={withDirectoryState(`${basePath}/`)}
    data-sveltekit-reload
    ><svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg
    >返回目录</a
  >
  <header class="brand-heading">
    <div>
      <p class="detail-entity">
        {entityLabels[brand.entityType as keyof typeof entityLabels] || '品牌'}
      </p>
      <div class="brand-heading-line">
        <h1>{names.primary}</h1>
      </div>
      {#if names.secondary}<p class="detail-english">{names.secondary}</p>{/if}
      {#if parent}<p class="parent-brand">
          所属 <a href={detailHref(parent)} data-sveltekit-reload>{identityNames(parent).primary}</a
          >
        </p>{/if}
    </div>
    <a class="website-link" href={external(brand.website)} target="_blank" rel="noopener noreferrer"
      >{websiteDomain(brand)}{@render externalIcon()}</a
    >
  </header>
  <div id="asset-workspace" bind:this={workspace}>
    {#key `${selectedAsset.file}:${workspaceVersion}`}
      <AssetWorkspace
        {brand}
        asset={selectedAsset}
        {sourceCommit}
        {basePath}
        {pageUrl}
        {backgroundChoice}
        bind:sourceDetailsOpen
        {feedback}
        {assetHref}
        shareHref={(file) => detailHref(brand, file)}
        onSelectAsset={selectAsset}
        onBackgroundChange={(value) => {
          backgroundChoice = value;
        }}
      />
    {/key}
  </div>
  <noscript
    ><p class="noscript-note">可直接下载文件。切换预览与复制需要 JavaScript。</p>
    {#if brand.assets.length > 1}<details class="noscript-files">
        <summary>全部格式下载</summary>
        <ul>
          {#each brand.assets as item (item.file)}<li>
              <a href={`${basePath}/${assetPath(item)}`} download={`${brand.id}-${item.file}`}
                >{assetDisplayLabel(item)} · {assetFormat(item)}</a
              >
            </li>{/each}
        </ul>
      </details>{/if}
    {#if brand.sourceFiles?.length}<details class="noscript-files">
        <summary>全部原生设计文件下载</summary>
        <ul>
          {#each nativeSourceFiles as entry (entry.file)}<li>
              <a href={`${basePath}/${assetPath(entry)}`} download={`${brand.id}-${entry.file}`}
                >{entry.label} · {assetFormat(entry)}</a
              >
            </li>{/each}
        </ul>
        <SourceInfo information={sourceInformation(nativeSourceFiles)} />
      </details>{/if}
  </noscript>
</main>
<CopyFeedback bind:this={feedback} />

<style>
  .detail-main {
    max-width: 1120px;
    padding-block: 22px 56px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .back-link:hover {
    color: var(--ink);
  }
  .back-link svg {
    width: 16px;
    height: 16px;
  }
  .brand-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin: 19px 0 27px;
  }
  .brand-heading > div {
    min-width: 0;
  }
  .detail-entity {
    margin-bottom: 10px;
    color: var(--muted);
    font-size: 12px;
  }
  .brand-heading h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.3;
    font-weight: 650;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }
  .detail-english {
    margin-top: 7px;
    color: var(--muted);
    font-size: 13px;
  }
  .parent-brand {
    margin-top: 8px;
    color: var(--muted);
    font-size: 12px;
  }
  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    max-width: 45%;
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  .website-link:hover {
    color: var(--ink);
    text-decoration: underline;
  }
  .website-link svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
  .noscript-files {
    margin-top: 14px;
    color: var(--muted);
    font-size: 13px;
  }
  .noscript-files > summary {
    min-height: 44px;
    padding-block: 10px;
    cursor: pointer;
  }
  .noscript-files ul {
    padding-left: 20px;
  }
  .noscript-files li + li {
    margin-top: 10px;
  }
  @media (max-width: 720px) {
    .detail-main {
      padding-block: 10px 34px;
    }
    .back-link {
      min-height: 40px;
    }
    .brand-heading {
      display: block;
      margin-top: 10px;
      margin-bottom: 18px;
    }
    .detail-entity {
      display: none;
    }
    .brand-heading h1 {
      font-size: 24px;
      line-height: 1.3;
    }
    .detail-english {
      margin-top: 5px;
      font-size: 12px;
    }
    .website-link {
      min-height: 34px;
      max-width: 100%;
      margin-top: 2px;
    }
  }
</style>
