import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../../index.json', import.meta.url), 'utf8'));

const removedSources = [
  ['trip-com', 'wordmark-color.svg'],
  ['meituan', 'logo-chinese.png'],
  ['yonyou', 'wordmark-red.jpg'],
  ['minimax', 'logo-gradient-vertical.png'],
  ['lenovo', 'logo-red-2015.png'],
  ['lenovo', 'logo-red-brandworld.png'],
  ['zte', 'wordmark-cyan-2015.png'],
  ['zte', 'wordmark-cyan-commons.svg'],
  ['alibaba', 'wordmark-orange.png'],
  ['bytedance', 'logo-english.png'],
  ['codeberg', 'icon-blue.png'],
  ['codeberg', 'icon-white.png'],
  ['codeberg', 'logo-vertical-blue.png'],
  ['codeberg', 'logo-vertical-white.png'],
  ['didi', 'logo-english.png'],
  ['iqiyi', 'wordmark-green.png'],
  ['oppo', 'wordmark-green-2019.png'],
  ['tencent', 'wordmark-blue.png'],
  ['kingdee', 'logo-color-english.jpg'],
  ['trip-com', 'wordmark-color.png'],
  ['vivo', 'wordmark-blue-2019.png'],
  ['yonyou', 'wordmark-white-transparent.png'],
] as const;

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.searchParams.sort();
  return url.href;
}

async function chooseFilter(page: Page, id: string, label: string) {
  if (id === 'format-filter') {
    await page
      .getByRole('group', { name: '文件格式', exact: true })
      .getByRole('button', { name: label, exact: true })
      .click();
    await expect(page.locator('#extra-filter-panel')).toBeHidden();
    await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
    return;
  }
  const moreFilters = page.locator('#more-filters-trigger');
  if ((await moreFilters.getAttribute('aria-expanded')) !== 'true') {
    await moreFilters.click();
    await expect(page.locator('#shape-filter')).toBeFocused();
  }
  await expect(page.getByRole('dialog', { name: '更多筛选', exact: true })).toBeVisible();
  const trigger = page.locator(`#${id}`);
  await expect(trigger).toHaveAttribute('role', 'combobox');
  await trigger.click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

type CopyKind = 'current' | 'svg' | 'png' | 'share' | 'html' | 'markdown';

async function chooseCopy(page: Page, kind: CopyKind, trigger = page.locator('#detail-copy-menu')) {
  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.locator(`[data-copy-kind="${kind}"]`).click();
  await expect(menu).toBeHidden();
}

async function choosePngDownload(page: Page) {
  await page.locator('#download-options').click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.locator('[data-download-kind="png"]').click();
  await expect(menu).toBeHidden();
}

async function recordTextCopies(page: Page) {
  await page.addInitScript(() => {
    const copied: string[] = [];
    Object.assign(window, { __copiedTexts: copied });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied.push(value);
        },
      },
    });
  });
}

async function expectLastCopy(page: Page, value: string) {
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1)),
    )
    .toBe(value);
}

for (const width of [1280, 390]) {
  test(`directory covers keep summaries, actions and filtering aligned at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await recordTextCopies(page);
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    for (const [id, file, count] of [
      ['dongchedi', 'logo-chinese-official.svg', 3],
      ['bytedance', 'logo-bilingual-color-official.svg', 7],
      ['nio', 'logo-black-english-official.svg', 5],
    ]) {
      const card = page.locator(`.brand-card[data-brand="${id}"]`);
      await expect(card.locator('.brand-art img')).toHaveAttribute('src', `/logo/${id}/${file}`);
      await expect(card.locator('.card-download')).toHaveAttribute('href', `/logo/${id}/${file}`);
      await expect(card.locator('.card-materials')).toContainText(`${count} 份素材`);
      await expect(card.locator('.card-materials')).toHaveAttribute(
        'href',
        (await card.locator('[data-brand-link]').getAttribute('href'))!,
      );
      const detail = new URL(
        (await card.locator('[data-brand-link]').getAttribute('href'))!,
        page.url(),
      );
      expect(detail.searchParams.has('asset')).toBe(false);
    }
    const card = page.locator('.brand-card[data-brand="dongchedi"]');
    await chooseCopy(page, 'current', card.locator('[data-copy-brand="dongchedi"]'));
    await expectLastCopy(
      page,
      new URL('/logo/dongchedi/logo-chinese-official.svg', page.url()).href,
    );
    const download = page.waitForEvent('download');
    await card.locator('.card-download').click();
    expect((await download).suggestedFilename()).toBe('dongchedi-logo-chinese-official.svg');
    await card.locator('.card-materials').click();
    await expect(page.locator('#detail-image')).toHaveAttribute(
      'src',
      '/logo/dongchedi/logo-chinese-official.svg',
    );
    await page.goto('/?q=懂车帝&format=JPG');
    await expect(card.locator('.brand-art img')).toHaveAttribute(
      'src',
      '/logo/dongchedi/icon-appstore.jpg',
    );
    await expect(card.locator('.card-materials')).toContainText('1 份素材');
    await page.goto('/?q=懂车帝%20logo-chinese-official.svg');
    await expect(card.locator('.brand-art img')).toHaveAttribute(
      'src',
      '/logo/dongchedi/logo-chinese-official.svg',
    );
    await expect(card.locator('.card-materials')).toContainText('1 份素材');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('card previews keep Codeberg color variants at a consistent icon size', async ({ page }) => {
  const card = page.locator('[data-brand="codeberg"]');
  const widths: number[] = [];
  for (const file of ['icon-blue.svg', 'icon-white.svg']) {
    await page.goto(`/?q=${encodeURIComponent(`Codeberg ${file}`)}`);
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await expect(card.locator('.card-materials')).toContainText('1 份素材');
    const image = card.locator('.brand-art img');
    await expect(image).toHaveAttribute('src', `/logo/codeberg/${file}`);
    await image.evaluate((element: HTMLImageElement) => element.decode());
    const bounds = await image.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width, `${file} should fill the icon preview target`).toBeGreaterThanOrEqual(60);
    widths.push(bounds!.width);
  }
  expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
});

test('small raster detail previews stay within the available pixels at each display density', async ({
  browser,
}) => {
  for (const density of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: density,
    });
    try {
      const page = await context.newPage();
      await page.goto('/logo/zte/?asset=wordmark-blue-header-official.png');
      await expect(page.locator('#theme-toggle')).toBeEnabled();
      const image = page.locator('#detail-image');
      await image.evaluate((element: HTMLImageElement) => element.decode());
      const pixels = await image.evaluate((element: HTMLImageElement) => {
        const bounds = element.getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
          density: window.devicePixelRatio,
        };
      });
      expect(pixels.naturalWidth).toBe(92);
      expect(pixels.width * pixels.density).toBeLessThanOrEqual(pixels.naturalWidth + 1);
      expect(pixels.height * pixels.density).toBeLessThanOrEqual(pixels.naturalHeight + 1);
      await page
        .locator(
          '.version-section > .variant-list [data-select-asset="wordmark-blue-official.png"]',
        )
        .click();
      await expect(image).toHaveAttribute('src', /wordmark-blue-official\.png$/);
      await expect
        .poll(() => image.evaluate((element) => element.getBoundingClientRect().width))
        .toBeGreaterThan(200);
      await page.goBack();
      await expect(image).toHaveAttribute('src', /wordmark-blue-header-official\.png$/);
      await expect
        .poll(() =>
          image.evaluate((element) => element.getBoundingClientRect().width * devicePixelRatio),
        )
        .toBeLessThanOrEqual(93);
    } finally {
      await context.close();
    }
  }
});

test('primary artwork choices keep source alternatives out of the main list while exact links remain usable', async ({
  page,
}) => {
  await page.goto('/logo/zte/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const primary = page.locator('.version-section > .variant-list [data-select-artwork]');
  await expect(primary).toHaveCount(2);
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /wordmark-blue-official\.png$/,
  );
  const alternatives = page.locator('details.artwork-alternatives');
  await expect(alternatives).toHaveJSProperty('open', false);
  await alternatives.locator('summary').click();
  await expect(alternatives.locator('[data-select-artwork]')).toHaveCount(1);
  await alternatives.locator('[data-select-asset="wordmark-blue-header-official.png"]').click();
  await expect(alternatives).toHaveJSProperty('open', true);
  await expect(alternatives.locator('[aria-current="true"]')).toHaveAttribute(
    'data-select-asset',
    'wordmark-blue-header-official.png',
  );
  await expect(page.locator('.asset-action-panel')).toContainText('92 × 44');
  await expect(page.locator('.asset-action-panel')).toContainText('#008ED3');
  await expect(page.locator('.asset-action-panel')).toContainText('低分辨率原图');
  await page.reload();
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(alternatives).toHaveJSProperty('open', true);
  await expect(alternatives.locator('[aria-current="true"]')).toHaveAttribute(
    'data-select-asset',
    'wordmark-blue-header-official.png',
  );
});

test('removed source files leave selection, search and format filters and their former URLs return 404', async ({
  page,
  request,
}) => {
  for (const [id, file] of removedSources) {
    await page.goto(`/logo/${id}/`);
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await expect(page.locator(`[data-select-asset="${file}"]`)).toHaveCount(0);
    await expect(page.locator(`a[download][href$="/${file}"]`)).toHaveCount(0);
    await page.goto(`/?q=${encodeURIComponent(`${id} ${file}`)}`);
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await expect(page.locator('#brand-grid .brand-card')).toHaveCount(0);
    const response = await request.get(`/logo/${id}/${file}`);
    expect(response.status()).toBe(404);
  }
  await page.goto('/?q=ZTE%20%E9%9D%92%E8%89%B2');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  // Useful JPG originals remain available after redundant JPG files are removed.
  await chooseFilter(page, 'format-filter', 'JPG');
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(17);
  await expect(page.locator('[data-brand="kingdee"]')).toHaveCount(0);
  await expect(page.locator('[data-brand="kuaishou"]')).toHaveCount(1);
  await expect(page.locator('[data-brand="xiaohongshu"]')).toHaveCount(0);
  await expect(page.locator('[data-brand="yonyou"]')).toHaveCount(0);
});

test('removed file selections fall back to the brand default without a replacement alias', async ({
  page,
}) => {
  for (const legacy of [false, true]) {
    const query = new URLSearchParams({
      asset: 'logo-gradient-vertical.png',
      q: 'minimax',
      category: 'ai',
      format: 'PNG',
      type: 'company',
      tracking: 'kept',
    });
    if (legacy) query.set('brand', 'minimax');
    await page.goto(`${legacy ? '/' : '/logo/minimax/'}?${query}#preview`);
    await expect(page.locator('#detail-copy-menu')).toBeEnabled();
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      /\/logo\/minimax\/logo-gradient-horizontal\.png$/,
    );
    const result = new URL(page.url());
    expect(result.pathname).toBe('/logo/minimax/');
    expect(result.searchParams.get('q')).toBe('minimax');
    expect(result.searchParams.get('category')).toBe('ai');
    expect(result.searchParams.get('format')).toBe('PNG');
    expect(result.searchParams.get('type')).toBe('company');
    expect(result.searchParams.get('tracking')).toBe('kept');
    expect(result.searchParams.has('brand')).toBe(false);
    if (legacy) expect(result.searchParams.has('asset')).toBe(false);
    expect(result.hash).toBe('#preview');
    await expect(page.locator('[data-select-asset="logo-gradient-vertical.png"]')).toHaveCount(0);
  }
});

test('legacy brand links use the directory preference only when no file is requested', async ({
  page,
}) => {
  for (const [requested, expected] of [
    [undefined, 'logo-gradient-horizontal.png'],
    ['', 'logo-gradient-horizontal.png'],
    ['logo-gradient-horizontal.png', 'logo-gradient-horizontal.png'],
    ['logo-gradient-vertical-official.png', 'logo-gradient-vertical-official.png'],
  ] as const) {
    const query = new URLSearchParams({ brand: 'minimax', q: 'minimax' });
    if (requested !== undefined) query.set('asset', requested);
    await page.goto(`/?${query}`);
    await expect(page.locator('#detail-copy-menu')).toBeEnabled();
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      new RegExp(`/logo/minimax/${expected.replaceAll('.', '\\.')}$`),
    );
    const result = new URL(page.url());
    expect(result.pathname).toBe('/logo/minimax/');
    expect(result.searchParams.get('asset')).toBe(
      expected === 'logo-gradient-horizontal.png' ? null : expected,
    );
    expect(result.searchParams.get('q')).toBe('minimax');
    expect(result.searchParams.has('brand')).toBe(false);
  }
});

test('an explicit alternative search keeps the standard-color source and discloses its limitation on the card', async ({
  page,
}) => {
  await page.goto('/?q=ZTE%20%E6%A0%87%E5%87%86%E8%93%9D');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const card = page.locator('[data-brand="zte"]');
  await expect(card.locator('.brand-art img')).toHaveAttribute(
    'src',
    /wordmark-blue-header-official\.png$/,
  );
  await expect(card.locator('.card-restrictions')).toContainText('备选');
  await expect(card.locator('.card-download')).toHaveAttribute(
    'href',
    /wordmark-blue-header-official\.png$/,
  );
  await card.locator('.brand-link').click();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /wordmark-blue-header-official\.png$/,
  );
  await expect(page.locator('details.artwork-alternatives')).toHaveJSProperty('open', true);
});

test('search and file filters survive detail navigation, browser back and a reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await page.locator('.category-sidebar [data-category="developer-tools"]').click();
  await page.getByRole('searchbox', { name: '搜索 Logo' }).fill('Git');
  await chooseFilter(page, 'shape-filter', '图形');
  await chooseFilter(page, 'format-filter', 'SVG');
  await chooseFilter(page, 'type-filter', '产品');
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  await expect(page.locator('#result-count')).toContainText('1 个结果');
  const directory = page.url();
  expect(new URL(directory).searchParams.get('q')).toBe('Git');
  expect(new URL(directory).searchParams.get('shape')).toBe('icon');
  expect(new URL(directory).searchParams.get('type')).toBe('product');
  expect(new URL(directory).searchParams.get('category')).toBe('developer-tools');
  await page.locator('[data-brand-link="git"]').click();
  await expect(page).toHaveURL(/\/logo\/git\/\?/);
  await expect(page.getByRole('heading', { name: 'Git', exact: true, level: 1 })).toBeVisible();
  await expect
    .poll(async () =>
      canonicalUrl(
        await page
          .locator('#back-directory')
          .evaluate((element: HTMLAnchorElement) => element.href),
      ),
    )
    .toBe(canonicalUrl(directory));
  await page.goBack();
  await expect(page).toHaveURL(directory);
  await expect(page.locator('#search')).toHaveValue('Git');
  await expect(page.locator('.category-sidebar [data-category="developer-tools"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#search')).toHaveValue('Git');
  await expect(page.locator('.category-sidebar [data-category="developer-tools"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  await page.locator('[data-brand-link="git"]').click();
  await page.locator('#back-directory').click();
  await expect(page).toHaveURL((url) => canonicalUrl(url.href) === canonicalUrl(directory));
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('legacy brand links retain valid file selections and directory filters', async ({ page }) => {
  for (const [requested, expected] of [
    ['wordmark-orange-chinese.svg', 'wordmark-orange-chinese.svg'],
    ['missing.svg', 'logo-chinese-horizontal-official.png'],
  ]) {
    await page.goto(`/?brand=alibaba&asset=${requested}&q=alibaba&category=internet&format=SVG`);
    await expect(page).toHaveURL(/\/logo\/alibaba\//);
    await expect(page.locator('#detail-copy-menu')).toBeEnabled();
    const url = new URL(page.url());
    expect(url.searchParams.has('brand')).toBe(false);
    expect(url.searchParams.get('q')).toBe('alibaba');
    expect(url.searchParams.get('category')).toBe('internet');
    expect(url.searchParams.get('format')).toBe('SVG');
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      new RegExp(`/logo/alibaba/${expected.replaceAll('.', '\\.')}$`),
    );
    const back = new URL(
      await page.locator('#back-directory').evaluate((element: HTMLAnchorElement) => element.href),
    );
    expect(back.searchParams.get('category')).toBe('internet');
  }
});

test('deep-linked variants and denied clipboard access retain the selected original', async ({
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
  await page.goto('/logo/git/?asset=logo-white.svg&q=Git&type=product&format=SVG&shape=logo');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logo\/git\/logo-white\.svg$/,
  );
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/logo\/git\/logo-white\.svg$/,
  );
  await page.locator('[data-select-asset="logo-color.svg"]').click();
  await expect(page).toHaveURL(/asset=logo-color\.svg/);
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logo\/git\/logo-color\.svg$/,
  );
  expect(new URL(page.url()).searchParams.get('q')).toBe('Git');
  await chooseCopy(page, 'current');
  await expect(page.locator('#action-status')).toContainText('手动复制');
  const manual = page.getByRole('textbox', { name: '手动复制' });
  await expect(manual).toBeVisible();
  await expect(manual).toBeFocused();
  await expect(manual).toHaveValue(new URL('/logo/git/logo-color.svg', page.url()).href);
  expect(
    await manual.evaluate((element: HTMLTextAreaElement) => ({
      start: element.selectionStart,
      end: element.selectionEnd,
      length: element.value.length,
    })),
  ).toEqual({
    start: 0,
    end: (await manual.inputValue()).length,
    length: (await manual.inputValue()).length,
  });
  await page.locator('#dismiss-feedback').click();
  await expect(page.locator('#detail-copy-menu')).toBeFocused();
  await page.goBack();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logo\/git\/logo-white\.svg$/,
  );
  await page.reload();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logo\/git\/logo-white\.svg$/,
  );
});

test('completing a pending copy after switching artwork cannot show stale success', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pending: (() => void)[] = [];
    Object.assign(window, { __pendingCopies: pending });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => new Promise<void>((resolve) => pending.push(resolve)) },
    });
  });
  await page.goto('/logo/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await chooseCopy(page, 'current');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __pendingCopies: unknown[] }).__pendingCopies.length,
      ),
    )
    .toBe(1);
  await page.locator('[data-select-asset="wordmark-orange-chinese.svg"]').click();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logo\/alibaba\/wordmark-orange-chinese\.svg$/,
  );
  await page.evaluate(async () => {
    (window as unknown as { __pendingCopies: (() => void)[] }).__pendingCopies.shift()!();
    // Let the Clipboard promise, feedback continuation, and Svelte DOM update
    // finish before asserting the old operation never announces success.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect(page.locator('#copy-feedback')).toBeHidden();
  await expect(page.locator('#action-status')).toHaveText('');
});

test('reselecting the current variant resets a pending export and discards its late result', async ({
  page,
}) => {
  let releaseSource!: () => void;
  const sourceGate = new Promise<void>((resolve) => {
    releaseSource = resolve;
  });
  let sourceRequested = false;
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.route('**/logo/git/icon-orange.svg', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    sourceRequested = true;
    await sourceGate;
    await route.continue();
  });
  try {
    await page.goto('/logo/git/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await choosePngDownload(page);
    await expect.poll(() => sourceRequested).toBe(true);
    const exportButton = page.locator('#download-options');
    await expect(exportButton).toBeDisabled();
    await expect(exportButton).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#download-link')).toBeFocused();
    await page.locator('#download-link').hover();
    const disabledPaint = await exportButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderColor };
    });
    await exportButton.hover();
    expect(
      await exportButton.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderColor };
      }),
    ).toEqual(disabledPaint);
    await page.locator('[data-select-asset="icon-orange.svg"]').click();
    await expect(page.locator('#download-options')).toBeEnabled();
    const sourceResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/logo/git/icon-orange.svg') &&
        response.request().resourceType() === 'fetch',
    );
    releaseSource();
    await sourceResponse;
    // A stale operation may deliberately leave the response body unread. Its
    // fetch continuation runs after headers; wait for that continuation and DOM
    // updates rather than requiring consumption of an abandoned source body.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(downloads).toEqual([]);
    await expect(page.locator('#copy-feedback')).toBeHidden();
  } finally {
    releaseSource();
  }
});

for (const scenario of [
  {
    name: 'image URL copy',
    kind: 'current',
    message: '已复制图片地址。',
    denied: false,
    exportFails: false,
  },
  {
    name: 'share copy',
    kind: 'share',
    message: '已复制素材分享地址。',
    denied: false,
    exportFails: false,
  },
  {
    name: 'denied embed copy',
    kind: 'html',
    message: '无法自动复制，已选中内容，请手动复制。',
    denied: true,
    exportFails: false,
  },
  {
    name: 'denied image URL copy with export failure',
    kind: 'current',
    message: '无法自动复制，已选中内容，请手动复制。',
    denied: true,
    exportFails: true,
  },
] as const) {
  test(`PNG export and copy feedback: ${scenario.name} preserves the newer copy result`, async ({
    page,
  }, testInfo) => {
    if (scenario.denied) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: () =>
              Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
          },
        });
      });
    } else {
      await recordTextCopies(page);
    }
    let releaseSource!: () => void;
    const sourceGate = new Promise<void>((resolve) => {
      releaseSource = resolve;
    });
    let sourceRequested = false;
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    await page.route('**/logo/git/icon-orange.svg', async (route) => {
      if (route.request().resourceType() !== 'fetch') return route.continue();
      sourceRequested = true;
      await sourceGate;
      if (scenario.exportFails) return route.fulfill({ status: 503, body: 'Source unavailable' });
      await route.continue();
    });
    try {
      await page.goto('/logo/git/');
      await expect(page.locator('#theme-toggle')).toBeEnabled();
      const copiedValue =
        scenario.kind === 'share'
          ? page.url()
          : scenario.kind === 'html'
            ? await page.locator('#html-example').inputValue()
            : await page
                .locator('#download-link')
                .evaluate((element: HTMLAnchorElement) => element.href);
      await choosePngDownload(page);
      await expect.poll(() => sourceRequested).toBe(true);
      await expect(page.locator('#download-options')).toBeDisabled();
      await chooseCopy(page, scenario.kind);
      await expect(page.locator('#action-status')).toHaveText(scenario.message);
      if (scenario.denied) await expect(page.locator('#manual-address')).toHaveValue(copiedValue);
      else await expectLastCopy(page, copiedValue);

      if (scenario.exportFails) {
        releaseSource();
        await expect(page.locator('#download-options')).toBeEnabled();
        expect(downloads).toEqual([]);
      } else {
        const downloadPromise = page.waitForEvent('download', { timeout: 3_000 });
        releaseSource();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('git-icon-orange-export-2048.png');
        const path = testInfo.outputPath('export-after-copy.png');
        await download.saveAs(path);
        const bytes = await readFile(path);
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(
          await page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            return [image.naturalWidth, image.naturalHeight];
          }, bytes.toString('base64')),
        ).toEqual([2048, 2048]);
        await expect(page.locator('#download-options')).toBeEnabled();
      }
      await expect(page.locator('#action-status')).toHaveText(scenario.message);
      if (scenario.denied) {
        const manual = page.locator('#manual-address');
        await expect(manual).toBeVisible();
        await expect(manual).toBeFocused();
        await expect(manual).toHaveValue(copiedValue);
        await expect(manual).toHaveJSProperty('readOnly', true);
        expect(
          await manual.evaluate((element: HTMLTextAreaElement) => [
            element.selectionStart,
            element.selectionEnd,
          ]),
        ).toEqual([0, copiedValue.length]);
      }
    } finally {
      releaseSource();
    }
  });
}

test('the SVG-only download menu generates a decodable PNG at the original aspect and transparent background', async ({
  page,
}, testInfo) => {
  await page.goto('/logo/git/?asset=logo-color.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#export-size, .export-details')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await choosePngDownload(page);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('git-logo-color-export-2048.png');
  const path = testInfo.outputPath('git-export-2048.png');
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  // Decode the downloaded bytes in the browser. A header-only fixture or a
  // fabricated success message cannot pass the size/visible-pixels checks.
  const image = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0,
      painted = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] === 0) transparent++;
      if (pixels[index] > 0) painted++;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      transparent,
      painted,
      cornerAlpha: pixels[3],
    };
  }, bytes.toString('base64'));
  expect(image.width).toBe(2048);
  expect(image.height).toBe(Math.round((2048 * 92) / 219));
  expect(image.transparent).toBeGreaterThan(image.width * image.height * 0.1);
  expect(image.painted).toBeGreaterThan(image.width * image.height * 0.05);
  expect(image.cornerAlpha).toBe(0);
  await expect(page.locator('#action-status')).toContainText(
    `已下载 ${image.width} × ${image.height} px PNG（由 SVG 生成 · 长边 2048px）`,
  );
});

test('format buttons and extra filters work by keyboard and theme survives narrow-screen navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: '搜索 Logo' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.locator('#search')).toBeFocused();
  const format = page
    .getByRole('group', { name: '文件格式', exact: true })
    .getByRole('button', { name: 'SVG', exact: true });
  await format.focus();
  await format.press('Enter');
  await expect(format).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('format')).toBe('SVG');
  await page.locator('#more-filters-trigger').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '更多筛选', exact: true })).toBeVisible();
  await expect(page.locator('#shape-filter')).toBeFocused();
  const type = page.locator('#type-filter');
  await type.focus();
  await type.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(type).toBeFocused();
  await expect(page.locator('#extra-filter-panel')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('type')).toBe('product');
  await page.getByRole('button', { name: '切换到深色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#search').fill('Git');
  await page.locator('[data-brand-link="git"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('button', { name: '切换到浅色主题' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('card material summaries open details while preview, download and copied address share the cover', async ({
  page,
}) => {
  await recordTextCopies(page);
  await page.goto('/?q=阿里巴巴');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const card = page.locator('.brand-card[data-brand="alibaba"]');
  const file = 'logo-chinese-horizontal-official.png';
  const directory = page.url();
  const address = new URL(`/logo/alibaba/${file}`, page.url()).href;
  await expect(card.locator('.brand-art img')).toHaveAttribute('src', `/logo/alibaba/${file}`);
  await expect(card.locator('.card-download')).toHaveAttribute('href', `/logo/alibaba/${file}`);
  await expect(card.locator('.card-download')).toHaveAttribute('download', `alibaba-${file}`);
  await expect(card.locator('.card-materials')).toContainText('6 份素材');
  const detailHref = (await card.locator('[data-brand-link]').getAttribute('href'))!;
  await expect(card.locator('.card-materials')).toHaveAttribute('href', detailHref);
  const detail = new URL(detailHref, page.url());
  expect(detail.searchParams.has('asset')).toBe(false);
  expect(detail.searchParams.get('q')).toBe('阿里巴巴');
  await chooseCopy(page, 'current', card.locator('[data-copy-brand="alibaba"]'));
  await expectLastCopy(page, address);
  expect(page.url()).toBe(directory);
  await card.locator('.card-materials').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/logo/alibaba/${file}`);
  const chineseWordmark = page.locator(
    '.version-section > .variant-list [data-select-asset="wordmark-orange-chinese.svg"]',
  );
  await chineseWordmark.click();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/wordmark-orange-chinese\.svg$/,
  );
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-orange-chinese\.svg$/,
  );
  await page.locator('#back-directory').click();
  await expect(page).toHaveURL(directory);
  await expect(page.locator('#search')).toHaveValue('阿里巴巴');
});

test('reviewed horizontal covers share their selected file with details, downloads and copied addresses', async ({
  page,
}) => {
  await recordTextCopies(page);
  const covers = {
    xiaomi: 'logo-horizontal-official.svg',
    huawei: 'logo-flat-horizontal-official.svg',
    weibo: 'logo-chinese-horizontal-official.svg',
    'alibaba-cloud': 'logo-chinese-horizontal.svg',
    'ping-an': 'logo-horizontal.svg',
  };
  for (const [id, file] of Object.entries(covers)) {
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    const card = page.locator(`article[data-brand="${id}"]`);
    const path = `/logo/${id}/${file}`;
    await expect(card.locator('.brand-art img')).toHaveAttribute('src', path);
    await expect(card.locator('.card-download')).toHaveAttribute('href', path);
    const detailHref = (await card.locator('[data-brand-link]').getAttribute('href'))!;
    await expect(card.locator('.card-materials')).toHaveAttribute('href', detailHref);
    expect(new URL(detailHref, page.url()).searchParams.get('asset')).toBe(file);
    await chooseCopy(page, 'current', card.locator('[data-copy-brand]'));
    await expectLastCopy(page, new URL(path, page.url()).href);
    await card.locator('.card-materials').click();
    await expect(page.locator('#detail-image')).toHaveAttribute('src', path);
  }
});

test('changing a file filter discards a pending SVG copy from the previous cover', async ({
  page,
}) => {
  await recordTextCopies(page);
  let releaseSource!: () => void;
  const sourceGate = new Promise<void>((resolve) => {
    releaseSource = resolve;
  });
  let sourceRequested = false;
  await page.route('**/logo/alibaba/wordmark-orange-chinese.svg', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    sourceRequested = true;
    await sourceGate;
    await route.continue();
  });
  try {
    await page.goto('/?q=阿里巴巴&format=SVG');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    const card = page.locator('.brand-card[data-brand="alibaba"]');
    await chooseCopy(page, 'svg', card.locator('[data-copy-brand="alibaba"]'));
    await expect.poll(() => sourceRequested).toBe(true);
    await page.locator('#format-filter [data-format="PNG"]').click();
    await expect(card.locator('.brand-art img')).toHaveAttribute(
      'src',
      /\/logo-chinese-horizontal-official\.png$/,
    );
    const sourceResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/logo/alibaba/wordmark-orange-chinese.svg') &&
        response.request().resourceType() === 'fetch',
    );
    releaseSource();
    await (await sourceResponse).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(
      await page.evaluate(() => (window as unknown as { __copiedTexts: string[] }).__copiedTexts),
    ).toEqual([]);
    await expect(page.locator('#copy-feedback')).toBeHidden();
    await expect(page.locator('#action-status')).toHaveText('');
  } finally {
    releaseSource();
  }
});

test('opening category drawer discards pending copy feedback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const denied: string[] = [];
    Object.assign(window, { __deniedCopies: denied });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          denied.push(value);
          return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
        },
      },
    });
  });
  let releaseSource!: () => void;
  const sourceGate = new Promise<void>((resolve) => {
    releaseSource = resolve;
  });
  let sourceRequested = false;
  await page.route('**/logo/alibaba/wordmark-orange.svg', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    sourceRequested = true;
    await sourceGate;
    await route.continue();
  });
  try {
    await page.goto(`/?q=${encodeURIComponent('阿里巴巴 wordmark-orange.svg')}&format=SVG`);
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    const card = page.locator('[data-brand="alibaba"]');
    const copyTrigger = page.locator('[data-copy-brand="alibaba"]');
    const categoryTrigger = page.getByRole('button', { name: '打开品牌分类', exact: true });
    const drawer = page.getByRole('dialog', { name: '资源分类', exact: true });
    await expect(card.locator('.brand-art img')).toHaveAttribute(
      'src',
      '/logo/alibaba/wordmark-orange.svg',
    );
    await expect(card.locator('.card-materials')).toContainText('1 份素材');
    await chooseCopy(page, 'svg', copyTrigger);
    await expect.poll(() => sourceRequested).toBe(true);
    await categoryTrigger.click();
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    const sourceResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/logo/alibaba/wordmark-orange.svg') &&
        response.request().resourceType() === 'fetch',
    );
    releaseSource();
    await (await sourceResponse).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('#copy-feedback')).toBeHidden();
    await expect(page.locator('#action-status')).toHaveText('');
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    expect(
      await page.evaluate(() => (window as unknown as { __deniedCopies: string[] }).__deniedCopies),
    ).toEqual([]);

    await drawer.getByRole('button', { name: '关闭分类', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(categoryTrigger).toBeFocused();
    await chooseCopy(page, 'current', copyTrigger);
    await expect(page.locator('#manual-address')).toBeFocused();
    await expect(page.locator('#manual-address')).toHaveValue(
      new URL('/logo/alibaba/wordmark-orange.svg', page.url()).href,
    );
    await categoryTrigger.click();
    await expect(drawer).toBeVisible();
    await expect(page.locator('#copy-feedback')).toBeHidden();
    await expect(page.locator('#action-status')).toHaveText('');
    await expect
      .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await drawer.getByRole('button', { name: '关闭分类', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('#copy-feedback')).toBeHidden();
    await expect(categoryTrigger).toBeFocused();
  } finally {
    releaseSource();
  }
});

test('PNG filtering limits covers, material counts and downloads to available PNG originals', async ({
  page,
}) => {
  await page.goto('/?format=PNG');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#format-filter [data-format="PNG"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const images = page.locator('#brand-grid .brand-card img');
  await expect(images.first()).toBeVisible();
  const wrongFormats = await images.evaluateAll((elements) =>
    elements.map((image) => image.getAttribute('src')).filter((src) => !src?.endsWith('.png')),
  );
  expect(wrongFormats).toEqual([]);
  const nio = page.locator('.brand-card[data-brand="nio"]');
  await expect(nio.locator('.brand-art img')).toHaveAttribute('src', /\/icon-turquoise-app\.png$/);
  await expect(nio.locator('.card-materials')).toContainText('1 份素材');
  await expect(nio.locator('.card-download')).toHaveAttribute('href', /\/icon-turquoise-app\.png$/);
  const alibaba = page.locator('.brand-card[data-brand="alibaba"]');
  await expect(alibaba.locator('.brand-art img')).toHaveAttribute(
    'src',
    /\/logo-chinese-horizontal-official\.png$/,
  );
  await expect(alibaba.locator('.card-materials')).toContainText('4 份素材');
  await expect(page.locator('.brand-card[data-brand="xiaomi"]')).toHaveCount(0);
  await nio.locator('[data-brand-link]').click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/icon-turquoise-app\.png$/);
  expect(new URL(page.url()).searchParams.get('format')).toBe('PNG');
});

test('mobile category drawer and copy menu support keyboard use while original download starts in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await recordTextCopies(page);
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const categoryTrigger = page.getByRole('button', { name: '打开品牌分类', exact: true });
  await expect(categoryTrigger).toBeEnabled();
  await categoryTrigger.focus();
  await categoryTrigger.press('Enter');
  const drawer = page.getByRole('dialog', { name: '资源分类', exact: true });
  await expect(drawer).toBeVisible();
  const category = drawer.locator('[data-category="internet"]');
  await category.focus();
  await category.press('Enter');
  await expect(drawer).toBeHidden();
  await expect(categoryTrigger).toBeFocused();
  expect(new URL(page.url()).searchParams.get('category')).toBe('internet');
  await categoryTrigger.press('Enter');
  await expect(category).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(categoryTrigger).toBeFocused();
  await page.locator('[data-brand-link="alibaba"]').click();
  await expect(page.locator('#detail-copy-menu')).toBeEnabled();
  await page
    .locator('.version-section > .variant-list [data-select-asset="wordmark-orange.svg"]')
    .click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.svg$/);
  const download = page.locator('#download-link');
  await expect(download).toBeInViewport();
  const bounds = await download.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  const copyTrigger = page.locator('#detail-copy-menu');
  await copyTrigger.focus();
  await copyTrigger.press('ArrowDown');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // Bits applies opening focus after the menu becomes visible. Let that focus
  // settle before navigation so it cannot overwrite the result of End.
  const firstCopyItem = menu.locator('[data-copy-kind="svg"]');
  await expect(firstCopyItem).toBeFocused();
  await firstCopyItem.press('End');
  await expect(menu.locator('[data-copy-kind="share"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(copyTrigger).toBeFocused();
  await expectLastCopy(page, page.url());
  await copyTrigger.press('ArrowDown');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(copyTrigger).toBeFocused();
  await page.locator('#back-directory').click();
  expect(new URL(page.url()).searchParams.get('category')).toBe('internet');
  await expect(page.locator('.directory-title h1')).toHaveText('互联网');
  await page.getByRole('button', { name: '打开品牌分类', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: '资源分类', exact: true })
      .locator('[data-category="internet"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '打开品牌分类', exact: true })).toBeFocused();
});

test('mobile category drawer locks background wheel scrolling and closes through its overlay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const trigger = page.getByRole('button', { name: '打开品牌分类', exact: true });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: '资源分类', exact: true });
  await expect(drawer).toBeVisible();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(382, 420);
  await page.mouse.wheel(0, 600);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  // The rightmost point is outside the drawer's 320px / 85vw content.
  await page.mouse.click(382, 420);
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  // Dialog focus restores before its delayed body scroll-lock cleanup finishes.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [document.documentElement, document.body].every((element) => {
          const style = getComputedStyle(element);
          return !['hidden', 'clip'].includes(style.overflowY) && style.pointerEvents !== 'none';
        }),
      ),
    )
    .toBe(true);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
});

test('without JavaScript the static home, source disclosure and original download remain usable', async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.locator('#brand-grid .brand-card')).toHaveCount(catalog.brands.length);
    const dongchedi = page.locator('.brand-card[data-brand="dongchedi"]');
    await expect(dongchedi.locator('.brand-art img')).toHaveAttribute(
      'src',
      '/logo/dongchedi/logo-chinese-official.svg',
    );
    await expect(dongchedi.locator('[data-brand-link]')).toHaveAttribute(
      'href',
      '/logo/dongchedi/',
    );
    await page.locator('.brand-card[data-brand="alibaba"] .card-materials').click();
    await expect(page).toHaveURL(/\/logo\/alibaba\/$/);
    await expect(
      page.getByRole('heading', { name: '阿里巴巴集团', exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator('.legal-names')).toHaveCount(0);
    const sources = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^来源与使用说明/ }) });
    await expect(sources).toHaveJSProperty('open', true);
    await expect(
      page.locator('a[href="https://www.alibabagroup.com/en-US/resource-logos"]').first(),
    ).toBeVisible();
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      /\/logo\/alibaba\/logo-chinese-horizontal-official\.png$/,
    );
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-link').click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('original.png');
    await download.saveAs(path);
    const original = await readFile(
      new URL('../../logo/alibaba/logo-chinese-horizontal-official.png', import.meta.url),
    );
    expect(
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ).toBe(createHash('sha256').update(original).digest('hex'));
    await expect(page.locator('[data-select-asset="wordmark-orange-chinese.svg"]')).toHaveAttribute(
      'href',
      /\/logo\/alibaba\/wordmark-orange-chinese\.svg$/,
    );
    await expect(page.locator('.variant-list [data-select-artwork]')).toHaveCount(6);
    await expect(page.locator('.format-option')).toHaveCount(0);
    await expect(page.locator('a[href$="/wordmark-orange.png"]')).toHaveCount(0);
    await expect(page.locator('#download-options')).toHaveCount(0);
    await page.locator('#back-directory').click();
    await expect(page.locator('#brand-grid .brand-card')).toHaveCount(catalog.brands.length);
    for (const id of new Set(removedSources.map(([brand]) => brand))) {
      await page.goto(`/logo/${id}/`);
      for (const [, file] of removedSources.filter(([brand]) => brand === id)) {
        await expect(page.locator(`[data-select-asset="${file}"]`)).toHaveCount(0);
        await expect(page.locator(`a[href$="/${file}"]`)).toHaveCount(0);
      }
      await expect(page.locator('#download-link')).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test('details show sources by default and preserve attribution, restrictions and embed copying', async ({
  page,
}) => {
  await recordTextCopies(page);
  await page.goto('/logo/iqiyi/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.getByRole('link', { name: /下载.*SVG/ })).toBeVisible();
  await expect(page.getByText('品牌与主体信息', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/No copyright attribution required/)).toHaveCount(0);
  await expect(page.getByText(/保存该文件页提供的 SVG 原始字节/)).toHaveCount(0);
  const sources = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^来源与使用说明/ }) });
  await expect(sources).toHaveJSProperty('open', true);
  await expect(
    sources.getByRole('link', { name: 'Commons 公共领域判定', exact: true }),
  ).toHaveCount(1);
  await expect(
    sources.getByRole('link', { name: 'Commons 公共领域判定', exact: true }),
  ).toBeVisible();

  const embed = page.locator('.embed-details');
  await expect(embed).toHaveJSProperty('open', false);
  await embed.locator('summary').click();
  for (const id of ['html-example', 'markdown-example']) {
    const value = await page.locator(`#${id}`).inputValue();
    expect(value).toContain('/logo/iqiyi/wordmark-green.svg');
    await page.locator(`[data-copy-target="${id}"]`).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1),
        ),
      )
      .toBe(value);
  }

  await page.goto('/logo/git/');
  const gitSources = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^来源与使用说明/ }) });
  await expect(gitSources.locator('summary')).toContainText('需署名');
  await expect(gitSources).toHaveJSProperty('open', true);
  await expect(gitSources.getByText(/Git Logo by Jason Long/)).toBeVisible();
  await page.goto('/logo/gitlab/?asset=icon-legacy.png');
  await expect(
    page.locator('.asset-warnings').getByText('仅限非商业用途', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/历史素材，不代表现行标识/)).toBeVisible();
});

test('SVG artwork offers original and generated downloads while links retain the selected source', async ({
  page,
}, testInfo) => {
  await recordTextCopies(page);
  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg&q=阿里巴巴&format=SVG');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const choices = page.locator('.variant-list [data-select-artwork]');
  await expect(choices).toHaveCount(6);
  const english = page.locator('[data-select-artwork="file:wordmark-orange.svg"]');
  await expect(english).toHaveCount(1);
  await expect(page.locator('.variant-list img')).toHaveCount(6);
  const artworkId = await english.getAttribute('data-select-artwork');
  await expect(english).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.format-option')).toHaveCount(0);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.svg$/);
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/wordmark-orange\.svg$/);
  await expect(page.locator('#download-options')).toBeEnabled();

  const currentAddress = new URL('/logo/alibaba/wordmark-orange.svg', page.url()).href;
  await chooseCopy(page, 'current');
  await expectLastCopy(page, currentAddress);
  await chooseCopy(page, 'share');
  const share = await page.evaluate(() =>
    (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1)!,
  );
  expect(new URL(share).searchParams.get('asset') || 'wordmark-orange.svg').toBe(
    'wordmark-orange.svg',
  );
  expect(new URL(share).searchParams.get('q')).toBe('阿里巴巴');

  const embed = page.locator('.embed-details');
  await embed.locator('summary').click();
  await expect(page.locator('#current-address')).toHaveValue(currentAddress);
  for (const id of ['html-example', 'markdown-example']) {
    const value = await page.locator(`#${id}`).inputValue();
    expect(value).toContain('/logo/alibaba/wordmark-orange.svg');
    await page.locator(`[data-copy-target="${id}"]`).click();
    await expectLastCopy(page, value);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-link').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('alibaba-wordmark-orange.svg');
  const path = testInfo.outputPath('alibaba-original.svg');
  await download.saveAs(path);
  const original = await readFile(
    new URL('../../logo/alibaba/wordmark-orange.svg', import.meta.url),
  );
  expect(
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  ).toBe(createHash('sha256').update(original).digest('hex'));

  const selectedUrl = page.url();
  const generatedDownloadPromise = page.waitForEvent('download');
  await choosePngDownload(page);
  const generatedDownload = await generatedDownloadPromise;
  expect(generatedDownload.suggestedFilename()).toBe('alibaba-wordmark-orange-export-2048.png');
  const generatedPath = testInfo.outputPath('alibaba-generated.png');
  await generatedDownload.saveAs(generatedPath);
  const generated = await readFile(generatedPath);
  expect(generated.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(generated.readUInt32BE(16)).toBe(2048);
  expect(generated.readUInt32BE(20)).toBe(Math.round((2048 * 122) / 773));
  expect(page.url()).toBe(selectedUrl);
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/wordmark-orange\.svg$/);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.svg$/);
  await expect(page.locator('#current-address')).toHaveValue(currentAddress);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-artwork',
    artworkId!,
  );
  await chooseCopy(page, 'svg');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1)),
    )
    .toMatch(/<svg\b/);
  expect(new URL(page.url()).searchParams.get('q')).toBe('阿里巴巴');
  expect(new URL(page.url()).searchParams.get('format')).toBe('SVG');
  await chooseCopy(page, 'current');
  await expectLastCopy(page, currentAddress);
  await page.locator('[data-select-asset="wordmark-orange-chinese.svg"]').click();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/wordmark-orange-chinese\.svg$/,
  );
  await page.reload();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/wordmark-orange-chinese\.svg$/,
  );
  await page.goBack();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.svg$/);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-artwork',
    artworkId!,
  );
});

test('PNG generation follows the selected PNG-only or SVG-only artwork', async ({ page }) => {
  await page.goto('/logo/huawei/?asset=wordmark-dark-2018.png');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-options, #export-size, .export-details')).toHaveCount(0);
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-dark-2018\.png$/,
  );
  await expect(page.locator('#detail-fileinfo')).toContainText('1280 × 219');
  await expect(page.locator('#download-options')).toHaveCount(0);

  // NIO retains a PNG application icon and an independent SVG lockup. The
  // selected artwork controls generation even when the brand supplies a PNG.
  await page.goto('/logo/nio/?asset=icon-turquoise-app.png');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-options')).toHaveCount(0);
  await page.locator('[data-select-asset="logo-black-english-official.svg"]').click();
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/logo-black-english-official\.svg$/,
  );
  await expect(page.locator('#download-options')).toBeEnabled();

  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-options')).toBeEnabled();
  await page.locator('[data-select-asset="wordmark-orange-chinese.svg"]').click();
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-orange-chinese\.svg$/,
  );
  const options = page.locator('#download-options');
  await expect(options).toBeEnabled();
  await options.click();
  const menu = page.getByRole('menu');
  const png = menu.locator('[data-download-kind="png"]');
  await expect(png).toContainText('下载 PNG');
  await expect(png).toContainText('由 SVG 生成');
  await expect(png).toContainText('长边 2048px');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(options).toBeFocused();
});

for (const denied of [false, true]) {
  test(`the PNG copy menu ${denied ? 'offers recovery after clipboard rejection' : 'copies the original PNG bytes'}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ denied }) => {
        const copies: { type: string; bytes: number[] }[] = [];
        Object.assign(window, { __copiedPngs: copies });
        class ImageClipboardItem {
          constructor(readonly data: Record<string, Blob | Promise<Blob>>) {}
          static supports(type: string) {
            return type === 'image/png';
          }
          getType(type: string) {
            return Promise.resolve(this.data[type]);
          }
        }
        Object.defineProperty(globalThis, 'ClipboardItem', {
          configurable: true,
          value: ImageClipboardItem,
        });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            write: async (items: ImageClipboardItem[]) => {
              if (denied) throw new DOMException('Permission denied', 'NotAllowedError');
              for (const item of items) {
                const png = await item.getType('image/png');
                copies.push({
                  type: png.type,
                  bytes: Array.from(new Uint8Array(await png.arrayBuffer())),
                });
              }
            },
          },
        });
      },
      { denied },
    );
    await page.goto('/logo/huawei/?asset=wordmark-dark-2018.png');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await expect(page.locator('.export-details, #copy-png-image')).toHaveCount(0);
    await chooseCopy(page, 'png');
    await expect(page.locator('#action-status')).toHaveText(
      denied ? '无法复制图片，请下载原图或复制图片地址。' : '已复制原始 PNG 图片。',
    );
    await expect(page.locator('#detail-copy-menu')).toBeFocused();
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      /\/wordmark-dark-2018\.png$/,
    );
    const copies = await page.evaluate(
      () =>
        (window as unknown as { __copiedPngs: { type: string; bytes: number[] }[] }).__copiedPngs,
    );
    if (denied) expect(copies).toEqual([]);
    else {
      expect(copies).toHaveLength(1);
      expect(copies[0].type).toBe('image/png');
      const original = await readFile(
        new URL('../../logo/huawei/wordmark-dark-2018.png', import.meta.url),
      );
      expect(createHash('sha256').update(Buffer.from(copies[0].bytes)).digest('hex')).toBe(
        createHash('sha256').update(original).digest('hex'),
      );
    }
    await page.goto('/logo/didi/?asset=logo-english.svg');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await page.locator('#detail-copy-menu').click();
    await expect(page.getByRole('menu').locator('[data-copy-kind="png"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
}

test('artwork choices retain distinct designs and colors after redundant formats are removed', async ({
  page,
}) => {
  for (const [id, count] of [
    ['codeberg', 6],
    ['git', 7],
    ['iflytek', 6],
    ['xiaomi', 2],
    ['zhipu', 5],
    ['lenovo', 0],
    ['meituan', 3],
    ['minimax', 4],
    ['yonyou', 3],
    ['zte', 2],
  ] as const) {
    await page.goto(`/logo/${id}/`);
    await expect(
      page.locator('.version-section > .variant-list [data-select-artwork]'),
      `${id}: retain meaningful visual choices`,
    ).toHaveCount(count);
  }
  await page.goto('/logo/codeberg/?asset=icon-white.png');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/icon-blue\.svg$/);
  await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', 'light');
  await expect(page.locator('[data-select-asset="icon-white.png"]')).toHaveCount(0);

  await page.goto('/logo/codeberg/?asset=icon-white.svg');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/icon-white\.svg$/);
  await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
  await page.reload();
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/icon-white\.svg$/);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-asset',
    'icon-white.svg',
  );
  await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
});

test('Tencent color choices retain their original files and sources without the redundant blue PNG', async ({
  page,
}) => {
  await recordTextCopies(page);
  await page.goto('/logo/tencent/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('.variant-list [data-select-artwork]')).toHaveCount(12);
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-blue-official\.png$/,
  );
  await expect(page.locator('#detail-fileinfo')).toContainText('2953 × 889');
  await expect(page.locator('.format-option')).toHaveCount(0);
  const sources = page.locator('.source-details');
  await expect(sources).toHaveJSProperty('open', true);
  await expect(
    sources.locator('a[href="https://www.tencent.com/zh-cn/newsroom/media-resources/"]'),
  ).toBeVisible();

  await expect(page.locator('details.file-options')).toHaveCount(0);
  await expect(page.locator('[data-select-asset="wordmark-blue.png"]')).toHaveCount(0);
  await expect(page.locator('a[href$="/wordmark-blue.png"]')).toHaveCount(0);
  const files = [
    ['wordmark-black-official.png', 'light', '01_Tencent_Logo_Black.png'],
    ['wordmark-white-official.png', 'dark', '01_Tencent_Logo_Reverse-type.png'],
    ['wordmark-blue-official.png', 'light', '01_Tencent_Standard-Logo.png'],
  ] as const;
  for (const [file, background, sourceFile] of files) {
    await page.locator(`.variant-list [data-select-asset="${file}"]`).click();
    await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
      'data-select-asset',
      file,
    );
    await expect(page.locator('#detail-image')).toHaveAttribute('src', `/logo/tencent/${file}`);
    await expect(page.locator('#download-link')).toHaveAttribute('href', `/logo/tencent/${file}`);
    await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', background);
    await expect(page.locator('#detail-fileinfo')).toContainText('2953 × 889');
    if ((await sources.getAttribute('open')) === null) await sources.locator('summary').click();
    await expect(
      sources.locator(`a[href="https://www.tencent.com/wp-content/uploads/2022/12/${sourceFile}"]`),
    ).toBeVisible();
    await expect(
      sources.locator('a[href="https://www.tencent.com/zh-cn/newsroom/media-resources/"]'),
    ).toBeVisible();
    await chooseCopy(page, 'current');
    await expectLastCopy(page, new URL(`/logo/tencent/${file}`, page.url()).href);
  }
  await page.goBack();
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-white-official\.png$/,
  );
  await page.goto('/logo/tencent/?asset=wordmark-blue.png');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-blue-official\.png$/,
  );
});
