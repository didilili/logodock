<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { pushState, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  const base = resolve('/').replace(/\/$/, '');
  import BrandCard from '#lib/components/BrandCard.svelte';
  import CopyFeedback, { type CopyFeedbackApi } from '#lib/components/CopyFeedback.svelte';
  import FilterSelect from '#lib/components/ui/FilterSelect.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import type { Brand } from '#lib/types.ts';
  import { identityNames, shapeLabels } from '#lib/catalog-display.mjs';
  import { normalizeQuery } from '../lib/catalog-search.mjs';
  import {
    directoryAsset,
    sortCatalogBrands,
    matchingBrands,
    readDirectoryState,
    directoryUrl,
    filterOptions,
    entityLabels,
  } from '../lib/catalog-presentation.mjs';
  import { resourceLinks } from '../lib/resource-links.mjs';
  let { data } = $props();
  let brands: Brand[] = $derived(sortCatalogBrands(data.brands));
  let filters = $state({ q: '', type: '', format: '', shape: '' });
  let matches: Brand[] = $derived(matchingBrands(brands, filters));
  let options = $derived(filterOptions(brands));
  let shapes: Brand['assets'][number]['variant'][] = $derived(
    [...new Set(brands.flatMap((brand) => brand.assets.map((asset) => asset.variant)))].sort(),
  );
  let total = $derived(brands.reduce((count, brand) => count + brand.assets.length, 0));
  let ready = $state(false);
  let searchInput: HTMLInputElement;
  let feedback = $state<CopyFeedbackApi>();
  let typing = false;
  function savePosition() {
    try {
      sessionStorage.setItem(`logodock:scroll:${location.href}`, String(window.scrollY));
    } catch {
      /* Storage is optional. */
    }
  }
  function restorePosition() {
    try {
      const y = Number(sessionStorage.getItem(`logodock:scroll:${location.href}`));
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {
      /* Native browser restoration remains available. */
    }
  }
  function hrefFor(brand: Brand) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This temporary URL builder is not component state.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const asset = directoryAsset(brand, filters.q);
    if (asset.file !== brand.defaultAsset) params.set('asset', asset.file);
    return `${base}/logos/${encodeURIComponent(brand.id)}/${params.size ? `?${params}` : ''}`;
  }
  function updateHistory(replace = false) {
    feedback?.reset();
    const url = directoryUrl(location.href, filters);
    url.searchParams.delete('brand');
    url.searchParams.delete('asset');
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- The URL is based on location.href and only changes directory filters.
    if (url.href !== location.href) (replace ? replaceState : pushState)(url, {});
  }
  function changeFilter(key: 'type' | 'shape' | 'format', value: string) {
    filters[key] = value;
    typing = false;
    updateHistory();
  }
  function reset(all = true) {
    filters.q = '';
    if (all) filters.type = filters.format = filters.shape = '';
    typing = false;
    updateHistory();
    searchInput?.focus();
  }
  function copyBrand(brand: Brand) {
    const links = resourceLinks({
      asset: directoryAsset(brand, filters.q),
      brand,
      baseUrl: new URL(`${base}/`, location.origin).href,
      sourceCommit: data.sourceCommit,
    });
    void feedback?.copy(links.current, `${identityNames(brand).primary} 图片地址`);
  }
  onMount(() => {
    ready = true;
    filters = readDirectoryState(location.href, brands);
    const legacyBrand = brands.find(
      (brand) => brand.id === new URL(location.href).searchParams.get('brand'),
    );
    if (legacyBrand) {
      const url = new URL(hrefFor(legacyBrand), location.href);
      const requested = new URL(location.href).searchParams.get('asset');
      if (requested && legacyBrand.assets.some((asset) => asset.file === requested))
        url.searchParams.set('asset', requested);
      location.replace(url);
      return;
    }
    updateHistory(true);
    void tick().then(restorePosition);
  });
  function popState() {
    filters = readDirectoryState(location.href, brands);
    typing = false;
    feedback?.reset();
    void tick().then(restorePosition);
  }
  function shortcut(event: KeyboardEvent) {
    const target = event.target;
    const editing =
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape' && target === searchInput && filters.q) {
      event.preventDefault();
      reset(false);
    }
  }
</script>

<svelte:head
  ><title>LogoDock · 品牌 Logo 下载</title><meta
    name="description"
    content={`查找 ${brands.length} 个品牌的 Logo，在线预览、下载 SVG、PNG 等格式，或复制图片地址。`}
  /></svelte:head
>
<svelte:window
  onkeydown={shortcut}
  onpopstate={popState}
  onpagehide={savePosition}
  onpageshow={restorePosition}
/>
<main id="main" class="shell directory-main">
  <section class="directory-intro">
    <div>
      <h1>找到 Logo，直接下载。</h1>
      <p>预览品牌标识，下载 SVG、PNG 等格式。</p>
    </div>
    <span class="catalog-total"
      >{brands.length} 个品牌 <span aria-hidden="true">/</span> {total} 个文件</span
    >
  </section>
  <form
    class="search-form"
    role="search"
    action={`${base}/`}
    onsubmit={(event) => {
      event.preventDefault();
      typing = false;
    }}
  >
    <label class="sr-only" for="search">搜索 Logo</label><Icon name="search" />
    <input
      id="search"
      name="q"
      type="search"
      bind:this={searchInput}
      value={filters.q}
      oninput={(event) => {
        filters.q = event.currentTarget.value;
        updateHistory(typing);
        typing = true;
      }}
      onblur={() => {
        typing = false;
      }}
      placeholder="搜索品牌名称或域名…"
      autocomplete="off"
      spellcheck="false"
    />
    <ActionButton
      id="clear-search"
      variant="text"
      size="sm"
      hidden={!filters.q}
      onclick={() => reset(false)}>清除</ActionButton
    ><kbd class="search-shortcut" aria-hidden="true">/</kbd>
  </form>
  <div class="catalog-toolbar">
    <div class="catalog-filters">
      <FilterSelect
        id="shape-filter"
        label="素材形态"
        value={filters.shape}
        options={[
          { value: '', label: '全部形态' },
          ...shapes.map((value) => ({ value, label: shapeLabels[value] || value })),
        ]}
        onchange={(value) => changeFilter('shape', value)}
      />
      <FilterSelect
        id="format-filter"
        label="文件格式"
        value={filters.format}
        options={[
          { value: '', label: '全部格式' },
          ...options.formats.map((value: string) => ({ value, label: value })),
        ]}
        onchange={(value) => changeFilter('format', value)}
      />
      <FilterSelect
        id="type-filter"
        label="品牌类型"
        value={filters.type}
        options={[
          { value: '', label: '全部类型' },
          ...options.types.map((value: keyof typeof entityLabels) => ({
            value,
            label: entityLabels[value],
          })),
        ]}
        onchange={(value) => changeFilter('type', value)}
      />
      <ActionButton
        variant="text"
        size="sm"
        id="clear-filters"
        hidden={!(filters.type || filters.format || filters.shape)}
        onclick={() => {
          filters.type = filters.format = filters.shape = '';
          typing = false;
          updateHistory();
        }}>重置筛选</ActionButton
      >
    </div>
    <p class="result-count" id="result-count" role="status" aria-live="polite">
      {matches.length} 个结果{normalizeQuery(filters.q) ? ' · 按相关度' : ''}
    </p>
  </div>
  <section aria-label="Logo 目录">
    <div id="brand-grid" class="brand-grid">
      {#each matches as brand (brand.id)}<BrandCard
          {brand}
          query={filters.q}
          basePath={base}
          href={hrefFor(brand)}
          oncopy={copyBrand}
          onsave={savePosition}
          {ready}
        />{/each}
    </div>
    <div class="empty-state" id="empty-state" hidden={matches.length > 0}>
      <Icon name="search" />
      <h2>没有找到匹配的 Logo</h2>
      <p>换个关键词，或清除筛选试试。</p>
      <ActionButton variant="primary" id="reset-search" onclick={() => reset()}
        >清除搜索与筛选</ActionButton
      ><a
        href="https://github.com/didilili/logodock/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer">建议收录 ↗</a
      >
    </div>
  </section>
  <noscript><p class="noscript-note">搜索、筛选与复制需要 JavaScript；仍可浏览和下载。</p></noscript
  >
</main>
<CopyFeedback bind:this={feedback} />
