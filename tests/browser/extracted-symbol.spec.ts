import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const metadata = JSON.parse(
  await readFile(new URL('../../logo/nio/metadata.json', import.meta.url), 'utf8'),
);
const symbol = metadata.assets.find(
  (asset: { file: string }) => asset.file === 'icon-black-extracted.svg',
);

for (const width of [1280, 390]) {
  test(`extracted square symbol keeps its shape, download and original link at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/logo/nio/?asset=icon-black-extracted.svg');
    const image = page.locator('.preview-stage img');
    await expect(image).toHaveAttribute('src', /icon-black-extracted\.svg$/);
    await expect(page.locator('#detail-source-link')).toContainText('图形提取版');
    const bounds = await image.evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, 256, 256);
      const pixels = context.getImageData(0, 0, 256, 256).data;
      let left = 256;
      let right = -1;
      let top = 256;
      let bottom = -1;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          if (pixels[(y * 256 + x) * 4 + 3]) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      return { left, right, top, bottom };
    });
    expect(bounds.left).toBe(0);
    expect(bounds.right).toBe(255);
    expect(Math.abs(bounds.top - (255 - bounds.bottom))).toBeLessThanOrEqual(1);
    const response = await page.request.get('/logo/nio/icon-black-extracted.svg');
    expect(response.ok()).toBe(true);
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex'),
    ).toBe(symbol.sha256);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#download-link').click();
    expect((await downloadEvent).suggestedFilename()).toBe('nio-icon-black-extracted.svg');
    const sources = page.locator('.source-details');
    await expect(sources).toHaveJSProperty('open', true);
    const original = sources.locator('[data-original-asset]');
    await expect(original).toHaveText('黑色英文组合');
    await expect(original).toHaveAttribute('data-original-asset', symbol.provenance.originalAsset);
    await original.focus();
    await original.press('Enter');
    await expect(image).toHaveAttribute('src', /logo-black-english-official\.svg$/);
    await expect(page.locator('#detail-source-link')).toHaveText('官网页面用图');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    expect(
      await focused.evaluate(
        (element, file) =>
          element.id === 'download-link' || element.getAttribute('data-select-asset') === file,
        symbol.provenance.originalAsset,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

const catalog = JSON.parse(await readFile(new URL('../../index.json', import.meta.url), 'utf8'));
const extractedSymbols = catalog.brands.flatMap(
  (brand: {
    id: string;
    assets: Array<{
      file: string;
      sha256: string;
      provenance: { processing: string; originalAsset?: string };
    }>;
  }) =>
    brand.assets
      .filter((asset) => asset.provenance.processing === 'extracted')
      .map((asset) => ({ ...asset, brandId: brand.id })),
);

for (const width of [1280, 390]) {
  test(`all extracted symbols retain square geometry, original links and download bytes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    expect(extractedSymbols.length).toBeGreaterThanOrEqual(22);
    for (const asset of extractedSymbols) {
      await page.goto(`/logo/${asset.brandId}/?asset=${asset.file}`);
      const image = page.locator('.preview-stage img');
      await expect(image).toHaveAttribute('src', `/logo/${asset.brandId}/${asset.file}`);
      await expect(page.locator('#detail-source-link')).toContainText('图形提取版');
      const response = await page.request.get(`/logo/${asset.brandId}/${asset.file}`);
      const bytes = await response.body();
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      const geometry = await image.evaluate(async (element, xml) => {
        const svg = new DOMParser().parseFromString(xml, 'image/svg+xml')
          .documentElement as unknown as SVGSVGElement;
        const box = svg.getAttribute('viewBox')!.split(/\s+/).map(Number);
        const image = element as HTMLImageElement;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0, 256, 256);
        const pixels = context.getImageData(0, 0, 256, 256).data;
        let left = 256,
          right = -1,
          top = 256,
          bottom = -1;
        for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
            if (pixels[(y * 256 + x) * 4 + 3]) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
        }
        return {
          box,
          rasterNodes: svg.querySelectorAll('image').length,
          textNodes: svg.querySelectorAll('text').length,
          left,
          right,
          top,
          bottom,
        };
      }, bytes.toString('utf8'));
      expect(geometry.box[2]).toBeGreaterThan(0);
      expect(geometry.box[2]).toBe(geometry.box[3]);
      expect(geometry.rasterNodes).toBe(0);
      expect(geometry.textNodes).toBe(0);
      expect(Math.max(geometry.right - geometry.left, geometry.bottom - geometry.top)).toBe(255);
      expect(Math.abs(geometry.left - (255 - geometry.right))).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.top - (255 - geometry.bottom))).toBeLessThanOrEqual(1);
      const download = page.waitForEvent('download');
      await page.locator('#download-link').click();
      expect((await download).suggestedFilename()).toBe(`${asset.brandId}-${asset.file}`);
      const sources = page.locator('.source-details');
      if (!(await sources.evaluate((element) => (element as HTMLDetailsElement).open)))
        await sources.locator('summary').click();
      const original = sources.locator('[data-original-asset]');
      await expect(original).toHaveAttribute(
        'data-original-asset',
        asset.provenance.originalAsset!,
      );
      await original.click();
      await expect(image).toHaveAttribute(
        'src',
        `/logo/${asset.brandId}/${asset.provenance.originalAsset}`,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
  });
}
