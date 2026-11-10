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
  await expect(page.locator('#download-link')).toBeVisible();
});

test('mobile navigation and updates remain usable in both themes', async ({ page }) => {
  for (const width of [320, 375, 720]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    await expect(page.locator('.mobile-navigation > summary')).toHaveAccessibleName('打开导航');
    await page.locator('.mobile-navigation > summary').click();
    await page.getByRole('link', { name: '更新日志', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '更新日志' })).toBeVisible();
    await expect(page.locator('.mobile-navigation')).not.toHaveAttribute('open');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.locator('.mobile-navigation > summary').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.mobile-navigation')).not.toHaveAttribute('open');
    await expect(page.locator('.mobile-navigation > summary')).toBeFocused();
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
  await page.locator('.mobile-navigation > summary').click();
  await expect(page.getByRole('link', { name: '建议收录', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回素材库', exact: true }).click();
  await expect(page.locator('#brand-grid')).toBeVisible();
  await context.close();
});
