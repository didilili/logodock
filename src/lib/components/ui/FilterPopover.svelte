<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import Icon from '../Icon.svelte';

  let {
    open = $bindable(false),
    active = false,
    disabled = false,
    children,
  }: {
    open?: boolean;
    active?: boolean;
    disabled?: boolean;
    children: Snippet;
  } = $props();
  let trigger: HTMLButtonElement | null = $state(null);
  let content: HTMLDivElement | null = $state(null);

  function preserveExternalFocus(event: Event) {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused !== document.body &&
      focused !== trigger &&
      !content?.contains(focused)
    )
      event.preventDefault();
  }
</script>

<div class="more-filters">
  <Popover.Root bind:open>
    <Popover.Trigger
      id="more-filters-trigger"
      bind:ref={trigger}
      class="more-filters-trigger"
      aria-label="更多筛选"
      {disabled}
    >
      <Icon name="filter" /><span>更多筛选</span>
      {#if active}<i aria-label="已启用筛选"></i>{/if}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        id="extra-filter-panel"
        bind:ref={content}
        class="extra-filter-panel"
        role="dialog"
        aria-label="更多筛选"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        trapFocus={false}
        preventScroll={false}
        onCloseAutoFocus={preserveExternalFocus}
      >
        {@render children()}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
</div>
