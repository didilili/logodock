<script lang="ts">
  import { onMount } from 'svelte';
  import { Toaster } from 'svelte-sonner';

  let { scope = 'page' }: { scope?: 'page' | 'file-detail' } = $props();
  let mobile = $state(false);
  let dark = $state(false);

  onMount(() => {
    const viewport = matchMedia('(max-width: 720px)');
    const appearance = matchMedia('(prefers-color-scheme: dark)');
    const updateViewport = () => (mobile = viewport.matches);
    const updateTheme = () => {
      const theme = document.documentElement.dataset.theme;
      dark = theme ? theme === 'dark' : appearance.matches;
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    updateViewport();
    updateTheme();
    viewport.addEventListener('change', updateViewport);
    appearance.addEventListener('change', updateTheme);
    return () => {
      observer.disconnect();
      viewport.removeEventListener('change', updateViewport);
      appearance.removeEventListener('change', updateTheme);
    };
  });
</script>

<Toaster
  id={scope}
  class="app-toaster"
  data-toast-scope={scope}
  theme={dark ? 'dark' : 'light'}
  invert
  position={mobile ? 'bottom-center' : 'top-right'}
  offset={{ top: scope === 'file-detail' ? 76 : 84, right: 24, bottom: 24 }}
  mobileOffset={{
    top: 16,
    right: 16,
    bottom: 'calc(16px + env(safe-area-inset-bottom))',
    left: 16,
  }}
  duration={4500}
  visibleToasts={1}
  containerAriaLabel="操作提示"
  closeButtonAriaLabel="关闭提示"
  toastOptions={{ style: 'font-size: 14px; line-height: 1.55;' }}
  style="z-index: 100;"
/>
