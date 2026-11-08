<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import BrandLogo from '#lib/components/BrandLogo.svelte';
  import favicon from '#lib/assets/favicon.svg?url';
  import '../app.css';
  let { children } = $props();
  let dark = $state(false);
  let ready = $state(false);
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
<header class="site-header shell">
  <BrandLogo />
  <nav aria-label="主导航">
    <a
      href="https://github.com/didilili/logodock/issues/new/choose"
      target="_blank"
      rel="noopener noreferrer">建议收录<Icon name="external" /></a
    >
    <a href="https://github.com/didilili/logodock" target="_blank" rel="noopener noreferrer"
      >GitHub<Icon name="external" /></a
    >
    <ActionButton
      id="theme-toggle"
      variant="icon"
      disabled={!ready}
      onclick={toggleTheme}
      aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
      title={dark ? '切换到浅色主题' : '切换到深色主题'}><Icon name="theme" /></ActionButton
    >
  </nav>
</header>
{@render children()}
