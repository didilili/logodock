<script lang="ts">
  import ActionButton from './ActionButton.svelte';

  interface Props {
    id: string;
    label: string;
    value: string;
    multiline?: boolean;
    oncopy: (value: string, label: string) => void | Promise<void>;
  }

  let { id, label, value, multiline = false, oncopy }: Props = $props();
</script>

<div class="copy-field">
  <div class="copy-field-heading">
    <label for={id}>{label}</label>
    <ActionButton
      variant="text"
      size="sm"
      data-copy-target={id}
      aria-label={`复制${label}`}
      onclick={() => oncopy(value, label)}>复制</ActionButton
    >
  </div>
  {#if multiline}
    <textarea
      {id}
      {value}
      readonly
      spellcheck="false"
      rows="2"
      onclick={(event) => event.currentTarget.select()}></textarea>
  {:else}
    <input
      {id}
      {value}
      type="text"
      readonly
      spellcheck="false"
      onclick={(event) => event.currentTarget.select()}
    />
  {/if}
</div>
