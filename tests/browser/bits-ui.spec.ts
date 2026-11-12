import { expect, test } from '@playwright/test';

test('mobile navigation closes with Escape and an outside click while preserving focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '打开导航', exact: true });
  const panel = page.locator('.mobile-nav-panel');
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await trigger.press('Enter');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: '更新日志', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).toBeVisible();
  const search = page.locator('#search');
  await search.click();
  await expect(panel).toBeHidden();
  await expect(search).toBeFocused();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('category expansion and category selection remain separate actions', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('.category-sidebar');
  const expand = sidebar.locator('[data-expand="technology"]');
  const select = sidebar.locator('[data-category="technology"]');
  const child = sidebar.locator('[data-category="internet-platforms"]');
  await expect(expand).toBeEnabled();
  const originalUrl = page.url();
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(child).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(child).toBeHidden();
  expect(page.url()).toBe(originalUrl);
  await select.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('technology');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await child.click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('category'))
    .toBe('internet-platforms');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
});

test('background and version-scope radio groups update through keyboard selection', async ({
  page,
}) => {
  await page.goto('/logo/git/?asset=logo-color.svg');
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('#detail-copy-menu')).toBeEnabled();
  const background = dialog.getByRole('radiogroup', { name: '预览背景', exact: true });
  const automatic = background.getByRole('radio', { name: '适配', exact: true });
  const light = background.getByRole('radio', { name: '浅色', exact: true });
  const dark = background.getByRole('radio', { name: '深色', exact: true });
  await automatic.focus();
  await automatic.press('ArrowRight');
  await expect(light).toBeFocused();
  await expect(light).toHaveAttribute('aria-checked', 'true');
  await light.press('ArrowRight');
  await expect(dark).toBeFocused();
  await expect(dark).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
  await expect(background.locator('[aria-checked="true"]')).toHaveCount(1);

  await page.goto('/logo/huawei/?q=华为&format=SVG');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  const scope = page.getByRole('radiogroup', { name: '版本范围', exact: true });
  const matching = scope.getByRole('radio', { name: '匹配版本', exact: true });
  const all = scope.getByRole('radio', { name: '全部版本', exact: true });
  await expect(matching).toHaveAttribute('aria-checked', 'true');
  await matching.focus();
  await matching.press('ArrowRight');
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('versions')).toBe('all');
  await all.press('Space');
  await expect(scope.locator('[aria-checked="true"]')).toHaveCount(1);
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await all.press('ArrowLeft');
  await expect(matching).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('versions')).toBe('matching');
});

test('the directory format radio group preserves one selection through keyboard and repeated clicks', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const formats = page.getByRole('radiogroup', { name: '文件格式', exact: true });
  const all = formats.locator('[data-format=""]');
  const next = formats.getByRole('radio').nth(1);
  const format = await next.getAttribute('data-format');
  expect(format).toBeTruthy();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await all.focus();
  await all.press('ArrowRight');
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('format')).toBe(format);
  await next.press('Space');
  await next.click();
  await expect(next).toHaveAttribute('aria-checked', 'true');
  await expect(formats.locator('[aria-checked="true"]')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('format')).toBe(format);
  await next.press('ArrowLeft');
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.has('format')).toBe(false);
});

test('the server-rendered gallery disclosure opens and downloads its original without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  try {
    await page.goto('/logo/insta360/');
    const more = page.locator('.artwork-more');
    expect(await more.evaluate((element) => element.tagName)).toBe('DETAILS');
    await expect(page.locator('.artwork-card')).toHaveCount(24);
    await expect(page.locator('.artwork-card:visible')).toHaveCount(6);
    await more.locator(':scope > summary').click();
    await expect(more).toHaveJSProperty('open', true);
    await expect(page.locator('.artwork-card:visible')).toHaveCount(24);
    const original = more.locator('.artwork-card a[download]').last();
    const filename = await original.getAttribute('download');
    await expect(original).toHaveAttribute('href', /^\/logo\/insta360\//);
    const downloadPromise = page.waitForEvent('download');
    await original.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.path()).not.toBeNull();
  } finally {
    await context.close();
  }
});

test('resource accordion supports multiple open panels and preserves copy recovery focus', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      },
    });
  });
  await page.goto('/logo/baidu/');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await page.locator('.file-details-link').first().click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog).toBeVisible();
  const source = dialog.locator('[data-resource-trigger="source"]');
  const design = dialog.locator('[data-resource-trigger="design"]');
  const embed = dialog.locator('[data-resource-trigger="embed"]');
  await expect(source).toHaveAttribute('aria-expanded', 'true');
  await expect(design).toHaveAttribute('aria-expanded', 'false');
  await expect(embed).toHaveAttribute('aria-expanded', 'false');
  await source.focus();
  await source.press('ArrowDown');
  await expect(design).toBeFocused();
  await design.press('Space');
  await expect(design).toHaveAttribute('aria-expanded', 'true');
  await expect(source).toHaveAttribute('aria-expanded', 'true');
  await design.press('ArrowDown');
  await expect(embed).toBeFocused();
  await embed.press('Enter');
  await expect(embed).toHaveAttribute('aria-expanded', 'true');
  await expect(design).toHaveAttribute('aria-expanded', 'true');
  await expect(source).toHaveAttribute('aria-expanded', 'true');
  await source.press('Space');
  await expect(source).toHaveAttribute('aria-expanded', 'false');
  await expect(design).toHaveAttribute('aria-expanded', 'true');
  await expect(embed).toHaveAttribute('aria-expanded', 'true');

  const field = dialog.locator('[data-copy-target="html-example"]');
  const value = await dialog.locator('#html-example').inputValue();
  await field.click();
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
  await recovery.getByRole('button', { name: '关闭复制提示', exact: true }).click();
  await expect(recovery).toBeHidden();
  await expect(field).toBeFocused();
  await expect(design).toHaveAttribute('aria-expanded', 'true');
  await expect(embed).toHaveAttribute('aria-expanded', 'true');
  await embed.click();
  await expect(dialog.locator('#html-example')).toBeHidden();
  await embed.click();
  await expect(dialog.locator('#html-example')).toHaveValue(value);
});
