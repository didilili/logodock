<script lang="ts">
  import type { sourceInformation } from '../catalog-display.mjs';
  import Icon from './Icon.svelte';

  interface Props {
    information: ReturnType<typeof sourceInformation>;
    licenseId?: string;
  }
  let { information, licenseId }: Props = $props();

  function external(value: string) {
    return /^https:\/\/[^\s\\]+$/i.test(value) ? value : '#';
  }
</script>

<dl class="source-list">
  {#each information.links as link (link.url)}
    <dt>{link.kind}</dt>
    <dd>
      <a
        id={link.primaryLicense ? licenseId : undefined}
        href={external(link.url)}
        target="_blank"
        rel="external noopener noreferrer">{link.label}<Icon name="external" size={13} /></a
      >
      {#if link.description}<small class="source-context">{link.description}</small>{/if}
      {#if link.files.length < information.fileCount}
        <small class="source-context">{link.files.join('、')}</small>
      {/if}
      {#each link.licenses as license (license.label)}
        {#if link.licenses.length > 1 || license.files.length < link.files.length}
          <small class="source-context">{license.files.join('、')} · {license.label}</small>
        {/if}
      {/each}
    </dd>
  {/each}
</dl>
{#each information.attributions as attribution (attribution.text)}
  <div class="attribution">
    <h2>署名</h2>
    {#if attribution.files.length < information.fileCount}
      <p class="file-scope">{attribution.files.join('、')}</p>
    {/if}
    <p>{attribution.text}</p>
  </div>
{/each}
{#each information.notes as note (note.text)}
  <div class="usage-note">
    {#if note.files.length < information.fileCount}
      <p class="file-scope">{note.files.join('、')}</p>
    {/if}
    <p>{note.text}</p>
  </div>
{/each}

<style>
  .source-list {
    display: grid;
    grid-template-columns: 62px minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    font-size: 13px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .attribution {
    margin-top: 18px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 5px;
  }
  h2 {
    margin-bottom: 5px;
    font-size: 13px;
    font-weight: 600;
  }
  .usage-note {
    margin-top: 14px;
  }
  .source-context {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 12px;
  }
  p {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  .file-scope {
    margin-bottom: 3px;
    color: var(--ink);
  }
</style>
