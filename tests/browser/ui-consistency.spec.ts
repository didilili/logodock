import { expect, test, type Locator, type Page } from '@playwright/test';

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
  await expectTypography(page.locator('#shape-filter, #type-filter'), 14);
  await expectTypography(page.locator('#format-filter [data-format]'), 12);
  await expectTypography(page.locator('#more-filters-trigger'), 12);
}

async function expectCardTypography(page: Page, nameSize: number) {
  await expectTypography(page.locator('.brand-identity h2'), nameSize);
  await expectTypography(page.locator('.card-download, .card-copy'), 13);
  await expectTypography(page.locator('.brand-english, .asset-format, .download-format'), 12);
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

async function openExtraFilters(page: Page) {
  const trigger = page.locator('#more-filters-trigger');
  const opening = (await trigger.getAttribute('aria-expanded')) !== 'true';
  if (opening) await trigger.click();
  const panel = page.getByRole('dialog', { name: '更多筛选', exact: true });
  await expect(panel).toBeVisible();
  if (opening) await expect(page.locator('#shape-filter')).toBeFocused();
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

test('desktop filters use readable control sizing and keyboard focus stays visible in both themes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('group', { name: '文件格式', exact: true })).toBeVisible();
  await expectMinimumHeight(page.locator('#format-filter button'), 40);
  await expectMinimumHeight(page.locator('.category-sidebar [data-category]'), 42);
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
    await expect(page.getByRole('dialog', { name: '更多筛选', exact: true })).toBeVisible();
    await expectKeyboardFocus(page.locator('#shape-filter'));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(page.getByRole('dialog', { name: '更多筛选', exact: true })).toBeVisible();
    await expectKeyboardFocus(page.locator('#shape-filter'));
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

  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('#download-link'), 44);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.locator('#download-link').focus();
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
  await expectMinimumHeight(page.locator('.card-download, .card-copy, .version-thumbnail'), 44);
  await openExtraFilters(page);
  await expectFilterTypography(page);
  await expectCardTypography(page, 13);
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
  await page.locator('#shape-filter').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.locator('#extra-filter-panel')).toBeVisible();
  await page.locator('#format-filter [data-format="PNG"]').click();
  await expect(page.locator('#extra-filter-panel')).toBeHidden();
  await expect(page.locator('#format-filter [data-format="PNG"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.brand-card').first()).toBeVisible();
  for (const format of await page.locator('.brand-card .asset-format').all())
    await expect(format).toHaveText('PNG');
  await expectNoHorizontalOverflow(page);

  await page.goto('/logos/alibaba/');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  await expectMinimumHeight(page.locator('button:visible'), 40);
  await expectMinimumHeight(page.locator('#download-link'), 44);
  await expectMinimumHeight(page.locator('.variant-list [data-select-artwork]'), 44);
  await expectMinimumHeight(page.locator('.format-option'), 40);
  await expectNoHorizontalOverflow(page);
  await expect(page.locator('#download-options, #export-size, .export-details')).toHaveCount(0);
  await page.locator('[data-select-asset="wordmark-orange-chinese.svg"]').click();
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
  await page.goto('/?type=company&shape=wordmark&format=SVG');
  await expect(page.locator('#theme-toggle')).toBeEnabled();
  const panel = await openExtraFilters(page);
  await expectEntirelyInViewport(panel);
  await expect(page.locator('#shape-filter')).toHaveText('文字');
  await expect(page.locator('#type-filter')).toHaveText('公司');
  await page.locator('#shape-filter').click();
  const options = page.getByRole('listbox');
  await expect(options).toBeVisible();
  await page.getByRole('option', { name: '图形', exact: true }).click();
  await expect(options).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(page.locator('#shape-filter')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('shape')).toBe('icon');
  await page.locator('#shape-filter').press('Enter');
  await expect(options).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(page.locator('#shape-filter')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#more-filters-trigger')).toBeFocused();
  await openExtraFilters(page);
  const reset = panel.locator('#clear-filters');
  await reset.scrollIntoViewIfNeeded();
  await expectEntirelyInViewport(reset);
  await expectEntirelyInViewport(panel);
  await reset.click();
  await expect(page.locator('#shape-filter')).toHaveText('全部形式');
  await expect(page.locator('#type-filter')).toHaveText('全部类型');
  await expect(page.locator('#format-filter [data-format=""]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(new URL(page.url()).search).toBe('');
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
  await expectMinimumHeight(page.locator('#reset-search, #clear-search, #clear-filters'), 40);
  await page.locator('#more-filters-trigger').click();
  await expect(page.locator('#more-filters-trigger')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '清除搜索与筛选', exact: true }).click();
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#search')).toHaveValue('');
  await openExtraFilters(page);
  await expect(page.locator('#shape-filter')).toHaveText('全部形式');
  await expect(page.locator('#format-filter [data-format=""]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#type-filter')).toHaveText('全部类型');
  await expect(page.locator('.directory-title h1')).toHaveText('全部品牌');
  await expect(page.locator('#empty-state')).toBeHidden();
  expect(new URL(page.url()).search).toBe('');
  await page.keyboard.press('Escape');

  await page.goto('/logos/alibaba/');
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
  await expect(
    gitlab.locator('.card-versions').getByText('历史 · 仅非商业', { exact: true }),
  ).toBeVisible();
  await expect(gitlab.locator('.card-warning')).toHaveCount(0);

  const zte = page.getByRole('article').filter({ has: page.locator('[data-brand-link="zte"]') });
  await expect(zte.locator('.brand-link')).toHaveAccessibleName(/^查看 中兴通讯，/);
  await expect(zte.locator('.version-thumbnails')).toBeVisible();
  await expect(zte.locator('.version-thumbnail')).toHaveCount(2);
  await expect(zte.locator('.more-versions')).toHaveCount(0);
  await expect(zte.locator('.version-thumbnail img').last()).toHaveAttribute(
    'src',
    /wordmark-white-official\.png$/,
  );
  await expect(zte.locator('.card-download')).toHaveAttribute(
    'href',
    /wordmark-blue-official\.png$/,
  );

  await zte.locator('.brand-link').click();
  await expect(page).toHaveURL(/\/logos\/zte\//);
  await expect(page.locator('#download-link')).toHaveAttribute(
    'href',
    /wordmark-blue-official\.png$/,
  );
  const sources = page.locator('.source-details');
  await expect(sources).toHaveJSProperty('open', false);
  const notes = page.locator('.asset-action-panel .asset-warnings li');
  await expect(notes).not.toHaveCount(0);
  for (const note of await notes.all()) await expect(note).toBeVisible();
  await expect(page.locator('.asset-action-panel')).toContainText('留白');
  await expect(page.locator('.asset-action-panel')).toContainText('#0086D1');
  await expect(page.locator('.asset-action-panel')).toContainText('#008ED3');
  await sources.locator('summary').click();
  await expect(sources).toHaveJSProperty('open', true);
  await expect(sources).not.toContainText('zte_logo_en/');
  await sources.locator('summary').click();
  for (const note of await notes.all()) await expect(note).toBeVisible();
});
