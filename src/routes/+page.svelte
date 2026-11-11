<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { pushState, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import BrandCard from '#lib/components/BrandCard.svelte';
  import CopyFeedback, { type CopyFeedbackApi } from '#lib/components/CopyFeedback.svelte';
  import FilterSelect from '#lib/components/ui/FilterSelect.svelte';
  import FilterPopover from '#lib/components/ui/FilterPopover.svelte';
  import CategoryDrawer from '#lib/components/ui/CategoryDrawer.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import type { Asset, Brand } from '#lib/types.ts';
  import { identityNames, shapeLabels } from '#lib/catalog-display.mjs';
  import {
    defaultAsset,
    directoryAsset,
    sortCatalogBrands,
    matchingBrands,
    readDirectoryState,
    directoryUrl,
    filterOptions,
    entityLabels,
    categoryOptions,
  } from '#lib/catalog-presentation.mjs';
  import { resourceLinks, assetPath } from '#lib/resource-links.mjs';

  const base = resolve('/').replace(/\/$/, '');
  let { data } = $props();
  let brands: Brand[] = $derived(sortCatalogBrands(data.brands));
  let filters = $state({ q: '', category: '', type: '', format: '', shape: '' });
  let matches: Brand[] = $derived(matchingBrands(brands, filters));
  let options = $derived(filterOptions(brands));
  let categories = $derived(categoryOptions(brands));
  let selectedCategory = $derived(categories.find((item) => item.id === filters.category));
  let shapes: Asset['variant'][] = $derived(
    [...new Set(brands.flatMap((brand) => brand.assets.map((asset) => asset.variant)))].sort(),
  );
  let ready = $state(false);
  let searchInput: HTMLInputElement;
  let categoryOpen = $state(false);
  let extraFiltersOpen = $state(false);
  let feedback = $state<CopyFeedbackApi>();
  let typing = false;

  function savePosition() {
    try {
      sessionStorage.setItem('logodock:scroll:' + location.href, String(window.scrollY));
    } catch {
      /* Storage is optional. */
    }
  }
  function restorePosition() {
    try {
      const y = Number(sessionStorage.getItem('logodock:scroll:' + location.href));
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {
      /* Native browser restoration remains available. */
    }
  }
  function hrefFor(brand: Brand, asset = directoryAsset(brand, filters.q)) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- A temporary URL builder, not component state.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    if (asset.file !== brand.defaultAsset) params.set('asset', asset.file);
    return base + '/logo/' + encodeURIComponent(brand.id) + '/' + (params.size ? '?' + params : '');
  }
  function updateHistory(replace = false) {
    feedback?.reset();
    const url = directoryUrl(location.href, filters);
    url.searchParams.delete('brand');
    url.searchParams.delete('asset');
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Based on the resolved current URL; changes filters only.
    if (url.href !== location.href) (replace ? replaceState : pushState)(url, {});
  }
  function changeFilter(key: 'category' | 'type' | 'shape' | 'format', value: string) {
    filters[key] = value;
    typing = false;
    updateHistory();
    if (key === 'category') categoryOpen = false;
  }
  function reset(all = true) {
    filters.q = '';
    if (all) filters.category = filters.type = filters.format = filters.shape = '';
    typing = false;
    updateHistory();
    searchInput?.focus();
  }
  async function copyBrand(
    brand: Brand,
    asset: Asset,
    kind: 'current' | 'html' | 'markdown' | 'svg',
  ) {
    const controller = feedback;
    if (!controller) return;
    const links = resourceLinks({
      asset,
      brand,
      baseUrl: new URL(base + '/', location.origin).href,
      sourceCommit: data.sourceCommit,
    });
    if (kind !== 'svg') {
      const labels = { current: '图片地址', html: 'HTML', markdown: 'Markdown' };
      await controller.copy(links[kind], identityNames(brand).primary + ' ' + labels[kind]);
      return;
    }
    const token = controller.reset();
    try {
      const response = await fetch(base + '/' + assetPath(asset));
      if (!response.ok) throw new Error('Source unavailable');
      const value = await response.text();
      if (controller.isCurrent(token)) await controller.copy(value, 'SVG 源码');
    } catch {
      if (controller.isCurrent(token))
        await controller.show('SVG 源码未能加载，请下载原始 SVG 文件。');
    }
  }
  onMount(() => {
    ready = true;
    filters = readDirectoryState(location.href, brands);
    const legacyBrand = brands.find(
      (brand) => brand.id === new URL(location.href).searchParams.get('brand'),
    );
    if (legacyBrand) {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- A temporary redirect URL, not component state.
      const url = new URL(location.href);
      url.pathname = new URL(hrefFor(legacyBrand), location.href).pathname;
      url.searchParams.delete('brand');
      const requested = url.searchParams.get('asset');
      const file =
        requested === null
          ? directoryAsset(legacyBrand, filters.q).file
          : defaultAsset(legacyBrand, requested).file;
      if (file === legacyBrand.defaultAsset) url.searchParams.delete('asset');
      else url.searchParams.set('asset', file);
      location.replace(url);
      return;
    }
    updateHistory(true);
    void tick().then(restorePosition);
  });
  function popState() {
    categoryOpen = extraFiltersOpen = false;
    filters = readDirectoryState(location.href, brands);
    typing = false;
    feedback?.reset();
    void tick().then(restorePosition);
  }
  function shortcut(event: KeyboardEvent) {
    if (categoryOpen) return;
    const target = event.target;
    const editing =
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape' && !event.defaultPrevented) {
      if (target === searchInput && filters.q) {
        event.preventDefault();
        reset(false);
      }
    }
  }
</script>

<svelte:head>
  <title>LogoDock · 品牌 Logo 下载</title>
  <meta
    name="description"
    content={'查找 ' +
      brands.length +
      ' 个品牌的 Logo，在线预览、下载 SVG、PNG 等格式，或复制图片地址。'}
  />
</svelte:head>
<svelte:window
  onkeydown={shortcut}
  onpopstate={popState}
  onpagehide={savePosition}
  onpageshow={restorePosition}
/>

{#snippet categoryList()}
  <nav class="category-list" aria-label="品牌分类">
    {#each categories as category (category.id)}
      <button
        type="button"
        data-category={category.id}
        aria-pressed={filters.category === category.id}
        onclick={() => changeFilter('category', category.id)}
      >
        <span>{category.label}</span><small>{category.count}</small>
      </button>
    {/each}
  </nav>
{/snippet}

<div class="directory-layout">
  <aside class="category-sidebar" aria-label="资源分类">
    <p class="nav-caption">资源分类</p>
    {@render categoryList()}
  </aside>
  <main id="main" class="directory-main">
    <div class="directory-search-row">
      <form
        class="search-form"
        role="search"
        action={base + '/'}
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
          aria-label="清空搜索"
          onclick={() => reset(false)}>×</ActionButton
        >
        <kbd class="search-shortcut" aria-hidden="true">/</kbd>
      </form>
      <CategoryDrawer
        bind:open={categoryOpen}
        {categories}
        selected={filters.category}
        disabled={!ready}
        onselect={(id) => changeFilter('category', id)}
        onOpenChange={(open) => {
          if (open) {
            extraFiltersOpen = false;
            feedback?.reset();
          }
        }}
      />
    </div>
    <div class="catalog-toolbar">
      <div class="directory-title">
        <h1>{filters.q ? '搜索结果' : selectedCategory?.label || '全部品牌'}</h1>
        <p class="result-count" id="result-count" role="status" aria-live="polite">
          {matches.length}<span class="sr-only">&nbsp;个结果</span>
        </p>
      </div>
      <div class="catalog-filters">
        <div class="format-filter" id="format-filter" role="group" aria-label="文件格式">
          {#each [{ value: '', label: '全部格式' }, ...options.formats.map( (value: string) => ({ value, label: value }) )] as option (option.value)}
            <button
              type="button"
              data-format={option.value}
              aria-pressed={filters.format === option.value}
              onclick={() => changeFilter('format', option.value)}>{option.label}</button
            >
          {/each}
        </div>
        <FilterPopover
          bind:open={extraFiltersOpen}
          active={Boolean(filters.type || filters.shape)}
          disabled={!ready}
        >
          <div>
            <span>Logo 形式</span><FilterSelect
              id="shape-filter"
              label="Logo 形式"
              value={filters.shape}
              options={[
                { value: '', label: '全部形式' },
                ...shapes.map((value) => ({ value, label: shapeLabels[value] || value })),
              ]}
              onchange={(value) => changeFilter('shape', value)}
            />
          </div>
          <div>
            <span>收录类型</span><FilterSelect
              id="type-filter"
              label="收录类型"
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
          </div>
          <ActionButton
            id="clear-filters"
            variant="text"
            size="sm"
            hidden={!(filters.type || filters.shape || filters.format)}
            onclick={() => {
              filters.type = filters.format = filters.shape = '';
              typing = false;
              updateHistory();
            }}>重置筛选</ActionButton
          >
        </FilterPopover>
      </div>
    </div>
    <section aria-label="Logo 目录">
      <div id="brand-grid" class="brand-grid">
        {#each matches as brand (brand.id)}
          <BrandCard
            {brand}
            query={filters.q}
            basePath={base}
            href={hrefFor(brand)}
            oncopy={copyBrand}
            onsave={savePosition}
            {ready}
          />
        {/each}
      </div>
      <div class="empty-state" id="empty-state" hidden={matches.length > 0}>
        <Icon name="search" />
        <h2>没有找到匹配的 Logo</h2>
        <p>换个关键词，或清除筛选试试。</p>
        <ActionButton variant="primary" id="reset-search" onclick={() => reset()}
          >清除搜索与筛选</ActionButton
        >
        <a
          href="https://github.com/didilili/logodock/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer">建议收录 ↗</a
        >
      </div>
    </section>
    <noscript
      ><p class="noscript-note">搜索、筛选与复制需要 JavaScript；仍可浏览和下载。</p></noscript
    >
  </main>
</div>

<CopyFeedback bind:this={feedback} />
