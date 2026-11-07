<script module lang="ts">
  export interface CopyFeedbackApi {
    reset(): number;
    isCurrent(token: number): boolean;
    show(message: string, manualValue?: string): Promise<void>;
    copy(value: string, label: string): Promise<void>;
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import ActionButton from './ActionButton.svelte';
  import { copyText } from '../resource-links.mjs';

  let visible = $state(false);
  let message = $state('');
  let manualValue = $state<string | undefined>();
  let manualAddress: HTMLTextAreaElement | undefined;
  let previousFocus: HTMLElement | null = null;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  export function reset() {
    revision += 1;
    clearTimeout(timer);
    visible = false;
    message = '';
    manualValue = undefined;
    return revision;
  }

  export function isCurrent(token: number) {
    return token === revision;
  }

  export async function show(value: string, manual?: string) {
    clearTimeout(timer);
    const token = revision;
    message = value;
    manualValue = manual;
    visible = true;
    if (manual !== undefined) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await tick();
      if (!isCurrent(token)) return;
      manualAddress?.focus();
      manualAddress?.select();
    } else {
      timer = setTimeout(() => {
        if (isCurrent(token)) visible = false;
      }, 3500);
    }
  }

  export async function copy(value: string, label: string) {
    if (!value) return;
    const token = reset();
    const copied = await copyText(value, navigator.clipboard);
    if (!isCurrent(token)) return;
    await show(copied ? `已复制${label}。` : '无法自动复制，已选中内容，请手动复制。', copied ? undefined : value);
  }

  function dismiss() {
    const restoreFocus = manualValue !== undefined && previousFocus?.isConnected;
    reset();
    if (restoreFocus) previousFocus?.focus({ preventScroll: true });
  }

  onDestroy(reset);
</script>

<div class="copy-feedback" id="copy-feedback" hidden={!visible}>
  <p id="action-status" role="status" aria-live="polite">{message}</p>
  <div id="manual-copy" hidden={manualValue === undefined}>
    <label for="manual-address">手动复制</label>
    <textarea id="manual-address" bind:this={manualAddress} value={manualValue ?? ''} readonly rows="2" spellcheck="false" onclick={(event) => event.currentTarget.select()}></textarea>
  </div>
  <ActionButton variant="icon" size="sm" id="dismiss-feedback" aria-label="关闭复制提示" onclick={dismiss}>×</ActionButton>
</div>
