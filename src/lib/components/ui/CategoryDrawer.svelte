<script lang="ts">
  import { Dialog } from 'bits-ui';
  import Icon from '../Icon.svelte';

  let {
    open = $bindable(false),
    categories,
    selected,
    disabled = false,
    onselect,
    onOpenChange,
  }: {
    open?: boolean;
    categories: { id: string; label: string; count: number }[];
    selected: string;
    disabled?: boolean;
    onselect: (id: string) => void;
    onOpenChange?: (open: boolean) => void;
  } = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Trigger
    type="button"
    class="button button-secondary mobile-category-trigger"
    aria-label="打开品牌分类"
    {disabled}
  >
    <Icon name="menu" />分类
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="category-overlay" />
    <Dialog.Content class="category-drawer" aria-describedby={undefined} trapFocus preventScroll>
      <div class="drawer-heading">
        <Dialog.Title class="drawer-title" level={2}>资源分类</Dialog.Title>
        <Dialog.Close type="button" class="icon-button" aria-label="关闭分类">×</Dialog.Close>
      </div>
      <nav class="category-list" aria-label="品牌分类">
        {#each categories as category (category.id)}
          <button
            type="button"
            data-category={category.id}
            aria-pressed={selected === category.id}
            {disabled}
            onclick={() => onselect(category.id)}
          >
            <span>{category.label}</span><small>{category.count}</small>
          </button>
        {/each}
      </nav>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
