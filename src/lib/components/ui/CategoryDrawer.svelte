<script lang="ts">
  import { Dialog } from 'bits-ui';
  import Icon from '../Icon.svelte';
  import CategoryNavigation from './CategoryNavigation.svelte';
  import type { CategoryOption } from '../../types';

  let {
    open = $bindable(false),
    categories,
    topics,
    selected,
    selectedTopic,
    query = $bindable(''),
    disabled = false,
    onselect,
    ontopic,
    onOpenChange,
  }: {
    open?: boolean;
    categories: CategoryOption[];
    topics: CategoryOption[];
    selected: string;
    selectedTopic: string;
    query?: string;
    disabled?: boolean;
    onselect: (id: string) => void;
    ontopic: (id: string) => void;
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
      <CategoryNavigation
        {categories}
        {topics}
        {selected}
        {selectedTopic}
        bind:query
        {disabled}
        {onselect}
        {ontopic}
      />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
