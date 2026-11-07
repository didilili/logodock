import { expect, test, type Locator, type Page } from '@playwright/test';

const filterIds = ['shape-filter', 'format-filter', 'type-filter'];

async function expectMinimumHeight(controls: Locator, minimum: number) {
  await expect(controls.first()).toBeVisible();
  const undersized = await controls.evaluateAll((elements, height) => elements.flatMap(element => {
    const actual = element.getBoundingClientRect().height;
    return actual < height ? [{ control: element.id || element.getAttribute('aria-label') || element.textContent?.trim(), height: actual }] : [];
  }), minimum);
  expect.soft(undersized, `visible controls should be at least ${minimum}px high`).toEqual([]);
}

async function expectFilterTypography(page: Page) {
  const typography = await page.locator(filterIds.map(id => `#${id}`).join(', ')).evaluateAll(elements => {
    const bodyFont = getComputedStyle(document.body).fontFamily;
    return elements.map(element => {
      const style = getComputedStyle(element);
      return { id: element.id, size: style.fontSize, usesBodyFont: style.fontFamily === bodyFont };
    });
  });
  expect.soft(typography).toEqual(filterIds.map(id => ({ id, size: '14px', usesBodyFont: true })));
}

async function expectKeyboardFocus(control: Locator) {
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport();
  const focus = await control.evaluate(element => {
    const style = getComputedStyle(element);
    return { visible: element.matches(':focus-visible'), width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor, background: getComputedStyle(document.documentElement).backgroundColor };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).not.toBe('none');
  expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(focus.color).not.toBe(focus.background);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth })))
    .toEqual({ content: 390, viewport: 390 });
}

test('desktop filters use readable control sizing and keyboard focus stays visible in both themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.getByRole('combobox'), 36);
  await expectFilterTypography(page);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    await page.locator('#search').focus();
    await page.keyboard.press('Tab');
    await expectKeyboardFocus(page.locator('#shape-filter'));
  }

  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('#download-link'), 44);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.locator('#download-link').focus();
    await page.keyboard.press('Tab');
    await expectKeyboardFocus(page.locator('#copy-current'));
  }
});

test('390px home and Alibaba detail retain usable targets without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('button:visible'), 40);
  await expectFilterTypography(page);
  await expectNoHorizontalOverflow(page);

  await page.locator('#format-filter').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');

  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('button:visible'), 40);
  await expectMinimumHeight(page.locator('#download-link'), 44);
  await expectMinimumHeight(page.locator('.variant-list [data-select-artwork]'), 44);
  await expectMinimumHeight(page.locator('.format-option'), 40);
  await expectNoHorizontalOverflow(page);
  await page.locator('.export-details > summary').click();
  await expectMinimumHeight(page.locator('#export-size, #export-png'), 40);
  await expectNoHorizontalOverflow(page);
});

test('empty results reset every filter and manual copy remains readonly with recoverable focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) },
    });
  });
  await page.goto('/?q=NoSuchBrand&type=company&format=SVG&shape=wordmark');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#empty-state')).toBeVisible();
  await expectMinimumHeight(page.locator('#reset-search, #clear-search, #clear-filters'), 40);
  await page.getByRole('button', { name: '清除搜索与筛选', exact: true }).click();
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#shape-filter')).toHaveText('全部形态');
  await expect(page.locator('#format-filter')).toHaveText('全部格式');
  await expect(page.locator('#type-filter')).toHaveText('全部类型');
  await expect(page.locator('#empty-state')).toBeHidden();
  expect(new URL(page.url()).search).toBe('');

  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const copy = page.locator('#copy-current');
  await copy.click();
  const manual = page.getByRole('textbox', { name: '手动复制', exact: true });
  await expect(manual).toBeFocused();
  await expect(manual).toHaveJSProperty('readOnly', true);
  const address = await manual.inputValue();
  expect(address).toBe(new URL(await page.locator('#download-link').getAttribute('href') || '', page.url()).href);
  expect(await manual.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd]))
    .toEqual([0, address.length]);
  await manual.press('x');
  await expect(manual).toHaveValue(address);
  await expectMinimumHeight(page.locator('#dismiss-feedback'), 40);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '关闭复制提示' }).click();
  await expect(manual).toBeHidden();
  await expect(copy).toBeFocused();
});

test('cards keep usage restrictions visible and disclose useful material differences', async ({ page }) => {
  await page.goto('/');
  const gitlab = page.getByRole('article').filter({ has: page.getByRole('link', { name: '查看 GitLab Logo', exact: true }) });
  await expect(gitlab.getByText(/历史素材，不代表现行标识/)).toBeVisible();
  await expect.soft(gitlab.getByText(/仅限非商业用途/)).toBeVisible();

  const zte = page.getByRole('article').filter({ has: page.getByRole('link', { name: '查看 中兴通讯 Logo', exact: true }) });
  const disclosure = zte.locator('details');
  const summary = disclosure.locator('summary');
  await expect(summary).toBeVisible();
  await expect(disclosure).toHaveJSProperty('open', false);
  const notes = disclosure.locator('li');
  await expect(notes).not.toHaveCount(0);
  await expect(notes.first()).toBeHidden();
  await summary.click();
  await expect(disclosure).toHaveJSProperty('open', true);
  await expect(disclosure).toContainText('留白');
  await expect(disclosure).toContainText('#0086D1');
  await expect(disclosure).toContainText('#008ED3');
  await expect(disclosure).not.toContainText('zte_logo_en/');
  for (const note of await notes.all()) await expect(note).toBeVisible();
  const materialNotes = await notes.allTextContents();
  await summary.click();
  await expect(notes.first()).toBeHidden();

  await page.goto('/logos/zte/');
  const sources = page.locator('.source-details');
  await expect(sources).toHaveJSProperty('open', false);
  await expect(sources.locator('.asset-notes li').first()).toBeHidden();
  await expect(page.locator('.asset-controls')).not.toContainText(materialNotes[0]);
  await sources.locator('summary').click();
  await expect(sources.locator('.asset-notes li')).toHaveText(materialNotes);
  for (const note of await sources.locator('.asset-notes li').all()) await expect(note).toBeVisible();
});
