<script lang="ts">
  import { onDestroy } from 'svelte';
  import CopyStateIcon from './CopyStateIcon.svelte';
  import type { CopyResult } from './CopyFeedback.svelte';
  import ActionButton from './ActionButton.svelte';

  interface Props {
    id: string;
    label: string;
    value: string;
    multiline?: boolean;
    getRevision?: () => number | undefined;
    oncopy: (value: string, label: string) => CopyResult | void | Promise<CopyResult | void>;
  }

  let { id, label, value, multiline = false, getRevision, oncopy }: Props = $props();
  let phase = $state<'idle' | 'pending' | 'success' | 'error'>('idle');
  let outcome = $state<CopyResult>();
  let startedRevision = $state<number>();
  let request = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const copyState = $derived(
    (startedRevision !== undefined && getRevision?.() !== startedRevision) ||
      (outcome && !outcome.isCurrent())
      ? 'idle'
      : phase,
  );
  const buttonLabel = $derived(
    { idle: '复制', pending: '复制中', success: '已复制', error: '失败' }[copyState],
  );

  async function copy() {
    const current = ++request;
    clearTimeout(timer);
    outcome = undefined;
    startedRevision = undefined;
    phase = 'pending';
    try {
      const operation = oncopy(value, label);
      startedRevision = getRevision?.();
      const result = await operation;
      if (!active || current !== request) return;
      outcome = result || undefined;
      if (!result || result.status === 'stale' || !result.isCurrent()) {
        phase = 'idle';
        return;
      }
      phase = result.status === 'copied' ? 'success' : 'error';
    } catch {
      if (!active || current !== request) return;
      if (startedRevision !== undefined && getRevision?.() !== startedRevision) {
        phase = 'idle';
        startedRevision = undefined;
        return;
      }
      phase = 'error';
    }
    timer = setTimeout(() => {
      if (current !== request) return;
      phase = 'idle';
      outcome = undefined;
      startedRevision = undefined;
    }, 2000);
  }

  onDestroy(() => {
    active = false;
    request += 1;
    clearTimeout(timer);
  });
</script>

<div class="copy-field">
  <div class="copy-field-heading">
    <label for={id}>{label}</label>
    <ActionButton
      variant="text"
      size="sm"
      class="copy-field-button"
      data-copy-target={id}
      data-copy-state={copyState}
      aria-busy={copyState === 'pending'}
      aria-label={`复制${label}`}
      title={copyState === 'success'
        ? '已复制'
        : copyState === 'error'
          ? '复制失败，请重试'
          : undefined}
      onclick={copy}
    >
      <CopyStateIcon state={copyState} />
      <span class="copy-field-button-label">{buttonLabel}</span>
    </ActionButton>
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

<style>
  .copy-field-button-label {
    min-width: 3em;
    text-align: center;
  }
</style>
