<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Dialog, RadioGroup, Toggle, Tooltip } from 'bits-ui';
  import type { Brand } from '../types';
  import type { CopyFeedbackApi } from './CopyFeedback.svelte';
  import FilterSelect from './ui/FilterSelect.svelte';
  import Disclosure from './ui/Disclosure.svelte';
  import { languageLabels, layoutLabels, colorLabels } from '../asset-taxonomy.mjs';
  import Icon from './Icon.svelte';
  import AssetPreview from './AssetPreview.svelte';
  import AssetActions from './AssetActions.svelte';
  import AppToaster from './AppToaster.svelte';
  import AssetReferences from './AssetReferences.svelte';
  import { directoryPreviewBounds } from '../catalog-preview.mjs';
  import {
    assetFormat,
    assetAttributes,
    matchingBrands,
    assetDisplayLabel,
    assetDescription,
    assetWarnings,
  } from '../catalog-presentation.mjs';
  import {
    artworkGroups,
    artworkDetailLabel,
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

  type Asset = Brand['assets'][number];
  type Artwork = ReturnType<typeof artworkGroups>[number];
  type PreviewBackground = 'light' | 'dark' | 'transparent';
  interface Props {
    brand: Brand;
    asset: Asset;
    sourceCommit: string;
    basePath: string;
    pageUrl: string;
    directoryContext?: string[];
    matchingOnly?: boolean;
    onChangeVersionScope: (value: boolean) => void;
    backgroundChoice?: PreviewBackground;
    versionFilters?: { language: string; layout: string; color: string };
    matchingFiles?: string[];
    previewOpen?: boolean;
    previewOrigin?: string;
    cardFiles?: Record<string, string>;
    preferredFormat?: string;
    moreVersionsOpen?: boolean;
    alternativeVersionsOpen?: boolean;
    onClosePreview: () => void;
    sourceDetailsOpen?: boolean;
    designFilesOpen?: boolean;
    feedback?: CopyFeedbackApi;
    assetHref: (file: string) => string;
    shareHref: (file: string) => string;
    onSelectAsset: (event: MouseEvent, file: string) => void;
    onBackgroundChange: (value: PreviewBackground | undefined) => void;
  }
  let {
    brand,
    asset,
    sourceCommit,
    basePath,
    pageUrl,
    directoryContext = [],
    matchingOnly = true,
    onChangeVersionScope,
    backgroundChoice,
    versionFilters = $bindable({ language: '', layout: '', color: '' }),
    matchingFiles,
    previewOpen = $bindable(false),
    previewOrigin = $bindable(''),
    cardFiles = $bindable({}),
    preferredFormat,
    moreVersionsOpen = $bindable(false),
    alternativeVersionsOpen = $bindable(false),
    onClosePreview,
    sourceDetailsOpen = $bindable(true),
    designFilesOpen = $bindable(false),
    feedback,
    assetHref,
    shareHref,
    onSelectAsset,
    onBackgroundChange,
  }: Props = $props();

  let density = $state(1);
  let compactPreview = $state(false);
  let fullCanvas = $state(false);
  let fileOptionsOpen = $derived(asset.display === 'alternative');
  let previewStatus = $state('');
  let failedFiles = $state<string[]>([]);
  let dimensions = $state<{ file: string; width: number; height: number }>();
  let gallery: HTMLElement;
  const backgroundOptions = [
    { value: 'auto', label: '适配' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'transparent', label: '棋盘格' },
  ] as const;
  const versionFilterFields = [
    { key: 'language', label: '版本语言', all: '全部语言', labels: languageLabels },
    { key: 'layout', label: '版本排布', all: '全部排布', labels: layoutLabels },
    { key: 'color', label: '版本配色', all: '全部配色', labels: colorLabels },
  ] as const;
  const filteredBrand: Brand | undefined = $derived(
    matchingBrands(
      [
        {
          ...brand,
          assets: brand.assets.filter(
            (item) => !matchingFiles || matchingFiles.includes(item.file),
          ),
        },
      ],
      versionFilters,
    )[0],
  );
  const artworks = $derived(filteredBrand ? primaryArtworkGroups(filteredBrand) : []);
  const alternativeArtworks = $derived(
    filteredBrand ? alternativeArtworkGroups(filteredBrand) : [],
  );
  const hasVersionFilters = $derived(
    Boolean(versionFilters.language || versionFilters.layout || versionFilters.color),
  );
  const totalVersions = $derived(artworkGroups(brand).length);
  const selectionOutsideResults = $derived(
    !filteredBrand?.assets.some((item) => item.file === asset.file),
  );
  const largeVersionSet = $derived(totalVersions >= 8);
  const visibleArtworks = $derived(largeVersionSet ? artworks.slice(0, 6) : artworks);
  const moreArtworks = $derived(largeVersionSet ? artworks.slice(6) : []);
  const hasColorVariants = $derived(new Set(brand.assets.map((item) => item.color)).size > 1);
  const artwork = $derived(selectedArtwork(brand, asset)!);
  const path = $derived(`${basePath}/${assetPath(asset)}`);
  const format = $derived(assetFormat(asset));
  const alt = $derived(`${brand.name} ${assetDescription(asset)}`);
  const background = $derived(backgroundChoice ?? (asset.background === 'dark' ? 'dark' : 'light'));
  const previewBounds = $derived(directoryPreviewBounds(asset));
  const currentAttributes = $derived(attributesFor(artwork, asset).join(' · '));
  const warnings = $derived(assetWarnings(asset));
  const originalAsset = $derived(
    brand.assets.find((entry) => entry.file === asset.provenance.originalAsset),
  );
  const sourceFiles = $derived(artworkSourceFiles(brand, asset));
  const sourceInfo = $derived(sourceInformation([asset, ...sourceFiles]));
  const formatChoices = $derived(
    [...new Set(artwork.assets.map(assetFormat))].map((value) => ({
      format: value,
      asset: value === format ? asset : preferredArtworkAsset(artwork, value),
    })),
  );
  const fileAlternatives = $derived(artwork.assets.filter((item) => assetFormat(item) === format));
  const rasterSize = $derived(dimensions && dimensions.file === asset.file ? dimensions : asset);
  const info = $derived(fileInfo({ ...asset, width: rasterSize.width, height: rasterSize.height }));
  $effect(() => {
    if (!previewOpen) return;
    if (moreArtworks.some((item) => item.id === artwork.id)) moreVersionsOpen = true;
    if (isAlternativeArtwork(artwork)) alternativeVersionsOpen = true;
  });
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

  function attributesFor(item: Artwork, file = item.defaultAsset) {
    const label = assetDisplayLabel(file);
    return [
      ...new Set(
        [assetAttributes(file), artworkDetailLabel(item, file)]
          .filter(Boolean)
          .flatMap((value) => value.split(' · '))
          .filter(
            (attribute) =>
              attribute !== colorLabels.brand &&
              attribute !== brand.name &&
              !(file.usage === 'app-icon' && attribute === '图形标') &&
              !label.includes(attribute) &&
              (hasColorVariants ||
                attribute !== colorLabels[file.color as keyof typeof colorLabels]),
          ),
      ),
    ];
  }
  function artworkFile(item: Artwork) {
    return (
      item.assets.find((candidate) => candidate.file === cardFiles[item.id]) ??
      preferredArtworkAsset(item, preferredFormat)
    );
  }
  function selectCardFile(event: MouseEvent, item: Artwork, file: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    feedback?.reset();
    cardFiles[item.id] = file;
  }
  function openPreview(event: MouseEvent, file: string) {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      if (!previewOpen) previewOrigin = (event.currentTarget as HTMLElement).id;
      previewOpen = true;
    }
    onSelectAsset(event, file);
  }
  function restorePreviewFocus(event: Event) {
    event.preventDefault();
    if (previewOpen) return;
    const target = [
      ...(gallery?.querySelectorAll<HTMLAnchorElement>('[data-selection-kind="artwork"]') ?? []),
    ].find(
      (link) =>
        link.dataset.selectAsset === asset.file || link.dataset.selectArtwork === artwork.id,
    );
    const focusTarget = [
      document.getElementById(previewOrigin),
      target,
      gallery?.querySelector<HTMLElement>('.artwork-visual'),
      gallery?.querySelector<HTMLElement>('button'),
      gallery,
    ].find((element) => element?.getClientRects().length);
    focusTarget?.focus({ preventScroll: true });
  }
  async function openDesignFiles() {
    designFilesOpen = true;
    await tick();
    const scroller = document.querySelector<HTMLElement>('.preview-dialog-body');
    const files = document.getElementById('design-files');
    if (scroller && files)
      scroller.scrollTo({
        top:
          scroller.scrollTop +
          files.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          12,
        behavior: 'smooth',
      });
    document.getElementById('design-files-trigger')?.focus({ preventScroll: true });
  }
  function imageLoaded(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    previewStatus = '';
    if (format !== 'SVG' && image.naturalWidth)
      dimensions = { file: asset.file, width: image.naturalWidth, height: image.naturalHeight };
  }
  onMount(() => {
    const updateDensity = () => (density = window.devicePixelRatio || 1);
    const media = window.matchMedia('(max-width: 720px)');
    const updatePreviewSize = () => (compactPreview = media.matches);
    updateDensity();
    updatePreviewSize();
    window.addEventListener('resize', updateDensity);
    media.addEventListener('change', updatePreviewSize);
    return () => {
      window.removeEventListener('resize', updateDensity);
      media.removeEventListener('change', updatePreviewSize);
    };
  });
</script>

{#snippet backgroundControls(name: string)}
  <RadioGroup.Root
    class="preview-controls"
    aria-label="预览背景"
    orientation="horizontal"
    {name}
    value={backgroundChoice ?? 'auto'}
    onValueChange={(value) =>
      onBackgroundChange(value === 'auto' ? undefined : (value as PreviewBackground))}
  >
    {#each backgroundOptions as option (option.value)}
      <RadioGroup.Item class="preview-background-option" value={option.value}>
        <span class="background-swatch" data-swatch={option.value}></span><span>{option.label}</span
        >
      </RadioGroup.Item>
    {/each}
  </RadioGroup.Root>
{/snippet}

{#snippet artworkCard(item: Artwork, index: number)}
  {@const file = artworkFile(item)}
  {@const attributes = attributesFor(item, file)}
  {@const choices = [...new Set(item.assets.map(assetFormat))]}
  {@const notices = assetWarnings(file)}
  {@const cardId = `artwork-${index}-${item.id.replace(/[^a-z0-9-]/gi, '-')}`}
  <article class="artwork-card" data-artwork={item.id}>
    <!-- eslint-disable svelte/no-navigation-without-resolve -- Selection preserves the current detail URL and directory context. -->
    <a
      id={`${cardId}-preview`}
      class="artwork-visual variant-option"
      href={assetHref(file.file)}
      data-select-artwork={item.id}
      data-select-asset={file.file}
      data-selection-kind="artwork"
      aria-label={`查看 ${brand.name} ${assetDescription(file)} ${assetFormat(file)} 文件详情`}
      onclick={(event) => openPreview(event, file.file)}
      data-background={backgroundChoice ?? (file.background === 'dark' ? 'dark' : 'light')}
    >
      {#if failedFiles.includes(file.file)}
        <span class="preview-error">预览未能加载<span>查看文件详情</span></span>
      {:else}
        <AssetPreview
          asset={file}
          src={`${basePath}/${assetPath(file)}`}
          maxWidth={totalVersions === 1 ? 420 : 300}
          maxHeight={totalVersions === 1 ? 180 : 128}
          {density}
          loading={index < 6 ? 'eager' : 'lazy'}
          onerror={() => {
            failedFiles = [...failedFiles, file.file];
          }}
        />
      {/if}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
    <div class="artwork-caption">
      <div class="artwork-caption-heading">
        <h3>{assetDisplayLabel(file)}</h3>
        <!-- eslint-disable svelte/no-navigation-without-resolve -- Opens this registered file's detail route. -->
        <a
          id={`${cardId}-details`}
          class="file-details-link"
          href={assetHref(file.file)}
          data-select-artwork={item.id}
          data-select-asset={file.file}
          data-selection-kind="artwork"
          aria-label={`查看 ${brand.name} ${assetDescription(file)} ${assetFormat(file)} 文件详情`}
          onclick={(event) => openPreview(event, file.file)}
          >文件详情<Icon name="chevron-right" size={13} /></a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>
      {#if attributes.length}<p class="artwork-attributes">{attributes.join(' · ')}</p>{/if}
      {#if totalVersions === 1}<p class="single-file-meta">{fileInfo(file)}</p>{/if}
      {#if choices.length > 1}
        <nav class="card-formats" aria-label={`${assetDisplayLabel(file)} 文件格式`}>
          {#each choices as choice (choice)}
            {@const candidate =
              choice === assetFormat(file) ? file : preferredArtworkAsset(item, choice)}
            <!-- eslint-disable svelte/no-navigation-without-resolve -- Selects a registered file within the current artwork. -->
            <a
              href={assetHref(candidate.file)}
              data-select-asset={candidate.file}
              data-selection-kind="format"
              aria-current={choice === assetFormat(file) ? 'true' : undefined}
              onclick={(event) => selectCardFile(event, item, candidate.file)}>{choice}</a
            >
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
          {/each}
        </nav>
      {/if}
      {#if notices.length}<p class="card-warning">{notices.join(' · ')}</p>{/if}
    </div>
    <div class="artwork-actions">
      {#key file.file}
        <AssetActions
          {brand}
          asset={file}
          {sourceCommit}
          {basePath}
          {pageUrl}
          {feedback}
          {shareHref}
          id={cardId}
        />
      {/key}
    </div>
  </article>
{/snippet}

<section
  class="asset-gallery"
  class:single-artwork={totalVersions === 1}
  aria-label="标识素材"
  tabindex="-1"
  bind:this={gallery}
>
  <div class="gallery-heading">
    <h2>标识素材</h2>
    {@render backgroundControls('gallery-background')}
  </div>
  {#if directoryContext.length}
    <div class="directory-context">
      <p>当前筛选 <span>{directoryContext.join(' · ')}</span></p>
      <RadioGroup.Root
        class="version-range"
        aria-label="版本范围"
        orientation="horizontal"
        value={matchingOnly ? 'matching' : 'all'}
        onValueChange={(value) => onChangeVersionScope(value === 'matching')}
      >
        <RadioGroup.Item value="matching">匹配版本</RadioGroup.Item>
        <RadioGroup.Item value="all">全部版本</RadioGroup.Item>
      </RadioGroup.Root>
    </div>
  {/if}
  {#if largeVersionSet}
    <div class="version-filters" aria-label="筛选当前品牌版本">
      {#each versionFilterFields as field (field.key)}
        <FilterSelect
          id={`version-${field.key}-filter`}
          label={field.label}
          value={versionFilters[field.key]}
          options={[
            { value: '', label: field.all },
            ...Object.entries(field.labels).map(([value, label]) => ({ value, label })),
          ]}
          onchange={(value) => {
            versionFilters[field.key] = value;
          }}
        />
      {/each}
      {#if hasVersionFilters}<button
          type="button"
          class="version-reset"
          onclick={() => {
            versionFilters = { language: '', layout: '', color: '' };
          }}>清除版本筛选</button
        >{/if}
    </div>
  {/if}
  {#if !filteredBrand}
    <p class="version-empty" role="status">当前条件下没有匹配版本，可调整筛选或查看全部版本。</p>
  {:else}
    <div class="artwork-grid" aria-label="标识版本">
      {#each visibleArtworks as item, index (item.id)}{@render artworkCard(item, index)}{/each}
    </div>
    {#if moreArtworks.length}
      <Disclosure
        class="artwork-more"
        triggerClass="artwork-more-trigger"
        bind:open={moreVersionsOpen}
      >
        {#snippet trigger()}其余 {moreArtworks.length} 个版本<Icon
            name="chevron-down"
            size={14}
          />{/snippet}
        <div class="artwork-grid" aria-label="更多标识版本">
          {#each moreArtworks as item, index (item.id)}{@render artworkCard(item, index + 6)}{/each}
        </div>
      </Disclosure>
    {/if}
    {#if alternativeArtworks.length}
      <Disclosure
        class="artwork-alternatives"
        triggerClass="artwork-alternatives-trigger"
        bind:open={alternativeVersionsOpen}
      >
        {#snippet trigger()}其他可用版本 <span>{alternativeArtworks.length}</span>{/snippet}
        <div class="artwork-grid" aria-label="备选标识">
          {#each alternativeArtworks as item, index (item.id)}{@render artworkCard(
              item,
              index + artworks.length,
            )}{/each}
        </div>
      </Disclosure>
    {/if}
  {/if}
</section>

<Dialog.Root
  bind:open={previewOpen}
  onOpenChange={(open) => {
    if (!open) onClosePreview();
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="asset-dialog-overlay" />
    <Dialog.Content
      class="preview-dialog"
      aria-describedby={undefined}
      preventScroll
      trapFocus
      onCloseAutoFocus={restorePreviewFocus}
    >
      <div class="asset-dialog-heading">
        <Dialog.Title level={2}>{brand.name} · {assetDescription(asset)} · {format}</Dialog.Title>
        <Dialog.Close class="icon-button" aria-label="关闭文件详情">×</Dialog.Close>
      </div>
      <div class="preview-dialog-body">
        <section class="preview-stage" aria-label="标识预览">
          <div
            class="detail-canvas"
            id="detail-canvas"
            data-background={background}
            data-variant={asset.variant}
            data-usage={asset.usage}
          >
            <AssetPreview
              {asset}
              src={path}
              {alt}
              id="detail-image"
              {fullCanvas}
              {density}
              maxWidth={600}
              maxHeight={compactPreview ? 180 : 300}
              onload={imageLoaded}
              onerror={() => {
                previewStatus = '预览未能加载，请尝试下载原始文件。';
              }}
            />
          </div>
          <div class="preview-bottom">
            {@render backgroundControls('preview-background')}
            {#if previewBounds}<Toggle.Root
                class="preview-view-toggle"
                aria-label="显示完整画布"
                bind:pressed={fullCanvas}>完整画布</Toggle.Root
              >{/if}
          </div>
          <p class="preview-hint">背景仅用于预览，下载保留原始文件。</p>
          {#if previewStatus}<p class="preview-status" role="status">{previewStatus}</p>{/if}
        </section>
        <section class="asset-controls" aria-label="文件详情">
          {#if selectionOutsideResults}<p class="selection-notice">
              此文件位于当前筛选范围之外。
            </p>{/if}
          <div class="current-version">
            <h3>{assetDisplayLabel(asset)}</h3>
            {#if currentAttributes}<p>{currentAttributes}</p>{/if}
            <p class="current-file-name">{asset.file}</p>
          </div>
          {#if formatChoices.length > 1}
            <fieldset class="format-choices">
              <legend>文件格式</legend>
              <div class="format-option-list">
                {#each formatChoices as item (item.format)}
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- Uses the current resolved detail URL. -->
                  <a
                    class="format-option"
                    href={assetHref(item.asset.file)}
                    data-select-asset={item.asset.file}
                    data-selection-kind="format"
                    aria-current={item.format === format ? 'true' : undefined}
                    onclick={(event) => onSelectAsset(event, item.asset.file)}>{item.format}</a
                  >
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                {/each}
              </div>
            </fieldset>
          {/if}
          {#if fileAlternatives.length > 1}
            <Disclosure
              class="file-options"
              triggerClass="file-options-trigger"
              bind:open={fileOptionsOpen}
            >
              {#snippet trigger()}更多文件{/snippet}
              <div class="file-option-list">
                {#each fileAlternatives as item (item.file)}
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- Uses the current resolved detail URL. -->
                  <a
                    class="file-option"
                    href={assetHref(item.file)}
                    data-select-asset={item.file}
                    data-selection-kind="file"
                    aria-current={item.file === asset.file ? 'true' : undefined}
                    onclick={(event) => onSelectAsset(event, item.file)}
                  >
                    <span>{assetDescription(item)}</span><small
                      >{provenanceLabel(item)} · {fileInfo(item)}</small
                    ></a
                  >
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                {/each}
              </div>
            </Disclosure>
          {/if}
          <div class="file-meta">
            <p id="detail-fileinfo">
              {info}{#if asset.display === 'alternative'}
                · 备选文件{/if}
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger id="detail-source-link">
                {#snippet child({ props })}
                  <a {...props} href={asset.sourcePage} target="_blank" rel="noopener noreferrer"
                    >来源<Icon name="external" size={13} /></a
                  >
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="utility-tooltip" role="tooltip" sideOffset={6}>
                  {sourceLabel(asset)}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
          {#if asset.qualityNotes?.length}<p class="asset-description">
              {asset.qualityNotes.join(' ')}
            </p>{/if}
          {#if warnings.length}<ul class="asset-warnings">
              {#each warnings as note (note)}<li>{note}</li>{/each}
            </ul>{/if}
          <AssetActions
            {brand}
            {asset}
            {sourceCommit}
            {basePath}
            {pageUrl}
            {feedback}
            {shareHref}
            id="detail"
            primary
          />
          {#if sourceFiles.length}<button
              type="button"
              class="design-files-link"
              onclick={openDesignFiles}
            >
              设计源文件 <span>{sourceFiles.length} 个文件</span><Icon
                name="chevron-right"
                size={14}
              /></button
            >{/if}
        </section>
        <div class="preview-references">
          <AssetReferences
            {brand}
            {asset}
            {basePath}
            {links}
            {sourceFiles}
            {sourceInfo}
            {originalAsset}
            bind:sourceDetailsOpen
            bind:designFilesOpen
            {feedback}
            {assetHref}
            onSelectAsset={openPreview}
          />
        </div>
      </div>
      <AppToaster scope="file-detail" />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .asset-gallery {
    min-width: 0;
  }
  .gallery-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .artwork-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 20px;
    align-items: start;
  }
  .artwork-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    background: var(--paper);
  }
  .artwork-visual {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 184px;
    padding: 24px;
    background: #f7f8fa;
    text-decoration: none;
  }
  .artwork-visual[data-background='dark'],
  .detail-canvas[data-background='dark'] {
    background: #22262c;
  }
  .artwork-visual[data-background='transparent'],
  .detail-canvas[data-background='transparent'] {
    background-color: #fff;
    background-image:
      linear-gradient(45deg, #e9ecf0 25%, transparent 25%),
      linear-gradient(-45deg, #e9ecf0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e9ecf0 75%),
      linear-gradient(-45deg, transparent 75%, #e9ecf0 75%);
    background-size: 16px 16px;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
  }
  .artwork-visual:focus-visible {
    outline-offset: -4px;
  }
  .artwork-caption {
    display: grid;
    gap: 5px;
    padding: 16px 16px 12px;
  }
  .artwork-caption h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.6;
  }
  .artwork-caption-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .file-details-link {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    min-height: 36px;
    margin-block: -6px;
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .file-details-link:hover {
    color: var(--accent);
  }
  .artwork-attributes {
    margin: 0;
    color: var(--ink);
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .artwork-actions {
    margin-top: auto;
    padding: 0 16px 16px;
  }
  .card-formats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .card-formats a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .card-formats a[aria-current='true'] {
    color: var(--ink);
    background: var(--surface);
  }
  .card-warning {
    margin: 3px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  .preview-error {
    display: grid;
    gap: 7px;
    text-align: center;
    font-size: 13px;
    color: var(--ink);
  }
  .preview-error span {
    font-size: 12px;
    color: var(--muted);
  }
  .single-artwork .artwork-visual {
    height: 240px;
    padding: 36px;
  }
  .single-artwork .artwork-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .single-artwork .artwork-visual {
    grid-row: 1 / 3;
  }
  .single-artwork .artwork-caption {
    align-self: end;
    padding: 24px 24px 12px;
  }
  .single-artwork .artwork-actions {
    align-self: start;
    margin-top: 0;
    padding: 0 24px 24px;
  }
  .single-file-meta {
    margin: 3px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  :global(.artwork-more) {
    margin-top: 20px;
  }
  :global(.artwork-more-trigger) {
    width: 100%;
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--ink);
    font-size: 13px;
    cursor: pointer;
    list-style: none;
  }
  :global(.artwork-more-trigger::-webkit-details-marker) {
    display: none;
  }
  :global(.artwork-more[data-state='open'] > .artwork-more-trigger) {
    margin-bottom: 20px;
  }
  :global(.artwork-more[data-state='open'] > .artwork-more-trigger svg) {
    transform: rotate(180deg);
  }
  :global(.artwork-alternatives) {
    margin-top: 24px;
  }
  :global(.artwork-alternatives-trigger) {
    width: 100%;
    padding: 0;
    border: 0;
    color: var(--ink);
    text-align: start;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-bottom: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  :global(.artwork-alternatives-trigger span) {
    color: var(--muted);
    font-size: 12px;
  }
  .directory-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    font-size: 13px;
  }
  .directory-context p {
    margin: 0;
    color: var(--muted);
  }
  .directory-context p span {
    color: var(--ink);
  }
  .directory-context :global(.version-range) {
    display: flex;
    gap: 4px;
  }
  .directory-context :global(button),
  .version-reset {
    min-height: 36px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--paper);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .directory-context :global(button[data-state='checked']) {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .version-filters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: end;
    gap: 12px;
    margin-bottom: 20px;
  }
  .version-reset {
    justify-self: start;
    grid-column: 1 / -1;
  }
  .version-empty {
    padding: 32px 0;
    font-size: 14px;
    line-height: 1.7;
    color: var(--muted);
  }
  .selection-notice {
    margin: 0;
    padding: 10px 12px;
    background: var(--surface);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
  }
  :global(.preview-controls) {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;
  }
  :global(.preview-background-option) {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 0;
    min-height: 36px;
    padding: 7px 8px;
    border-radius: 5px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  :global(.preview-background-option[data-state='checked']) {
    background: var(--surface);
    color: var(--ink);
  }
  :global(.preview-background-option:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .background-swatch {
    width: 11px;
    height: 11px;
    border: 1px solid #9ba5b3;
    border-radius: 50%;
    background: #fff;
  }
  .background-swatch[data-swatch='auto'] {
    background: linear-gradient(90deg, #fff 50%, #22262c 50%);
  }
  .background-swatch[data-swatch='dark'] {
    background: #22262c;
  }
  .background-swatch[data-swatch='transparent'] {
    background: repeating-conic-gradient(#bbc2cb 0% 25%, #fff 0% 50%) 50% / 6px 6px;
  }
  :global(.asset-dialog-overlay) {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: #10182080;
  }
  :global(.preview-dialog) {
    position: fixed;
    z-index: 75;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    width: min(1120px, calc(100vw - 48px));
    max-height: calc(100dvh - 48px);
    border-radius: 12px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 20px 80px #09132130;
    outline: none;
  }
  :global(.asset-dialog-heading) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 64px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }
  :global(.asset-dialog-heading h2) {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    font-weight: 600;
  }
  :global(.asset-dialog-heading .icon-button) {
    width: 40px;
    height: 40px;
    font-size: 24px;
    flex-shrink: 0;
  }
  .preview-dialog-body {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 28px;
    padding: 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
    min-height: 0;
  }
  .preview-references {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .preview-stage {
    min-width: 0;
  }
  .detail-canvas {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 360px;
    padding: 24px;
    border-radius: 7px;
    background: #f7f8fa;
  }
  .preview-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 12px;
  }
  :global(.preview-view-toggle) {
    min-height: 36px;
    padding: 7px 9px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  :global(.preview-view-toggle:hover) {
    background: var(--surface);
    color: var(--ink);
  }
  :global(.preview-view-toggle[data-state='on']) {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .preview-hint,
  .preview-status {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  .asset-controls {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 18px;
    min-width: 0;
  }
  .current-version h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  .current-version p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
  }
  .current-version .current-file-name {
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .file-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    font-size: 12px;
    color: var(--muted);
  }
  .file-meta p {
    margin: 0;
  }
  .file-meta a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    color: var(--muted);
    text-underline-offset: 3px;
  }
  .asset-description {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.75;
    overflow-wrap: anywhere;
  }
  .asset-warnings {
    margin: 0;
    padding: 10px 12px 10px 28px;
    background: var(--surface);
    border-radius: 5px;
    font-size: 12px;
    line-height: 1.75;
  }
  .format-choices {
    padding: 0;
    margin: 0;
    border: 0;
  }
  .format-choices legend {
    margin-bottom: 8px;
    color: var(--muted);
    font-size: 12px;
  }
  .format-option-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .format-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--muted);
    font-size: 13px;
    text-decoration: none;
  }
  .format-option[aria-current='true'] {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }
  :global(.file-options) {
    font-size: 12px;
    color: var(--muted);
  }
  :global(.file-options-trigger) {
    border: 0;
    padding-inline: 0;
    color: var(--muted);
    font: inherit;
    min-height: 36px;
    padding-block: 8px;
    cursor: pointer;
  }
  .file-option-list {
    display: grid;
    gap: 6px;
  }
  .file-option {
    display: grid;
    gap: 4px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 5px;
    text-decoration: none;
  }
  .file-option[aria-current='true'] {
    border-color: var(--accent);
    color: var(--accent);
  }
  .file-option small {
    color: var(--muted);
    font-size: 12px;
  }
  .design-files-link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 8px 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    text-align: start;
    cursor: pointer;
  }
  .design-files-link span {
    margin-left: auto;
    font-size: 12px;
    color: var(--muted);
  }
  @media (max-width: 720px) {
    :global(.preview-dialog) {
      width: calc(100vw - 24px);
      max-height: calc(100dvh - 24px);
    }
    :global(.asset-dialog-heading) {
      min-height: 56px;
      padding: 8px 16px;
    }
    .preview-dialog-body {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
      padding: 16px;
    }
    .detail-canvas {
      height: 240px;
      padding: 24px;
    }
    .asset-controls {
      gap: 14px;
    }
    .version-filters {
      gap: 8px;
    }
    .gallery-heading {
      align-items: start;
      flex-direction: column;
      gap: 8px;
    }
    :global(.preview-background-option) {
      min-height: 40px;
      padding-inline: 9px;
    }
  }
  @media (max-width: 560px) {
    .artwork-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .artwork-visual {
      height: 180px;
    }
    .single-artwork .artwork-visual {
      height: 220px;
      padding: 24px;
    }
    .single-artwork .artwork-card {
      display: flex;
    }
    .single-artwork .artwork-caption {
      align-self: stretch;
      padding: 16px 16px 12px;
    }
    .single-artwork .artwork-actions {
      align-self: stretch;
      padding: 0 16px 16px;
    }
  }
</style>
