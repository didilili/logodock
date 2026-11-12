import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { directoryPreviewBounds } from '../../src/lib/catalog-preview.mjs';
import { isAlternativeArtwork, selectedArtwork } from '../../src/lib/catalog-artworks.mjs';
import { assetDownloadName, directoryAsset } from '../../src/lib/catalog-presentation.mjs';
import type { Catalog } from '../../src/lib/types';

const catalog = JSON.parse(
  await readFile(new URL('../../index.json', import.meta.url), 'utf8'),
) as Catalog;

function fileDetails(page: Page) {
  return page.locator('.preview-dialog[role="dialog"]');
}

async function openGallery(page: Page) {
  const dialog = fileDetails(page);
  if (new URL(page.url()).searchParams.has('asset')) await expect(dialog).toBeVisible();
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: '关闭文件详情', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  }
  const gallery = page.getByRole('region', { name: '标识素材', exact: true });
  await expect(gallery.locator('.copy-menu-trigger').first()).toBeEnabled();
  return gallery;
}

async function openFileDetails(page: Page, file: string) {
  const gallery = await openGallery(page);
  const trigger = gallery.locator(`.artwork-visual[data-select-asset="${file}"]`);
  if (!(await trigger.isVisible())) {
    const id = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
    const brand = catalog.brands.find((entry) => entry.id === id)!;
    const asset = brand.assets.find((entry) => entry.file === file)!;
    const artwork = selectedArtwork(brand, asset);
    const disclosure = gallery.locator(
      isAlternativeArtwork(artwork) ? '.artwork-alternatives-trigger' : '.artwork-more-trigger',
    );
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  }
  await trigger.click();
  const dialog = fileDetails(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#detail-copy-menu')).toBeEnabled();
  await expect(dialog.locator('#detail-image')).toHaveAttribute(
    'src',
    new RegExp(`/${file.replaceAll('.', '\\.')}$`),
  );
  return dialog;
}

async function openDefaultDetails(page: Page) {
  const id = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
  const brand = catalog.brands.find((entry) => entry.id === id)!;
  return openFileDetails(page, brand.defaultAsset);
}

async function reopenThroughHistory(page: Page) {
  await page.goBack();
  await expect(fileDetails(page)).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  await page.goForward();
  await expect(fileDetails(page)).toBeVisible();
}

async function openSourceDetails(page: Page) {
  const sources = fileDetails(page).locator('.source-details');
  await expect(sources).toHaveAttribute('data-state', 'open');
  await sources.locator('[data-resource-trigger="source"]').click();
  await expect(sources).toHaveAttribute('data-state', 'closed');
  await sources.locator('[data-resource-trigger="source"]').click();
  await expect(sources).toHaveAttribute('data-state', 'open');
}

async function expectMinimumHeight(controls: Locator, minimum: number) {
  await expect(controls.first()).toBeVisible();
  const undersized = await controls.evaluateAll(
    (elements, height) =>
      elements.flatMap((element) => {
        const actual = element.getBoundingClientRect().height;
        return actual < height
          ? [
              {
                control:
                  element.id || element.getAttribute('aria-label') || element.textContent?.trim(),
                height: actual,
              },
            ]
          : [];
      }),
    minimum,
  );
  expect.soft(undersized, `visible controls should be at least ${minimum}px high`).toEqual([]);
}

async function expectTypography(controls: Locator, size: number) {
  await expect(controls.first()).toBeVisible();
  const typography = await controls.evaluateAll((elements) => {
    const bodyFont = getComputedStyle(document.body).fontFamily;
    return elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        size: style.fontSize,
        usesBodyFont: style.fontFamily === bodyFont,
      };
    });
  });
  expect
    .soft(typography)
    .toEqual(typography.map(() => ({ size: `${size}px`, usesBodyFont: true })));
}

async function expectFilterTypography(page: Page) {
  await expectTypography(
    page.locator('#usage-filter, #shape-filter, #layout-filter, #language-filter'),
    14,
  );
  await expectTypography(page.locator('#format-filter [data-format]'), 12);
  await expectTypography(page.locator('#more-filters-trigger'), 12);
}

async function expectCardTypography(page: Page, nameSize: number, actionSize = 13) {
  await expectTypography(page.locator('.brand-identity h2'), nameSize);
  await expectTypography(page.locator('.card-download, .card-copy'), actionSize);
  await expectTypography(page.locator('.brand-english'), 12);
}

async function expectGridColumns(page: Page, count: number) {
  await expect(page.locator('#brand-grid')).toBeVisible();
  const columns = await page
    .locator('#brand-grid')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(/\s+/).length);
  expect(columns).toBe(count);
}

async function expectKeyboardFocus(control: Locator) {
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      width: Number.parseFloat(style.outlineWidth),
      style: style.outlineStyle,
      color: style.outlineColor,
      background: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).not.toBe('none');
  expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(focus.color).not.toBe(focus.background);
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.content).toBe(width.viewport);
  expect(width.viewport).toBe(page.viewportSize()?.width);
}

async function expectSourceLink(page: Page, label: string, href: string) {
  const source = page.locator('#detail-source-link');
  await expect(source).toHaveText('来源');
  await expect(source).toHaveAccessibleName('来源');
  await expect(source).toHaveAttribute('href', href);
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(
    page.locator('#detail-fileinfo').locator('..').locator('#detail-source-link'),
  ).toHaveCount(1);
  await expectMinimumHeight(source, 36);
  expect(
    await source.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(40);
  await source.focus();
  await expect(page.getByRole('tooltip')).toHaveText(label);
  await page.locator('#download-link').focus();
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoHorizontalOverflow(page);
}

async function openExtraFilters(page: Page) {
  const trigger = page.locator('#more-filters-trigger');
  const opening = (await trigger.getAttribute('aria-expanded')) !== 'true';
  if (opening) await trigger.click();
  const panel = page.getByRole('dialog', { name: '筛选', exact: true });
  await expect(panel).toBeVisible();
  if (opening) await expect(page.locator('#type-filter')).toBeFocused();
  return panel;
}

async function expectEntirelyInViewport(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.x >= -1 &&
          bounds.y >= -1 &&
          bounds.right <= window.innerWidth + 1 &&
          bounds.bottom <= window.innerHeight + 1
        );
      }),
    )
    .toBe(true);
}

test('directory uses wider screens while keeping filtered cards at the same size', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  for (const [width, columns] of [
    [721, 3],
    [1050, 3],
    [1462, 4],
    [1920, 6],
    [2376, 8],
    [2560, 8],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectGridColumns(page, columns);
    const layout = await page.locator('.directory-layout').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, left: bounds.left };
    });
    expect(layout.width).toBe(Math.min(width, 2200));
    expect(layout.left).toBe((width - layout.width) / 2);
    const header = await page.locator('.site-header-inner').boundingBox();
    expect(header?.x).toBe(layout.left);
    expect(header?.width).toBe(layout.width);
    const brand = await page.locator('.brand-mark').boundingBox();
    const sidebar = await page.locator('.category-sidebar').boundingBox();
    const search = await page.locator('.search-form').boundingBox();
    const description = await page.locator('.wordmark-description').boundingBox();
    const sidebarInset = width <= 1050 ? 9 : 15;
    expect(brand!.x).toBe(sidebar!.x + sidebarInset);
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width - sidebarInset);
    expect(description?.x).toBe(search?.x);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 2376, height: 1000 });
  const unfilteredCardWidth = await page
    .locator('#brand-grid > .brand-card')
    .first()
    .evaluate((element) => element.getBoundingClientRect().width);
  await page.locator('#search').fill('阿里巴巴');
  await expect(page.locator('#brand-grid > .brand-card')).toHaveCount(1);
  await expectGridColumns(page, 8);
  const cardWidth = await page
    .locator('#brand-grid > .brand-card')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(cardWidth).toBeGreaterThanOrEqual(220);
  expect(cardWidth).toBeCloseTo(unfilteredCardWidth, 1);
});

test('reviewed directory preview bounds keep artwork centered and fully visible on desktop and mobile', async ({
  page,
}) => {
  for (const width of [390, 2048]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    for (const id of [
      'antgroup',
      'baidu',
      'nio',
      'tencent-music',
      'bytedance',
      'haier',
      'huawei',
      'weibo',
      'honor',
      'zte',
    ]) {
      const brand = catalog.brands.find((item) => item.id === id)!;
      const asset = directoryAsset(brand);
      const bounds = directoryPreviewBounds(asset);
      expect(bounds, `${id} still uses its reviewed source`).toBeDefined();
      if (!bounds) throw new Error(`Missing reviewed preview bounds for ${id}`);

      const card = page.locator(`.brand-card[data-brand="${id}"]`);
      await expect(card.locator('.brand-art')).toHaveAttribute('data-shape', 'horizontal');
      const image = card.locator('.brand-art img');
      await expect(image).toHaveAttribute('src', `/logo/${id}/${asset.file}`);
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
      const rendered = await image.evaluate((element: HTMLImageElement) => {
        const imageRect = element.getBoundingClientRect();
        const frameRect = element.closest('.preview-frame')!.getBoundingClientRect();
        return {
          image: {
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
          },
          frame: {
            left: frameRect.left,
            top: frameRect.top,
            right: frameRect.right,
            bottom: frameRect.bottom,
            width: frameRect.width,
            height: frameRect.height,
          },
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
        };
      });
      const context = `${id} at ${width}px`;
      expect(rendered.naturalWidth, context).toBe(bounds.sourceWidth);
      expect(Math.abs(rendered.naturalHeight - bounds.sourceHeight), context).toBeLessThanOrEqual(
        1,
      );
      expect(rendered.image.width / rendered.image.height, context).toBeCloseTo(
        bounds.sourceWidth / bounds.sourceHeight,
        2,
      );

      const scaleX = rendered.image.width / bounds.sourceWidth;
      const scaleY = rendered.image.height / bounds.sourceHeight;
      const artwork = {
        left: rendered.image.left + bounds.x * scaleX,
        top: rendered.image.top + bounds.y * scaleY,
        width: bounds.width * scaleX,
        height: bounds.height * scaleY,
      };
      expect(artwork.left, context).toBeGreaterThanOrEqual(rendered.frame.left - 1);
      expect(artwork.top, context).toBeGreaterThanOrEqual(rendered.frame.top - 1);
      expect(artwork.left + artwork.width, context).toBeLessThanOrEqual(rendered.frame.right + 1);
      expect(artwork.top + artwork.height, context).toBeLessThanOrEqual(rendered.frame.bottom + 1);
      expect(artwork.width, context).toBeGreaterThanOrEqual(110);
      expect(artwork.width, context).toBeLessThanOrEqual(rendered.frame.width + 1);
      expect(
        Math.abs(
          artwork.left + artwork.width / 2 - (rendered.frame.left + rendered.frame.width / 2),
        ),
        context,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          artwork.top + artwork.height / 2 - (rendered.frame.top + rendered.frame.height / 2),
        ),
        context,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('desktop filters use readable control sizing and keyboard focus stays visible in both themes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('radiogroup', { name: '文件格式', exact: true })).toBeVisible();
  await expectMinimumHeight(page.locator('#format-filter button'), 40);
  const sidebar = page.locator('.category-sidebar');
  await expectMinimumHeight(
    sidebar.locator(
      '.category-tree > [data-category], .category-parent > [data-category], .category-expand',
    ),
    40,
  );
  const expand = sidebar.locator('[data-expand]').first();
  const children = sidebar.locator('.category-children').first();
  await expect(children).toBeHidden();
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(children).toBeVisible();
  await expectMinimumHeight(sidebar.locator('.category-child:visible'), 35);
  await expectMinimumHeight(sidebar.locator('[data-topic]'), 36);
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(children).toBeHidden();
  await expectMinimumHeight(page.locator('.card-download, .card-copy'), 44);
  await openExtraFilters(page);
  await expectMinimumHeight(page.getByRole('combobox'), 36);
  await expectFilterTypography(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#extra-filter-panel')).toBeHidden();
  await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
  const palettes: string[] = [];
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.locator('#theme-toggle').click();
      await expect(page.locator('#extra-filter-panel')).toBeHidden();
      await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('#theme-toggle')).toHaveAttribute(
      'aria-label',
      theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
    );
    await page.locator('#search').focus();
    await page.keyboard.press('Tab');
    await expectKeyboardFocus(page.locator('#format-filter [data-format=""]'));
    await page.locator('#more-filters-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '筛选', exact: true })).toBeVisible();
    await expectKeyboardFocus(page.locator('#type-filter'));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(page.getByRole('dialog', { name: '筛选', exact: true })).toBeVisible();
    await expectKeyboardFocus(page.locator('#type-filter'));
    await page.keyboard.press('Escape');
    await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#extra-filter-panel')).toBeHidden();
    await expectKeyboardFocus(page.locator('#more-filters-trigger'));
    await expectGridColumns(page, 5);
    await expectCardTypography(page, 14);
    await expectNoHorizontalOverflow(page);
    palettes.push(
      await page
        .locator('.brand-card')
        .first()
        .evaluate(
          (element) =>
            `${getComputedStyle(element).backgroundColor}/${getComputedStyle(element).color}`,
        ),
    );
  }
  expect(palettes[0]).not.toBe(palettes[1]);

  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('#download-link'), 44);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await openGallery(page);
      await page.locator('#theme-toggle').click();
      await openFileDetails(page, 'wordmark-orange.svg');
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.locator('#download-link').focus();
    await page.keyboard.press('Tab');
    await expectKeyboardFocus(page.locator('#download-options'));
    await page.keyboard.press('Tab');
    await expectKeyboardFocus(page.locator('#detail-copy-menu'));
  }
});

test('390px home and Alibaba detail retain usable targets without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('button:visible'), 40);
  await expectMinimumHeight(page.locator('.card-download, .card-copy'), 44);
  await openExtraFilters(page);
  await expectFilterTypography(page);
  await expectCardTypography(page, 13, 12);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.locator('#theme-toggle').click();
      await expect(page.locator('#extra-filter-panel')).toBeHidden();
      await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
    }
    await expectGridColumns(page, 2);
    await expectNoHorizontalOverflow(page);
  }

  await openExtraFilters(page);
  await page.locator('#color-filter').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.locator('#extra-filter-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#extra-filter-panel')).toBeHidden();
  await page.locator('#format-filter [data-format="PNG"]').click();
  await expect(page.locator('#extra-filter-panel')).toBeHidden();
  await expect(page.locator('#format-filter [data-format="PNG"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.brand-card').first()).toBeVisible();
  for (const download of await page.locator('.brand-card .card-download').all()) {
    await expect(download).toContainText('下载 PNG');
    await expect(download).toHaveAttribute('href', /\.png$/);
  }
  await expectNoHorizontalOverflow(page);

  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const versions = await openGallery(page);
  await expectMinimumHeight(page.locator('button:visible'), 40);
  await expectMinimumHeight(versions.locator('.artwork-visual:visible'), 44);
  await openFileDetails(page, 'wordmark-orange.svg');
  await expectMinimumHeight(page.locator('#download-link'), 44);
  await expect(page.locator('.format-choices, #export-size, .export-details')).toHaveCount(0);
  await expectMinimumHeight(page.locator('#download-options'), 44);
  await expectNoHorizontalOverflow(page);
  await openFileDetails(page, 'wordmark-orange-chinese.svg');
  const downloadOptions = page.locator('#download-options');
  await expectMinimumHeight(downloadOptions, 44);
  await downloadOptions.focus();
  await page.keyboard.press('Enter');
  const downloadMenu = page.getByRole('menu');
  await expect(downloadMenu).toBeVisible();
  await expectMinimumHeight(downloadMenu.locator('[data-download-kind="png"]'), 44);
  await expectEntirelyInViewport(downloadMenu);
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(downloadMenu).toBeHidden();
  await expectKeyboardFocus(downloadOptions);
});

test('landscape extra filters stay reachable and nested selects close one layer at a time', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?type=company&shape=wordmark&format=SVG&color=black');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const panel = await openExtraFilters(page);
  await expectEntirelyInViewport(panel);
  await expect(page.locator('#shape-filter')).toHaveText('字标');
  await expect(page.locator('#color-filter')).toHaveText('黑色');
  await expect(page.locator('#type-filter')).toHaveText('公司');
  await page.locator('#color-filter').click();
  const options = page.getByRole('listbox');
  await expect(options).toBeVisible();
  await page.getByRole('option', { name: '白色', exact: true }).click();
  await expect(options).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(page.locator('#color-filter')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('color')).toBe('white');
  await page.locator('#color-filter').press('Enter');
  await expect(options).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(page.locator('#color-filter')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#more-filters-trigger')).toBeFocused();
  await openExtraFilters(page);
  const reset = panel.locator('#clear-filters');
  await reset.scrollIntoViewIfNeeded();
  await expectEntirelyInViewport(reset);
  await expectEntirelyInViewport(panel);
  await reset.click();
  await expect(page.locator('#color-filter')).toHaveText('全部配色');
  await expect(page.locator('#type-filter')).toHaveText('全部类型');
  await expect(page.locator('#format-filter [data-format=""]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(new URL(page.url()).searchParams.has('color')).toBe(false);
  expect(new URL(page.url()).searchParams.has('type')).toBe(false);
  expect(new URL(page.url()).searchParams.has('format')).toBe(false);
  await expectNoHorizontalOverflow(page);
});

test('empty results reset every filter and manual copy remains readonly with recoverable focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      },
    });
  });
  await page.goto('/?q=NoSuchBrand&type=company&format=SVG&shape=wordmark&category=internet');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#more-filters-trigger').click();
  await expectMinimumHeight(
    page.locator('#reset-search:visible, #clear-search:visible, #clear-filters:visible'),
    40,
  );
  await page.locator('#more-filters-trigger').click();
  await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '清除搜索与筛选', exact: true }).click();
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#search')).toHaveValue('');
  await openExtraFilters(page);
  await expect(page.locator('#shape-filter')).toHaveText('全部构成');
  await expect(page.locator('#format-filter [data-format=""]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('#type-filter')).toHaveText('全部类型');
  await expect(page.locator('.directory-title h1')).toHaveText('全部品牌');
  await expect(page.locator('#empty-state')).toBeHidden();
  expect(new URL(page.url()).search).toBe('');
  await page.keyboard.press('Escape');

  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const copy = page.locator('#detail-copy-menu');
  await copy.click();
  const currentAddress = page.locator('[data-copy-kind="current"]');
  await expect(currentAddress).toHaveRole('menuitem');
  await expectMinimumHeight(currentAddress, 44);
  await currentAddress.click();
  const manual = page.getByRole('textbox', { name: '手动复制', exact: true });
  await expect(manual).toBeFocused();
  await expect(manual).toHaveJSProperty('readOnly', true);
  const address = await manual.inputValue();
  expect(address).toBe(
    new URL((await page.locator('#download-link').getAttribute('href')) || '', page.url()).href,
  );
  expect(
    await manual.evaluate((element: HTMLTextAreaElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([0, address.length]);
  await manual.press('x');
  await expect(manual).toHaveValue(address);
  await expectMinimumHeight(page.locator('#dismiss-feedback'), 40);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '关闭复制提示' }).click();
  await expect(manual).toBeHidden();
  await expect(copy).toBeFocused();
});

test('cards keep usage restrictions visible and details disclose useful material differences', async ({
  page,
}) => {
  await page.goto('/');
  const gitlab = page
    .getByRole('article')
    .filter({ has: page.locator('[data-brand-link="gitlab"]') });
  for (const width of [1760, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(gitlab).toBeVisible();
    const row = await page.locator('.brand-card').evaluateAll((cards) => {
      const gitlabCard = cards.find((card) => card.getAttribute('data-brand') === 'gitlab')!;
      const gitlabTop = gitlabCard.getBoundingClientRect().top;
      return cards
        .filter((card) => Math.abs(card.getBoundingClientRect().top - gitlabTop) < 1)
        .map((card) => ({
          brand: card.getAttribute('data-brand'),
          actionsTop: card.querySelector('.card-actions')!.getBoundingClientRect().top,
        }));
    });
    expect(row.length).toBeGreaterThan(1);
    const actionTops = row.map((card) => card.actionsTop);
    expect
      .soft(
        Math.max(...actionTops) - Math.min(...actionTops),
        `GitLab's row actions should align at ${width}px: ${JSON.stringify(row)}`,
      )
      .toBeLessThanOrEqual(1);
  }
  await expect(gitlab.locator('.brand-link')).toHaveAccessibleName(/^查看 GitLab，/);
  await expect(gitlab.locator('.brand-art img')).toHaveAttribute(
    'src',
    /logo-color-official\.svg$/,
  );
  await expect(gitlab.locator('.card-download')).toHaveAttribute(
    'href',
    /logo-color-official\.svg$/,
  );
  expect(
    new URL(
      (await gitlab.locator('.brand-link').getAttribute('href')) || '',
      page.url(),
    ).searchParams.get('asset'),
  ).toBe(null);
  await expect(gitlab.locator('.card-warning')).toHaveCount(0);

  const zte = page.getByRole('article').filter({ has: page.locator('[data-brand-link="zte"]') });
  await expect(zte.locator('.brand-link')).toHaveAccessibleName(/^查看 中兴通讯，/);
  await expect(zte.locator('.card-download')).toHaveAttribute(
    'href',
    /wordmark-blue-official\.png$/,
  );

  await zte.locator('.brand-link').click();
  await expect(page).toHaveURL(/\/logo\/zte\//);
  await openDefaultDetails(page);
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /wordmark-blue-official\.png$/,
  );
  const sources = page.locator('.source-details');
  await expect(sources).toHaveAttribute('data-state', 'open');
  const notes = page.locator('.asset-controls .asset-warnings li');
  await expect(notes).not.toHaveCount(0);
  for (const note of await notes.all()) await expect(note).toBeVisible();
  await expect(page.locator('.asset-controls')).toContainText('留白');
  await expect(page.locator('.asset-controls')).toContainText('#0086D1');
  await expect(page.locator('.asset-controls')).toContainText('#008ED3');
  await openSourceDetails(page);
  await expect(sources).not.toContainText('zte_logo_en/');
  await sources.locator('[data-resource-trigger="source"]').click();
  await expect(sources).toHaveAttribute('data-state', 'closed');
  for (const note of await notes.all()) await expect(note).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`detail controls stay concise and file descriptions remain accurate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const panel = page.locator('.asset-controls');
    const fileInfo = page.locator('#detail-fileinfo');
    const sources = page.locator('.source-details');
    const download = page.locator('#download-link');

    await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
    await expect(page.locator('#detail-copy-menu')).toBeEnabled();
    await expect(fileInfo.locator('span')).toHaveCount(0);
    await expect(panel.locator('.asset-description')).toHaveCount(0);
    await expect(page.locator('.preview-note, .single-format')).toHaveCount(0);
    const gallery = await openGallery(page);
    for (const [file, language] of [
      ['wordmark-orange.svg', '英文'],
      ['wordmark-orange-chinese.svg', '中文'],
    ]) {
      const card = gallery.locator('.artwork-card').filter({
        has: page.locator(`.artwork-visual[data-select-asset="${file}"]`),
      });
      await expect(card.getByRole('heading')).toHaveText(`${language}字标`);
      await expect(card.locator('.artwork-attributes')).toContainText('横向');
      await expect(card.locator('a[download]')).toHaveText('下载 SVG');
    }
    await expect(gallery).toHaveAccessibleName('标识素材');
    await expect(gallery).not.toContainText('品牌色');
    await openFileDetails(page, 'wordmark-orange.svg');
    await expect(panel.locator('.current-version h3')).toHaveText('英文字标');
    await expect(
      fileDetails(page).getByText('背景仅用于预览，下载保留原始文件。', { exact: true }),
    ).toBeVisible();

    await expect(page.locator('.format-choices')).toHaveCount(0);
    await openSourceDetails(page);
    for (const file of [
      'wordmark-orange.svg',
      'wordmark-orange-chinese.svg',
      'wordmark-orange.svg',
    ]) {
      await openFileDetails(page, file);
      await expect(download).toHaveAttribute('href', new RegExp(`/${file.replace('.', '\\.')}$`));
      await expect(fileInfo).toContainText('SVG');
      await expect(fileInfo.locator('span')).toHaveCount(0);
      await expect(panel.locator('.asset-description, .asset-warnings')).toHaveCount(0);
      await expect(sources).toHaveAttribute('data-state', 'open');
      await expect(sources).toContainText('Wikimedia Commons · 原始文件');
    }
    await expectNoHorizontalOverflow(page);

    await page.goto('/logo/xiaohongshu/');
    await openDefaultDetails(page);
    await expect(download).toHaveAttribute('href', /wordmark-capsule-official\.svg$/);
    await expect(panel.locator('.asset-description')).toHaveText('透明圆角。');
    await openFileDetails(page, 'wordmark-rounded-google-play.png');
    await expect(panel.locator('.asset-description')).toHaveText('四角透明。');
    await expect(panel.locator('.asset-warnings')).toHaveCount(0);
    await expect(fileInfo).toContainText('512 × 512');
    await expect(fileInfo.locator('span')).toHaveCount(0);
    await expect(page.locator('.file-section')).toHaveCount(0);
    await expect(panel).not.toContainText('artworkUrl512');
    await expect(panel).not.toContainText('Commons');
    await expect(download).toHaveAttribute('href', /wordmark-rounded-google-play\.png$/);
    const downloaded = page.waitForEvent('download');
    await download.click();
    const xiaohongshu = catalog.brands.find((brand) => brand.id === 'xiaohongshu')!;
    const applicationIcon = xiaohongshu.assets.find(
      (asset) => asset.file === 'wordmark-rounded-google-play.png',
    )!;
    expect((await downloaded).suggestedFilename()).toBe(
      assetDownloadName(xiaohongshu, applicationIcon),
    );

    await page.goto('/logo/tencent/');
    await openDefaultDetails(page);
    await expect(page.locator('.format-choices, .single-format')).toHaveCount(0);
    await expect(panel.locator('.asset-description')).toContainText('留白');
    await expect(panel.locator('.asset-description')).toContainText('2763');
    await expect(page.locator('.file-options')).toHaveCount(0);
    for (const [file, color] of [
      ['wordmark-black-official.png', '黑色'],
      ['wordmark-white-official.png', '白色'],
    ]) {
      await openFileDetails(page, file);
      await expect(download).toHaveAttribute('href', new RegExp(`/${file.replace('.', '\\.')}$`));
      await expect(panel.locator('.current-version h3')).toHaveText('中英双语字标');
      await expect(panel.locator('.current-version > p').first()).toHaveText(`横向 · ${color}`);
      await expect(panel.locator('.asset-description')).toHaveText('透明背景，上下留白较多。');
      await expect(panel.locator('.asset-description')).not.toContainText('2763');
      await expect(fileInfo).toContainText('PNG');
    }

    await page.goto('/logo/zte/');
    await openDefaultDetails(page);
    await expect(panel.locator('.asset-description')).toContainText('留白');
    await expect(panel.locator('.asset-warnings')).toContainText('#0086D1');
    await expect(panel.locator('.asset-warnings')).toContainText('#008ED3');
    await expect(sources).toHaveAttribute('data-state', 'open');
    const zteVersions = await openGallery(page);
    const alternatives = zteVersions.locator('.artwork-alternatives');
    await alternatives.locator('.artwork-alternatives-trigger').click();
    await alternatives
      .locator('.artwork-visual[data-select-asset="wordmark-blue-header-official.png"]')
      .click();
    await expect(fileInfo).toContainText('92 × 44');
    await expect(fileInfo).toContainText('备选文件');
    await expect(panel.locator('.asset-description')).toContainText('#008ED3');
    await expect(panel.locator('.asset-warnings')).toContainText('低分辨率');
    await expect(panel.locator('.asset-warnings')).not.toContainText('#0086D1');
    await expect(download).toHaveAttribute('href', /wordmark-blue-header-official\.png$/);
    await expectNoHorizontalOverflow(page);

    await page.goto('/logo/gitlab/?asset=icon-legacy.png');
    await expect(panel.locator('.asset-warnings')).toContainText('历史素材');
    await expect(panel.locator('.asset-warnings')).toContainText('仅限非商业用途');
  });

  test(`current-file sources and disclosure preferences follow selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const sources = page.locator('.source-details');
    const license = page.locator('#detail-license-link');
    const download = page.locator('#download-link');
    const kuaishouSource = 'https://www.kuaishou.com/official/material-lib';
    const alibabaSource = 'https://commons.wikimedia.org/wiki/File:Alibaba_en_logo.svg';
    const alibabaChineseSource = 'https://commons.wikimedia.org/wiki/File:Alibaba_zh_logo.svg';
    const tencentSource = 'https://www.tencent.com/zh-cn/newsroom/media-resources/';
    const tencentBlue =
      'https://www.tencent.com/wp-content/uploads/2022/12/01_Tencent_Standard-Logo.png';
    const tencentBlack =
      'https://www.tencent.com/wp-content/uploads/2022/12/01_Tencent_Logo_Black.png';
    const tencentWhite =
      'https://www.tencent.com/wp-content/uploads/2022/12/01_Tencent_Logo_Reverse-type.png';
    const sourceFile = sources.getByRole('link', {
      name: '查看来源文件',
      exact: true,
      includeHidden: true,
    });

    await page.goto('/logo/kuaishou/');
    await openDefaultDetails(page);
    await expect(page.locator('#detail-copy-menu')).toBeEnabled();
    await expectSourceLink(page, '官方品牌素材下载页', kuaishouSource);
    await openSourceDetails(page);
    await expect(license).toHaveText('Commons 公共领域判定');
    await expect(license).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/w/index.php?title=File:Kuaishou_logo.png&oldid=686719154',
    );
    await openFileDetails(page, 'logo-english-official.jpg');
    await expect(download).toHaveAttribute('href', /logo-english-official\.jpg$/);
    await expectSourceLink(page, '官方品牌素材下载页', kuaishouSource);
    await expect(sources).toHaveAttribute('data-state', 'open');
    await sources.locator('[data-resource-trigger="source"]').click();
    await openFileDetails(page, 'icon-orange-official.png');
    await expect(download).toHaveAttribute('href', /icon-orange-official\.png$/);
    await expect(sources).toHaveAttribute('data-state', 'closed');
    await reopenThroughHistory(page);
    await expect(download).toHaveAttribute('href', /icon-orange-official\.png$/);
    await expectSourceLink(page, '官方品牌素材下载页', kuaishouSource);
    await expect(sources).toHaveAttribute('data-state', 'closed');

    await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
    await expectSourceLink(page, 'Commons', alibabaSource);
    await openSourceDetails(page);
    await expect(license).toHaveText('Commons 公共领域判定');
    await expect(license).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/w/index.php?title=File%3AAlibaba_en_logo.svg&oldid=1115285514',
    );
    await openFileDetails(page, 'wordmark-orange-chinese.svg');
    await expect(download).toHaveAttribute('href', /wordmark-orange-chinese\.svg$/);
    await expectSourceLink(page, 'Commons', alibabaChineseSource);
    await expect(sources).toHaveAttribute('data-state', 'open');
    await reopenThroughHistory(page);
    await expect(download).toHaveAttribute('href', /wordmark-orange-chinese\.svg$/);
    await expectSourceLink(page, 'Commons', alibabaChineseSource);
    await expect(sources).toHaveAttribute('data-state', 'open');
    await sources.locator('[data-resource-trigger="source"]').click();
    await openFileDetails(page, 'wordmark-orange-chinese.svg');
    await expect(download).toHaveAttribute('href', /wordmark-orange-chinese\.svg$/);
    await expectSourceLink(page, 'Commons', alibabaChineseSource);
    await expect(sources).toHaveAttribute('data-state', 'closed');
    await reopenThroughHistory(page);
    await expect(download).toHaveAttribute('href', /wordmark-orange-chinese\.svg$/);
    await expectSourceLink(page, 'Commons', alibabaChineseSource);
    await expect(sources).toHaveAttribute('data-state', 'closed');

    await page.goto('/logo/tencent/');
    await openDefaultDetails(page);
    await expectSourceLink(page, '官方品牌素材下载页', tencentSource);
    await expect(page.locator('.format-choices, .file-options')).toHaveCount(0);
    await openSourceDetails(page);
    await expect(license).toHaveText('Commons 公共领域判定');
    await expect(sourceFile).toHaveAttribute('href', tencentBlue);
    await openFileDetails(page, 'wordmark-black-official.png');
    await expect(download).toHaveAttribute('href', /wordmark-black-official\.png$/);
    await expectSourceLink(page, '官方品牌素材下载页', tencentSource);
    await expect(sourceFile).toHaveAttribute('href', tencentBlack);
    await expect(sources).toHaveAttribute('data-state', 'open');
    await reopenThroughHistory(page);
    await expect(download).toHaveAttribute('href', /wordmark-black-official\.png$/);
    await expectSourceLink(page, '官方品牌素材下载页', tencentSource);
    await expect(sourceFile).toHaveAttribute('href', tencentBlack);
    await expect(sources).toHaveAttribute('data-state', 'open');
    await sources.locator('[data-resource-trigger="source"]').click();
    await openFileDetails(page, 'wordmark-white-official.png');
    await expect(download).toHaveAttribute('href', /wordmark-white-official\.png$/);
    await expectSourceLink(page, '官方品牌素材下载页', tencentSource);
    await expect(sources).toHaveAttribute('data-state', 'closed');
    await expect(sourceFile).toBeHidden();
    await sources.locator('[data-resource-trigger="source"]').click();
    await expect(sources).toHaveAttribute('data-state', 'open');
    await expect(sourceFile).toHaveAttribute('href', tencentWhite);
    await sources.locator('[data-resource-trigger="source"]').click();
    await expect(sources).toHaveAttribute('data-state', 'closed');
    await reopenThroughHistory(page);
    await expect(download).toHaveAttribute('href', /wordmark-white-official\.png$/);
    await expectSourceLink(page, '官方品牌素材下载页', tencentSource);
    await expect(sources).toHaveAttribute('data-state', 'closed');
    await expect(sourceFile).toBeHidden();
    await sources.locator('[data-resource-trigger="source"]').click();
    await expect(sources).toHaveAttribute('data-state', 'open');
    await expect(sourceFile).toHaveAttribute('href', tencentWhite);
    await sources.locator('[data-resource-trigger="source"]').click();
    await expect(sources).toHaveAttribute('data-state', 'closed');

    await page.goto('/logo/xiaohongshu/');
    await openDefaultDetails(page);
    await expectSourceLink(
      page,
      '官网页头 Logo',
      'https://pro.xiaohongshu.com/login?redirectTo=%2F',
    );
    await openSourceDetails(page);
    await openFileDetails(page, 'wordmark-rounded-google-play.png');
    await expectSourceLink(
      page,
      '官方应用商店 · 渲染图',
      'https://play.google.com/store/apps/details?hl=zh-CN&id=com.xingin.xhs',
    );
    await expect(sources).toHaveAttribute('data-state', 'open');

    await page.goto('/logo/nio/');
    await openDefaultDetails(page);
    await expectSourceLink(page, '官网页面用图', 'https://www.nio.com/about?noredirect=');
    await expect(download).toHaveAttribute('href', /logo-black-english-official\.svg$/);
    await openSourceDetails(page);
    await openFileDetails(page, 'icon-turquoise-app.png');
    await expectSourceLink(
      page,
      '官方应用商店 · 渲染图',
      'https://play.google.com/store/apps/details?id=com.nio.nioapp',
    );
    await expect(sources).toHaveAttribute('data-state', 'open');

    await page.goto('/logo/shopee/');
    await openDefaultDetails(page);
    await expectSourceLink(page, '官网页脚 Logo', 'https://careers.shopee.sg/');
    await openSourceDetails(page);
    await openFileDetails(page, 'logo-vertical-commons.png');
    await expectSourceLink(
      page,
      'Commons · 渲染图',
      'https://commons.wikimedia.org/wiki/File:Shopee_logo.svg',
    );
    await expect(page.locator('#detail-fileinfo')).toContainText('1920 × 2731');
    await expect(download).toHaveAttribute('href', /logo-vertical-commons\.png$/);
    await expect(sources).toHaveAttribute('data-state', 'open');

    for (const [id, file, sourceLabel, sourcePage, rightsStatus] of [
      ['oppo', 'wordmark-black-official.svg', '官网页头 Logo', 'https://www.oppo.com/cn/'],
      [
        'gitlab',
        'logo-color-official.svg',
        '官方品牌素材下载页',
        'https://about.gitlab.com/press/press-kit/',
        'unverified',
      ],
      [
        'bilibili',
        'wordmark-blue-international-official.svg',
        '官网页面用图',
        'https://www.bilibili.tv/',
        'unverified',
      ],
      [
        'bigo',
        'wordmark-blue-official.png',
        '官网页面用图',
        'https://www.bigo.sg/about',
        'unverified',
      ],
      [
        'hundsun',
        'wordmark-color-official.png',
        '官网页面用图',
        'https://campus.hundsun.com/campus',
        'unverified',
      ],
      [
        'waterdrop',
        'logo-bilingual-white-background-official.png',
        '官网页脚 Logo',
        'https://www.waterdrop-inc.com/downloads',
        'unverified',
      ],
      [
        'sf-express',
        'icon-black-official.png',
        '官网页头 Logo',
        'https://www.sf-express.com/chn/sc',
        'unverified',
      ],
      [
        'trip-com',
        'wordmark-white-official.png',
        '官方品牌素材下载页',
        'https://group.trip.com/media',
      ],
      ['trip-com', 'wordmark-blue-small-official.png', '官网页头 Logo', 'https://group.trip.com/'],
      [
        'baidu',
        'logo-bilingual-brand-library.jpg',
        '官方品牌素材下载页',
        'https://home.baidu.com/media_resource/show_detail/res_id/2/tab_id/1',
        'unverified',
      ],
      [
        'baidu',
        'icon-blue-brand-library.jpg',
        '官方品牌素材下载页',
        'https://home.baidu.com/media_resource/show_detail/res_id/5/tab_id/1',
        'unverified',
      ],
      [
        'baidu',
        'icon-appstore.jpg',
        '官方应用商店 · 渲染图',
        'https://apps.apple.com/cn/app/%E7%99%BE%E5%BA%A6-ai%E6%99%BA%E8%83%BD%E6%90%9C%E7%B4%A2/id382201985?uo=4',
        'unverified',
      ],
      [
        'pinduoduo',
        'logo-slogan-official.png',
        '官网页面用图',
        'https://www.pinduoduo.com/',
        'unverified',
      ],
      ['jd', 'logo-header-official.png', '官网页面用图', 'https://about.jd.com/', 'unverified'],
      [
        'bilibili',
        'wordmark-white-small-official.png',
        '官网页面用图',
        'https://www.bilibili.com/',
        'unverified',
      ],
      [
        'hundsun',
        'wordmark-header-original.png',
        '官网页面用图',
        'https://www.hundsun.com/',
        'unverified',
      ],
      [
        'sf-express',
        'icon-appstore.jpg',
        '官方应用商店 · 渲染图',
        'https://apps.apple.com/cn/app/%E9%A1%BA%E4%B8%B0%E9%80%9F%E8%BF%90-%E5%BF%AB%E9%80%92%E6%9F%A5%E5%AF%84%E6%94%B6-%E4%B8%8D%E6%AD%A2%E6%98%AF%E5%BF%AB/id899529698?uo=4',
        'unverified',
      ],
      [
        'dewu',
        'wordmark-square-official.png',
        '官网页头 Logo',
        'https://poizon.jobs.feishu.cn/index',
        'unverified',
      ],
      [
        'netease',
        'wordmark-red-official.svg',
        '官网页面用图',
        'https://campus.163.com/app/index',
        'unverified',
      ],
      [
        'taotian',
        'logo-recruitment-official.png',
        '官网页面用图',
        'https://talent.taotian.com/',
        'unverified',
      ],
      [
        'duoyi',
        'logo-chinese-small-official.png',
        '官网页面用图',
        'https://www.duoyigroup.cn/dycommerce/ch/business.shtm',
        'unverified',
      ],
      [
        'vipshop',
        'wordmark-slogan-official.png',
        '官网页面用图',
        'https://www.vip.com/',
        'unverified',
      ],
      [
        'hirain',
        'logo-bilingual-small-official.png',
        '官网页面用图',
        'https://www.hirain.com/',
        'unverified',
      ],
      [
        'waterdrop',
        'logo-bilingual-small-official.png',
        '官网页面用图',
        'https://www.waterdrop-inc.com/downloads',
        'unverified',
      ],
      [
        'yaowu-tech',
        'icon-small-official.png',
        '官网页面用图',
        'https://www.yaowutech.com/',
        'unverified',
      ],
      [
        'agibot',
        'logo-english-gray-small-official.png',
        '官网页面用图',
        'https://www.agibot.com/',
        'unverified',
      ],
      [
        'bigo',
        'wordmark-white-official.png',
        '官网页面用图',
        'https://www.bigo.sg/mobile/about',
        'unverified',
      ],
      [
        'antgroup',
        'logo-bilingual-color-official.png',
        '官方品牌素材下载页',
        'https://www.antgroup.com/news-media/media-library',
        'unverified',
      ],
      [
        'qunar',
        'logo-english-official.svg',
        '官网页面用图',
        'https://careers.trip.com/',
        'unverified',
      ],
      [
        'sangfor',
        'logo-bilingual-official.svg',
        '官网页面用图',
        'https://www.sangfor.com.cn/',
        'unverified',
      ],
      [
        'dongchedi',
        'logo-chinese-official.svg',
        '官网页面用图',
        'https://www.dongchedi.com/',
        'unverified',
      ],
      [
        'zuoyebang',
        'logo-slogan-official.png',
        '官网页面用图',
        'https://smart.zuoyebang.com/',
        'unverified',
      ],
      [
        'cvte',
        'wordmark-bilingual-official.png',
        '官网页面用图',
        'https://www.cvte.com/',
        'unverified',
      ],
      [
        'asiainfo',
        'logo-bilingual-color-official.svg',
        '官网页面用图',
        'https://www.asiainfo.com/zh_cn/index.html',
        'unverified',
      ],
      [
        'qihoo-360',
        'logo-horizontal-official.png',
        '官方品牌素材下载页',
        'https://www.360.cn/about/contactus.html?page=logo',
        'unverified',
      ],
      [
        'fanruan',
        'logo-english-official.svg',
        '官网页面用图',
        'https://www.fanruan.com/en/',
        'unverified',
      ],
      [
        'amap',
        'icon-appstore.jpg',
        '官方应用商店 · 渲染图',
        'https://apps.apple.com/cn/app/%E9%AB%98%E5%BE%B7%E5%9C%B0%E5%9B%BE-%E9%AB%98%E5%BE%B7%E6%89%93%E8%BD%A6-%E5%AF%BC%E8%88%AA%E5%85%AC%E4%BA%A4%E5%9C%B0%E9%93%81%E5%87%BA%E8%A1%8C/id461703208?uo=4',
        'unverified',
      ],
      [
        'tsingmicro',
        'logo-color-official.svg',
        '官网页面用图',
        'https://www.tsingmicro.com/',
        'unverified',
      ],

      ['kuaishou', 'icon-rounded-official.png', '官方品牌素材下载页', kuaishouSource],
      [
        'meituan',
        'wordmark-rounded-google-play.png',
        '官方应用商店 · 渲染图',
        'https://play.google.com/store/apps/details?id=com.sankuai.meituan&hl=zh-CN',
      ],
      [
        'zhihu',
        'wordmark-rounded-google-play.png',
        '官方应用商店 · 渲染图',
        'https://play.google.com/store/apps/details?id=com.zhihu.android&hl=zh-CN',
      ],
    ]) {
      await page.goto(`/logo/${id}/?asset=${file}`);
      await expectSourceLink(page, sourceLabel, sourcePage);
      if (rightsStatus === 'unverified') {
        await expect(license).toHaveCount(0);
        await expect(page.getByText(/许可未核实|许可已确认/)).toHaveCount(0);
        await expect(sources.locator('[data-resource-trigger="source"]')).not.toContainText(
          '需署名',
        );
      }
      await expect(download).toHaveAttribute('href', new RegExp(`${file}$`));
      await expect(page.locator('.preview-stage img')).toBeVisible();
      const downloaded = page.waitForEvent('download');
      await download.click();
      const fileDownload = await downloaded;
      const brand = catalog.brands.find((entry) => entry.id === id)!;
      const asset = brand.assets.find((entry) => entry.file === file)!;
      expect(fileDownload.suggestedFilename()).toBe(assetDownloadName(brand, asset));
    }

    await page.goto('/logo/zte/?asset=wordmark-blue-header-official.png');
    await expectSourceLink(page, '官网页头 Logo', 'https://www.zte.com.cn/global/');
    await expect(page.locator('.asset-controls .asset-warnings')).toContainText('低分辨率');
    await expect(page.locator('.asset-controls .asset-warnings')).toBeVisible();
    await openSourceDetails(page);
    await expect(sources).toContainText('页头 Logo · 原始文件');

    await page.goto('/logo/transsion/');
    await openDefaultDetails(page);
    await expectSourceLink(page, '官网页脚 Logo', 'https://www.transsion.com/zh-CN/about');
    await openSourceDetails(page);
    await expect(sources).toContainText('页脚 Logo · 原始文件');

    await page.goto('/logo/xiaomi/');
    await openDefaultDetails(page);
    await expectSourceLink(page, '官网页面用图 · 图形提取版', 'https://trust.mi.com/');
    await openSourceDetails(page);
    await expect(sources).toContainText('小米信任中心 · 图形提取版');
    await openFileDetails(page, 'logo-horizontal-official.svg');
    await expectSourceLink(page, '官网页面用图', 'https://trust.mi.com/');
    await expect(sources).toHaveAttribute('data-state', 'open');
    await expect(sources).toContainText('小米信任中心 · 原始文件');
    await reopenThroughHistory(page);
    await expectSourceLink(page, '官网页面用图', 'https://trust.mi.com/');
    await expect(sources).toHaveAttribute('data-state', 'open');
    await expect(sources).toContainText('小米信任中心 · 原始文件');

    await page.goto('/logo/gitlab/?asset=icon-legacy.png');
    const gitlabSource =
      'https://gitlab.com/gitlab-com/gitlab-artwork/-/raw/9b07772f44a9fa51f395a95928a6e41c61a5b1cb/README.md';
    await expectSourceLink(page, '官方仓库', gitlabSource);
    await openSourceDetails(page);
    const warnings = page.locator('.asset-controls .asset-warnings');
    await expect(warnings).toBeVisible();
    await expect(warnings).toContainText('历史素材');
    await expect(warnings).toContainText('仅限非商业用途');
    await expect(license).toHaveText('CC-BY-NC-SA-4.0');
    await expect(license).toHaveAttribute('href', gitlabSource);
    await expect(warnings).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
