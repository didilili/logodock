<script module lang="ts">
  export interface CopySourceOptions {
    url: string;
    downloadName: string;
    label?: string;
  }

  export interface CopyImageOptions extends CopySourceOptions {
    format: string;
  }

  export interface CopyFeedbackApi {
    reset(): number;
    isCurrent(token: number): boolean;
    pending(url: string): boolean;
    show(message: string, manualValue?: string): Promise<void>;
    copy(value: string, label: string): Promise<void>;
    copyImage(options: CopyImageOptions): Promise<void>;
    copySvg(options: CopySourceOptions): Promise<void>;
  }
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import ActionButton from './ActionButton.svelte';
  import { copyDeferredText, copyText } from '../resource-links.mjs';
  import { canCopyPngImage, copyPngImage } from '../clipboard-image.mjs';
  import { renderRasterPng, renderSvgPng } from '../svg-export';

  type RecoveryAction =
    { kind: 'image'; options: CopyImageOptions } | { kind: 'svg'; options: CopySourceOptions };

  let visible = $state(false);
  let message = $state('');
  let manualValue = $state<string | undefined>();
  let recoveryAction = $state<RecoveryAction>();
  let pendingOperation = $state<{ url: string; token: number }>();
  let feedbackElement: HTMLDivElement | undefined;
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
    recoveryAction = undefined;
    pendingOperation = undefined;
    previousFocus = null;
    return revision;
  }

  export function isCurrent(token: number) {
    return token === revision;
  }

  export function pending(url: string) {
    return (
      pendingOperation?.token === revision &&
      pendingOperation.url === new URL(url, location.href).href
    );
  }

  function begin(url?: string) {
    const active = document.activeElement;
    const fromFeedback = active instanceof HTMLElement && feedbackElement?.contains(active);
    const focus = active instanceof HTMLElement && !fromFeedback ? active : previousFocus;
    if (fromFeedback && focus?.isConnected) focus.focus({ preventScroll: true });
    const token = reset();
    previousFocus = focus;
    if (url) pendingOperation = { url: new URL(url, location.href).href, token };
    return token;
  }

  async function present(value: string, manual?: string, recovery?: RecoveryAction) {
    clearTimeout(timer);
    const token = revision;
    message = value;
    manualValue = manual;
    recoveryAction = recovery;
    pendingOperation = undefined;
    visible = true;
    if (manual !== undefined) {
      if (!previousFocus)
        previousFocus =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await tick();
      if (!isCurrent(token)) return;
      manualAddress?.focus();
      manualAddress?.select();
    } else if (!recovery) {
      timer = setTimeout(() => {
        if (isCurrent(token)) visible = false;
      }, 3500);
    }
  }

  export async function show(value: string, manual?: string) {
    await present(value, manual);
  }

  export async function copy(value: string, label: string) {
    if (!value) return;
    const token = begin();
    const copied = await copyText(value, navigator.clipboard);
    if (!isCurrent(token)) return;
    await show(
      copied ? `已复制${label}。` : '无法自动复制，已选中内容，请手动复制。',
      copied ? undefined : value,
    );
  }

  export async function copyImage(options: CopyImageOptions) {
    const token = begin(options.url);
    const current = () => isCurrent(token);
    const recovery: RecoveryAction = { kind: 'image', options: { ...options } };
    if (!canCopyPngImage(navigator.clipboard, globalThis.ClipboardItem)) {
      await present('当前浏览器暂不支持复制图片，可下载原图或复制图片地址。', undefined, recovery);
      return;
    }
    message = '正在复制图片…';
    visible = true;
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
    if (!current() || result === 'stale') return;
    if (result !== 'copied') {
      await present('无法复制图片，请重试。', undefined, recovery);
      return;
    }
    const label = options.label ? `${options.label} ` : '';
    await present(
      dimensions
        ? `已复制${label}PNG 图片（${dimensions.width} × ${dimensions.height} px，由 ${format} 生成）。`
        : `已复制${label}原始 PNG 图片。`,
    );
  }

  export async function copySvg(options: CopySourceOptions) {
    const token = begin(options.url);
    const current = () => isCurrent(token);
    const recovery: RecoveryAction = { kind: 'svg', options: { ...options } };
    message = '正在复制 SVG 源码…';
    visible = true;
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
      if (!current() || result.status === 'stale') return;
      if (result.status === 'copied') {
        const label = options.label ? `${options.label} ` : '';
        await present(`已复制${label}SVG 源码。`);
        return;
      }
      await present(
        result.value !== undefined
          ? '无法自动复制，已选中内容，请手动复制。'
          : 'SVG 源码未能加载，请重试或下载原始 SVG 文件。',
        result.value,
        recovery,
      );
    } catch {
      if (current())
        await present('SVG 源码未能加载，请重试或下载原始 SVG 文件。', undefined, recovery);
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
    reset();
    if (restoreFocus) focus?.focus({ preventScroll: true });
  }

  onDestroy(reset);
</script>

<div class="copy-feedback" id="copy-feedback" bind:this={feedbackElement} hidden={!visible}>
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
</div>

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
