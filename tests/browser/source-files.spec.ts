import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Catalog } from '../../src/lib/types';
import { artworkGroups } from '../../src/lib/catalog-artworks.mjs';
import { assetPath } from '../../src/lib/resource-links.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../../_site/index.json', import.meta.url), 'utf8'),
) as Catalog;
const brands = catalog.brands.filter((brand) => brand.sourceFiles?.length);

test('native design downloads follow artwork changes with shared source and usage information', async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(!brands.length, 'No native design attachments are registered in this catalog.');
  for (const brand of brands) {
    await page.goto(`/logo/${brand.id}/`);
    await expect(page.locator('#theme-toggle')).toBeEnabled();
    let downloaded = false;
    for (const artwork of artworkGroups(brand)) {
      const option = page.locator(`[data-select-artwork="${artwork.id}"]`);
      if (await option.count()) {
        if (!(await option.isVisible()))
          await page.locator('.artwork-alternatives > summary').click();
        await option.click();
      }
      const files = artwork.assets.map((asset) => asset.file);
      const attachments = (brand.sourceFiles ?? []).filter((entry) =>
        entry.assetFiles.some((file) => files.includes(file)),
      );
      const section = page.getByRole('region', { name: '原生设计文件', exact: true });
      if (!attachments.length) {
        await expect(section).toHaveCount(0);
        continue;
      }
      await expect(section.locator('[data-source-file]')).toHaveCount(attachments.length);
      for (const entry of attachments) {
        const item = section.locator(`[data-source-file="${entry.file}"]`);
        await expect(item).toContainText(entry.label);
        await expect(item).toContainText(entry.file.split('.').at(-1)!.toUpperCase());
        const link = item.locator('a[download]');
        await expect(link).toHaveAttribute('href', `/${assetPath(entry)}`);
        await expect(link).toHaveAttribute('download', `${brand.id}-${entry.file}`);
        const response = await page.request.get(`/${assetPath(entry)}`);
        expect(response.ok()).toBe(true);
        const bytes = await response.body();
        expect(bytes.byteLength).toBe(entry.bytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
        // Verify one real download per page and every link's bytes. Chromium
        // throttles bursts of many downloads from one document's large brand pack.
        if (!downloaded) {
          const downloadPromise = page.waitForEvent('download');
          await link.click();
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toBe(`${brand.id}-${entry.file}`);
          const path = await download.path();
          expect(path).not.toBeNull();
          expect(await readFile(path!)).toEqual(bytes);
          downloaded = true;
        }
      }
      const sources = page.locator('.source-details');
      if (!(await sources.evaluate((element) => (element as HTMLDetailsElement).open)))
        await sources.locator('summary').click();
      const hrefs = await sources
        .locator('a[href^="https://"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const sourcePage of new Set(attachments.map((entry) => entry.sourcePage)))
        expect(hrefs).toContain(sourcePage);
      for (const notes of new Set(attachments.map((entry) => entry.rights.notes).filter(Boolean)))
        await expect(sources.getByText(notes!, { exact: true })).toHaveCount(1);
      await expect(page.getByText(/许可未核实|许可已确认/)).toHaveCount(0);
      expect((await page.locator('.format-option').allTextContents()).join(' ')).not.toMatch(
        /\b(?:AI|EPS|PDF)\b/,
      );
    }
  }
});

test('all native originals remain available with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
  test.skip(!brands.length, 'No native design attachments are registered in this catalog.');
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    for (const brand of brands) {
      await page.goto(`/logo/${brand.id}/`);
      const fallback = page.locator('noscript details').filter({ hasText: '全部原生设计文件下载' });
      await fallback.locator('summary').click();
      await expect(page.getByText(/许可未核实|许可已确认/)).toHaveCount(0);
      const hrefs = await fallback
        .locator('a[href^="https://"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const sourcePage of new Set(brand.sourceFiles!.map((entry) => entry.sourcePage)))
        expect(hrefs).toContain(sourcePage);
      for (const notes of new Set(
        brand.sourceFiles!.map((entry) => entry.rights.notes).filter(Boolean),
      ))
        await expect(fallback.getByText(notes!, { exact: true })).toHaveCount(1);
      for (const entry of brand.sourceFiles ?? []) {
        const link = fallback.locator(`a[download="${brand.id}-${entry.file}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', `/${assetPath(entry)}`);
        const response = await page.request.get(`/${assetPath(entry)}`);
        expect(response.ok()).toBe(true);
        expect(
          createHash('sha256')
            .update(await response.body())
            .digest('hex'),
        ).toBe(entry.sha256);
      }
    }
  } finally {
    await context.close();
  }
});

test('named licenses retain attribution and concrete use restrictions', async ({ page }) => {
  const brand = catalog.brands.find((entry) => entry.id === 'gitlab')!;
  const asset = brand.assets.find((entry) => entry.file === 'icon-legacy.png')!;
  await page.goto(`/logo/${brand.id}/?asset=${asset.file}`);
  const sources = page.locator('.source-details');
  await expect(sources).toHaveJSProperty('open', true);
  await expect(
    sources.getByRole('link', { name: asset.rights.license, exact: true }),
  ).toHaveAttribute('href', asset.rights.reference);
  await expect(sources).toContainText(asset.rights.attribution);
  await expect(page.locator('.asset-warnings')).toContainText('仅限非商业用途');
  await expect(page.getByText(/许可未核实|许可已确认/)).toHaveCount(0);
});
