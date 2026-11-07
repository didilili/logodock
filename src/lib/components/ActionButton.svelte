<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'text' | 'icon';
    size?: 'sm' | 'md';
  };
  let {
    children,
    variant = 'secondary',
    size = 'md',
    type = 'button',
    class: className = '',
    ...rest
  }: Props = $props();
  const variants = {
    primary: 'button button-primary',
    secondary: 'button button-secondary',
    text: 'text-button',
    icon: 'icon-button',
  };
</script>

<button {...rest} {type} class={[variants[variant], 'ui-button', `ui-button--${size}`, className]}>
  {@render children?.()}
</button>
