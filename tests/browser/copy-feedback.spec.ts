import { expect, test, type Locator, type Page } from '@playwright/test';

const activeToast = '[data-sonner-toast]:not([data-removed="true"])';

async function recordCopies(page: Page, options: { blocked?: boolean; reject?: boolean } = {}) {
  await page.addInitScript(({ blocked = false, reject = false }) => {
    const releases: (() => void)[] = [];
    const state = {
      blocked,
      reject,
      calls: [] as { kind: string; complete: boolean }[],
      texts: [] as string[],
      release(index: number) {
        releases[index]?.();
      },
    };
    Object.assign(window, { __copyFeedbackAudit: state });

    async function write(kind: string, read: () => Promise<void>) {
      const index = state.calls.length;
      const call = { kind, complete: false };
      state.calls.push(call);
      try {
        if (state.blocked) await new Promise<void>((resolve) => (releases[index] = resolve));
        await read();
        if (state.reject) throw new DOMException('Permission denied', 'NotAllowedError');
      } finally {
        call.complete = true;
      }
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) =>
          write('text', async () => {
            state.texts.push(value);
          }),
        write: (items: ClipboardItem[]) =>
          write('item', async () => {
            for (const item of items) {
              for (const type of item.types) {
                const blob = await item.getType(type);
                if (type === 'text/plain') state.texts.push(await blob.text());
              }
            }
          }),
      },
    });
  }, options);
}

function detailDialog(page: Page) {
  return page.locator('.preview-dialog[role="dialog"]');
}

async function chooseCopy(page: Page, trigger: Locator, kind: string) {
  await trigger.click();
  await page.locator(`[data-copy-menu-content] [data-copy-kind="${kind}"]`).click();
}

async function openEmbed(page: Page) {
  await page.goto('/logo/git/?asset=logo-color.svg');
  const dialog = detailDialog(page);
  await expect(dialog.locator('#detail-copy-menu')).toBeEnabled();
  await dialog.locator('[data-resource-trigger="embed"]').click();
  return dialog;
}

test('pending and copied states belong to the initiating menu for the same original file', async ({
  page,
}) => {
  await recordCopies(page, { blocked: true });
  await page.goto('/logo/git/?asset=logo-color.svg');
  const trigger = detailDialog(page).locator('#detail-copy-menu');
  await expect(trigger).toBeEnabled();
  await chooseCopy(page, trigger, 'svg');
  await expect.poll(() => page.evaluate('window.__copyFeedbackAudit.calls.length')).toBe(1);
  await expect(trigger).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.asset-gallery .copy-menu-trigger[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator(`${activeToast}[data-type="success"]`)).toHaveCount(0);
  await page.evaluate('window.__copyFeedbackAudit.release(0)');
  await expect(trigger).toHaveAttribute('aria-busy', 'false');
  await expect(trigger).toContainText('已复制');
  await expect(page.locator(activeToast)).toHaveCount(1);
  await expect(page.locator(activeToast)).toContainText('SVG 源码');
  await expect(trigger).toBeFocused();
  await expect(
    page.locator('.asset-gallery .copy-menu-trigger').filter({ hasText: '已复制' }),
  ).toHaveCount(0);
});

test('a later field copy supersedes an earlier pending result and clears another copied field', async ({
  page,
}) => {
  await recordCopies(page, { blocked: true });
  const dialog = await openEmbed(page);
  const html = dialog.locator('[data-copy-target="html-example"]');
  const markdown = dialog.locator('[data-copy-target="markdown-example"]');
  await html.click();
  await expect(html).toHaveAttribute('aria-busy', 'true');
  await markdown.click();
  await expect(markdown).toHaveAttribute('aria-busy', 'true');
  await expect(html).toHaveAttribute('aria-busy', 'false');
  await expect(html).toHaveAttribute('data-copy-state', 'idle');
  await page.evaluate('window.__copyFeedbackAudit.release(1)');
  await expect(markdown).toContainText('已复制');
  await page.evaluate('window.__copyFeedbackAudit.release(0)');
  await expect(html).toHaveAttribute('aria-busy', 'false');
  await expect(html).not.toContainText('已复制');
  await expect(page.locator(activeToast)).toHaveCount(1);
  await expect(page.locator(activeToast)).toContainText('Markdown');
  await page.evaluate('window.__copyFeedbackAudit.blocked = false');
  await html.click();
  await expect(html).toContainText('已复制');
  await expect(markdown).not.toContainText('已复制');
  await expect(page.locator(activeToast)).toHaveCount(1);
  await expect(page.locator(activeToast)).toContainText('HTML');
});

test('copying the same menu again refreshes its local success timer and replaces the toast', async ({
  page,
}) => {
  await recordCopies(page);
  await page.goto('/?q=华为&format=PNG');
  const trigger = page.locator('[data-copy-brand="huawei"]');
  await expect(trigger).toBeEnabled();
  await page.clock.install();
  await chooseCopy(page, trigger, 'current');
  await expect(trigger).toContainText('已复制');
  await page.clock.fastForward(1300);
  await chooseCopy(page, trigger, 'current');
  await expect.poll(() => page.evaluate('window.__copyFeedbackAudit.calls.length')).toBe(2);
  await expect(trigger).toContainText('已复制');
  await expect(page.locator(activeToast)).toHaveCount(1);
  await page.clock.fastForward(1000);
  await expect(trigger).toContainText('已复制');
  await page.clock.fastForward(1100);
  await expect(trigger).toHaveText('复制');
});

test('text rejection keeps the selected manual recovery and restores focus to the field', async ({
  page,
}) => {
  await recordCopies(page, { reject: true });
  await page.clock.install();
  const dialog = await openEmbed(page);
  const trigger = dialog.locator('[data-copy-target="html-example"]');
  const value = await dialog.locator('#html-example').inputValue();
  await trigger.click();
  const recovery = page.getByRole('dialog', { name: '复制未完成', exact: true });
  const manual = recovery.getByRole('textbox', { name: '手动复制', exact: true });
  await expect(manual).toHaveValue(value);
  await expect(manual).toBeFocused();
  expect(
    await manual.evaluate((element: HTMLTextAreaElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([0, value.length]);
  await expect(trigger).toHaveAttribute('data-copy-state', 'error');
  await expect(trigger).not.toContainText('已复制');
  await expect(page.locator(`${activeToast}[data-type="success"]`)).toHaveCount(0);
  await page.clock.fastForward(5000);
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button', { name: '关闭复制提示', exact: true }).click();
  await expect(recovery).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(dialog).toBeVisible();
  await page.evaluate('window.__copyFeedbackAudit.reject = false');
  await trigger.click();
  await expect(trigger).toContainText('已复制');
  await expect(page.locator(activeToast)).toContainText('HTML');
});

test('image rejection offers retry without reporting success and returns focus after recovery', async ({
  page,
}) => {
  await recordCopies(page, { reject: true });
  await page.clock.install();
  await page.goto('/logo/huawei/?asset=wordmark-dark-2018.png');
  const trigger = detailDialog(page).locator('#detail-copy-menu');
  await expect(trigger).toBeEnabled();
  await chooseCopy(page, trigger, 'image');
  const recovery = page.getByRole('group', { name: '复制失败后的操作', exact: true });
  await expect(recovery).toBeVisible();
  await expect(trigger).toHaveAttribute('data-copy-state', 'error');
  await expect(trigger).not.toContainText('已复制');
  await expect(page.locator(`${activeToast}[data-type="success"]`)).toHaveCount(0);
  await expect(recovery.getByRole('link', { name: '下载原图', exact: true })).toHaveAttribute(
    'href',
    /wordmark-dark-2018\.png$/,
  );
  await page.clock.fastForward(5000);
  await expect(recovery).toBeVisible();
  await page.evaluate('window.__copyFeedbackAudit.reject = false');
  await recovery.getByRole('button', { name: '重试复制', exact: true }).click();
  await expect(recovery).toBeHidden();
  await expect(page.locator(activeToast)).toContainText('原始 PNG 图片');
  await expect(trigger).toBeFocused();
});

test('changing the file cancels pending copy feedback before the old promise resolves', async ({
  page,
}) => {
  await recordCopies(page, { blocked: true });
  await page.goto('/logo/bambu-lab/?asset=symbol-square.svg');
  const dialog = detailDialog(page);
  const trigger = dialog.locator('#detail-copy-menu');
  await expect(trigger).toBeEnabled();
  await chooseCopy(page, trigger, 'svg');
  await expect.poll(() => page.evaluate('window.__copyFeedbackAudit.calls.length')).toBe(1);
  await expect(trigger).toHaveAttribute('aria-busy', 'true');
  await dialog.locator('.file-options-trigger').click();
  await dialog.locator('.file-option[data-select-asset="symbol-green.svg"]').click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    '/logo/bambu-lab/symbol-green.svg',
  );
  await page.evaluate('window.__copyFeedbackAudit.release(0)');
  await expect.poll(() => page.evaluate('window.__copyFeedbackAudit.calls[0].complete')).toBe(true);
  await expect(trigger).toHaveAttribute('aria-busy', 'false');
  await expect(trigger).not.toContainText('已复制');
  await expect(page.locator(activeToast)).toHaveCount(0);
});

test('PNG export replaces copy feedback with its download result and surfaces generation failure', async ({
  page,
}) => {
  await recordCopies(page);
  await page.goto('/logo/git/?asset=logo-color.svg');
  const dialog = detailDialog(page);
  const trigger = dialog.locator('#detail-copy-menu');
  await expect(trigger).toBeEnabled();
  await chooseCopy(page, trigger, 'current');
  await expect(trigger).toContainText('已复制');
  await dialog.locator('#download-options').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-download-kind="png"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-export-2048\.png$/);
  await expect(page.locator(activeToast)).toHaveCount(1);
  await expect(page.locator(activeToast)).toContainText(/已下载.*2048/);
  await expect(trigger).not.toContainText('已复制');
  await page.route('**/logo/git/logo-color.svg', (route) =>
    route.request().resourceType() === 'fetch' ? route.abort('failed') : route.continue(),
  );
  await dialog.locator('#download-options').click();
  await page.locator('[data-download-kind="png"]').click();
  await expect(page.locator(activeToast)).toHaveCount(1);
  await expect(page.locator(activeToast)).toContainText('PNG 生成未完成');
  await expect(trigger).not.toContainText('已复制');
});

for (const width of [1280, 390]) {
  test(`copy toast follows the site theme and viewport placement at ${width}px`, async ({
    page,
  }) => {
    const height = 844;
    await page.setViewportSize({ width, height });
    await recordCopies(page);
    await page.goto('/logo/git/');
    const trigger = page.locator('.artwork-card .copy-menu-trigger').first();
    await expect(trigger).toBeEnabled();
    await chooseCopy(page, trigger, 'current');
    const toaster = page.locator('[data-sonner-toaster]');
    const toast = page.locator(activeToast);
    await expect(toast).toHaveCount(1);
    await expect(toaster).toHaveAttribute('data-sonner-theme', 'light');
    await expect(toaster).toHaveAttribute('data-y-position', width < 720 ? 'bottom' : 'top');
    await expect(toaster).toHaveAttribute('data-x-position', width < 720 ? 'center' : 'right');
    await expect
      .poll(async () => {
        const box = await toast.boundingBox();
        if (!box) return false;
        return width < 720
          ? box.y > height - 180 && Math.abs(box.x + box.width / 2 - width / 2) < 3
          : box.y < 160 && box.x > width / 2;
      })
      .toBe(true);
    const lightBackground = await toast.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await page.locator('#theme-toggle').click();
    await expect(toaster).toHaveAttribute('data-sonner-theme', 'dark');
    await expect(toast).not.toHaveCSS('background-color', lightBackground);
    await expect(page.locator(activeToast)).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
