<script module lang="ts">
  export interface CopySourceOptions {
    url: string;
    downloadName: string;
    label?: string;
  }

  export interface CopyImageOptions extends CopySourceOptions {
    format: string;
  }

  export interface CopyResult {
    status: 'copied' | 'failed' | 'stale';
    isCurrent: () => boolean;
  }

  export type NotificationKind = 'success' | 'error' | 'info';

  export interface CopyFeedbackApi {
    reset(): number;
    currentRevision(): number;
    isCurrent(token: number): boolean;
    pending(url: string): boolean;
    show(message: string, kind?: NotificationKind): Promise<void>;
    copy(value: string, label: string): Promise<CopyResult>;
    copyImage(options: CopyImageOptions): Promise<CopyResult>;
    copySvg(options: CopySourceOptions): Promise<CopyResult>;
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { Dialog } from 'bits-ui';
  import { toast } from 'svelte-sonner';
  import ActionButton from './ActionButton.svelte';
  import { copyDeferredText, copyText } from '../resource-links.mjs';
  import { canCopyPngImage, copyPngImage } from '../clipboard-image.mjs';
  import { renderRasterPng, renderSvgPng } from '../svg-export';

  type RecoveryAction =
    { kind: 'image'; options: CopyImageOptions } | { kind: 'svg'; options: CopySourceOptions };

  let message = $state('');
  let manualValue = $state<string | undefined>();
  let recoveryAction = $state<RecoveryAction>();
  let pendingOperation = $state<{ url: string; token: number }>();
  let recoveryOpen = $state(false);
  let recoveryElement = $state<HTMLDivElement | null>(null);
  let manualAddress: HTMLTextAreaElement | undefined;
  let previousFocus: HTMLElement | null = null;
  let recoveryReturnFocus: HTMLElement | null = null;
  let revision = $state(0);
  const notificationId = 'logodock-copy-feedback';

  export function reset() {
    revision += 1;
    toast.dismiss(notificationId);
    message = '';
    manualValue = undefined;
    recoveryAction = undefined;
    pendingOperation = undefined;
    recoveryOpen = false;
    previousFocus = null;
    recoveryReturnFocus = null;
    return revision;
  }

  export function isCurrent(token: number) {
    return token === revision;
  }

  export function currentRevision() {
    return revision;
  }

  export function pending(url: string) {
    return (
      pendingOperation?.token === revision &&
      pendingOperation.url === new URL(url, location.href).href
    );
  }

  function begin(url?: string) {
    const active = document.activeElement;
    const fromRecovery = active instanceof HTMLElement && recoveryElement?.contains(active);
    const focus = active instanceof HTMLElement && !fromRecovery ? active : previousFocus;
    const token = reset();
    previousFocus = focus;
    if (fromRecovery) recoveryReturnFocus = focus;
    if (url) pendingOperation = { url: new URL(url, location.href).href, token };
    return token;
  }

  function copyResult(status: CopyResult['status'], token: number): CopyResult {
    return { status, isCurrent: () => isCurrent(token) };
  }

  function notify(value: string, kind: NotificationKind | 'loading') {
    const options = {
      id: notificationId,
      toasterId: document.querySelector('.preview-dialog') ? 'file-detail' : 'page',
      duration: kind === 'loading' ? Infinity : 4500,
    };
    toast[kind](value, options);
  }

  async function present(value: string, manual?: string, recovery?: RecoveryAction) {
    const token = revision;
    const interactive = manual !== undefined || recovery !== undefined;
    if (!interactive) {
      if (recoveryOpen) recoveryReturnFocus = previousFocus;
      recoveryOpen = false;
      pendingOperation = undefined;
      notify(value, 'success');
      return;
    }
    toast.dismiss(notificationId);
    if (!previousFocus)
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    message = value;
    manualValue = manual;
    recoveryAction = recovery;
    pendingOperation = undefined;
    recoveryOpen = true;
    if (manual !== undefined) {
      await tick();
      if (!isCurrent(token)) return;
      manualAddress?.focus();
      manualAddress?.select();
    }
  }

  export async function show(value: string, kind: NotificationKind = 'info') {
    notify(value, kind);
  }

  export async function copy(value: string, label: string): Promise<CopyResult> {
    if (!value) return copyResult('failed', revision);
    const token = begin();
    const copied = await copyText(value, navigator.clipboard);
    if (!isCurrent(token)) return copyResult('stale', token);
    await present(
      copied ? `已复制${label}。` : '无法自动复制，已选中内容，请手动复制。',
      copied ? undefined : value,
    );
    return copyResult(copied ? 'copied' : 'failed', token);
  }

  export async function copyImage(options: CopyImageOptions): Promise<CopyResult> {
    const token = begin(options.url);
    const current = () => isCurrent(token);
    const recovery: RecoveryAction = { kind: 'image', options: { ...options } };
    if (!canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem)) {
      await present('当前浏览器暂不支持复制图片，可下载原图或复制图片地址。', undefined, recovery);
      return copyResult('failed', token);
    }
    notify('正在复制图片…', 'loading');
    const format = options.format.toUpperCase();
    let dimensions: { width: number; height: number } | undefined;
    const loadPng =
      format === 'PNG'
        ? undefined
        : async () => {
            const result =
              format === 'SVG'
                ? await renderSvgPng(options.url, 2048, current)
                : await renderRasterPng(options.url, current);
            if (!result) throw new Error('Stale image selection');
            dimensions = { width: result.width, height: result.height };
            return result.blob;
          };
    const result = await copyPngImage({
      url: options.url,
      clipboard: navigator.clipboard,
      ClipboardItemType: globalThis.ClipboardItem,
      isCurrent: current,
      loadPng,
    });
    if (!current() || result === 'stale') return { status: 'stale', isCurrent: current };
    if (result !== 'copied') {
      await present('无法复制图片，请重试。', undefined, recovery);
      return { status: 'failed', isCurrent: current };
    }
    const label = options.label ? `${options.label} ` : '';
    await present(
      dimensions
        ? `已复制${label}PNG 图片（${dimensions.width} × ${dimensions.height} px，由 ${format} 生成）。`
        : `已复制${label}原始 PNG 图片。`,
    );
    return { status: 'copied', isCurrent: current };
  }

  export async function copySvg(options: CopySourceOptions): Promise<CopyResult> {
    const token = begin(options.url);
    const current = () => isCurrent(token);
    const recovery: RecoveryAction = { kind: 'svg', options: { ...options } };
    notify('正在复制 SVG 源码…', 'loading');
    try {
      const result = await copyDeferredText({
        clipboard: navigator.clipboard,
        ClipboardItemType: globalThis.ClipboardItem,
        isCurrent: current,
        loadText: async () => {
          const response = await fetch(options.url);
          if (!response.ok) throw new Error('SVG source unavailable');
          return response.text();
        },
      });
      if (!current() || result.status === 'stale') return { status: 'stale', isCurrent: current };
      if (result.status === 'copied') {
        const label = options.label ? `${options.label} ` : '';
        await present(`已复制${label}SVG 源码。`);
        return { status: 'copied', isCurrent: current };
      }
      await present(
        result.value !== undefined
          ? '无法自动复制，已选中内容，请手动复制。'
          : 'SVG 源码未能加载，请重试或下载原始 SVG 文件。',
        result.value,
        recovery,
      );
      return { status: 'failed', isCurrent: current };
    } catch {
      if (!current()) return { status: 'stale', isCurrent: current };
      await present('SVG 源码未能加载，请重试或下载原始 SVG 文件。', undefined, recovery);
      return { status: 'failed', isCurrent: current };
    }
  }

  function retry() {
    const action = recoveryAction;
    if (!action) return;
    if (action.kind === 'image') void copyImage(action.options);
    else void copySvg(action.options);
  }

  function dismiss() {
    const restoreFocus =
      (manualValue !== undefined || recoveryAction !== undefined) && previousFocus?.isConnected;
    const focus = previousFocus;
    const fromDialog = Boolean(recoveryElement);
    reset();
    if (restoreFocus && fromDialog) recoveryReturnFocus = focus;
    else if (restoreFocus) focus?.focus({ preventScroll: true });
  }

  function focusRecovery(event: Event) {
    if (manualValue === undefined) return;
    event.preventDefault();
    manualAddress?.focus({ preventScroll: true });
    manualAddress?.select();
  }

  function restoreRecoveryFocus(event: Event) {
    event.preventDefault();
    const focus = recoveryReturnFocus;
    recoveryReturnFocus = null;
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  }

  onDestroy(reset);
</script>

{#snippet feedbackContent()}
  <p id="action-status" role="status" aria-live="polite">{message}</p>
  <div id="manual-copy" hidden={manualValue === undefined}>
    <label for="manual-address">手动复制</label>
    <textarea
      id="manual-address"
      bind:this={manualAddress}
      value={manualValue ?? ''}
      readonly
      rows="2"
      spellcheck="false"
      onclick={(event) => event.currentTarget.select()}></textarea>
  </div>
  {#if recoveryAction}
    <div class="copy-recovery" role="group" aria-label="复制失败后的操作">
      <ActionButton variant="text" size="sm" onclick={retry}>重试复制</ActionButton>
      <!-- eslint-disable svelte/no-navigation-without-resolve -- Downloads the selected original asset URL. -->
      <a
        class="text-button"
        href={recoveryAction.options.url}
        download={recoveryAction.options.downloadName}>下载原图</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
      <ActionButton
        variant="text"
        size="sm"
        onclick={() => copy(recoveryAction!.options.url, '图片地址')}>复制图片地址</ActionButton
      >
    </div>
  {/if}
  <ActionButton
    variant="icon"
    size="sm"
    id="dismiss-feedback"
    aria-label="关闭复制提示"
    onclick={dismiss}>×</ActionButton
  >
{/snippet}

<Dialog.Root
  bind:open={recoveryOpen}
  onOpenChange={(open) => {
    if (!open) dismiss();
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="copy-recovery-overlay" />
    <Dialog.Content
      id="copy-feedback"
      class="copy-recovery-dialog"
      bind:ref={recoveryElement}
      aria-describedby="action-status"
      trapFocus
      preventScroll
      onOpenAutoFocus={focusRecovery}
      onCloseAutoFocus={restoreRecoveryFocus}
    >
      <Dialog.Title class="copy-recovery-title" level={2}>复制未完成</Dialog.Title>
      {@render feedbackContent()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .copy-recovery {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 12px;
  }
  .copy-recovery :global(button),
  .copy-recovery a {
    min-height: 44px;
  }
</style>
