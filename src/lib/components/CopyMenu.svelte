<script module lang="ts">
  export interface CopyMenuItem {
    id: string;
    label: string;
    hint?: string;
    disabled?: boolean;
    onselect: () => void | Promise<void>;
  }
</script>

<script lang="ts">
  import { DropdownMenu } from 'bits-ui';

  let {
    id,
    items,
    disabled = false,
    busy = false,
    label = '复制',
    ariaLabel,
    brandId,
    class: className = '',
  }: {
    id?: string;
    items: CopyMenuItem[];
    disabled?: boolean;
    busy?: boolean;
    label?: string;
    ariaLabel?: string;
    brandId?: string;
    class?: string;
  } = $props();
  let trigger = $state<HTMLButtonElement | null>(null);

  function select(item: CopyMenuItem) {
    // CopyFeedback records this focus target before opening a manual fallback.
    trigger?.focus({ preventScroll: true });
    void item.onselect();
  }

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
    bind:ref={trigger}
    disabled={disabled || items.length === 0}
    aria-busy={busy}
    aria-label={ariaLabel || label || '复制标识'}
    class={['copy-menu-trigger', className]}
  >
    {#if busy}
      <svg
        class="copy-spinner"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
        ><circle cx="12" cy="12" r="9" opacity="0.25" /><path
          d="M12 3a9 9 0 0 1 9 9"
          stroke-linecap="round"
        /></svg
      >
    {:else}<svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><rect x="8" y="8" width="12" height="13" rx="2" /><path
          d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
        /></svg
      >{/if}
    {#if label}<span>{busy ? '正在复制…' : label}</span>{/if}
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
  .copy-spinner {
    animation: copy-spin 800ms linear infinite;
  }
  @keyframes copy-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .copy-spinner {
      animation: none;
    }
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
    z-index: 60;
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
