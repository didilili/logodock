import { expect, test, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Brand, Catalog } from '../../src/lib/types';
import { artworkGroups, artworkSourceFiles } from '../../src/lib/catalog-artworks.mjs';
import {
  assetDescription,
  assetDownloadName,
  assetFormat,
} from '../../src/lib/catalog-presentation.mjs';
import { sourceInformation } from '../../src/lib/catalog-display.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../../_site/index.json', import.meta.url), 'utf8'),
) as Catalog;
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration.*mismatch/i.test(message.text()))
      errors.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

function brandById(id: string) {
  return catalog.brands.find((brand) => brand.id === id)!;
}

function detailsDialog(page: Page) {
  return page.locator('.preview-dialog[role="dialog"]');
}

function cardForFile(page: Page, file: string) {
  return page.locator('.artwork-card').filter({
    has: page.locator(`.artwork-visual[data-select-asset="${file}"]`),
  });
}

async function openDetails(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = detailsDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#detail-copy-menu')).toBeEnabled();
  await expect(dialog.getByRole('region', { name: '文件详情', exact: true })).toBeVisible();
  return dialog;
}

async function expectCurrentFile(dialog: Locator, brand: Brand, file: string) {
  const asset = brand.assets.find((entry) => entry.file === file)!;
  await expect(dialog.locator('#detail-image')).toHaveAttribute('src', `/${asset.path}`);
  await expect(dialog.locator('#download-link')).toHaveAttribute('href', `/${asset.path}`);
  const title = dialog.getByRole('heading', { level: 2 }).first();
  await expect(title).toContainText(brand.name);
  await expect(title).toContainText(assetDescription(asset));
  await expect(title).toContainText(assetFormat(asset));
  await expect.poll(() => new URL(dialog.page().url()).searchParams.get('asset')).toBe(file);
}

async function recordTextCopies(page: Page) {
  await page.addInitScript(() => {
    const values: string[] = [];
    Object.assign(window, { __fileDetailCopies: values });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => values.push(value) },
    });
  });
}

async function lastTextCopy(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __fileDetailCopies: string[] }).__fileDetailCopies.at(-1),
  );
}

test('a non-default directory cover opens its gallery with the original file and filter context', async ({
  page,
}) => {
  await page.goto('/?q=华为&format=SVG&layout=horizontal&category=consumer-electronics');
  const directoryCard = page.locator('.brand-card[data-brand="huawei"]');
  await expect(directoryCard.locator('.copy-menu-trigger')).toBeEnabled();
  const directoryUrl = page.url();
  const source = (await directoryCard.locator('.brand-art img').getAttribute('src'))!;
  const file = decodeURIComponent(new URL(source, directoryUrl).pathname.split('/').at(-1)!);
  expect(file).not.toBe(brandById('huawei').defaultAsset);
  await directoryCard.locator('.brand-link').click();
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(detailsDialog(page)).toHaveCount(0);
  const galleryUrl = page.url();
  const galleryParams = new URL(galleryUrl).searchParams;
  expect(galleryParams.get('selected')).toBe(file);
  expect(galleryParams.has('asset')).toBe(false);
  const directoryReturn = new URL((await page.locator('#back-directory').getAttribute('href'))!);
  for (const [key, value] of new URL(directoryUrl).searchParams) {
    expect(galleryParams.get(key)).toBe(value);
    expect(directoryReturn.searchParams.get(key)).toBe(value);
  }
  const card = cardForFile(page, file);
  await expect(card).toBeVisible();
  await expect(card.locator('.artwork-preview img')).toHaveAttribute('src', source);
  await expect(card.locator('a[download]')).toHaveAttribute('href', source);
  const trigger = card.locator('.file-details-link');
  const dialog = await openDetails(page, trigger);
  await expectCurrentFile(dialog, brandById('huawei'), file);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(galleryUrl);
  await expect(trigger).toBeFocused();
  await expect(card.locator('a[download]')).toHaveAttribute('href', source);
});

test('directory gallery selection survives browser history, detail closure and refresh', async ({
  page,
}) => {
  await page.goto('/?q=华为&format=SVG&layout=horizontal');
  const directoryCard = page.locator('.brand-card[data-brand="huawei"]');
  await expect(directoryCard.locator('.copy-menu-trigger')).toBeEnabled();
  const directoryUrl = page.url();
  const source = (await directoryCard.locator('.brand-art img').getAttribute('src'))!;
  const file = decodeURIComponent(new URL(source, directoryUrl).pathname.split('/').at(-1)!);
  await directoryCard.locator('.brand-link').click();
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(detailsDialog(page)).toHaveCount(0);
  const galleryUrl = page.url();
  expect(new URL(galleryUrl).searchParams.get('selected')).toBe(file);
  await page.goBack();
  await expect(page).toHaveURL(directoryUrl);
  await expect(directoryCard.locator('.brand-art img')).toHaveAttribute('src', source);
  await page.goForward();
  await expect(page).toHaveURL(galleryUrl);
  await expect(detailsDialog(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(detailsDialog(page)).toHaveCount(0);
  const card = cardForFile(page, file);
  await expect(card.locator('a[download]')).toHaveAttribute('href', source);
  const dialog = await openDetails(page, card.locator('.artwork-visual'));
  await expectCurrentFile(dialog, brandById('huawei'), file);
  await page.goBack();
  await expect(page).toHaveURL(galleryUrl);
  await expect(dialog).toBeHidden();
  await page.goForward();
  await expectCurrentFile(dialog, brandById('huawei'), file);
  await dialog.getByRole('button', { name: '关闭文件详情', exact: true }).click();
  await expect(page).toHaveURL(galleryUrl);
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(page).toHaveURL(galleryUrl);
  await expect(detailsDialog(page)).toHaveCount(0);
  await expect(card.locator('a[download]')).toHaveAttribute('href', source);
});

for (const width of [1680, 1024, 390]) {
  test(`each card owns its file details while complete brand identity stays visible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const id of ['alibaba', 'huawei']) {
      const brand = brandById(id);
      await page.goto(`/logo/${id}/`);
      await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
      await expect(detailsDialog(page)).toHaveCount(0);
      await expect(page.locator('.reference-heading, .asset-references')).toHaveCount(0);
      for (const subject of brand.identity.legalNames) {
        await expect(
          page.locator('.brand-subjects').getByText(subject.name, { exact: true }),
        ).toBeVisible();
      }
      await expect(page.locator('.english-subjects, .brand-reference')).toHaveCount(0);
      await expect(page.locator('.brand-information-panel')).toHaveCSS('border-top-width', '0px');
      await expect(page.locator('.artwork-card')).toHaveCount(artworkGroups(brand).length);
      for (const artwork of artworkGroups(brand)) {
        const card = page.locator(`.artwork-card[data-artwork="${artwork.id}"]`);
        const file = await card.locator('.artwork-visual').getAttribute('data-select-asset');
        const asset = artwork.assets.find((entry) => entry.file === file)!;
        expect(asset).toBeDefined();
        await expect(card.locator('a[download]')).toBeVisible();
        await expect(card.locator('a[download]')).toHaveAttribute('href', `/${asset.path}`);
        await expect(card.locator('a[download]')).toHaveAttribute(
          'download',
          assetDownloadName(brand, asset),
        );
        await expect(card.locator('.file-details-link')).toBeVisible();
        await expect(card.locator('.file-details-link')).toHaveAttribute(
          'data-select-asset',
          asset.file,
        );
        const formats = [...new Set(artwork.assets.map(assetFormat))];
        const choices = card.locator('.card-formats [data-select-asset]');
        if (formats.length > 1) await expect(choices).toHaveText(formats);
        else await expect(choices).toHaveCount(0);
      }
      const trigger = page.locator('.file-details-link').first();
      const file = await trigger.getAttribute('data-select-asset');
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      const scrollBefore = await page.evaluate(() => scrollY);
      await trigger.press('Enter');
      const dialog = detailsDialog(page);
      await expectCurrentFile(dialog, brand, file!);
      await expect(dialog.locator('.source-details')).toHaveAttribute('data-state', 'open');
      expect(new URL(page.url()).searchParams.get('asset')).toBe(file);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
      expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
      await expect(page.locator('.asset-references')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}

test('card download and copy use that original without opening details or changing the URL', async ({
  page,
}) => {
  const brand = brandById('alibaba');
  await recordTextCopies(page);
  await page.goto('/logo/alibaba/?q=阿里巴巴&versions=all');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  const galleryUrl = page.url();
  for (const file of [brand.defaultAsset, 'wordmark-orange.svg']) {
    const asset = brand.assets.find((entry) => entry.file === file)!;
    const card = cardForFile(page, file);
    const downloadPromise = page.waitForEvent('download');
    await card.locator('a[download]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(assetDownloadName(brand, asset));
    const path = await download.path();
    expect(path).not.toBeNull();
    expect(
      createHash('sha256')
        .update(await readFile(path!))
        .digest('hex'),
    ).toBe(asset.sha256);
    await card.locator('.copy-menu-trigger').click();
    await page.locator('[data-copy-menu-content] [data-copy-kind="current"]').click();
    await expect.poll(() => lastTextCopy(page)).toBe(new URL(`/${asset.path}`, page.url()).href);
    await card.locator('.copy-menu-trigger').click();
    await page.locator('[data-copy-menu-content] [data-copy-kind="share"]').click();
    const share = new URL((await lastTextCopy(page))!);
    expect(share.searchParams.get('asset')).toBe(file);
    expect(share.searchParams.get('q')).toBe('阿里巴巴');
    expect(page.url()).toBe(galleryUrl);
    await expect(detailsDialog(page)).toHaveCount(0);
  }
});

test('same-artwork files replace one detail history entry and keep their original sources', async ({
  page,
}) => {
  const brand = brandById('bambu-lab');
  await page.goto('/logo/bambu-lab/');
  const card = page.locator('[data-artwork="green-symbol"]');
  await expect(card.locator('.copy-menu-trigger')).toBeEnabled();
  await expect(card.locator('.card-formats')).toHaveCount(0);
  const galleryUrl = page.url();
  const historyBefore = await page.evaluate(() => history.length);
  const dialog = await openDetails(page, card.locator('.file-details-link'));
  await expectCurrentFile(dialog, brand, 'symbol-square.svg');
  await expect(dialog.locator('.source-details [data-original-asset]')).toHaveAttribute(
    'data-original-asset',
    'symbol-green.svg',
  );
  const detailHistory = await page.evaluate(() => history.length);
  expect(detailHistory).toBe(historyBefore + 1);
  await dialog.locator('.file-options-trigger').click();
  await expect(dialog.locator('.file-option')).toHaveCount(2);
  await dialog.locator('.file-option[data-select-asset="symbol-green.svg"]').click();
  await expectCurrentFile(dialog, brand, 'symbol-green.svg');
  expect(await page.evaluate(() => history.length)).toBe(detailHistory);
  await expect(dialog.locator('.source-details [data-original-asset]')).toHaveCount(0);
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(galleryUrl);
  await expect(card.locator('.file-details-link')).toBeFocused();
  await expect(card.locator('a[download]')).toHaveAttribute('href', /symbol-green\.svg$/);
});

test('the 24-file gallery keeps local filters and its disclosure after file details close', async ({
  page,
}) => {
  await page.goto('/logo/insta360/');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(page.locator('.artwork-card')).toHaveCount(24);
  await expect(page.locator('.artwork-card:visible')).toHaveCount(6);
  await page.locator('#version-layout-filter').click();
  await page.getByRole('option', { name: '上下排列', exact: true }).click();
  await expect(page.locator('.artwork-card')).toHaveCount(4);
  const trigger = page.locator('.file-details-link').last();
  const file = await trigger.getAttribute('data-select-asset');
  const dialog = await openDetails(page, trigger);
  await expectCurrentFile(dialog, brandById('insta360'), file!);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('#version-layout-filter')).toContainText('上下排列');
  await expect(page.locator('.artwork-card')).toHaveCount(4);
  await page.getByRole('button', { name: '清除版本筛选', exact: true }).click();
  await expect(page.locator('.artwork-card')).toHaveCount(24);
  const more = page.locator('.artwork-more');
  if ((await more.getAttribute('data-state')) !== 'open')
    await more.locator('.artwork-more-trigger').click();
  await expect(page.locator('.artwork-card:visible')).toHaveCount(24);
  const last = page.locator('.file-details-link').last();
  await openDetails(page, last);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(more).toHaveAttribute('data-state', 'open');
  await expect(last).toBeFocused();
});

test('mobile framing and backgrounds preserve the full original inside file details', async ({
  page,
}) => {
  const brand = brandById('baidu');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/logo/baidu/');
  const card = cardForFile(page, brand.defaultAsset);
  await expect(card.locator('.artwork-preview')).toHaveAttribute('data-framed', 'true');
  const dialog = await openDetails(page, card.locator('.artwork-visual'));
  const frame = dialog.locator('.artwork-preview');
  await expect(frame).toHaveAttribute('data-framed', 'true');
  await expect(dialog.locator('#download-link')).toBeInViewport();
  await dialog.getByRole('button', { name: '显示完整画布', exact: true }).click();
  await expect(frame).not.toHaveAttribute('data-framed');
  await dialog.getByRole('radio', { name: '深色', exact: true }).click();
  await expect(dialog.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
  await expectCurrentFile(dialog, brand, brand.defaultAsset);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card.locator('.artwork-visual')).toBeFocused();
  await expect(
    page.locator('.asset-gallery').getByRole('radio', { name: '深色', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1440, 390]) {
  test(`sources, design attachments and embed fields belong to the open file at ${width}px`, async ({
    page,
  }) => {
    const brand = brandById('baidu');
    await page.setViewportSize({ width, height: 844 });
    await recordTextCopies(page);
    await page.goto('/logo/baidu/');
    await expect(page.locator('.asset-references')).toHaveCount(0);
    const dialog = await openDetails(
      page,
      cardForFile(page, brand.defaultAsset).locator('.file-details-link'),
    );
    const sources = dialog.locator('.source-details');
    const designFiles = dialog.locator('#design-files');
    const embed = dialog.locator('.embed-details');
    await expect(sources).toHaveAttribute('data-state', 'open');
    await expect(designFiles).toHaveAttribute('data-state', 'closed');
    await expect(embed).toHaveAttribute('data-state', 'closed');
    const pageScroll = await page.evaluate(() => scrollY);
    await dialog.locator('.design-files-link').click();
    await expect(dialog).toBeVisible();
    await expect(designFiles).toHaveAttribute('data-state', 'open');
    await expect(designFiles.locator('#design-files-trigger')).toBeFocused();
    await expect(designFiles.locator('#design-files-trigger')).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
    await expect(designFiles.locator('[data-source-file]')).toHaveCount(4);
    for (const entry of artworkSourceFiles(brand, brand.defaultAsset)) {
      const item = designFiles.locator(`[data-source-file="${entry.file}"]`);
      await expect(item).toContainText(entry.label);
      await expect(item.locator('a[download]')).toHaveAttribute('href', `/${entry.path}`);
      if (entry.rights.notes)
        await expect(sources.getByText(entry.rights.notes, { exact: true })).toHaveCount(1);
    }
    await embed.locator('[data-resource-trigger="embed"]').click();
    await expect(embed.locator('#current-address')).toHaveValue(
      new URL(`/logo/baidu/${brand.defaultAsset}`, page.url()).href,
    );
    for (const id of ['html-example', 'markdown-example']) {
      const value = await embed.locator(`#${id}`).inputValue();
      expect(value).toContain(`/logo/baidu/${brand.defaultAsset}`);
      await embed.locator(`[data-copy-target="${id}"]`).click();
      await expect.poll(() => lastTextCopy(page)).toBe(value);
    }
    const native = artworkSourceFiles(brand, brand.defaultAsset)[0];
    const downloadPromise = page.waitForEvent('download');
    await designFiles.locator(`[data-source-file="${native.file}"] a[download]`).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(
      createHash('sha256')
        .update(await readFile(path!))
        .digest('hex'),
    ).toBe(native.sha256);
    await expectCurrentFile(dialog, brand, brand.defaultAsset);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.asset-references')).toHaveCount(0);
    await openDetails(page, cardForFile(page, 'icon-appstore.jpg').locator('.file-details-link'));
    await expect(dialog.locator('#design-files')).toHaveCount(0);
    const app = brand.assets.find((asset) => asset.file === 'icon-appstore.jpg')!;
    await expect(dialog.locator('#detail-source-link')).toHaveAttribute('href', app.sourcePage);
    await expect(dialog.locator('.source-details a').filter({ hasText: 'AI' })).toHaveCount(0);
  });
}

test('filtered deep links and original mother files stay in one explicit file context', async ({
  page,
}) => {
  const brand = brandById('bambu-lab');
  await page.goto('/logo/bambu-lab/?q=提取&asset=symbol-green.svg&versions=matching');
  const dialog = detailsDialog(page);
  await expectCurrentFile(dialog, brand, 'symbol-green.svg');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  await expect(page.locator('.artwork-card')).toHaveCount(1);
  await expect(page.locator('.artwork-visual')).toHaveAttribute(
    'data-select-asset',
    'symbol-square.svg',
  );
  await openDetails(page, page.locator('.file-details-link'));
  await expectCurrentFile(dialog, brand, 'symbol-square.svg');
  const historyBeforeMother = await page.evaluate(() => history.length);
  await dialog.locator('[data-original-asset="symbol-green.svg"]').click();
  await expectCurrentFile(dialog, brand, 'symbol-green.svg');
  expect(await page.evaluate(() => history.length)).toBe(historyBeforeMother);
  expect(new URL(page.url()).searchParams.get('q')).toBe('提取');
  expect(new URL(page.url()).searchParams.get('versions')).toBe('matching');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.artwork-visual')).toHaveAttribute(
    'data-select-asset',
    'symbol-square.svg',
  );
  await expect(page.locator('.file-details-link')).toBeFocused();
  await expect(page.locator('.asset-references')).toHaveCount(0);

  await page.goto('/logo/bambu-lab/?q=提取');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(page.locator('.artwork-card')).toHaveCount(1);
  await openDetails(page, page.locator('.file-details-link'));
  await dialog.locator('[data-original-asset="symbol-green.svg"]').click();
  await expectCurrentFile(dialog, brand, 'symbol-green.svg');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  await expect(page.locator('.artwork-card')).toHaveCount(1);
  await expect(page.locator('.artwork-visual')).toHaveAttribute(
    'data-select-asset',
    'symbol-square.svg',
  );
});

test('valid default-file shares open details directly and invalid files leave the gallery usable', async ({
  page,
}) => {
  const brand = brandById('alibaba');
  await page.goto(`/logo/alibaba/?asset=${brand.defaultAsset}&q=阿里巴巴`);
  await expectCurrentFile(detailsDialog(page), brand, brand.defaultAsset);
  await page.keyboard.press('Escape');
  await expect(detailsDialog(page)).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  expect(new URL(page.url()).searchParams.get('q')).toBe('阿里巴巴');
  await page.goto('/logo/alibaba/?asset=missing.svg');
  await expect(page.locator('.artwork-card .copy-menu-trigger').first()).toBeEnabled();
  await expect(detailsDialog(page)).toHaveCount(0);
  await expect(cardForFile(page, brand.defaultAsset).locator('a[download]')).toHaveAttribute(
    'href',
    `/logo/alibaba/${brand.defaultAsset}`,
  );
  const unmatchedQuery = '不存在的品牌匹配项';
  await page.goto(
    `/logo/git/?asset=logo-color.svg&versions=matching&q=${encodeURIComponent(unmatchedQuery)}`,
  );
  await expectCurrentFile(detailsDialog(page), brandById('git'), 'logo-color.svg');
  await page.keyboard.press('Escape');
  await expect(detailsDialog(page)).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
  await expect(page.locator('.artwork-card')).toHaveCount(0);
  const gallery = page.locator('.asset-gallery');
  await expect
    .poll(() => gallery.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  expect(new URL(page.url()).searchParams.get('q')).toBe(unmatchedQuery);
});

test('multi-format SSR fixture exposes only registered group files and their original downloads', async ({
  page,
  baseURL,
}) => {
  const brand: Brand = {
    ...brandById('alibaba'),
    // Temporary memberships pair registered files to exercise format choices.
    artworks: [
      {
        id: 'fixture-zh',
        label: '中文测试图稿',
        files: ['logo-chinese-horizontal-official.png', 'wordmark-orange-chinese.svg'],
        defaultAsset: 'logo-chinese-horizontal-official.png',
      },
      {
        id: 'fixture-en',
        label: '英文测试图稿',
        files: ['logo-english-horizontal-official.png', 'wordmark-orange.svg'],
        defaultAsset: 'logo-english-horizontal-official.png',
      },
    ],
  };
  const serverEntry = new URL(
    '../../.svelte-kit/output/server/chunks/instance.js',
    import.meta.url,
  );
  const serverSource = await readFile(serverEntry, 'utf8');
  // SSR components and render share the bundled Svelte runtime. The generated
  // server entry identifies the renderer's current export name.
  const binding = /import\s*\{[^}]*\b(\w+)\s+as\s+render\b[^}]*\}\s+from\s+["']([^"']+)["']/.exec(
    serverSource,
  );
  expect(binding).not.toBeNull();
  const runtime = await import(new URL(binding![2], serverEntry).href);
  const render = runtime[binding![1]] as (
    component: unknown,
    options: { props: { data: { brand: Brand; children: never[]; sourceCommit: string } } },
  ) => { body: string };
  const componentEntry = new URL(
    '../../.svelte-kit/output/server/entries/pages/logo/_id_/_page.svelte.js',
    import.meta.url,
  );
  const component = (await import(componentEntry.href)).default;
  const rendered = render(component, {
    props: { data: { brand, children: [], sourceCommit: '' } },
  });
  await page.setContent(`<base href="${baseURL}">${rendered.body}`);
  await expect(page.locator('.artwork-card')).toHaveCount(4);
  for (const group of brand.artworks!) {
    const card = page.locator(`[data-artwork="${group.id}"]`);
    const choices = card.locator('.card-formats [data-select-asset]');
    await expect(choices).toHaveText(['PNG', 'SVG']);
    expect(
      await choices.evaluateAll((links) =>
        links.map((link) => link.getAttribute('data-select-asset')),
      ),
    ).toEqual(group.files);
    await expect(card.locator('.artwork-visual')).toHaveAttribute(
      'data-select-asset',
      group.defaultAsset,
    );
    await expect(card.locator('.file-details-link')).toHaveAttribute(
      'data-select-asset',
      group.defaultAsset,
    );
    await expect(card.locator('a[download]')).toHaveAttribute(
      'href',
      `/logo/alibaba/${group.defaultAsset}`,
    );
    await expect(card.locator('.download-options-trigger')).toHaveCount(0);
  }
});

test('detail copy and download menus preserve focus and export the full original SVG canvas', async ({
  page,
}) => {
  const brand = brandById('git');
  const asset = brand.assets.find((entry) => entry.file === 'logo-color.svg')!;
  await recordTextCopies(page);
  await page.goto('/logo/git/?asset=logo-color.svg');
  const dialog = detailsDialog(page);
  await expectCurrentFile(dialog, brand, asset.file);
  await dialog.locator('#detail-copy-menu').click();
  const menu = page.locator('[data-copy-menu-content]');
  await expect(menu.locator('[data-copy-kind]').first()).toHaveAttribute('data-copy-kind', 'svg');
  await menu.locator('[data-copy-kind="current"]').click();
  await expect(menu).toBeHidden();
  await expect(dialog.locator('#detail-copy-menu')).toBeFocused();
  await expect.poll(() => lastTextCopy(page)).toBe(new URL(`/${asset.path}`, page.url()).href);
  const options = dialog.locator('#download-options');
  await options.click();
  await expect(page.locator('[data-download-kind="png"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options).toBeFocused();
  await expect(dialog).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await options.click();
  await page.locator('[data-download-kind="png"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    assetDownloadName(brand, asset).replace(/\.svg$/, '-export-2048.png'),
  );
  const path = await download.path();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const dimensions = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, bytes.toString('base64'));
  expect(dimensions).toEqual({ width: 2048, height: Math.round((2048 * 92) / 219) });
  await expectCurrentFile(dialog, brand, asset.file);
});

test('embed clipboard rejection opens a selectable recovery and returns to the same file field', async ({
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
  await page.goto('/logo/git/?asset=logo-color.svg');
  const dialog = detailsDialog(page);
  await expect(dialog.locator('#detail-copy-menu')).toBeEnabled();
  await dialog.locator('[data-resource-trigger="embed"]').click();
  const value = await dialog.locator('#html-example').inputValue();
  const trigger = dialog.locator('[data-copy-target="html-example"]');
  await trigger.click();
  const recovery = page.getByRole('dialog', { name: '复制未完成', exact: true });
  const manual = recovery.getByRole('textbox', { name: '手动复制', exact: true });
  await expect(manual).toBeVisible();
  await expect(manual).toBeFocused();
  await expect(manual).toHaveValue(value);
  expect(
    await manual.evaluate((element: HTMLTextAreaElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([0, value.length]);
  await recovery.locator('#dismiss-feedback').click();
  await expect(recovery).toBeHidden();
  await expect(trigger).toBeFocused();
  await expectCurrentFile(dialog, brandById('git'), 'logo-color.svg');
});

test('closing and switching file details discard a pending generated download', async ({
  page,
}) => {
  let releaseSource!: () => void;
  const sourceGate = new Promise<void>((resolve) => {
    releaseSource = resolve;
  });
  let requested = false;
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.route('**/logo/git/icon-orange.svg', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    requested = true;
    await sourceGate;
    await route.continue();
  });
  try {
    await page.goto('/logo/git/');
    const dialog = await openDetails(
      page,
      cardForFile(page, 'icon-orange.svg').locator('.file-details-link'),
    );
    await dialog.locator('#download-options').click();
    await page.locator('[data-download-kind="png"]').click();
    await expect.poll(() => requested).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.has('asset')).toBe(false);
    await openDetails(page, cardForFile(page, 'logo-color.svg').locator('.file-details-link'));
    const response = page.waitForResponse(
      (result) =>
        result.url().endsWith('/logo/git/icon-orange.svg') &&
        result.request().resourceType() === 'fetch',
    );
    releaseSource();
    await response;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(downloads).toEqual([]);
    await expect(page.locator('#copy-feedback')).toBeHidden();
    await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])')).toHaveCount(0);
    await expectCurrentFile(dialog, brandById('git'), 'logo-color.svg');
  } finally {
    releaseSource();
  }
});

test('without JavaScript every preview file and native attachment retains its real source and conditions', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    for (const id of ['git', 'baidu', 'nio']) {
      const brand = brandById(id);
      await page.goto(`/logo/${id}/`);
      const fallback = page.locator('noscript');
      for (const details of await fallback.locator('details').all()) {
        if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
          await details.locator(':scope > summary').click();
      }
      const information = sourceInformation([...brand.assets, ...(brand.sourceFiles ?? [])]);
      const hrefs = await fallback
        .locator('a[href^="https://"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      for (const entry of information.links) expect(hrefs).toContain(entry.url);
      for (const entry of [...information.notes, ...information.attributions])
        await expect(fallback.getByText(entry.text, { exact: true }).first()).toBeVisible();
      for (const asset of brand.assets)
        await expect(fallback.locator(`a[download][href="/${asset.path}"]`).first()).toBeVisible();
      for (const source of brand.sourceFiles ?? [])
        await expect(fallback.locator(`a[download][href="/${source.path}"]`)).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
