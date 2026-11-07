<script lang="ts">
  import { resolve } from '$app/paths';
  const base = resolve('/').replace(/\/$/, '');
  import BrandDetail from '#lib/components/BrandDetail.svelte';
  import { identityNames } from '#lib/catalog-display.mjs';
  let { data } = $props();
  let names = $derived(identityNames(data.brand));
</script>
<svelte:head>
  <title>{names.primary}{names.secondary ? `（${names.secondary}）` : ''} Logo 下载 · LogoDock</title>
  <meta name="description" content={`查看${names.primary}${names.secondary ? ` ${names.secondary}` : ''}的 ${data.brand.assets.length} 份 Logo 素材、原始格式、来源与许可，并下载原图。`} />
</svelte:head>
{#key data.brand.id}
  <BrandDetail brand={data.brand} parent={data.parent} sourceCommit={data.sourceCommit} basePath={base} />
{/key}
