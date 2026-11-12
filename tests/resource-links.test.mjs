import assert from 'node:assert/strict';
import test from 'node:test';

const resources = () => import('../src/lib/resource-links.mjs');
const asset = { file: 'logo 图形.svg', path: 'logo/示例/logo 图形.svg', label: '图形标识' };
const brand = { name: 'Example & "Co" [Test]' };
const commit = 'a'.repeat(40);

test('current image addresses resolve below a deployment subpath and encode filenames', async () => {
  const { resourceLinks } = await resources();
  const links = resourceLinks({
    asset,
    brand,
    baseUrl: 'https://example.com/logodock/?q=x',
    sourceCommit: '',
  });
  assert.equal(
    links.current,
    'https://example.com/logodock/logo/%E7%A4%BA%E4%BE%8B/logo%20%E5%9B%BE%E5%BD%A2.svg',
  );
  assert.equal(links.fixed, null);
});

test('fixed addresses require a full verified source commit', async () => {
  const { resourceLinks } = await resources();
  const input = { asset, brand, baseUrl: 'https://example.com/' };
  assert.equal(resourceLinks({ ...input, sourceCommit: 'main' }).fixed, null);
  assert.equal(resourceLinks({ ...input, sourceCommit: '__SOURCE_COMMIT__' }).fixed, null);
  assert.equal(
    resourceLinks({ ...input, sourceCommit: commit }).fixed,
    `https://raw.githubusercontent.com/didilili/logodock/${commit}/logo/%E7%A4%BA%E4%BE%8B/logo%20%E5%9B%BE%E5%BD%A2.svg`,
  );
});

test('HTML and Markdown examples escape names and prefer the fixed address when available', async () => {
  const { resourceLinks } = await resources();
  const links = resourceLinks({
    asset,
    brand,
    baseUrl: 'https://example.com/',
    sourceCommit: commit,
  });
  assert.match(links.html, /alt="Example &amp; &quot;Co&quot; \[Test\] 图形标识"/);
  assert.ok(links.html.includes(links.fixed));
  assert.ok(links.markdown.includes('\\[Test\\]'));
  assert.ok(links.markdown.includes(links.fixed));
  const complete = resourceLinks({
    asset: {
      ...asset,
      variant: 'logo',
      language: 'zh',
      layout: 'vertical',
      color: 'brand',
      label: '中文竖版组合标（含口号）',
    },
    brand,
    baseUrl: 'https://example.com/',
    sourceCommit: commit,
  });
  for (const text of [complete.html, complete.markdown]) {
    assert.ok(text.includes('中文组合标 · 上下排列 · （含口号）'));
  }
});

test('copy reports unsupported or rejected clipboard access without losing the text', async () => {
  const { copyText } = await resources();
  assert.equal(await copyText('hello', undefined), false);
  assert.equal(
    await copyText('hello', {
      writeText: async () => {
        throw new Error('denied');
      },
    }),
    false,
  );
  let copied;
  assert.equal(
    await copyText('hello', {
      writeText: async (value) => {
        copied = value;
      },
    }),
    true,
  );
  assert.equal(copied, 'hello');
});

test('rejects non-relative asset paths instead of creating external or traversing links', async () => {
  const { assetPath } = await resources();
  for (const path of [
    'https://bad.example/x.svg',
    '//bad.example/x.svg',
    '../x.svg',
    'logo/../x.svg',
    '/x.svg',
    'logo\\x.svg',
  ]) {
    assert.throws(() => assetPath({ path }));
  }
});

test('asset URL punctuation is encoded so copied Markdown stays a complete image reference', async () => {
  const { resourceLinks } = await resources();
  const links = resourceLinks({
    asset: { ...asset, path: 'logo/example/logo (1).svg' },
    brand,
    baseUrl: 'https://example.com/',
  });
  assert.equal(links.current, 'https://example.com/logo/example/logo%20%281%29.svg');
  assert.ok(links.markdown.endsWith('logo%20%281%29.svg)'));
});

test('nested detail pages resolve the explicit site root before creating image addresses', async () => {
  const { resourceLinks, siteRootUrl } = await resources();
  for (const [page, relativeRoot, expected] of [
    [
      'https://example.com/logodock/logo/git/?asset=logo.svg',
      '../../',
      'https://example.com/logodock/',
    ],
    ['https://example.com/logodock/?q=git', './', 'https://example.com/logodock/'],
    ['https://example.com/logo/git/', '../../', 'https://example.com/'],
  ]) {
    const baseUrl = siteRootUrl(page, relativeRoot);
    assert.equal(baseUrl, expected);
    assert.equal(
      resourceLinks({ asset: { ...asset, path: 'logo/git/logo.svg' }, brand, baseUrl }).current,
      `${expected}logo/git/logo.svg`,
    );
  }
  assert.throws(() => siteRootUrl('https://example.com/', 'https://evil.example/'));
});

class TextClipboardItem {
  constructor(data) {
    this.data = data;
  }
  static supports(type) {
    return type === 'text/plain';
  }
}

test('deferred text queues a native write during the click before source loading finishes', async () => {
  const { copyDeferredText } = await resources();
  let finishLoading;
  const source = new Promise((resolve) => {
    finishLoading = resolve;
  });
  let writeCalled = false;
  let copied;
  const result = copyDeferredText({
    loadText: () => source,
    ClipboardItemType: TextClipboardItem,
    clipboard: {
      write: async (items) => {
        writeCalled = true;
        const blob = await items[0].data['text/plain'];
        assert.equal(blob.type, 'text/plain');
        copied = await blob.text();
      },
    },
  });
  assert.equal(writeCalled, true);
  finishLoading('<svg>中文</svg>');
  assert.equal((await result).status, 'copied');
  assert.equal(copied, '<svg>中文</svg>');
});

test('immediate clipboard denial still waits for deferred text to offer manual copying', async () => {
  const { copyDeferredText } = await resources();
  let finishLoading;
  const source = new Promise((resolve) => {
    finishLoading = resolve;
  });
  let settled = false;
  const result = copyDeferredText({
    loadText: () => source,
    ClipboardItemType: TextClipboardItem,
    clipboard: {
      write: async () => {
        throw new Error('Permission denied');
      },
    },
  }).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  finishLoading('<svg/>');
  assert.deepEqual(await result, { status: 'failed', value: '<svg/>' });
});

test('deferred text propagates source failure even if clipboard permission is denied first', async () => {
  const { copyDeferredText } = await resources();
  const error = new Error('SVG source unavailable');
  await assert.rejects(
    copyDeferredText({
      loadText: async () => {
        throw error;
      },
      ClipboardItemType: TextClipboardItem,
      clipboard: {
        write: async () => {
          throw new Error('Permission denied');
        },
      },
    }),
    error,
  );
});

test('a stale deferred source cannot reach the native clipboard', async () => {
  const { copyDeferredText } = await resources();
  let current = true;
  let wroteText = false;
  const result = await copyDeferredText({
    loadText: async () => {
      current = false;
      return '<svg/>';
    },
    ClipboardItemType: TextClipboardItem,
    clipboard: {
      write: async (items) => {
        await items[0].data['text/plain'];
        wroteText = true;
      },
    },
    isCurrent: () => current,
  });
  assert.equal(result.status, 'stale');
  assert.equal(wroteText, false);
});

test('environments with only writeText retain automatic and manual deferred text copying', async () => {
  const { copyDeferredText } = await resources();
  const copied = [];
  assert.equal(
    (
      await copyDeferredText({
        loadText: async () => '<svg/>',
        clipboard: { writeText: async (value) => copied.push(value) },
      })
    ).status,
    'copied',
  );
  assert.deepEqual(copied, ['<svg/>']);
  assert.deepEqual(
    await copyDeferredText({ loadText: async () => '<svg/>', clipboard: undefined }),
    { status: 'failed', value: '<svg/>' },
  );
});
