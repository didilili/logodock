<script lang="ts">
  import { Accordion } from 'bits-ui';
  import type { Asset, Brand, SourceFile } from '../types';
  import type { CopyFeedbackApi } from './CopyFeedback.svelte';
  import { assetDescription, assetFormat } from '../catalog-presentation.mjs';
  import { fileInfo, sourceLabel, type sourceInformation } from '../catalog-display.mjs';
  import { assetPath } from '../resource-links.mjs';
  import CopyField from './CopyField.svelte';
  import Icon from './Icon.svelte';
  import SourceInfo from './SourceInfo.svelte';

  interface Props {
    brand: Brand;
    asset: Asset;
    basePath: string;
    links: { current: string; fixed?: string | null; html: string; markdown: string };
    sourceFiles: SourceFile[];
    sourceInfo: ReturnType<typeof sourceInformation>;
    originalAsset?: Asset;
    sourceDetailsOpen?: boolean;
    designFilesOpen?: boolean;
    feedback?: CopyFeedbackApi;
    assetHref: (file: string) => string;
    onSelectAsset: (event: MouseEvent, file: string) => void;
  }

  let {
    brand,
    asset,
    basePath,
    links,
    sourceFiles,
    sourceInfo,
    originalAsset,
    sourceDetailsOpen = $bindable(true),
    designFilesOpen = $bindable(false),
    feedback,
    assetHref,
    onSelectAsset,
  }: Props = $props();

  let embedDetailsOpen = $state(false);
  const openSections = $derived([
    ...(sourceDetailsOpen ? ['source'] : []),
    ...(designFilesOpen ? ['design'] : []),
    ...(embedDetailsOpen ? ['embed'] : []),
  ]);

  function updateOpenSections(value: string[]) {
    sourceDetailsOpen = value.includes('source');
    designFilesOpen = value.includes('design');
    embedDetailsOpen = value.includes('embed');
  }

  const designGroups = $derived(
    [
      {
        id: 'same-page',
        label: '同页设计文件',
        files: sourceFiles.filter((entry) => entry.sourcePage === asset.sourcePage),
      },
      {
        id: 'related',
        label: '相关规范',
        files: sourceFiles.filter((entry) => entry.sourcePage !== asset.sourcePage),
      },
    ].filter((group) => group.files.length),
  );
  const designFormats = $derived([...new Set(sourceFiles.map(assetFormat))].join(' / '));
</script>

<section class="asset-references" aria-label="素材参考信息">
  <Accordion.Root type="multiple" value={openSections} onValueChange={updateOpenSections}>
    <Accordion.Item value="source" class="resource-details source-details">
      <Accordion.Header level={3} class="resource-header">
        <Accordion.Trigger
          id="source-details-trigger"
          class="resource-trigger"
          data-resource-trigger="source"
        >
          <span>来源与使用说明</span>
          {#if sourceInfo.attributions.length}<small>需署名</small>{/if}
          <span class="resource-chevron"><Icon name="chevron-down" size={14} /></span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content data-resource-content="source">
        <div class="source-fields">
          <p class="source-category">{sourceLabel(asset)}</p>
          {#if originalAsset}
            <div class="original-source">
              <span>原始素材</span>
              <!-- eslint-disable svelte/no-navigation-without-resolve -- assetHref preserves the resolved detail route and selected file. -->
              <a
                href={assetHref(originalAsset.file)}
                data-original-asset={originalAsset.file}
                data-selection-kind="artwork"
                onclick={(event) => onSelectAsset(event, originalAsset.file)}
                >{assetDescription(originalAsset)}</a
              >
              <!-- eslint-enable svelte/no-navigation-without-resolve -->
            </div>
          {/if}
          <SourceInfo information={sourceInfo} licenseId="detail-license-link" />
        </div>
      </Accordion.Content>
    </Accordion.Item>

    {#if sourceFiles.length}
      <section class="source-files" aria-label="原生设计文件">
        <Accordion.Item value="design" id="design-files" class="resource-details design-files">
          <Accordion.Header level={3} class="resource-header">
            <Accordion.Trigger
              id="design-files-trigger"
              class="resource-trigger"
              data-resource-trigger="design"
            >
              <span>设计源文件</span>
              <small>{designFormats} · {sourceFiles.length} 个文件</small>
              <span class="resource-chevron"><Icon name="chevron-down" size={14} /></span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content data-resource-content="design">
            <div class="design-file-groups">
              {#each designGroups as group (group.id)}
                <section class="design-file-group" aria-label={group.label}>
                  <h4>{group.label}</h4>
                  <ul>
                    {#each group.files as entry (entry.file)}
                      <li data-source-file={entry.file}>
                        <!-- eslint-disable svelte/no-navigation-without-resolve -- Downloads a validated catalog path under the resolved base path. -->
                        <a
                          class="source-file-download"
                          href={`${basePath}/${assetPath(entry)}`}
                          download={`${brand.id}-${entry.file}`}
                          aria-label={`下载 ${entry.label} ${assetFormat(entry)}`}
                        >
                          <span class="design-file-label">{entry.label}</span>
                          <small class="source-file-meta">{fileInfo(entry)}</small>
                          <span class="source-file-action"
                            >下载<Icon name="download" size={14} /></span
                          >
                        </a>
                        <!-- eslint-enable svelte/no-navigation-without-resolve -->
                      </li>
                    {/each}
                  </ul>
                </section>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </section>
    {/if}

    <Accordion.Item value="embed" class="resource-details embed-details">
      <Accordion.Header level={3} class="resource-header">
        <Accordion.Trigger
          id="embed-details-trigger"
          class="resource-trigger"
          data-resource-trigger="embed"
        >
          <span>嵌入代码</span>
          <span class="resource-chevron"><Icon name="chevron-down" size={14} /></span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content data-resource-content="embed">
        <div class="resource-fields">
          <CopyField
            id="current-address"
            label="图片地址"
            value={links.current}
            getRevision={() => feedback?.currentRevision()}
            oncopy={(value, label) => feedback?.copy(value, label)}
          />
          {#if links.fixed}
            <CopyField
              id="fixed-address"
              label="固定版本地址"
              value={links.fixed}
              getRevision={() => feedback?.currentRevision()}
              oncopy={(value, label) => feedback?.copy(value, label)}
            />
            <p class="link-hint" id="snippet-hint">嵌入代码使用固定版本。</p>
          {/if}
          <CopyField
            id="html-example"
            label="HTML"
            value={links.html}
            getRevision={() => feedback?.currentRevision()}
            multiline
            oncopy={(value, label) => feedback?.copy(value, label)}
          />
          <CopyField
            id="markdown-example"
            label="Markdown"
            value={links.markdown}
            getRevision={() => feedback?.currentRevision()}
            multiline
            oncopy={(value, label) => feedback?.copy(value, label)}
          />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
</section>

<style>
  .asset-references {
    margin-top: 0;
    border-top: 1px solid var(--line);
  }
  .asset-references :global(.resource-details + .source-files),
  .asset-references :global(.resource-details + .resource-details),
  .asset-references :global(.source-files + .resource-details) {
    border-top: 1px solid var(--line);
  }
  .asset-references :global(.resource-header) {
    margin: 0;
  }
  .asset-references :global(.resource-trigger) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 12px 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: var(--type-small);
    font-weight: 600;
    line-height: 1.6;
    text-align: left;
    cursor: pointer;
  }
  .asset-references :global(.resource-trigger > small) {
    color: var(--muted);
    font-size: var(--type-caption);
    font-weight: 400;
  }
  .resource-chevron {
    display: inline-flex;
    flex-shrink: 0;
    margin-left: auto;
  }
  .asset-references :global(.resource-trigger[data-state='open'] .resource-chevron) {
    transform: rotate(180deg);
  }
  .asset-references :global(#design-files) {
    scroll-margin-top: 84px;
  }
  .design-file-groups {
    display: grid;
    gap: 16px;
    padding-bottom: 16px;
  }
  .design-file-group h4 {
    margin-bottom: 4px;
    color: var(--muted);
    font-size: var(--type-caption);
    font-weight: 500;
    line-height: 1.6;
  }
  .design-file-group ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .source-file-download {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding-block: 6px;
    color: var(--ink);
    font-size: var(--type-small);
    line-height: 1.6;
    text-decoration: none;
  }
  .source-file-download:hover .design-file-label,
  .source-file-download:hover .source-file-action {
    color: var(--focus);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .design-file-label {
    overflow-wrap: anywhere;
  }
  .source-file-meta {
    color: var(--muted);
    font-size: var(--type-caption);
  }
  .source-file-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .source-fields {
    padding-block: 4px 18px;
  }
  .source-category {
    margin-bottom: 10px;
    color: var(--muted);
    font-size: var(--type-small);
    line-height: 1.6;
  }
  .original-source {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-bottom: 14px;
    font-size: var(--type-small);
    line-height: 1.6;
  }
  .original-source > span {
    color: var(--muted);
  }
  .original-source a {
    overflow-wrap: anywhere;
  }
  .resource-fields {
    display: grid;
    gap: 16px;
    padding-block: 4px 18px;
  }
  .link-hint {
    margin-top: -6px;
    color: var(--muted);
    font-size: var(--type-caption);
  }
  @media (max-width: 720px) {
    .asset-references {
      margin-top: 24px;
    }
    .source-file-download {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0 12px;
      min-height: 54px;
    }
    .source-file-meta {
      grid-column: 1;
      grid-row: 2;
    }
    .source-file-action {
      grid-column: 2;
      grid-row: 1 / 3;
    }
    .asset-references :global(#design-files) {
      scroll-margin-top: 72px;
    }
  }
</style>
