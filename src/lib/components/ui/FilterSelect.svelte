<script lang="ts">
  import { Select } from 'bits-ui';
  let {
    id,
    label,
    value,
    options,
    onchange,
  }: {
    id: string;
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onchange: (value: string) => void;
  } = $props();
  let chosen = $derived(
    options.find((option) => option.value === value)?.label || options[0]?.label,
  );
  // Bits UI uses an empty value for clearing. The first item is our explicit "all" choice.
  let items = $derived(options.map((option) => ({ ...option, value: option.value || '__all__' })));
</script>

<Select.Root
  type="single"
  value={value || '__all__'}
  {items}
  onValueChange={(next) => onchange(next === '__all__' ? '' : next)}
>
  <Select.Trigger
    {id}
    aria-label={label}
    class="filter-trigger inline-flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--paper)] px-[11px] py-1 text-[length:var(--type-body)] text-[var(--ink)] hover:border-[var(--line-strong)]"
  >
    {chosen}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
      ><path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.3" /></svg
    >
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      sideOffset={5}
      class="filter-options z-30 min-w-[var(--bits-select-anchor-width)] rounded-md border border-[var(--line)] bg-[var(--paper)] p-1 text-[length:var(--type-body)] text-[var(--ink)]"
    >
      <Select.Viewport>
        {#each items as option (option.value)}
          <Select.Item
            value={option.value}
            label={option.label}
            class="filter-option flex cursor-pointer items-center justify-between gap-4 rounded px-2 py-2 outline-none data-[highlighted]:bg-[var(--hover)]"
          >
            {#snippet children({ selected })}{option.label}<span aria-hidden="true"
                >{selected ? '✓' : ''}</span
              >{/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
