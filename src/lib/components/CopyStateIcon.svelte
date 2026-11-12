<script lang="ts">
  let { state }: { state: 'idle' | 'pending' | 'success' | 'error' } = $props();
</script>

<svg
  class="copy-feedback-icon"
  class:copy-spinner={state === 'pending'}
  class:copy-success={state === 'success'}
  class:copy-error={state === 'error'}
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if state === 'pending'}
    <circle cx="12" cy="12" r="9" opacity="0.25" /><path d="M12 3a9 9 0 0 1 9 9" />
  {:else if state === 'success'}
    <path d="m5 12 4 4L19 6" />
  {:else if state === 'error'}
    <circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" />
  {:else}
    <rect x="8" y="8" width="12" height="13" rx="2" /><path
      d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
    />
  {/if}
</svg>

<style>
  .copy-feedback-icon {
    flex-shrink: 0;
  }
  .copy-success {
    color: var(--copy-success, var(--accent));
  }
  .copy-error {
    color: var(--copy-error, var(--warning-ink));
  }
  .copy-spinner {
    animation: copy-spin 800ms linear infinite;
  }
  @keyframes copy-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .copy-spinner {
      animation: none;
    }
  }
</style>
