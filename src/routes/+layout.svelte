<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import BrandLogo from '#lib/components/BrandLogo.svelte';
  import favicon from '#lib/assets/favicon.svg?url';
  import '../app.css';
  let { children } = $props();
  let dark = $state(false);
  let ready = $state(false);
  let mobileNavigation: HTMLDetailsElement | undefined = $state();
  const isChangelog = $derived(page.route.id === '/changelog');

  function closeNavigation() {
    if (mobileNavigation) mobileNavigation.open = false;
  }

  function closeOnOutsidePointer(event: PointerEvent) {
    if (event.target instanceof Node && !mobileNavigation?.contains(event.target))
      closeNavigation();
  }

  function handleNavigationKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && mobileNavigation?.open) {
      closeNavigation();
      mobileNavigation?.querySelector('summary')?.focus();
    }
  }
  function applyTheme(theme?: string | null) {
    const value = theme === 'light' || theme === 'dark' ? theme : undefined;
    if (value) document.documentElement.dataset.theme = value;
    dark = value ? value === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  onMount(() => {
    ready = true;
    try {
      applyTheme(localStorage.getItem('logodock:theme'));
    } catch {
      applyTheme();
    }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => {
      if (!document.documentElement.dataset.theme) applyTheme();
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  });
  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('logodock:theme', next);
    } catch {
      /* Preference remains active for this page. */
    }
  }
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main">跳到内容</a>
<svelte:window onpointerdown={closeOnOutsidePointer} onkeydown={handleNavigationKey} />
<header class="site-header">
  <div class="site-header-inner">
    <BrandLogo />
    <div class="site-header-main">
      <span class="wordmark-description">品牌 Logo 库</span>
      <nav aria-label="主导航">
        <a
          class="desktop-nav-link"
          href={resolve('changelog/')}
          aria-current={isChangelog ? 'page' : undefined}>更新日志</a
        >
        <a
          class="desktop-nav-link"
          href="https://github.com/didilili/logodock/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer">建议收录<Icon name="external" /></a
        >
        <a
          class="desktop-nav-link"
          href="https://github.com/didilili/logodock"
          target="_blank"
          rel="noopener noreferrer">GitHub<Icon name="external" /></a
        >
        <details class="mobile-navigation" bind:this={mobileNavigation}>
          <summary class="icon-button"
            ><Icon name="menu" /><span class="sr-only">打开导航</span></summary
          >
          <div class="mobile-nav-panel">
            <a
              href={resolve('changelog/')}
              aria-current={isChangelog ? 'page' : undefined}
              onclick={closeNavigation}>更新日志</a
            >
            <a
              href="https://github.com/didilili/logodock/issues/new/choose"
              target="_blank"
              rel="noopener noreferrer"
              onclick={closeNavigation}>建议收录<Icon name="external" /></a
            >
            <a
              href="https://github.com/didilili/logodock"
              target="_blank"
              rel="noopener noreferrer"
              onclick={closeNavigation}>GitHub<Icon name="external" /></a
            >
          </div>
        </details>
        <ActionButton
          id="theme-toggle"
          variant="icon"
          disabled={!ready}
          onclick={toggleTheme}
          aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
          title={dark ? '切换到浅色主题' : '切换到深色主题'}><Icon name="theme" /></ActionButton
        >
      </nav>
    </div>
  </div>
</header>
{@render children()}
