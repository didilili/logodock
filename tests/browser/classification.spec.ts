import { expect, test, type Page } from '@playwright/test';

function fileCard(page: Page, file: string) {
  return page.locator('.artwork-card').filter({
    has: page.locator(`.artwork-visual[data-select-asset="${file}"]`),
  });
}

async function choose(page: Page, id: string, label: string) {
  const trigger = page.locator(`#${id}`);
  if (!(await trigger.isVisible())) await page.locator('#more-filters-trigger').click();
  await trigger.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  if (await page.locator('#extra-filter-panel').isVisible()) await page.keyboard.press('Escape');
}

test('application icons share one purpose filter while language and composition remain independent', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await choose(page, 'usage-filter', '应用图标');
  const jd = page.locator('[data-brand="jd"]');
  const meituan = page.locator('[data-brand="meituan"]');
  await expect(jd.locator('.brand-art img')).toHaveAttribute(
    'src',
    /\/logo\/jd\/icon-google-play-official\.png$/,
  );
  await expect(meituan.locator('.brand-art img')).toHaveAttribute(
    'src',
    /wordmark-rounded-google-play\.png$/,
  );
  await expect
    .poll(() =>
      jd
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('application-filter.png') });
  await choose(page, 'language-filter', '中文');
  await expect(jd).toHaveCount(0);
  await meituan.locator('.brand-link').click();
  const versions = page.locator('.asset-gallery');
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog).toHaveCount(0);
  await expect(versions.locator('.artwork-visual img')).toHaveAttribute(
    'src',
    /wordmark-rounded-google-play\.png$/,
  );
  await expect(page.locator('.directory-context')).toContainText('应用图标 · 中文');
  await expect(versions.locator('.variant-option')).toHaveCount(1);
  await page.getByRole('radio', { name: '全部版本', exact: true }).click();
  await expect(versions.locator('.variant-option')).toHaveCount(3);
  await fileCard(page, 'logo-chinese-official.png').locator('.file-details-link').click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    /logo-chinese-official\.png$/,
  );
  await page.reload();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    /logo-chinese-official\.png$/,
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('radio', { name: '全部版本', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(fileCard(page, 'logo-chinese-official.png')).toBeVisible();
  await page.locator('#back-directory').click();
  await page.locator('#more-filters-trigger').click();
  await expect(page.locator('#usage-filter')).toContainText('应用图标');
  await expect(page.locator('#language-filter')).toContainText('中文');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('[data-brand="meituan"] .card-download')).toHaveAttribute(
    'href',
    /wordmark-rounded-google-play\.png$/,
  );
});

test('pure symbols exclude letter symbols and filters require one available file', async ({
  page,
}) => {
  await page.goto('/?q=腾讯&shape=pure-icon&format=SVG');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await page.locator('#more-filters-trigger').click();
  await expect(page.locator('#shape-filter')).toContainText('纯图形（无文字）');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-brand="tencent"]')).toHaveCount(0);
  await page.goto('/?q=京东&usage=app-icon&format=SVG');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: '移除SVG筛选', exact: true }).click();
  await expect(page.locator('[data-brand="jd"] .card-download')).toHaveAttribute(
    'href',
    /\/logo\/jd\/icon-google-play-official\.png$/,
  );
  await expect(page.locator('#search')).toHaveValue('京东');
});

test('large brand version filters survive file details and retain original downloads', async ({
  page,
}) => {
  await page.goto('/logo/insta360/');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await choose(page, 'version-layout-filter', '上下排列');
  const variants = page.locator('.asset-gallery .variant-option');
  await expect(variants).toHaveCount(4);
  const selectedFile = await variants.first().getAttribute('data-select-asset');
  await variants.first().click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#download-link')).toHaveAttribute('href', /vertical\.(png|jpg)$/);
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    `/logo/insta360/${selectedFile}`,
  );
  await expect(dialog.locator('.current-version h3')).toBeVisible();
  await expect(dialog.locator('[id^="version-"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#version-layout-filter')).toContainText('上下排列');
  await expect(variants).toHaveCount(4);
  await expect(page.locator('.asset-gallery .version-filters')).toBeVisible();
  await expect(fileCard(page, selectedFile!).locator('a[download]')).toHaveAttribute(
    'href',
    `/logo/insta360/${selectedFile}`,
  );
});

test('a matching artwork returns to its matching file after another file in the group is previewed', async ({
  page,
}) => {
  await page.goto('/?q=提取');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await page.locator('[data-brand="bambu-lab"] .brand-link').click();
  const matchingArtwork = page.locator('.artwork-visual[data-select-artwork="green-symbol"]');
  await expect(matchingArtwork).toHaveAttribute('data-select-asset', 'symbol-square.svg');
  await matchingArtwork.click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', /symbol-square\.svg$/);
  const moreFiles = dialog.locator('.file-options-trigger');
  await expect(moreFiles).toHaveAttribute('aria-expanded', 'false');
  await moreFiles.click();
  await expect(moreFiles).toHaveAttribute('aria-expanded', 'true');
  await dialog.locator('.file-option[data-select-asset="symbol-green.svg"]').click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', /symbol-green\.svg$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(matchingArtwork).toHaveAttribute('data-select-asset', 'symbol-square.svg');
  await matchingArtwork.click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', /symbol-square\.svg$/);
  await expect(dialog.locator('#download-link')).toHaveAttribute('href', /symbol-square\.svg$/);
});

test('artwork choices retain group details without repeating their file details', async ({
  page,
}) => {
  await page.goto('/logo/bambu-lab/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const greenSymbol = page.locator(
    '.artwork-card[data-artwork="green-symbol"] .artwork-attributes',
  );
  await expect(greenSymbol).toContainText('绿色');
  await expect(greenSymbol).toContainText('方形');
  await page.goto('/logo/biren/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const blueSymbol = page.locator('.artwork-card[data-artwork="blue-symbol"] .artwork-attributes');
  await expect(blueSymbol).toContainText('蓝色B');
  expect((await blueSymbol.innerText()).match(/蓝色B/g)).toHaveLength(1);
});

test('mobile classification controls remain readable and within the viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?usage=app-icon');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#usage-filter')).toBeHidden();
  await page.locator('#more-filters-trigger').click();
  await expect(page.getByRole('dialog', { name: '筛选', exact: true })).toBeVisible();
  for (const id of ['usage-filter', 'shape-filter', 'layout-filter', 'language-filter']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
    const bounds = await page.locator(`#${id}`).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await expect(page.locator('#more-filters-trigger')).toContainText('筛选');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile-filter.png') });
  await page.keyboard.press('Escape');
  await page.goto('/logo/alibaba/');
  const card = fileCard(page, 'wordmark-orange.svg');
  await expect(card.locator('.copy-menu-trigger')).toBeEnabled();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog).toHaveCount(0);
  await card.locator('a[download]').scrollIntoViewIfNeeded();
  await expect(card.locator('a[download]')).toBeInViewport();
  const trigger = card.locator('.file-details-link');
  await trigger.click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', /wordmark-orange\.svg$/);
  await expect(dialog.locator('#download-link')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('mobile-detail.png') });
  await page.goto('/logo/yuanbao/?asset=app-icon-dimensional.jpg');
  await expect(dialog.locator('.current-version')).toContainText('立体效果');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await fileCard(page, 'app-icon-flat.png').locator('.file-details-link').click();
  await expect(dialog.locator('.current-version')).toContainText('平面');
});
