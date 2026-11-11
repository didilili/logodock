<script lang="ts">
  let { name, size = 18 }: { name: string; size?: number } = $props();
  const paths: Record<string, string[]> = {
    search: ['m16 16 4 4'],
    menu: ['M4 6h16M4 12h16M4 18h16'],
    filter: ['M4 6h16M7 12h10M10 18h4'],
    'chevron-right': ['m9 6 6 6-6 6'],
    copy: ['M8 8h12v13H8zM15 8V3H3v13h5'],
    code: ['m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18'],
    download: ['M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4'],
    link: [
      'm10 13 4-4m-5 7-1.5 1.5a4 4 0 0 1-5.7-5.7L7 7.6a4 4 0 0 1 5.7 0m-.7 8.8a4 4 0 0 0 5.7 0l4.2-4.2a4 4 0 0 0-5.7-5.7L15 8',
    ],
    arrow: ['M19 12H5m6-6-6 6 6 6'],
    external: ['M13 5h6v6m0-6-9 9M9 5H5v14h14v-4'],
    theme: ['M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'],
  };
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'search'}<circle cx="11" cy="11" r="7" />{/if}
  {#if name === 'theme'}<circle cx="12" cy="12" r="4" />{/if}
  {#each paths[name] || [] as d, index (index)}<path {d} />{/each}
</svg>
