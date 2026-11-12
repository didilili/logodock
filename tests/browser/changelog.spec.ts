import { expect, test } from '@playwright/test';

test('changelog shows published updates, working brand links and the current navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: '更新日志', exact: true }).click();
  await expect(page).toHaveURL(/\/changelog\/$/);
  await expect(page).toHaveTitle('更新日志 · LogoDock');
  await expect(page.getByRole('heading', { level: 1, name: '更新日志' })).toBeVisible();
  await expect(page.getByRole('link', { name: '更新日志', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.release-entry').first()).toBeVisible();
  await expect(page.locator('#main')).not.toContainText('未发布');
  const brand = page.locator('.release-content a[href*="/logo/"]').first();
  const destination = await brand.getAttribute('href');
  await brand.click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  await expect(page.locator('.asset-gallery a[download]').first()).toBeVisible();
});

test('mobile navigation and updates remain usable in both themes', async ({ page }) => {
  for (const width of [320, 375, 720]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    const trigger = page.getByRole('button', { name: '打开导航', exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: '更新日志', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '更新日志' })).toBeVisible();
    await expect(page.locator('.mobile-nav-panel')).toBeHidden();
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.mobile-nav-panel')).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#theme-toggle').click();
  }
});

test('published updates and mobile navigation work without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto('/changelog/');
  await expect(page.getByRole('heading', { level: 1, name: '更新日志' })).toBeVisible();
  await expect(page.locator('.release-entry').first()).toBeVisible();
  const navigation = page.locator('.mobile-navigation-fallback');
  await expect(navigation).toHaveJSProperty('open', false);
  await navigation.locator(':scope > summary').click();
  await expect(navigation).toHaveJSProperty('open', true);
  await expect(navigation.getByRole('link', { name: '更新日志', exact: true })).toHaveAttribute(
    'href',
    '/changelog/',
  );
  await expect(navigation.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/didilili/logodock',
  );
  await expect(page.getByRole('link', { name: '建议收录', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回素材库', exact: true }).click();
  await expect(page.locator('#brand-grid')).toBeVisible();
  await context.close();
});
