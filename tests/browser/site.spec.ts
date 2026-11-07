import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.searchParams.sort();
  return url.href;
}

async function chooseFilter(page: Page, id: string, label: string) {
  const trigger = page.locator(`#${id}`);
  await expect(trigger).toHaveAttribute('role', 'combobox');
  await trigger.click();
  await page.getByRole('option', { name: label, exact: true }).click();
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

test('search and file filters survive detail navigation, browser back and a reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /切换到/);
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
  await page.getByRole('link', { name: '查看 Git Logo', exact: true }).click();
  await expect(page).toHaveURL(/\/logos\/git\/\?/);
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
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#search')).toHaveValue('Git');
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  await page.getByRole('link', { name: '查看 Git Logo', exact: true }).click();
  await page.locator('#back-directory').click();
  await expect(page).toHaveURL((url) => canonicalUrl(url.href) === canonicalUrl(directory));
  await expect(page.locator('#brand-grid .brand-card')).toHaveCount(1);
  expect(errors).toEqual([]);
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
  await page.goto('/logos/git/?asset=logo-white.svg&q=Git&type=product&format=SVG&shape=logo');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /切换到/);
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logos\/git\/logo-white\.svg$/,
  );
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/logos\/git\/logo-white\.svg$/,
  );
  await page.locator('[data-select-asset="logo-color.svg"]').click();
  await expect(page).toHaveURL(/asset=logo-color\.svg/);
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logos\/git\/logo-color\.svg$/,
  );
  expect(new URL(page.url()).searchParams.get('q')).toBe('Git');
  await page.locator('#copy-current').click();
  await expect(page.locator('#action-status')).toContainText('手动复制');
  const manual = page.getByRole('textbox', { name: '手动复制' });
  await expect(manual).toBeVisible();
  await expect(manual).toBeFocused();
  await expect(manual).toHaveValue(new URL('/logos/git/logo-color.svg', page.url()).href);
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
  await expect(page.locator('#copy-current')).toBeFocused();
  await page.goBack();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logos\/git\/logo-white\.svg$/,
  );
  await page.reload();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logos\/git\/logo-white\.svg$/,
  );
});

test('completing a pending copy after switching format within one artwork cannot show stale success', async ({
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
  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /切换到/);
  await page.locator('#copy-current').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __pendingCopies: unknown[] }).__pendingCopies.length,
      ),
    )
    .toBe(1);
  await page.locator('.format-option[data-select-asset="wordmark-orange.png"]').click();
  await expect(page.locator('#detail-image')).toHaveAttribute(
    'src',
    /\/logos\/alibaba\/wordmark-orange\.png$/,
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
  await page.route('**/logos/git/icon-orange.svg', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    sourceRequested = true;
    await sourceGate;
    await route.continue();
  });
  try {
    await page.goto('/logos/git/');
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    await page.locator('.export-details > summary').click();
    await page.locator('#export-png').click();
    await expect.poll(() => sourceRequested).toBe(true);
    await expect(page.locator('#export-png')).toBeDisabled();
    await page.locator('[data-select-asset="icon-orange.svg"]').click();
    await page.locator('.export-details > summary').click();
    await expect(page.locator('#export-png')).toBeEnabled();
    const sourceResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/logos/git/icon-orange.svg') &&
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
    selector: '#copy-current',
    message: '已复制图片地址。',
    denied: false,
    exportFails: false,
  },
  {
    name: 'share copy',
    selector: '#copy-share',
    message: '已复制素材分享地址。',
    denied: false,
    exportFails: false,
  },
  {
    name: 'denied embed copy',
    selector: '[data-copy-target="html-example"]',
    message: '无法自动复制，已选中内容，请手动复制。',
    denied: true,
    exportFails: false,
  },
  {
    name: 'denied image URL copy with export failure',
    selector: '#copy-current',
    message: '无法自动复制，已选中内容，请手动复制。',
    denied: true,
    exportFails: true,
  },
]) {
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
    await page.route('**/logos/git/icon-orange.svg', async (route) => {
      if (route.request().resourceType() !== 'fetch') return route.continue();
      sourceRequested = true;
      await sourceGate;
      if (scenario.exportFails) return route.fulfill({ status: 503, body: 'Source unavailable' });
      await route.continue();
    });
    try {
      await page.goto('/logos/git/');
      await expect(page.locator('#theme-toggle')).toBeEnabled();
      if (scenario.selector.includes('html-example'))
        await page
          .locator('.resource-details')
          .filter({ hasText: '嵌入代码' })
          .locator('summary')
          .click();
      const copiedValue =
        scenario.selector === '#copy-share'
          ? page.url()
          : scenario.selector.includes('html-example')
            ? await page.locator('#html-example').inputValue()
            : await page
                .locator('#download-link')
                .evaluate((element: HTMLAnchorElement) => element.href);
      await page.locator('.export-details > summary').click();
      await page.locator('#export-png').click();
      await expect.poll(() => sourceRequested).toBe(true);
      await expect(page.locator('#export-png')).toBeDisabled();
      await page.locator(scenario.selector).click();
      await expect(page.locator('#action-status')).toHaveText(scenario.message);
      if (scenario.denied) await expect(page.locator('#manual-address')).toHaveValue(copiedValue);
      else await expectLastCopy(page, copiedValue);

      if (scenario.exportFails) {
        releaseSource();
        await expect(page.locator('#export-png')).toBeEnabled();
        expect(downloads).toEqual([]);
      } else {
        const downloadPromise = page.waitForEvent('download', { timeout: 3_000 });
        releaseSource();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('git-icon-orange-export-1024.png');
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
        ).toEqual([1024, 1024]);
        await expect(page.locator('#export-png')).toBeEnabled();
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

test('SVG export downloads a decodable PNG at the selected size, original aspect and transparent background', async ({
  page,
}, testInfo) => {
  await page.goto('/logos/git/?asset=logo-color.svg');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /切换到/);
  await page.locator('.export-details > summary').click();
  const size = page.locator('#export-size');
  if (await size.evaluate((element) => element.tagName === 'SELECT')) {
    await size.selectOption('512');
  } else {
    await size.click();
    await page.getByRole('option', { name: '512 px', exact: true }).click();
  }
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/git-.*export-512\.png$/);
  const path = testInfo.outputPath('git-export-512.png');
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
  expect(image.width).toBe(512);
  expect(image.height).toBe(Math.round((512 * 92) / 219));
  expect(image.transparent).toBeGreaterThan(image.width * image.height * 0.1);
  expect(image.painted).toBeGreaterThan(image.width * image.height * 0.05);
  expect(image.cornerAlpha).toBe(0);
  await expect(page.locator('#action-status')).toContainText(
    `已导出 ${image.width} × ${image.height} px PNG`,
  );
});

test('Bits UI filters work by keyboard and theme survives navigation on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /切换到/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: '搜索 Logo' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.locator('#search')).toBeFocused();
  const format = page.locator('#format-filter');
  await format.focus();
  await format.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(format).toBeFocused();
  expect(new URL(page.url()).searchParams.get('format')).toBe('SVG');
  await page.getByRole('button', { name: '切换到深色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#search').fill('Git');
  await page.getByRole('link', { name: '查看 Git Logo', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('button', { name: '切换到浅色主题' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
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
    await expect(page.locator('#brand-grid .brand-card')).toHaveCount(23);
    await page.getByRole('link', { name: '查看 阿里巴巴集团 Logo', exact: true }).click();
    await expect(page).toHaveURL(/\/logos\/alibaba\/$/);
    await expect(
      page.getByRole('heading', { name: '阿里巴巴集团', exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator('.legal-names')).toHaveCount(0);
    const sources = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^来源与许可/ }) });
    await expect(sources).toHaveJSProperty('open', false);
    await sources.locator('summary').click();
    await expect(
      page.locator('a[href="https://commons.wikimedia.org/wiki/File:Alibaba_en_logo.svg"]').first(),
    ).toBeVisible();
    await expect(page.locator('#download-link')).toHaveAttribute(
      'href',
      /\/logos\/alibaba\/wordmark-orange\.svg$/,
    );
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-link').click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('original.svg');
    await download.saveAs(path);
    const original = await readFile(
      new URL('../../logos/alibaba/wordmark-orange.svg', import.meta.url),
    );
    expect(
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ).toBe(createHash('sha256').update(original).digest('hex'));
    await expect(page.locator('[data-select-asset="wordmark-orange-chinese.svg"]')).toHaveAttribute(
      'href',
      /\/logos\/alibaba\/wordmark-orange-chinese\.svg$/,
    );
    await expect(page.locator('.variant-list [data-select-artwork]')).toHaveCount(2);
    await expect(
      page.locator('.format-option[data-select-asset="wordmark-orange.png"]'),
    ).toHaveAttribute('href', /\/logos\/alibaba\/wordmark-orange\.png$/);
    await page.locator('#back-directory').click();
    await expect(page.locator('#brand-grid .brand-card')).toHaveCount(23);
  } finally {
    await context.close();
  }
});

test('compact details disclose sources on demand and preserve attribution, restrictions and embed copying', async ({
  page,
}) => {
  await recordTextCopies(page);
  await page.goto('/logos/iqiyi/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.getByRole('link', { name: /下载.*SVG/ })).toBeVisible();
  await expect(page.getByText('品牌与主体信息', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/No copyright attribution required/)).toHaveCount(0);
  await expect(page.getByText(/保存该文件页提供的 SVG 原始字节/)).toHaveCount(0);
  const sources = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^来源与许可/ }) });
  await expect(sources).toHaveJSProperty('open', false);
  await sources.locator('summary').click();
  await expect(sources.getByRole('link', { name: '公共领域', exact: true })).toHaveCount(1);
  await expect(sources.getByRole('link', { name: '公共领域', exact: true })).toBeVisible();

  const embed = page
    .locator('details')
    .filter({ has: page.getByText('嵌入代码', { exact: true }) });
  await expect(embed).toHaveJSProperty('open', false);
  await embed.locator('summary').click();
  for (const id of ['html-example', 'markdown-example']) {
    const value = await page.locator(`#${id}`).inputValue();
    expect(value).toContain('/logos/iqiyi/wordmark-green.svg');
    await page.locator(`[data-copy-target="${id}"]`).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1),
        ),
      )
      .toBe(value);
  }

  await page.goto('/logos/git/');
  const gitSources = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^来源与许可/ }) });
  await expect(gitSources.locator('summary')).toContainText('需署名');
  await gitSources.locator('summary').click();
  await expect(gitSources.getByText(/Git Logo by Jason Long/)).toBeVisible();
  await page.goto('/logos/gitlab/');
  await expect(page.getByText(/仅限非商业用途/)).toBeVisible();
  await expect(page.getByText(/历史素材，不代表现行标识/)).toBeVisible();
});

test('one artwork offers original PNG and SVG formats without duplicating its preview or breaking file links', async ({
  page,
}, testInfo) => {
  await recordTextCopies(page);
  await page.goto('/logos/alibaba/?asset=wordmark-orange.png&q=阿里巴巴&format=PNG');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const choices = page.locator('.variant-list [data-select-artwork]');
  await expect(choices).toHaveCount(2);
  await expect(choices.filter({ hasText: /英文/ })).toHaveCount(1);
  await expect(page.locator('.variant-list img')).toHaveCount(2);
  const artworkId = await choices.filter({ hasText: /英文/ }).getAttribute('data-select-artwork');
  await expect(choices.filter({ hasText: /英文/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.format-option')).toHaveCount(2);
  await expect(
    page.locator('.format-option[data-select-asset="wordmark-orange.png"]'),
  ).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.png$/);
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/wordmark-orange\.png$/);
  await expect(page.locator('#export-png')).toHaveCount(0);

  const currentAddress = new URL('/logos/alibaba/wordmark-orange.png', page.url()).href;
  await page.locator('#copy-current').click();
  await expectLastCopy(page, currentAddress);
  await page.locator('#copy-share').click();
  const share = await page.evaluate(() =>
    (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1)!,
  );
  expect(new URL(share).searchParams.get('asset')).toBe('wordmark-orange.png');
  expect(new URL(share).searchParams.get('q')).toBe('阿里巴巴');

  const embed = page
    .locator('details')
    .filter({ has: page.getByText('嵌入代码', { exact: true }) });
  await embed.locator('summary').click();
  await expect(page.locator('#current-address')).toHaveValue(currentAddress);
  for (const id of ['html-example', 'markdown-example']) {
    const value = await page.locator(`#${id}`).inputValue();
    expect(value).toContain('/logos/alibaba/wordmark-orange.png');
    await page.locator(`[data-copy-target="${id}"]`).click();
    await expectLastCopy(page, value);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-link').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('alibaba-wordmark-orange.png');
  const path = testInfo.outputPath('alibaba-original.png');
  await download.saveAs(path);
  const original = await readFile(
    new URL('../../logos/alibaba/wordmark-orange.png', import.meta.url),
  );
  expect(
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  ).toBe(createHash('sha256').update(original).digest('hex'));

  await page.locator('.format-option[data-select-asset="wordmark-orange.svg"]').click();
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/wordmark-orange\.svg$/);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-artwork',
    artworkId!,
  );
  await expect(page.locator('.export-details > summary')).toBeVisible();
  await expect(page.locator('#export-png')).toBeHidden();
  await expect(page.locator('#copy-svg')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('阿里巴巴');
  expect(new URL(page.url()).searchParams.get('format')).toBe('PNG');
  await page.locator('#copy-current').click();
  await expectLastCopy(page, new URL('/logos/alibaba/wordmark-orange.svg', page.url()).href);
  await page.reload();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.svg$/);
  await page.goBack();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /\/wordmark-orange\.png$/);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-artwork',
    artworkId!,
  );
});

test('grouping combines format renditions while retaining distinct artwork and color choices', async ({
  page,
}) => {
  for (const [id, count] of [
    ['codeberg', 4],
    ['git', 3],
    ['iflytek', 3],
    ['xiaomi', 2],
    ['zhipu', 3],
    ['lenovo', 3],
    ['meituan', 3],
    ['minimax', 5],
    ['yonyou', 4],
    ['zte', 4],
  ] as const) {
    await page.goto(`/logos/${id}/`);
    await expect(
      page.locator('.variant-list [data-select-artwork]'),
      `${id}: retain meaningful visual choices`,
    ).toHaveCount(count);
  }
  await page.goto('/logos/codeberg/?asset=icon-white.png');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const selected = page.locator('.variant-list [aria-current="true"]');
  const artworkId = await selected.getAttribute('data-select-artwork');
  await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
  await page.locator('.format-option[data-select-asset="icon-white.svg"]').click();
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/icon-white\.svg$/);
  await expect(selected).toHaveAttribute('data-select-artwork', artworkId!);
  await expect(page.locator('#detail-canvas')).toHaveAttribute('data-background', 'dark');
});

test('same-format source alternatives remain under one artwork and update exact file metadata', async ({
  page,
}) => {
  await recordTextCopies(page);
  await page.goto('/logos/tencent/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('.variant-list [data-select-artwork]')).toHaveCount(3);
  const artworkId = await page
    .locator('.variant-list [aria-current="true"]')
    .getAttribute('data-select-artwork');
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-blue-official\.png$/,
  );
  await expect(page.locator('#detail-fileinfo')).toContainText('2953 × 889');
  await expect(page.locator('.format-option')).toHaveCount(0);
  const sources = page.locator('.source-details');
  await sources.locator('summary').click();
  await expect(
    sources.locator('a[href="https://www.tencent.com/zh-cn/newsroom/media-resources/"]'),
  ).toBeVisible();

  const alternatives = page.locator('details.file-options');
  await expect(alternatives).toHaveJSProperty('open', false);
  await alternatives.locator('summary').click();
  const commons = alternatives.locator('[data-select-asset="wordmark-blue.png"]');
  await expect(commons).toContainText('Wikimedia Commons');
  await expect(commons).toContainText('1280 × 172');
  await commons.click();
  await expect(page).toHaveURL(/asset=wordmark-blue\.png/);
  await expect(page.locator('.variant-list [aria-current="true"]')).toHaveAttribute(
    'data-select-artwork',
    artworkId!,
  );
  await expect(page.locator('#download-link')).toHaveAttribute('href', /\/wordmark-blue\.png$/);
  await expect(page.locator('#detail-fileinfo')).toContainText('1280 × 172');
  await page.locator('.source-details summary').click();
  await expect(
    page.locator(
      '.source-details a[href="https://commons.wikimedia.org/wiki/File:Tencent_logo_2017.svg"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '.source-details a[href="https://www.tencent.com/zh-cn/newsroom/media-resources/"]',
    ),
  ).toHaveCount(0);
  await page.locator('#copy-current').click();
  await expectLastCopy(page, new URL('/logos/tencent/wordmark-blue.png', page.url()).href);
  await page.goBack();
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /\/wordmark-blue-official\.png$/,
  );
  await expect(page.locator('#detail-fileinfo')).toContainText('2953 × 889');
});
