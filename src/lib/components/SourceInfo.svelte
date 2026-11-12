<script lang="ts">
  import type { sourceInformation } from '../catalog-display.mjs';
  import Icon from './Icon.svelte';

  interface Props {
    information: ReturnType<typeof sourceInformation>;
    licenseId?: string;
  }
  let { information, licenseId }: Props = $props();

  type Information = Props['information'];
  interface SourceGroup {
    key: string;
    files: string[];
    links: Information['links'];
    attributions: Information['attributions'];
    notes: Information['notes'];
  }

  const groups = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- A temporary lookup rebuilt for each derived value.
    const byFiles = new Map<string, SourceGroup>();
    const groupFor = (files: string[], allowSharedScope = false) => {
      const key = JSON.stringify([...files].sort());
      let group = byFiles.get(key);
      if (!group && allowSharedScope)
        group = [...byFiles.values()].find((entry) =>
          files.every((file) => entry.files.includes(file)),
        );
      if (!group) {
        group = { key, files, links: [], attributions: [], notes: [] };
        byFiles.set(key, group);
      }
      return group;
    };
    for (const link of information.links) groupFor(link.files).links.push(link);
    for (const attribution of information.attributions)
      groupFor(attribution.files, true).attributions.push(attribution);
    for (const note of information.notes) groupFor(note.files, true).notes.push(note);
    return [...byFiles.values()];
  });

  function external(value: string) {
    return /^https:\/\/[^\s\\]+$/i.test(value) ? value : '#';
  }
</script>

{#each groups as group (group.key)}
  <section class="source-group">
    {#if information.fileCount > 1 && group.files.length < information.fileCount}
      <h3 class="file-scope">{group.files.join('、')}</h3>
    {/if}
    {#if group.links.length}
      <ul class="source-list">
        {#each group.links as link (link.url)}
          <li>
            <a
              id={link.primaryLicense ? licenseId : undefined}
              href={external(link.url)}
              target="_blank"
              title={link.kind}
              rel="external noopener noreferrer">{link.label}<Icon name="external" size={13} /></a
            >
            {#if link.description}<small class="source-context">{link.description}</small>{/if}
            {#each link.licenses as license (license.label)}
              {#if link.licenses.length > 1 || license.files.length < link.files.length}
                <small class="source-context">{license.files.join('、')} · {license.label}</small>
              {/if}
            {/each}
          </li>
        {/each}
      </ul>
    {/if}
    {#each group.attributions as attribution (attribution.text)}
      <div class="attribution">
        <h3>署名</h3>
        {#if attribution.files.length < group.files.length}
          <p class="statement-scope">{attribution.files.join('、')}</p>
        {/if}
        <p>{attribution.text}</p>
      </div>
    {/each}
    {#each group.notes as note (note.text)}
      <div class="usage-note">
        {#if note.files.length < group.files.length}
          <p class="statement-scope">{note.files.join('、')}</p>
        {/if}
        <p>{note.text}</p>
      </div>
    {/each}
  </section>
{/each}

<style>
  .source-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    padding: 0;
    margin: 0;
    font-size: var(--type-small);
    list-style: none;
  }
  .source-list li {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .source-group + .source-group {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .attribution {
    margin-top: 10px;
  }
  h3 {
    margin-bottom: 4px;
    color: var(--ink);
    font-size: var(--type-small);
    font-weight: 600;
    line-height: 1.6;
  }
  .usage-note {
    margin-top: 8px;
  }
  .source-context {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: var(--type-caption);
  }
  p {
    color: var(--muted);
    font-size: var(--type-small);
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
  .file-scope {
    margin-bottom: 6px;
    font-weight: 500;
  }
  .statement-scope {
    margin-bottom: 3px;
    color: var(--ink);
    font-size: var(--type-caption);
  }
</style>
