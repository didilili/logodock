import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assetDownloadName } from '../../src/lib/catalog-presentation.mjs';

const catalog = JSON.parse(await readFile(new URL('../../index.json', import.meta.url), 'utf8'));

function fileDetails(page: Page) {
  return page.locator('.preview-dialog[role="dialog"]');
}

function copyToast(page: Page) {
  return page.locator('[data-sonner-toast]:not([data-removed="true"]) [data-title]');
}

async function recordCopies(page: Page) {
  await page.addInitScript(() => {
    const state = {
      started: false,
      reject: false,
      images: [] as number[][],
      texts: [] as string[],
    };
    Object.assign(window, { __clipboardAudit: state });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          state.started = true;
          if (state.reject) throw new DOMException('Permission denied', 'NotAllowedError');
          for (const item of items) {
            for (const type of item.types) {
              const blob = await item.getType(type);
              if (type === 'image/png')
                state.images.push(Array.from(new Uint8Array(await blob.arrayBuffer())));
              else state.texts.push(await blob.text());
            }
          }
        },
        writeText: async (text: string) => state.texts.push(text),
      },
    });
  });
}

async function chooseCopy(page: Page, kind: string, trigger = '#detail-copy-menu') {
  if (trigger === '#detail-copy-menu') await expect(fileDetails(page)).toBeVisible();
  await page.locator(trigger).click();
  await page.getByRole('menu').locator(`[data-copy-kind="${kind}"]`).click();
}

async function copiedPng(page: Page) {
  await expect.poll(() => page.evaluate('window.__clipboardAudit.images.length')).toBe(1);
  return Buffer.from(await page.evaluate('window.__clipboardAudit.images[0]'));
}

test('directory image copy uses the displayed PNG original', async ({ page }) => {
  await recordCopies(page);
  await page.goto('/?q=华为&format=PNG');
  const card = page.locator('.brand-card[data-brand="huawei"]');
  await expect(card.locator('[data-copy-brand]')).toBeEnabled();
  const source = (await card.locator('.brand-art img').getAttribute('src'))!;
  await chooseCopy(page, 'image', '[data-copy-brand="huawei"]');
  const png = await copiedPng(page);
  const original = await readFile(new URL(`../../${source.replace(/^\//, '')}`, import.meta.url));
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    createHash('sha256').update(original).digest('hex'),
  );
  await expect(copyToast(page)).toContainText('华为 原始 PNG 图片');
});

for (const format of ['SVG', 'JPG', 'WEBP']) {
  test(`${format} image copy produces a decodable PNG at the intended size`, async ({ page }) => {
    await recordCopies(page);
    const brand = catalog.brands.find((entry: { assets: { file: string }[] }) =>
      entry.assets.some((asset) => asset.file.toUpperCase().endsWith(`.${format}`)),
    );
    const asset = brand.assets.find((entry: { file: string }) =>
      entry.file.toUpperCase().endsWith(`.${format}`),
    );
    await page.goto(`/logo/${brand.id}/?asset=${encodeURIComponent(asset.file)}`);
    await expect(fileDetails(page).locator('#detail-copy-menu')).toBeEnabled();
    await expect(fileDetails(page).locator('#detail-image')).toHaveJSProperty('complete', true);
    const source = await fileDetails(page)
      .locator('#detail-image')
      .evaluate((image: HTMLImageElement) => ({
        width: image.naturalWidth,
        height: image.naturalHeight,
      }));
    await chooseCopy(page, 'image');
    const png = await copiedPng(page);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const scale = format === 'SVG' ? 2048 / Math.max(source.width, source.height) : 1;
    expect(png.readUInt32BE(16)).toBe(Math.max(1, Math.round(source.width * scale)));
    expect(png.readUInt32BE(20)).toBe(Math.max(1, Math.round(source.height * scale)));
    await expect(copyToast(page)).toContainText(`由 ${format} 生成`);
    const dimensions = await page.evaluate(
      async (bytes) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        );
        return { width: image.width, height: image.height };
      },
      [...png],
    );
    expect(dimensions).toEqual({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
  });
}

test('SVG copy submits before source loading and exposes its pending state', async ({ page }) => {
  await recordCopies(page);
  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(fileDetails(page).locator('#detail-copy-menu')).toBeEnabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/wordmark-orange.svg', async (route) => {
    if (route.request().resourceType() === 'fetch') await gate;
    await route.continue();
  });
  try {
    await chooseCopy(page, 'svg');
    await expect.poll(() => page.evaluate('window.__clipboardAudit.started')).toBe(true);
    await expect(fileDetails(page).locator('#detail-copy-menu')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(copyToast(page)).toHaveText('正在复制 SVG 源码…');
    release();
    await expect.poll(() => page.evaluate('window.__clipboardAudit.texts[0]')).toMatch(/<svg\b/);
    await expect(fileDetails(page).locator('#detail-copy-menu')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(copyToast(page)).toHaveText('已复制SVG 源码。');
  } finally {
    release();
  }
});

test('image copy failure persists and retries from the recovery actions', async ({ page }) => {
  await recordCopies(page);
  await page.clock.install();
  await page.goto('/logo/huawei/?asset=wordmark-dark-2018.png');
  await expect(fileDetails(page).locator('#detail-copy-menu')).toBeEnabled();
  await page.evaluate('window.__clipboardAudit.reject = true');
  await chooseCopy(page, 'image');
  const recovery = page.getByRole('group', { name: '复制失败后的操作' });
  await expect(recovery).toBeVisible();
  const brand = catalog.brands.find((entry: { id: string }) => entry.id === 'huawei');
  const asset = brand.assets.find(
    (entry: { file: string }) => entry.file === 'wordmark-dark-2018.png',
  );
  await expect(recovery.getByRole('link', { name: '下载原图' })).toHaveAttribute(
    'download',
    assetDownloadName(brand, asset),
  );
  await page.clock.fastForward(5000);
  await expect(recovery).toBeVisible();
  await page.evaluate('window.__clipboardAudit.reject = false');
  await recovery.getByRole('button', { name: '重试复制' }).click();
  await copiedPng(page);
  await expect(recovery).toHaveCount(0);
  await expect(copyToast(page)).toHaveText('已复制原始 PNG 图片。');
  await expect(fileDetails(page).locator('#detail-copy-menu')).toBeFocused();
});

test('SVG source failure offers recovery and copying its address restores focus', async ({
  page,
}) => {
  await recordCopies(page);
  await page.goto('/logo/alibaba/?asset=wordmark-orange.svg');
  await expect(fileDetails(page).locator('#detail-copy-menu')).toBeEnabled();
  await page.route('**/wordmark-orange.svg', (route) =>
    route.request().resourceType() === 'fetch' ? route.abort('failed') : route.continue(),
  );
  await chooseCopy(page, 'svg');
  const recovery = page.getByRole('group', { name: '复制失败后的操作' });
  await expect(recovery).toBeVisible();
  await expect(fileDetails(page).locator('#detail-copy-menu')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('#action-status')).toContainText('SVG 源码未能加载');
  await recovery.getByRole('button', { name: '复制图片地址' }).click();
  await expect(copyToast(page)).toHaveText('已复制图片地址。');
  await expect(fileDetails(page).locator('#detail-copy-menu')).toBeFocused();
  await expect
    .poll(() => page.evaluate('window.__clipboardAudit.texts[0]'))
    .toBe(new URL('/logo/alibaba/wordmark-orange.svg', page.url()).href);
});

test('unsupported image copying stays visible with an explanation', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: undefined }),
  );
  await page.goto('/logo/huawei/?asset=wordmark-dark-2018.png');
  await fileDetails(page).locator('#detail-copy-menu').click();
  const imageCopy = page.getByRole('menu').locator('[data-copy-kind="image"]');
  await expect(imageCopy).toBeVisible();
  await expect(imageCopy).toBeDisabled();
  await expect(imageCopy).toContainText('浏览器不支持');
  await expect(page.getByRole('menu').locator('[data-copy-kind="current"]')).toBeEnabled();
});
