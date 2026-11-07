<script lang="ts">
  import type { Brand } from '../types';
  import { identityNames, websiteDomain } from '../catalog-display.mjs';
  import { directoryAsset, assetFormat, assetWarnings, entityLabels } from '../catalog-presentation.mjs';
  import { artworkGroups } from '../catalog-artworks.mjs';
  import { assetPath } from '../resource-links.mjs';
  import Icon from './Icon.svelte';
  import ActionButton from './ActionButton.svelte';
  let { brand, basePath, href, oncopy, onsave, ready, query = '' }: {
    brand: Brand; basePath: string; href: string; ready: boolean; query?: string;
    oncopy: (brand: Brand) => void; onsave: () => void;
  } = $props();
  let asset = $derived(directoryAsset(brand, query));
  let artworks = $derived(artworkGroups(brand));
  let names = $derived(identityNames(brand));
  let formats = $derived([...new Set(brand.assets.map(assetFormat))].join(' / '));
  let warnings = $derived(assetWarnings(asset));
  let restrictions = $derived(warnings.filter(note => note === '历史素材，不代表现行标识' || note === '仅限非商业用途'));
  let notes = $derived(warnings.filter(note => !restrictions.includes(note)));
</script>
<article class="brand-card" data-brand={brand.id}>
  <a class="brand-link" {href} onclick={onsave} data-brand-link={brand.id} aria-label={`查看 ${names.primary} Logo`} data-sveltekit-reload>
    <div class="brand-art" data-background={asset.background === 'dark' ? 'dark' : 'light'} data-variant={asset.variant}><img src={`${basePath}/${assetPath(asset)}`} alt="" loading="lazy" decoding="async" width="190" height="80" /></div>
    <div class="brand-identity"><h2>{names.primary}{#if brand.entityType !== 'company'}<span class="entity-tag">{entityLabels[brand.entityType]}</span>{/if}</h2><p class="brand-english">{names.secondary || websiteDomain(brand)}</p><p class="brand-domain" aria-hidden={!names.secondary}>{names.secondary ? websiteDomain(brand) : '\u00a0'}</p></div>
  </a>
  <div class="card-meta"><span>{formats}</span><span>{artworks.length} 组素材</span></div>
  {#if restrictions.length}<p class="card-warning">{restrictions.join('；')}</p>{/if}
  {#if notes.length}
    <details class="card-notes"><summary>{notes.length === 1 ? '素材说明' : `${notes.length} 项素材说明`}</summary><ul>{#each notes as note}<li>{note}</li>{/each}</ul></details>
  {/if}
  <div class="card-actions"><a class="card-download" href={`${basePath}/${assetPath(asset)}`} download={`${brand.id}-${asset.file}`} aria-label={`下载 ${names.primary} ${assetFormat(asset)}`}><Icon name="download" /><span>下载 {assetFormat(asset)}</span></a><ActionButton variant="text" size="sm" class="card-copy" disabled={!ready} data-copy-brand={brand.id} aria-label={`复制 ${names.primary} 图片地址`} onclick={() => oncopy(brand)}><Icon name="link" /><span>复制链接</span></ActionButton></div>
</article>
