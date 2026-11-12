<script lang="ts">
  import { Popover, Tooltip } from 'bits-ui';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Icon from '#lib/components/Icon.svelte';
  import ActionButton from '#lib/components/ActionButton.svelte';
  import BrandLogo from '#lib/components/BrandLogo.svelte';
  import AppToaster from '#lib/components/AppToaster.svelte';
  import favicon from '#lib/assets/favicon.svg?url';
  import '../app.css';
  let { children } = $props();
  let dark = $state(false);
  let ready = $state(false);
  let mobileNavigationOpen = $state(false);
  let navigationTrigger: HTMLButtonElement | null = $state(null);
  let navigationContent: HTMLDivElement | null = $state(null);
  const isChangelog = $derived(page.route.id === '/changelog');
  const themeLabel = $derived(dark ? '切换到浅色主题' : '切换到深色主题');

  function closeNavigation() {
    mobileNavigationOpen = false;
  }

  function closeNavigationOnFocusOutside(event: FocusEvent) {
    const target = event.target;
    if (
      target instanceof Node &&
      !navigationTrigger?.contains(target) &&
      !navigationContent?.contains(target)
    )
      closeNavigation();
  }

  function preserveNavigationFocus(event: Event) {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused !== document.body &&
      focused !== navigationTrigger &&
      !navigationContent?.contains(focused)
    )
      event.preventDefault();
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
    const mobileViewport = matchMedia('(max-width: 720px)');
    const closeDesktopNavigation = () => {
      if (!mobileViewport.matches) closeNavigation();
    };
    media.addEventListener('change', changed);
    mobileViewport.addEventListener('change', closeDesktopNavigation);
    return () => {
      media.removeEventListener('change', changed);
      mobileViewport.removeEventListener('change', closeDesktopNavigation);
    };
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

{#snippet mobileNavigationLinks()}
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
{/snippet}

<a class="skip-link" href="#main">跳到内容</a>
<Tooltip.Provider>
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
          <div class="mobile-navigation">
            {#if ready}
              <Popover.Root bind:open={mobileNavigationOpen}>
                <Popover.Trigger bind:ref={navigationTrigger} aria-label="打开导航">
                  {#snippet child({ props })}
                    <ActionButton {...props} class="mobile-navigation-trigger" variant="icon"
                      ><Icon name="menu" /></ActionButton
                    >
                  {/snippet}
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    bind:ref={navigationContent}
                    class="mobile-nav-panel"
                    aria-label="主导航"
                    align="end"
                    sideOffset={10}
                    collisionPadding={12}
                    trapFocus={false}
                    preventScroll={false}
                    onFocusOutside={closeNavigationOnFocusOutside}
                    onCloseAutoFocus={preserveNavigationFocus}
                  >
                    {@render mobileNavigationLinks()}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            {:else}
              <details class="mobile-navigation-fallback">
                <summary class="icon-button mobile-navigation-trigger" aria-label="打开导航">
                  <Icon name="menu" />
                </summary>
                <div class="mobile-nav-panel">{@render mobileNavigationLinks()}</div>
              </details>
            {/if}
          </div>
          <Tooltip.Root>
            <Tooltip.Trigger
              id="theme-toggle"
              disabled={!ready}
              onclick={toggleTheme}
              aria-label={themeLabel}
            >
              {#snippet child({ props })}
                <ActionButton {...props} variant="icon"><Icon name="theme" /></ActionButton>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                class="utility-tooltip"
                role="tooltip"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}>{themeLabel}</Tooltip.Content
              >
            </Tooltip.Portal>
          </Tooltip.Root>
        </nav>
      </div>
    </div>
  </header>
  {@render children()}
  <AppToaster />
</Tooltip.Provider>
