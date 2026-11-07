import assert from 'node:assert/strict';
import test from 'node:test';

const resources = () => import('../src/lib/resource-links.mjs');
const asset = { file: 'logo 图形.svg', path: 'logos/示例/logo 图形.svg', label: '图形标识' };
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
    'https://example.com/logodock/logos/%E7%A4%BA%E4%BE%8B/logo%20%E5%9B%BE%E5%BD%A2.svg',
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
    `https://raw.githubusercontent.com/didilili/logodock/${commit}/logos/%E7%A4%BA%E4%BE%8B/logo%20%E5%9B%BE%E5%BD%A2.svg`,
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
    'logos/../x.svg',
    '/x.svg',
    'logos\\x.svg',
  ]) {
    assert.throws(() => assetPath({ path }));
  }
});

test('asset URL punctuation is encoded so copied Markdown stays a complete image reference', async () => {
  const { resourceLinks } = await resources();
  const links = resourceLinks({
    asset: { ...asset, path: 'logos/example/logo (1).svg' },
    brand,
    baseUrl: 'https://example.com/',
  });
  assert.equal(links.current, 'https://example.com/logos/example/logo%20%281%29.svg');
  assert.ok(links.markdown.endsWith('logo%20%281%29.svg)'));
});

test('nested detail pages resolve the explicit site root before creating image addresses', async () => {
  const { resourceLinks, siteRootUrl } = await resources();
  for (const [page, relativeRoot, expected] of [
    [
      'https://example.com/logodock/logos/git/?asset=logo.svg',
      '../../',
      'https://example.com/logodock/',
    ],
    ['https://example.com/logodock/?q=git', './', 'https://example.com/logodock/'],
    ['https://example.com/logos/git/', '../../', 'https://example.com/'],
  ]) {
    const baseUrl = siteRootUrl(page, relativeRoot);
    assert.equal(baseUrl, expected);
    assert.equal(
      resourceLinks({ asset: { ...asset, path: 'logos/git/logo.svg' }, brand, baseUrl }).current,
      `${expected}logos/git/logo.svg`,
    );
  }
  assert.throws(() => siteRootUrl('https://example.com/', 'https://evil.example/'));
});
