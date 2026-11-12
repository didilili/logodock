<script module lang="ts">
  import type { CopyResult } from './CopyFeedback.svelte';

  export interface CopyMenuItem {
    id: string;
    label: string;
    hint?: string;
    disabled?: boolean;
    onselect: () => CopyResult | void | Promise<CopyResult | void>;
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import CopyStateIcon from './CopyStateIcon.svelte';
  import { DropdownMenu } from 'bits-ui';
  import Icon from './Icon.svelte';

  let {
    id,
    items,
    disabled = false,
    busyLabel = '复制中',
    label = '复制',
    ariaLabel,
    brandId,
    getRevision,
    class: className = '',
  }: {
    id?: string;
    items: CopyMenuItem[];
    disabled?: boolean;
    busyLabel?: string;
    label?: string;
    ariaLabel?: string;
    brandId?: string;
    getRevision?: () => number | undefined;
    class?: string;
  } = $props();
  let trigger = $state<HTMLButtonElement | null>(null);
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
  const displayedLabel = $derived(
    { idle: label, pending: busyLabel, success: '已复制', error: '失败' }[copyState],
  );

  async function select(item: CopyMenuItem) {
    const current = ++request;
    clearTimeout(timer);
    outcome = undefined;
    startedRevision = undefined;
    phase = 'pending';
    // CopyFeedback records this focus target before opening a manual fallback.
    trigger?.focus({ preventScroll: true });
    try {
      const operation = item.onselect();
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

  function preserveExternalFocus(event: Event) {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active !== trigger &&
      !active.closest('[data-copy-menu-content]')
    )
      event.preventDefault();
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    {id}
    data-copy-brand={brandId}
    data-copy-state={copyState}
    bind:ref={trigger}
    disabled={disabled || items.length === 0}
    aria-busy={copyState === 'pending'}
    aria-label={ariaLabel || label || '复制标识'}
    class={['copy-menu-trigger', className]}
    title={copyState === 'success'
      ? '已复制'
      : copyState === 'error'
        ? '复制失败，请重试'
        : undefined}
  >
    <CopyStateIcon state={copyState} />
    {#if label}
      <span class="copy-menu-label">{displayedLabel}</span>
      <span class="copy-menu-chevron"><Icon name="chevron-down" size={12} /></span>
    {/if}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      class="copy-menu-content"
      data-copy-menu-content=""
      align="end"
      sideOffset={6}
      onCloseAutoFocus={preserveExternalFocus}
    >
      {#each items as item (item.id)}
        <DropdownMenu.Item
          class="copy-menu-item"
          data-copy-kind={item.id}
          disabled={item.disabled}
          textValue={item.label}
          onSelect={() => select(item)}
        >
          <span>{item.label}</span>
          {#if item.hint}<small>{item.hint}</small>{/if}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
  .copy-menu-chevron {
    flex-shrink: 0;
  }
  .copy-menu-label {
    min-width: 3em;
    text-align: center;
  }
  .copy-menu-chevron {
    display: inline-flex;
  }
  :global(.copy-menu-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--paper);
    color: var(--muted);
    font: inherit;
    font-size: var(--type-small);
    white-space: nowrap;
    cursor: pointer;
  }
  :global(.copy-menu-trigger:hover:not(:disabled)),
  :global(.copy-menu-trigger[data-state='open']) {
    border-color: var(--line-strong);
    background: var(--hover);
    color: var(--ink);
  }
  :global(.copy-menu-trigger:disabled) {
    cursor: default;
  }
  :global(.copy-menu-content) {
    z-index: 90;
    width: 228px;
    max-width: calc(100vw - 24px);
    max-height: var(--bits-dropdown-menu-content-available-height, calc(100vh - 24px));
    overflow-y: auto;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    color: var(--ink);
    box-shadow:
      0 8px 32px #17223524,
      0 2px 5px #1722350a;
    outline: none;
  }
  :global(.copy-menu-content .copy-menu-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 40px;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: var(--type-small);
    line-height: 1.5;
    cursor: pointer;
    outline: none;
    user-select: none;
  }
  :global(.copy-menu-content .copy-menu-item[data-highlighted]) {
    background: var(--hover);
    color: var(--focus);
  }
  :global(.copy-menu-content .copy-menu-item[data-disabled]) {
    cursor: default;
    opacity: 0.55;
  }
  :global(.copy-menu-content .copy-menu-item small) {
    color: var(--muted);
    font-size: var(--type-caption);
    text-align: right;
    overflow-wrap: anywhere;
  }
  :global(.copy-menu-content .copy-menu-item > span) {
    flex-shrink: 0;
  }
  @media (max-width: 720px) {
    :global(.copy-menu-content .copy-menu-item) {
      min-height: 44px;
    }
  }
</style>
