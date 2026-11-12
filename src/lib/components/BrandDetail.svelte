<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Brand, BrandReference } from '../types';
  import { assetPath } from '../resource-links.mjs';
  import {
    defaultAsset,
    assetDescription,
    assetFormat,
    entityLabels,
    readDirectoryState,
    matchingBrands,
    assetDownloadName,
  } from '../catalog-presentation.mjs';
  import {
    brandRoute,
    identityNames,
    websiteDomain,
    sourceLabel,
    sourceInformation,
  } from '../catalog-display.mjs';
  import AssetWorkspace from './AssetWorkspace.svelte';
  import SourceInfo from './SourceInfo.svelte';
  import CopyFeedback, { type CopyFeedbackApi } from './CopyFeedback.svelte';
  import { industryGroups, topicLabels } from '../catalog-taxonomy.mjs';
  import { selectedArtwork } from '../catalog-artworks.mjs';
  import {
    usageLabels,
    shapeLabels,
    layoutLabels,
    languageLabels,
    colorLabels,
    statusLabels,
  } from '../asset-taxonomy.mjs';

  interface Props {
    brand: Brand;
    parent?: BrandReference;
    relatedBrands?: BrandReference[];
    sourceCommit: string;
    basePath: string;
  }
  let { brand, parent, relatedBrands = [], sourceCommit, basePath }: Props = $props();
  let selectedFile = $state('');
  let pageUrl = $state('');
  let workspaceVersion = $state(0);
  let backgroundChoice = $state<'light' | 'dark' | 'transparent'>();
  let sourceDetailsOpen = $state(true);
  let designFilesOpen = $state(false);
  let feedback = $state<CopyFeedbackApi>();
  let versionFilters = $state({ language: '', layout: '', color: '' });
  let matchingOnly = $state(true);
  let previewOpen = $state(false);
  let previewOrigin = $state('');
  let cardFiles = $state<Record<string, string>>({});
  let moreVersionsOpen = $state(false);
  let alternativeVersionsOpen = $state(false);
  let navigation = Promise.resolve();
  let navigationRevision = 0;
  let active = true;
  interface PreviewEntry {
    brandId: string;
    galleryUrl: string;
    origin: string;
  }
  const names = $derived(identityNames(brand));
  const categoryPaths = $derived(
    industryGroups.flatMap((group) =>
      group.children
        .filter((category) => brand.categories.includes(category.id))
        .map((category) => ({ id: category.id, label: category.label, groupLabel: group.label })),
    ),
  );
  const subjects = $derived(brand.identity.legalNames);
  const subjectGroups = $derived(
    [...new Set(subjects.map((entry) => entry.role))].map((role) => ({
      role,
      entries: subjects
        .filter((entry) => entry.role === role)
        .toSorted(
          (left, right) => Number(right.language === 'zh') - Number(left.language === 'zh'),
        ),
    })),
  );
  const subjectRoleLabels: Record<string, string> = {
    company: '公司全称',
    group: '集团全称',
    'operating-company': '运营主体',
    'website-operator': '官网运营主体',
    organization: '组织全称',
  };
  const selectedAsset = $derived(defaultAsset(brand, selectedFile));
  const directoryState = $derived(pageUrl ? readDirectoryState(pageUrl, [brand]) : undefined);
  const contextLabels: Record<string, Record<string, string>> = {
    usage: usageLabels,
    shape: { ...shapeLabels, 'pure-icon': '纯图形（无文字）' },
    layout: layoutLabels,
    language: languageLabels,
    color: colorLabels,
    status: statusLabels,
  };
  const context = $derived(
    directoryState
      ? Object.entries(directoryState)
          .filter(
            ([key, value]) => value && (key in contextLabels || key === 'q' || key === 'format'),
          )
          .map(([key, value]) => contextLabels[key]?.[value] || value)
      : [],
  );
  const matchingFiles = $derived(
    directoryState && context.length
      ? (matchingBrands([brand], directoryState)[0]?.assets ?? []).map(
          (item: Brand['assets'][number]) => item.file,
        )
      : undefined,
  );
  const nativeSourceFiles = $derived(
    (brand.sourceFiles ?? []).map((entry) => {
      const labels = brand.assets
        .filter((asset) => entry.assetFiles.includes(asset.file))
        .map(assetDescription);
      return { ...entry, label: `${[...new Set(labels)].join('、')} · ${entry.label}` };
    }),
  );

  function external(value?: string) {
    return /^https:\/\/[^\s\\]+$/i.test(value || '') ? value : '#';
  }
  function categoryHref(key: 'category' | 'topic', value: string) {
    return `${basePath}/?${key}=${encodeURIComponent(value)}`;
  }
  function withDirectoryState(path: string) {
    if (!pageUrl) return path;
    const result = new URL(path, pageUrl);
    const current = new URL(pageUrl);
    for (const key of [
      'q',
      'type',
      'format',
      'shape',
      'category',
      'topic',
      'usage',
      'layout',
      'language',
      'color',
      'status',
    ]) {
      const value = current.searchParams.get(key);
      if (value) result.searchParams.set(key, value);
    }
    return result.href;
  }
  function detailHref(target: Pick<Brand, 'id' | 'defaultAsset'>, file?: string) {
    const path = brandRoute(target, `${basePath}/`);
    const url = withDirectoryState(path);
    if (!pageUrl) return url;
    const result = new URL(url);
    if (file) result.searchParams.set('asset', file);
    if (target.id === brand.id && context.length)
      result.searchParams.set('versions', matchingOnly ? 'matching' : 'all');
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
    const params = new URL(pageUrl).searchParams;
    const preview = brand.assets.find((item) => item.file === params.get('asset'));
    const requested = preview ?? brand.assets.find((item) => item.file === params.get('selected'));
    if (requested) {
      if (selectedFile !== requested.file) workspaceVersion += 1;
      selectedFile = requested.file;
      cardFiles = { ...cardFiles, [selectedArtwork(brand, requested).id]: requested.file };
      const entry = (page.state as { logoDockPreview?: PreviewEntry }).logoDockPreview;
      if (entry?.brandId === brand.id && entry.origin) previewOrigin = entry.origin;
    }
    previewOpen = Boolean(preview);
    const state = readDirectoryState(pageUrl, [brand]);
    const matches = matchingBrands([brand], state)[0]?.assets ?? [];
    matchingOnly =
      params.get('versions') === 'matching' ||
      (params.get('versions') !== 'all' &&
        (!requested ||
          matches.some((item: Brand['assets'][number]) => item.file === requested.file)));
  }
  function queueNavigation(action: () => Promise<void>) {
    const revision = navigationRevision;
    navigation = navigation
      .then(async () => {
        if (active && revision === navigationRevision) await action();
      })
      .catch(() => {
        if (!active || revision !== navigationRevision) return;
        syncFromLocation();
        void feedback?.show('素材地址未能更新，请重试。', 'error');
      });
  }
  function changeVersionScope(value: boolean) {
    matchingOnly = value;
    queueNavigation(async () => {
      const url = new URL(location.href);
      url.searchParams.set('versions', value ? 'matching' : 'all');
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- Updates query state on the current resolved detail route.
      await goto(url, {
        shallow: true,
        reset: false,
        replace: previewOpen,
        persistState: true,
        state: page.state,
      });
      if (active) pageUrl = location.href;
    });
  }
  function selectAsset(event: MouseEvent, file: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const requested = brand.assets.find((item) => item.file === file);
    if (!requested) return;
    feedback?.reset();
    selectedFile = file;
    cardFiles = { ...cardFiles, [selectedArtwork(brand, requested).id]: file };
    previewOpen = true;
    workspaceVersion += 1;
    const origin = previewOrigin;
    queueNavigation(async () => {
      const current = new URL(location.href);
      const hadPreview = brand.assets.some(
        (item) => item.file === current.searchParams.get('asset'),
      );
      const state = hadPreview
        ? page.state
        : {
            ...page.state,
            logoDockPreview: { brandId: brand.id, galleryUrl: current.href, origin },
          };
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- detailHref preserves the current resolved detail route and directory context.
      await goto(detailHref(brand, file), {
        shallow: true,
        reset: false,
        replace: hadPreview,
        persistState: true,
        state,
      });
      if (active) pageUrl = location.href;
    });
  }
  function closePreview() {
    previewOpen = false;
    feedback?.reset();
    queueNavigation(async () => {
      const url = new URL(location.href);
      if (!url.searchParams.has('asset')) return;
      const entry = (page.state as { logoDockPreview?: PreviewEntry }).logoDockPreview;
      if (entry?.brandId === brand.id) {
        await new Promise<void>((resolve) => {
          window.addEventListener('popstate', () => resolve(), { once: true });
          history.back();
        });
      } else {
        url.searchParams.delete('asset');
        const state = { ...page.state } as { logoDockPreview?: PreviewEntry };
        delete state.logoDockPreview;
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- Removes only the asset query from the current resolved detail route.
        await goto(url, { shallow: true, reset: false, replace: true, persistState: true, state });
        if (active) pageUrl = location.href;
      }
    });
  }

  onMount(() => {
    syncFromLocation();
    const popstate = () => {
      navigationRevision += 1;
      syncFromLocation();
    };
    window.addEventListener('popstate', popstate);
    return () => {
      active = false;
      navigationRevision += 1;
      window.removeEventListener('popstate', popstate);
    };
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

{#snippet brandInformation()}
  <div class="brand-information-panel">
    <section class="brand-information" aria-label="品牌信息">
      <h2>品牌信息</h2>
      {#if categoryPaths.length || brand.topics?.length}
        <nav class="brand-classification" aria-label="品牌分类">
          {#each categoryPaths as category (category.id)}
            <a
              href={categoryHref('category', category.id)}
              title={`${category.groupLabel} / ${category.label}`}
              data-sveltekit-reload>{category.label}</a
            >
          {/each}
          {#each brand.topics ?? [] as topic (topic)}
            <a class="brand-topic" href={categoryHref('topic', topic)} data-sveltekit-reload
              >{topicLabels[topic as keyof typeof topicLabels]}</a
            >
          {/each}
        </nav>
      {/if}
      {#if subjectGroups.length}
        <dl class="brand-subjects" aria-label="主体信息">
          {#each subjectGroups as group (group.role)}
            <div>
              <dt>{subjectRoleLabels[group.role]}</dt>
              {#each group.entries as entry (`${entry.language}:${entry.name}`)}
                <dd class:subject-english={entry.language === 'en'}>
                  <span lang={entry.language}>{entry.name}</span><a
                    href={external(entry.source)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`查看${entry.name}的核验来源`}>依据 ↗</a
                  >
                </dd>
              {/each}
            </div>
          {/each}
        </dl>
      {:else if brand.entityType === 'company'}
        <p class="subject-pending">公司全称待核实</p>
      {/if}
    </section>
    {#if parent}
      <section class="related-brands" aria-label="所属品牌">
        <h2>所属品牌</h2>
        <a href={brandRoute(parent, `${basePath}/`)} data-sveltekit-reload
          ><span>{identityNames(parent).primary}</span><small
            >{entityLabels[parent.entityType]}</small
          ></a
        >
      </section>
    {/if}
    {#if relatedBrands.length}
      <section class="related-brands" aria-label="相关品牌与产品">
        <h2>相关品牌</h2>
        <div>
          {#each relatedBrands as related (related.id)}
            <a href={brandRoute(related, `${basePath}/`)} data-sveltekit-reload
              ><span>{identityNames(related).primary}</span><small
                >{entityLabels[related.entityType]}</small
              ></a
            >
          {/each}
        </div>
      </section>
    {/if}
  </div>
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
      <div class="brand-heading-line">
        <h1>{names.primary}</h1>
        {#if brand.entityType !== 'company'}
          <span class="detail-entity">{entityLabels[brand.entityType]}</span>
        {/if}
      </div>
      <div class="brand-heading-meta">
        {#if names.secondary}<p class="detail-english">{names.secondary}</p>{/if}
        <a
          class="website-link"
          href={external(brand.website)}
          target="_blank"
          rel="noopener noreferrer">{websiteDomain(brand)}{@render externalIcon()}</a
        >
      </div>
    </div>
  </header>
  <div class="detail-layout">
    <aside class="brand-sidebar" aria-label="品牌资料">
      {@render brandInformation()}
    </aside>
    <div id="asset-workspace">
      {#key `${selectedAsset.file}:${workspaceVersion}`}
        <AssetWorkspace
          {brand}
          asset={selectedAsset}
          {sourceCommit}
          {basePath}
          {pageUrl}
          directoryContext={matchingFiles && matchingFiles.length < brand.assets.length
            ? context
            : []}
          {matchingOnly}
          onChangeVersionScope={changeVersionScope}
          bind:versionFilters
          bind:previewOpen
          bind:previewOrigin
          bind:cardFiles
          bind:moreVersionsOpen
          bind:alternativeVersionsOpen
          preferredFormat={directoryState?.format}
          onClosePreview={closePreview}
          matchingFiles={matchingOnly ? matchingFiles : undefined}
          {backgroundChoice}
          bind:sourceDetailsOpen
          bind:designFilesOpen
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
  </div>
  <noscript
    ><p class="noscript-note">可直接下载文件。切换预览与复制需要 JavaScript。</p>
    <details class="noscript-files noscript-sources" open>
      <summary>素材来源与使用说明</summary>
      <p class="noscript-default-source">
        默认素材 {assetDescription(selectedAsset)} · {sourceLabel(selectedAsset)}
      </p>
      <SourceInfo information={sourceInformation([...brand.assets, ...nativeSourceFiles])} />
    </details>
    {#if brand.assets.length > 1}<details class="noscript-files">
        <summary>全部格式下载</summary>
        <ul>
          {#each brand.assets as item (item.file)}<li>
              <a href={`${basePath}/${assetPath(item)}`} download={assetDownloadName(brand, item)}
                >{assetDescription(item)} · {assetFormat(item)}</a
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
      </details>{/if}
  </noscript>
</main>
<CopyFeedback bind:this={feedback} />

<style>
  .detail-main {
    max-width: 1280px;
    padding-block: 12px 48px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    color: var(--muted);
    font-size: 13px;
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
    margin: 8px 0 28px;
  }
  .brand-heading > div {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 20px;
    min-width: 0;
  }
  .brand-heading-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 16px;
    min-width: 0;
  }
  .brand-heading-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .brand-heading h1 {
    font-size: 28px;
    line-height: 1.3;
    font-weight: 650;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }
  .detail-entity {
    padding: 3px 8px;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .detail-english {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    max-width: 100%;
    color: var(--muted);
    font-size: 13px;
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
    flex-shrink: 0;
  }
  .detail-layout {
    display: grid;
    grid-template-columns: 272px minmax(0, 1fr);
    align-items: start;
    gap: 32px;
  }
  .brand-sidebar,
  #asset-workspace {
    min-width: 0;
  }
  .brand-information-panel {
    min-width: 0;
    padding-top: 4px;
  }
  .brand-information {
    display: grid;
    gap: 16px;
    min-width: 0;
  }
  .brand-information h2,
  .related-brands h2 {
    margin: 0;
    color: var(--ink);
    font-size: var(--type-small);
    line-height: 1.5;
    font-weight: 600;
  }
  .brand-classification {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: var(--type-small);
  }
  .brand-classification a {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    color: var(--muted);
    text-decoration-color: var(--line-strong);
    text-underline-offset: 4px;
  }
  .brand-classification a:hover {
    color: var(--accent);
  }
  .brand-subjects {
    display: grid;
    gap: 20px;
    margin: 0;
    font-size: var(--type-small);
    line-height: 1.6;
  }
  .brand-subjects > div {
    display: grid;
    gap: 5px;
  }
  .brand-subjects dt {
    color: var(--muted);
    font-size: var(--type-caption);
  }
  .brand-subjects dd {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 8px;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .brand-subjects dd a {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .brand-subjects .subject-english {
    color: var(--muted);
  }
  .subject-pending {
    color: var(--muted);
    font-size: 13px;
  }
  .related-brands {
    display: grid;
    gap: 8px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  .related-brands > div {
    display: grid;
    gap: 2px;
  }
  .related-brands a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    color: var(--ink);
    text-decoration: none;
    font-size: var(--type-small);
  }
  .related-brands a:hover {
    color: var(--accent);
  }
  .related-brands small {
    color: var(--muted);
    font-size: 12px;
    flex-shrink: 0;
  }
  .noscript-files {
    margin-top: 16px;
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
  .noscript-default-source {
    margin-bottom: 12px;
    color: var(--muted);
    font-size: var(--type-small);
    line-height: 1.6;
  }
  @media (max-width: 900px) {
    .detail-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 28px;
    }
    #asset-workspace {
      order: -1;
    }
    .brand-sidebar {
      padding-top: 24px;
      border-top: 1px solid var(--line);
    }
    .brand-information-panel {
      padding-top: 0;
    }
  }
  @media (max-width: 720px) {
    .detail-main {
      padding-block: 4px 32px;
    }
    .brand-heading {
      margin-block: 4px 16px;
    }
    .brand-heading-line {
      gap: 8px;
    }
    .brand-heading h1 {
      font-size: 26px;
    }
    .detail-english {
      margin: 0;
      font-size: 13px;
    }
    .website-link {
      min-height: 32px;
      font-size: 13px;
    }
  }
</style>
