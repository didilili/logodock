import { expect, test, type Page } from '@playwright/test';

function fileCard(page: Page, file: string) {
  return page.locator('.artwork-card').filter({
    has: page.locator(`.artwork-visual[data-select-asset="${file}"]`),
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

test('a singleton gallery aligns its preview and actions beside brand information', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/logo/netease/?q=网易');
  const card = page.locator('.artwork-card');
  await expect(card.locator('.copy-menu-trigger')).toBeEnabled();
  await expect(page.locator('.directory-context')).toHaveCount(0);
  await expect(card).toHaveCount(1);
  await expect(card.locator('.artwork-caption h3')).toBeVisible();

  const preview = (await card.locator('.artwork-visual').boundingBox())!;
  const caption = (await card.locator('.artwork-caption').boundingBox())!;
  const download = (await card.locator('a[download]').boundingBox())!;
  const information = (await page.locator('.brand-information').boundingBox())!;
  const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  const website = (await page.locator('.website-link').boundingBox())!;

  expect(preview.x + preview.width).toBeLessThanOrEqual(caption.x);
  expect(preview.y).toBeLessThan(280);
  expect(download.y + download.height).toBeLessThanOrEqual(preview.y + preview.height);
  expect(information.x + information.width).toBeLessThan(preview.x);
  expect(Math.abs(heading.y + heading.height / 2 - website.y - website.height / 2)).toBeLessThan(
    22,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('netease-desktop-layout.png') });

  await card.locator('.file-details-link').click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('.current-version h3')).toBeVisible();
  const canvas = (await dialog.locator('#detail-canvas').boundingBox())!;
  const controls = (await dialog.locator('.asset-controls').boundingBox())!;
  expect(Math.abs(canvas.y - controls.y)).toBeLessThan(8);
  await expect(dialog.locator('#download-link')).toBeInViewport({ ratio: 1 });
});

test('a genuinely narrowed artwork range still exposes all versions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/logo/meituan/?usage=app-icon&asset=wordmark-rounded-google-play.png');
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    /wordmark-rounded-google-play\.png$/,
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.directory-context')).toBeVisible();
  await expect(page.getByRole('radio', { name: '匹配版本', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.artwork-card')).toHaveCount(1);
  await page.getByRole('radio', { name: '全部版本', exact: true }).click();
  await expect(page.locator('.artwork-card')).toHaveCount(3);
  await fileCard(page, 'wordmark-rounded-google-play.png').locator('.file-details-link').click();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    /wordmark-rounded-google-play\.png$/,
  );
});

for (const width of [1440, 1200, 1024, 768, 390]) {
  test(`artwork choices retain readable widths and whole attribute phrases at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/logo/netease-cloud-music/');
    await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
    const list = page.locator('.artwork-grid[aria-label="标识版本"]');
    const metrics = await list.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        gap: Number.parseFloat(style.columnGap) || 0,
        columns: style.gridTemplateColumns.split(/\s+/).length,
        cardWidths: [...element.querySelectorAll('.artwork-card')].map(
          (card) => card.getBoundingClientRect().width,
        ),
        hasInternalScroll: element.scrollHeight > element.clientHeight,
      };
    });
    expect(metrics.cardWidths.length).toBeGreaterThan(1);
    expect(metrics.hasInternalScroll).toBe(false);
    expect(Math.min(...metrics.cardWidths)).toBeGreaterThanOrEqual(260);
    if (metrics.width < 260 * 2 + metrics.gap) expect(metrics.columns).toBe(1);
    await expect(fileCard(page, 'symbol-red.svg').locator('.artwork-attributes')).toContainText(
      '图形提取版',
    );
    const splitAttributes = await list.locator('.artwork-attributes').evaluateAll((elements) =>
      elements.flatMap((element) => {
        const text = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        if (!text?.textContent) return [];
        let offset = 0;
        return text.textContent.split(' · ').flatMap((attribute) => {
          const range = document.createRange();
          range.setStart(text, offset);
          range.setEnd(text, offset + attribute.length);
          offset += attribute.length + 3;
          const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
          return lines.size > 1 ? [attribute] : [];
        });
      }),
    );
    expect(splitAttributes).toEqual([]);
    await expectNoHorizontalOverflow(page);
    if (width === 1440)
      await page.screenshot({ path: testInfo.outputPath('cloud-music-artwork-widths.png') });

    await list.locator('.file-details-link').first().click();
    const dialog = page.locator('.preview-dialog[role="dialog"]');
    await expect(dialog.locator('.current-version h3')).toBeVisible();
    if (width > 720) {
      const preview = (await dialog.locator('.preview-stage').boundingBox())!;
      const controls = (await dialog.locator('.asset-controls').boundingBox())!;
      expect(preview.width / controls.width).toBeCloseTo(1.35, 1);
    }
    await expectNoHorizontalOverflow(page);
  });

  test(`selecting the final artwork preserves its gallery position and focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/logo/insta360/');
    await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
    await expect(page.locator('.artwork-card:visible')).toHaveCount(6);
    const more = page.locator('.artwork-more');
    const moreTrigger = more.locator('.artwork-more-trigger');
    await expect(moreTrigger).toHaveAttribute('aria-expanded', 'false');
    await moreTrigger.click();
    await expect(moreTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveAttribute('data-state', 'open');
    const list = more.locator('.artwork-grid[aria-label="更多标识版本"]');
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    );
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      false,
    );
    const lastOption = list.locator('.file-details-link').last();
    const file = await lastOption.getAttribute('data-select-asset');
    await lastOption.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await lastOption.click();
    const dialog = page.locator('.preview-dialog[role="dialog"]');
    await expect(dialog.locator('#detail-image')).toHaveAttribute('src', `/logo/insta360/${file}`);
    await expect(dialog.locator('#download-link')).toHaveAttribute(
      'href',
      `/logo/insta360/${file}`,
    );
    await expect(dialog.locator('.current-version h3')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(moreTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveAttribute('data-state', 'open');
    await expect(lastOption).toBeFocused();
    await expect(lastOption).toBeInViewport({ ratio: 1 });
    expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
    await expect(fileCard(page, file!).locator('a[download]')).toHaveAttribute(
      'href',
      `/logo/insta360/${file}`,
    );
    await lastOption.press('Enter');
    await expect(dialog.locator('#detail-image')).toHaveAttribute('src', `/logo/insta360/${file}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(lastOption).toBeFocused();
  });
}

test('English legal identity stays visible after artwork details and browser back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/logo/insta360/');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  const englishSubject = page
    .locator('.brand-subjects .subject-english')
    .getByText('Arashi Vision Inc.', { exact: true });
  await expect(englishSubject).toBeVisible();
  const nextOption = page.locator('.artwork-grid[aria-label="标识版本"] .file-details-link').nth(1);
  const file = await nextOption.getAttribute('data-select-asset');
  await nextOption.click();
  const dialog = page.locator('.preview-dialog[role="dialog"]');
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', `/logo/insta360/${file}`);
  await expect(englishSubject).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(englishSubject).toBeVisible();
  await expect(nextOption).toBeFocused();
});

for (const width of [1024, 768]) {
  test(`medium-width six-artwork galleries keep downloading and the final file accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/logo/alibaba/');
    await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
    const list = page.locator('.artwork-grid[aria-label="标识版本"]');
    const options = list.locator('.artwork-card');
    await expect(options).toHaveCount(6);
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      false,
    );
    const listBounds = (await list.boundingBox())!;
    expect(listBounds.width).toBeGreaterThanOrEqual(260);
    await expect(options.first().locator('a[download]')).toBeInViewport({ ratio: 1 });

    const lastOption = options.last().locator('.file-details-link');
    const file = await lastOption.getAttribute('data-select-asset');
    await lastOption.click();
    const dialog = page.locator('.preview-dialog[role="dialog"]');
    await expect(dialog.locator('#detail-image')).toHaveAttribute('src', `/logo/alibaba/${file}`);
    await expect(dialog.locator('#download-link')).toHaveAttribute('href', `/logo/alibaba/${file}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(lastOption).toBeFocused();
    await expect(lastOption).toBeInViewport({ ratio: 1 });
    const currentListBounds = (await list.boundingBox())!;
    const selectedBounds = (await lastOption.boundingBox())!;
    expect(selectedBounds.y).toBeGreaterThanOrEqual(currentListBounds.y);
    expect(selectedBounds.y + selectedBounds.height).toBeLessThanOrEqual(
      currentListBounds.y + currentListBounds.height,
    );
  });
}

for (const width of [390, 320]) {
  test(`mobile galleries prioritize downloading and restore focus after file details at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/logo/netease/?q=网易');
    await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
    const download = page.locator('.artwork-card a[download]');
    await expect(download).toBeInViewport({ ratio: 1 });
    const downloadBounds = (await download.boundingBox())!;
    const informationBounds = (await page.locator('.brand-information').boundingBox())!;
    expect(informationBounds.y).toBeGreaterThanOrEqual(downloadBounds.y + downloadBounds.height);
    const information = page.locator('.brand-information');
    await expect(information.getByText('NetEase, Inc.', { exact: true })).toBeVisible();
    const classification = page.getByRole('navigation', { name: '品牌分类', exact: true });
    await expect(classification.getByRole('link').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath('netease-mobile-layout.png'),
        fullPage: true,
      });

    await page.goto('/logo/alibaba/');
    const card = fileCard(page, 'wordmark-orange.svg');
    await expect(card.locator('.copy-menu-trigger')).toBeEnabled();
    const dialog = page.locator('.preview-dialog[role="dialog"]');
    await expect(dialog).toHaveCount(0);
    const trigger = card.locator('.file-details-link');
    await trigger.click();
    await expect(dialog.locator('#download-link')).toHaveAttribute('href', /wordmark-orange\.svg$/);
    await expect(dialog.locator('#download-link')).toBeInViewport({ ratio: 1 });
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toBeInViewport({ ratio: 1 });
    await expect(card.locator('a[download]')).toHaveAttribute('href', /wordmark-orange\.svg$/);
  });
}

test('long Chinese and English legal names remain readable in the narrow dark layout', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/logo/deepseek/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const information = page.locator('.brand-information');
  await expect(
    information.getByText('杭州深度求索人工智能基础技术研究有限公司', { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('long-chinese-identity-dark.png'),
    fullPage: true,
  });

  await page.goto('/logo/icbc/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page
      .locator('.brand-subjects .subject-english')
      .getByText('Industrial and Commercial Bank of China Limited', { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath('long-english-identity-dark.png'),
    fullPage: true,
  });
});
