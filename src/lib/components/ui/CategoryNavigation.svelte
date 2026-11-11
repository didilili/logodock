<script lang="ts">
  import { untrack } from 'svelte';
  import { categoryDefinitions, filterCategoryOptions } from '../../catalog-taxonomy.mjs';
  import type { CategoryOption } from '../../types';
  import Icon from '../Icon.svelte';

  let {
    categories,
    topics,
    selected = '',
    selectedTopic = '',
    query = $bindable(''),
    disabled = false,
    onselect,
    ontopic,
  }: {
    categories: CategoryOption[];
    topics: CategoryOption[];
    selected?: string;
    selectedTopic?: string;
    query?: string;
    disabled?: boolean;
    onselect: (id: string) => void;
    ontopic: (id: string) => void;
  } = $props();

  let expanded = $state<string[]>([]);
  const visible = $derived(filterCategoryOptions(categories, query));

  $effect(() => {
    const definition = categoryDefinitions.get(selected);
    const parent = definition?.parent || selected;
    untrack(() => {
      if (parent && !expanded.includes(parent)) expanded = [...expanded, parent];
    });
  });

  function toggle(id: string) {
    expanded = expanded.includes(id) ? expanded.filter((value) => value !== id) : [...expanded, id];
  }
</script>

{#snippet choice(category: CategoryOption, child = false)}
  <button
    type="button"
    class:category-child={child}
    data-category={category.id}
    aria-pressed={selected === category.id}
    disabled={disabled || (category.count === 0 && selected !== category.id)}
    onclick={() => onselect(category.id)}
  >
    <span>{category.label}</span><small>{category.count}</small>
  </button>
{/snippet}

<div class="category-navigation">
  <div class="category-navigation-heading">
    <p class="nav-caption">行业分类</p>
    {#if expanded.length}
      <button type="button" class="collapse-categories" onclick={() => (expanded = [])}>折叠</button
      >
    {/if}
  </div>
  <label class="category-search-label">
    <span class="sr-only">查找行业分类</span>
    <input
      class="category-search"
      type="search"
      placeholder="查找分类，如芯片、SaaS"
      bind:value={query}
      {disabled}
    />
  </label>
  <nav class="category-list category-tree" aria-label="品牌分类">
    {#each visible as category (category.id)}
      {#if category.children?.length}
        {@const open = Boolean(query.trim()) || expanded.includes(category.id)}
        <div class="category-branch">
          <div class="category-parent">
            {@render choice(category)}
            <button
              type="button"
              class="category-expand"
              data-expand={category.id}
              aria-label={`${open ? '收起' : '展开'}${category.label}`}
              aria-expanded={open}
              {disabled}
              onclick={() => toggle(category.id)}><Icon name="chevron-right" size={14} /></button
            >
          </div>
          <div class="category-children" hidden={!open}>
            {#each category.children as child (child.id)}
              {@render choice(child, true)}
            {/each}
          </div>
        </div>
      {:else}
        {@render choice(category)}
      {/if}
    {/each}
  </nav>
  {#if query.trim() && visible.length === 1}
    <p class="category-search-empty">没有匹配的行业分类</p>
  {/if}
  {#if topics.length}
    <nav class="category-list category-topics" aria-label="跨行业专题">
      <p class="nav-caption">跨行业专题</p>
      {#each topics as topic (topic.id)}
        <button
          type="button"
          data-topic={topic.id}
          aria-pressed={selectedTopic === topic.id}
          disabled={disabled || (topic.count === 0 && selectedTopic !== topic.id)}
          onclick={() => ontopic(selectedTopic === topic.id ? '' : topic.id)}
          ><span><span class="topic-prefix" aria-hidden="true">#</span>{topic.label}</span><small
            >{topic.count}</small
          ></button
        >
      {/each}
    </nav>
  {/if}
</div>
