<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { RadioGroup } from 'bits-ui';
  import { pushState, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import BrandCard from '#lib/components/BrandCard.svelte';
  import CopyFeedback, { type CopyFeedbackApi } from '#lib/components/CopyFeedback.svelte';
  import FilterSelect from '#lib/components/ui/FilterSelect.svelte';
  import FilterPopover from '#lib/components/ui/FilterPopover.svelte';
  import CategoryDrawer from '#lib/components/ui/CategoryDrawer.svelte';
  import CategoryNavigation from '#lib/components/ui/CategoryNavigation.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import type { Asset, Brand } from '#lib/types.ts';
  import { identityNames, shapeLabels } from '#lib/catalog-display.mjs';
  import {
    usageLabels,
    layoutLabels,
    languageLabels,
    colorLabels,
    statusLabels,
  } from '#lib/asset-taxonomy.mjs';
  import {
    defaultAsset,
    directoryAsset,
    assetFormat,
    sortCatalogBrands,
    matchingBrands,
    readDirectoryState,
    directoryUrl,
    filterOptions,
    entityLabels,
    categoryOptions,
    categoryLabels,
    topicOptions,
    topicLabels,
    assetDownloadName,
  } from '#lib/catalog-presentation.mjs';
  import { resourceLinks, assetPath } from '#lib/resource-links.mjs';
  import { canCopyPngImage } from '#lib/clipboard-image.mjs';

  const base = resolve('/').replace(/\/$/, '');
  let { data } = $props();
  let brands: Brand[] = $derived(sortCatalogBrands(data.brands));
  const emptyFilters = {
    q: '',
    category: '',
    topic: '',
    type: '',
    format: '',
    shape: '',
    usage: '',
    layout: '',
    language: '',
    color: '',
    status: '',
  };
  let filters = $state({ ...emptyFilters });
  type FilterKey = Exclude<keyof typeof emptyFilters, 'q'>;
  const panelFilters = [
    { key: 'type', label: '品牌类型', all: '全部类型', labels: entityLabels },
    { key: 'usage', label: '用途', all: '全部用途', labels: usageLabels },
    {
      key: 'shape',
      label: '标识构成',
      all: '全部构成',
      labels: { ...shapeLabels, 'pure-icon': '纯图形（无文字）' },
    },
    { key: 'layout', label: '排布', all: '全部排布', labels: layoutLabels },
    { key: 'language', label: '文字语言', all: '全部语言', labels: languageLabels },
    { key: 'color', label: '配色', all: '全部配色', labels: colorLabels },
    { key: 'status', label: '版本', all: '全部版本', labels: statusLabels },
  ] as const;
  const filterLabels: Record<string, Record<string, string>> = {
    shape: { ...shapeLabels, 'pure-icon': '纯图形（无文字）' },
    usage: usageLabels,
    layout: layoutLabels,
    language: languageLabels,
    color: colorLabels,
    status: statusLabels,
  };
  const hasPanelFilters = $derived(panelFilters.some((field) => Boolean(filters[field.key])));
  let matches: Brand[] = $derived(matchingBrands(brands, filters));
  let options = $derived(filterOptions(brands));
  let categories = $derived(
    categoryOptions(matchingBrands(brands, { ...filters, category: '' }), brands),
  );
  let topics = $derived(topicOptions(matchingBrands(brands, { ...filters, topic: '' }), brands));
  let selectedCategory = $derived(
    categoryLabels[filters.category] ||
      topicLabels[filters.topic as keyof typeof topicLabels] ||
      '全部品牌',
  );
  let activeFilters = $derived(
    [
      { key: 'category' as const, value: filters.category, label: selectedCategory },
      {
        key: 'topic' as const,
        value: filters.topic,
        label: topicLabels[filters.topic as keyof typeof topicLabels],
      },
      { key: 'format' as const, value: filters.format, label: filters.format },
      {
        key: 'type' as const,
        value: filters.type,
        label: entityLabels[filters.type as keyof typeof entityLabels],
      },
      {
        key: 'shape' as const,
        value: filters.shape,
        label: filterLabels.shape[filters.shape],
      },
      ...(['usage', 'layout', 'language', 'color', 'status'] as const).map((key) => ({
        key,
        value: filters[key],
        label: filterLabels[key][filters[key]],
      })),
    ].filter((item) => item.value),
  );
  let ready = $state(false);
  let searchInput: HTMLInputElement;
  let categoryOpen = $state(false);
  let categoryQuery = $state('');
  let extraFiltersOpen = $state(false);
  let feedback = $state<CopyFeedbackApi>();
  let canCopyImage = $state(false);
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
    if (asset.file !== brand.defaultAsset) params.set('selected', asset.file);
    return base + '/logo/' + encodeURIComponent(brand.id) + '/' + (params.size ? '?' + params : '');
  }
  function updateHistory(replace = false) {
    feedback?.reset();
    const url = directoryUrl(location.href, filters);
    url.searchParams.delete('brand');
    url.searchParams.delete('asset');
    url.searchParams.delete('selected');
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Based on the resolved current URL; changes filters only.
    if (url.href !== location.href) (replace ? replaceState : pushState)(url, {});
  }
  function changeFilter(key: FilterKey, value: string) {
    filters[key] = value;
    typing = false;
    updateHistory();
    if (key === 'category' || key === 'topic') categoryOpen = false;
  }
  function reset(all = true) {
    filters.q = '';
    if (all) {
      filters = { ...emptyFilters };
      categoryQuery = '';
    }
    typing = false;
    updateHistory();
    searchInput?.focus();
  }
  async function copyBrand(
    brand: Brand,
    asset: Asset,
    kind: 'current' | 'html' | 'markdown' | 'svg' | 'image',
  ) {
    const controller = feedback;
    if (!controller) return;
    const options = {
      url: new URL(base + '/' + assetPath(asset), location.origin).href,
      downloadName: assetDownloadName(brand, asset),
      label: identityNames(brand).primary,
    };
    if (kind === 'image') {
      return controller.copyImage({ ...options, format: assetFormat(asset) });
    }
    if (kind === 'svg') {
      return controller.copySvg(options);
    }
    const links = resourceLinks({
      asset,
      brand,
      baseUrl: new URL(base + '/', location.origin).href,
      sourceCommit: data.sourceCommit,
    });
    const labels = { current: '图片地址', html: 'HTML 代码', markdown: 'Markdown 引用' };
    return controller.copy(links[kind], identityNames(brand).primary + ' ' + labels[kind]);
  }
  onMount(() => {
    ready = true;
    canCopyImage = canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem);
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

<div class="directory-layout">
  <aside class="category-sidebar" aria-label="资源分类">
    <CategoryNavigation
      {categories}
      {topics}
      selected={filters.category}
      selectedTopic={filters.topic}
      bind:query={categoryQuery}
      disabled={!ready}
      onselect={(id) => changeFilter('category', id)}
      ontopic={(id) => changeFilter('topic', id)}
    />
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
          placeholder="搜索品牌、域名或版本，如 腾讯 英文 横向…"
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
        {topics}
        selected={filters.category}
        selectedTopic={filters.topic}
        bind:query={categoryQuery}
        disabled={!ready}
        onselect={(id) => changeFilter('category', id)}
        ontopic={(id) => changeFilter('topic', id)}
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
        <h1>{filters.q ? '搜索结果' : selectedCategory}</h1>
        <p class="result-count" id="result-count" role="status" aria-live="polite">
          {matches.length}<span class="sr-only">&nbsp;个品牌</span>
        </p>
      </div>
      <div class="catalog-filters">
        <RadioGroup.Root
          class="format-filter"
          id="format-filter"
          aria-label="文件格式"
          orientation="horizontal"
          value={filters.format || '__all__'}
          onValueChange={(value) => changeFilter('format', value === '__all__' ? '' : value)}
        >
          {#each [{ value: '', label: '全部格式' }, ...options.formats.map( (value: string) => ({ value, label: value }) )] as option (option.value)}
            <RadioGroup.Item value={option.value || '__all__'} data-format={option.value}
              >{option.label}</RadioGroup.Item
            >
          {/each}
        </RadioGroup.Root>
        <FilterPopover bind:open={extraFiltersOpen} active={hasPanelFilters} disabled={!ready}>
          <div class="directory-filter-panel">
            <div class="directory-filter-fields">
              {#each panelFilters as field (field.key)}
                <div class="directory-filter-field">
                  <label for={`${field.key}-filter`}>{field.label}</label>
                  <FilterSelect
                    id={`${field.key}-filter`}
                    label={field.label}
                    value={filters[field.key]}
                    options={[
                      { value: '', label: field.all },
                      ...Object.entries(field.labels).map(([value, label]) => ({ value, label })),
                    ]}
                    onchange={(value) => changeFilter(field.key, value)}
                  />
                </div>
              {/each}
            </div>
            <div class="directory-filter-actions">
              <ActionButton
                id="clear-filters"
                variant="text"
                size="sm"
                disabled={!hasPanelFilters && !filters.format}
                onclick={() => {
                  for (const field of panelFilters) filters[field.key] = '';
                  filters.format = '';
                  typing = false;
                  updateHistory();
                }}>清除筛选</ActionButton
              >
              <ActionButton variant="secondary" size="sm" onclick={() => (extraFiltersOpen = false)}
                >完成</ActionButton
              >
            </div>
          </div>
        </FilterPopover>
      </div>
    </div>
    {#if activeFilters.length}
      <div class="active-directory-filters" aria-label="已选筛选条件">
        {#each activeFilters as item (item.key)}
          <button
            type="button"
            aria-label={`移除${item.label}筛选`}
            onclick={() => changeFilter(item.key, '')}
            >{item.label}<span aria-hidden="true">×</span></button
          >
        {/each}
        <button type="button" class="clear-directory-filters" onclick={() => reset()}
          >清除全部</button
        >
      </div>
    {/if}
    <section aria-label="Logo 目录">
      <div id="brand-grid" class="brand-grid">
        {#each matches as brand (brand.id)}
          <BrandCard
            {brand}
            query={filters.q}
            basePath={base}
            href={hrefFor(brand)}
            oncopy={copyBrand}
            getRevision={() => feedback?.currentRevision()}
            {canCopyImage}
            copying={feedback?.pending(base + '/' + assetPath(directoryAsset(brand, filters.q))) ??
              false}
            onsave={savePosition}
            {ready}
          />
        {/each}
      </div>
      <div class="empty-state" id="empty-state" hidden={matches.length > 0}>
        <Icon name="search" />
        <h2>没有找到匹配的 Logo</h2>
        <p>可以移除上方某个筛选条件，或调整关键词。</p>
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

<style>
  :global(.extra-filter-panel:has(.directory-filter-panel)) {
    width: min(480px, calc(100vw - 32px));
  }
  .directory-filter-panel {
    display: grid;
    gap: 18px;
  }
  .directory-filter-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 16px;
  }
  .directory-filter-field {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .directory-filter-field label {
    color: var(--muted);
    font-size: var(--type-caption);
  }
  .directory-filter-field :global(.filter-trigger) {
    width: 100%;
    min-height: 40px;
    min-width: 0;
    text-align: left;
  }
  .directory-filter-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .directory-filter-actions :global(.text-button) {
    width: auto;
    margin-top: 0;
  }
  @media (max-width: 720px) {
    .catalog-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    .catalog-filters {
      display: contents;
    }
    :global(.format-filter) {
      grid-column: 1 / -1;
      grid-row: 2;
      flex-wrap: wrap;
    }
    .catalog-filters :global(.more-filters) {
      grid-column: 2;
      grid-row: 1;
    }
    .directory-filter-fields {
      gap: 12px;
    }
  }
  @media (max-width: 359px) {
    .directory-filter-fields {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
