<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { Collapsible } from 'bits-ui';

  let {
    open = $bindable(false),
    class: className = '',
    triggerClass = '',
    trigger,
    children,
  }: {
    open?: boolean;
    class?: string;
    triggerClass?: string;
    trigger: Snippet;
    children: Snippet;
  } = $props();
  let interactive = $state(false);
  onMount(() => {
    interactive = true;
  });
</script>

{#if interactive}
  <Collapsible.Root bind:open class={className}>
    <Collapsible.Trigger class={triggerClass}>{@render trigger()}</Collapsible.Trigger>
    <Collapsible.Content>{@render children()}</Collapsible.Content>
  </Collapsible.Root>
{:else}
  <details bind:open class={className} data-state={open ? 'open' : 'closed'}>
    <summary class={triggerClass}>{@render trigger()}</summary>
    {@render children()}
  </details>
{/if}
