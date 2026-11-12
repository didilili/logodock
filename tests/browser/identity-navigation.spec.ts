import { expect, test } from '@playwright/test';

test('company details show the reviewed short name, legal identity and linked classification', async ({
  page,
}, testInfo) => {
  await page.goto('/logo/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('阿里巴巴');
  await expect(page.getByRole('definition')).toContainText(['阿里巴巴集团控股有限公司']);
  const category = page
    .getByRole('navigation', { name: '品牌分类' })
    .getByRole('link', { name: '综合互联网', exact: true });
  await expect(category).toHaveAttribute('href', '/?category=internet-platforms');
  await expect(category).toHaveAttribute('title', '科技与软件 / 综合互联网');
  await expect(page.locator('.brand-subjects a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect
    .poll(() =>
      page
        .locator('.artwork-visual img')
        .first()
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('company-identity.png') });
  await category.click();
  await expect(page.locator('.directory-title h1')).toHaveText('综合互联网');
});

test('a single artwork shows its summary and keeps the original download', async ({
  page,
}, testInfo) => {
  await page.goto('/logo/bank-of-china/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.getByRole('definition')).toContainText(['中国银行股份有限公司']);
  const card = page.locator('.artwork-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.artwork-caption h3')).toBeVisible();
  await expect(card.locator('.artwork-caption')).not.toContainText('品牌色');
  await expect(card.locator('.artwork-visual img')).toHaveAttribute(
    'src',
    '/logo/bank-of-china/logo-bilingual.png',
  );
  await expect(card.locator('a[download]')).toHaveAttribute(
    'href',
    '/logo/bank-of-china/logo-bilingual.png',
  );
  await page.screenshot({ path: testInfo.outputPath('single-artwork.png') });
  await card.locator('.file-details-link').click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('.current-version h3')).toBeVisible();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    '/logo/bank-of-china/logo-bilingual.png',
  );
  await expect(dialog.locator('#download-link')).toHaveAttribute(
    'href',
    '/logo/bank-of-china/logo-bilingual.png',
  );
});

test('product filtering and parent navigation open the complete company with a reverse product link', async ({
  page,
}, testInfo) => {
  await page.goto('/?q=元宝&usage=app-icon');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await page.locator('#more-filters-trigger').click();
  const type = page.locator('#type-filter');
  await expect(type).toBeFocused();
  await type.click();
  await page.getByRole('option', { name: '产品', exact: true }).click();
  await expect(type).toHaveText('产品');
  expect(new URL(page.url()).searchParams.get('type')).toBe('product');
  await page.keyboard.press('Escape');
  const yuanbao = page.locator('[data-brand="yuanbao"]');
  await expect(yuanbao.locator('.brand-type, .card-parent')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('directory-product.png') });
  await yuanbao.locator('.brand-link').click();
  await expect(page.locator('.detail-entity')).toHaveText('产品');
  await expect(page.locator('.brand-information')).toContainText('AI 模型与应用');
  await page.getByRole('region', { name: '所属品牌', exact: true }).getByRole('link').click();
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('腾讯');
  const commonVersions = page.locator('.artwork-grid[aria-label="标识版本"] .artwork-card');
  await expect(commonVersions).not.toHaveCount(0);
  const commonCount = await commonVersions.count();
  expect(commonCount).toBeLessThanOrEqual(6);
  await expect(page.locator('.preview-dialog[role="dialog"]')).toHaveCount(0);
  await expect(page.locator('.directory-context')).toHaveCount(0);
  const moreVersions = page.locator('.artwork-more');
  const moreTrigger = moreVersions.locator('.artwork-more-trigger');
  await expect(moreTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(moreVersions).toHaveAttribute('data-state', 'closed');
  await moreTrigger.click();
  await expect(moreTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(moreVersions).toHaveAttribute('data-state', 'open');
  expect(await page.locator('.artwork-card:visible').count()).toBeGreaterThan(commonCount);
  await expect(
    page.getByRole('region', { name: '相关品牌与产品' }).getByRole('link', { name: /腾讯元宝/ }),
  ).toHaveAttribute('href', '/logo/yuanbao/');
  await page.goBack();
  expect(new URL(page.url()).searchParams.get('usage')).toBe('app-icon');
  await expect(page.locator('.detail-entity')).toHaveText('产品');
});

test('mobile identity and singleton summary remain readable without horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/logo/bank-of-china/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const information = page.getByRole('region', { name: '品牌信息', exact: true });
  await expect(information.getByRole('term').filter({ hasText: /^公司全称$/ })).toBeVisible();
  await expect(information).toContainText('中国银行股份有限公司');
  await expect(page.getByRole('navigation', { name: '品牌分类' })).toBeVisible();
  const card = page.locator('.artwork-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.artwork-caption h3')).toBeVisible();
  await expect(card.locator('a[download]')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('mobile-identity.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
