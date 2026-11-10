<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '#lib/components/Icon.svelte';

  let { data } = $props();
</script>

<!-- eslint-disable svelte/no-at-html-tags -- The changelog parser escapes text and checks every link before emitting this limited HTML subset. -->
<svelte:head>
  <title>更新日志 · LogoDock</title>
  <meta name="description" content="查看 LogoDock 的素材收录、下载与预览改进，以及文件引用变化。" />
</svelte:head>

<main id="main" class="changelog-page">
  <a class="back-link" href={resolve('/')}><Icon name="arrow" size={16} />返回素材库</a>
  <div class="changelog-heading">
    <h1>更新日志</h1>
    <p>记录素材收录、体验改进与引用变化。</p>
  </div>

  <div class="release-list">
    {#each data.releases as release (release.id)}
      <article class="release-entry" id={release.id} aria-labelledby={`${release.id}-title`}>
        <div class="release-meta">
          <a href={`#${release.id}`} aria-label={`查看 ${release.date} 的更新`}>
            <time datetime={release.date ?? undefined}>{release.date}</time>
          </a>
          <span>网站更新</span>
        </div>
        <div class="release-content">
          <h2 id={`${release.id}-title`}>{release.title}</h2>
          {#each release.sections as section, index (index)}
            <section class="release-section" class:release-compatibility={section.compatibility}>
              {#if section.title}<h3>{section.title}</h3>{/if}
              <div class="release-prose">{@html section.html}</div>
            </section>
          {/each}
        </div>
      </article>
    {:else}
      <p class="changelog-empty">更新记录正在整理，欢迎先浏览素材库。</p>
    {/each}
  </div>
</main>

<style>
  .changelog-page {
    width: min(960px, calc(100% - 64px));
    margin: 0 auto;
    padding: 32px 0 80px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    color: var(--muted);
    font-size: var(--type-small);
    text-decoration: none;
  }
  .back-link:hover {
    color: var(--accent);
  }
  .changelog-heading {
    padding: 24px 0 40px;
    border-bottom: 1px solid var(--line);
  }
  h1 {
    font-size: 30px;
    font-weight: 650;
    letter-spacing: -0.03em;
  }
  .changelog-heading p {
    margin-top: 10px;
    color: var(--muted);
    line-height: 1.8;
  }
  .release-entry {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr);
    gap: 32px;
    padding: 36px 0 40px;
    border-bottom: 1px solid var(--line);
    scroll-margin-top: 100px;
  }
  .release-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding-top: 2px;
  }
  .release-meta a {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
  }
  .release-meta a:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  .release-meta span {
    color: var(--muted);
    font-size: var(--type-caption);
  }
  .release-content {
    min-width: 0;
  }
  h2 {
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.5;
  }
  .release-section {
    margin-top: 24px;
  }
  h3 {
    display: inline-block;
    margin: 0 0 10px;
    padding: 3px 8px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--surface);
    font-size: var(--type-caption);
    font-weight: 500;
  }
  .release-prose {
    line-height: 1.9;
    overflow-wrap: anywhere;
  }
  .release-prose :global(p + p),
  .release-prose :global(p + ul),
  .release-prose :global(ul + p) {
    margin-top: 12px;
  }
  .release-prose :global(ul) {
    margin: 0;
    padding-left: 19px;
  }
  .release-prose :global(li + li) {
    margin-top: 8px;
  }
  .release-prose :global(li::marker) {
    color: var(--muted);
  }
  .release-prose :global(a) {
    color: var(--accent);
  }
  .release-prose :global(code) {
    padding: 2px 4px;
    border-radius: 3px;
    background: var(--surface);
    font-size: var(--type-small);
  }
  .release-compatibility {
    padding: 16px;
    border-left: 2px solid var(--warning-ink);
    border-radius: 0 var(--control-radius) var(--control-radius) 0;
    background: var(--warning-paper);
  }
  .release-compatibility h3 {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--warning-ink);
  }
  .release-prose :global(.changelog-file-changes) {
    margin-top: 16px;
    border: 1px solid var(--line);
    border-radius: var(--control-radius);
    background: var(--paper);
  }
  .release-prose :global(summary) {
    padding: 12px 14px;
    font-size: var(--type-small);
  }
  .release-prose :global(.changelog-table-scroll) {
    overflow-x: auto;
    padding: 0 12px 12px;
  }
  .release-prose :global(table) {
    width: 100%;
    margin-top: 16px;
    border-collapse: collapse;
    font-size: var(--type-small);
    text-align: left;
  }
  .release-prose :global(th),
  .release-prose :global(td) {
    padding: 10px 8px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  .changelog-empty {
    padding-top: 32px;
    color: var(--muted);
  }
  @media (max-width: 720px) {
    .changelog-page {
      width: calc(100% - 36px);
      padding: 16px 0 48px;
    }
    .changelog-heading {
      padding: 20px 0 28px;
    }
    h1 {
      font-size: 26px;
    }
    .release-entry {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      padding: 24px 0 32px;
      scroll-margin-top: 80px;
    }
    .release-meta {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 0;
    }
    .release-meta a {
      min-height: 40px;
    }
    h2 {
      font-size: 19px;
    }
    .release-section {
      margin-top: 20px;
    }
  }
</style>
