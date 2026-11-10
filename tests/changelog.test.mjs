import assert from 'node:assert/strict';
import test from 'node:test';

const changelog = () => import('../src/lib/changelog.mjs');

test('returns an empty collection when the document has no entries', async () => {
  const { parseChangelog } = await changelog();
  assert.deepEqual(parseChangelog('# 变更记录\n\n面向使用者。'), {
    published: [],
    unreleased: null,
  });
});

test('parses dated entries and their category sections', async () => {
  const { parseChangelog } = await changelog();
  const { published, unreleased } = parseChangelog(`## 2026-11-09 · 新增品牌与素材

### 新增收录

- 新增 **示例品牌**。

### 素材更新

更新来源原件。`);

  assert.equal(unreleased, null);
  assert.deepEqual(published, [
    {
      id: '2026-11-09',
      date: '2026-11-09',
      title: '新增品牌与素材',
      sections: [
        {
          title: '新增收录',
          html: '<ul><li>新增 <strong>示例品牌</strong>。</li></ul>',
          compatibility: false,
        },
        { title: '素材更新', html: '<p>更新来源原件。</p>', compatibility: false },
      ],
    },
  ]);
});

test('sorts published dates descending while preserving same-day source order and unique IDs', async () => {
  const { parseChangelog } = await changelog();
  const { published } = parseChangelog(`## 2026-11-07 · 较早
### 新增收录
- A
## 2026-11-09 · 当日第一条
### 新增收录
- B
## 2026-11-08 · 中间
### 新增收录
- C
## 2026-11-09 · 当日第二条
### 素材更新
- D`);

  assert.deepEqual(
    published.map(({ id, date, title }) => ({ id, date, title })),
    [
      { id: '2026-11-09', date: '2026-11-09', title: '当日第一条' },
      { id: '2026-11-09-2', date: '2026-11-09', title: '当日第二条' },
      { id: '2026-11-08', date: '2026-11-08', title: '中间' },
      { id: '2026-11-07', date: '2026-11-07', title: '较早' },
    ],
  );
});

test('keeps unreleased content separate and accepts the existing untitled unreleased heading', async () => {
  const { parseChangelog } = await changelog();
  for (const heading of ['未发布', '未发布 · 下一批素材']) {
    const result = parseChangelog(`## ${heading}

还在整理。

## 2026-11-08 · 已发布

### 新增收录

- 已完成。`);
    assert.equal(result.published.length, 1);
    assert.equal(result.unreleased.id, 'unreleased');
    assert.equal(result.unreleased.date, null);
    assert.equal(result.unreleased.title, heading.includes('·') ? '下一批素材' : '未发布');
    assert.deepEqual(result.unreleased.sections, [
      { title: '', html: '<p>还在整理。</p>', compatibility: false },
    ]);
    assert.ok(!result.published[0].sections[0].html.includes('还在整理'));
  }
});

test('validates calendar dates instead of normalizing impossible release dates', async () => {
  const { parseChangelog } = await changelog();
  assert.equal(parseChangelog('## 2024-02-29 · 闰日').published[0].date, '2024-02-29');
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-11-31']) {
    assert.throws(() => parseChangelog(`## ${date} · 错误日期`), /Invalid changelog date/);
  }
  assert.throws(() => parseChangelog('## 2026-2-09 · 格式错误'), /Invalid changelog heading/);
});

test('rejects duplicate unreleased entries rather than silently dropping their content', async () => {
  const { parseChangelog } = await changelog();
  assert.throws(
    () => parseChangelog('## 未发布\n\n第一段。\n\n## 未发布 · 另一个\n\n第二段。'),
    /Only one unreleased entry/,
  );
});

test('renders paragraphs, lists, inline code and bold while escaping text', async () => {
  const { parseChangelog } = await changelog();
  const result = parseChangelog(`## 2026-11-09 · 文本
### 体验改进与修复
第一行 & 第二行
继续说明。

- 使用 \`<svg title="Logo">\`。
- 支持 **清晰 & 透明**。

<script>alert('x')</script>`);
  assert.equal(
    result.published[0].sections[0].html,
    '<p>第一行 &amp; 第二行 继续说明。</p>' +
      '<ul><li>使用 <code>&lt;svg title=&quot;Logo&quot;&gt;</code>。</li>' +
      '<li>支持 <strong>清晰 &amp; 透明</strong>。</li></ul>' +
      '<p>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</p>',
  );
});

test('maps brand links below the deployment base path', async () => {
  const { parseChangelog } = await changelog();
  const markdown = `## 2026-11-09 · 链接
### 新增收录
[示例](logo/example/) [带定位](logo/example/?asset=logo.svg#download)`;
  for (const [basePath, prefix] of [
    ['', ''],
    ['/', ''],
    ['/logodock', '/logodock'],
    ['/logodock/', '/logodock'],
  ]) {
    const html = parseChangelog(markdown, { basePath }).published[0].sections[0].html;
    assert.ok(html.includes(`href="${prefix}/logo/example/"`));
    assert.ok(html.includes(`href="${prefix}/logo/example/?asset=logo.svg#download"`));
  }
});

test('maps repository Markdown links and preserves HTTPS links and anchors', async () => {
  const { parseChangelog } = await changelog();
  const { published } = parseChangelog(`## 2026-11-09 · 链接
### 新增收录
[规范](docs/versioning.md#版本) [贡献](./CONTRIBUTING.md) [官网](https://example.com/?a=1&b=2) [定位](#2026-11-08) [**加粗**](logo/example/)`);
  const html = published[0].sections[0].html;
  assert.ok(
    html.includes('href="https://github.com/didilili/logodock/blob/main/docs/versioning.md#版本"'),
  );
  assert.ok(html.includes('href="https://github.com/didilili/logodock/blob/main/CONTRIBUTING.md"'));
  assert.ok(html.includes('href="https://example.com/?a=1&amp;b=2"'));
  assert.ok(html.includes('href="#2026-11-08"'));
  assert.ok(html.includes('<a href="/logo/example/"><strong>加粗</strong></a>'));
});

test('rejects executable and unknown URL forms without interpreting raw HTML', async () => {
  const { parseChangelog } = await changelog();
  const markdown = `## 2026-11-09 · 安全
### 新增收录
[脚本](javascript:alert) [大写](JaVaScRiPt:alert) [数据](data:text/html,test) [协议](//evil.example/) [反斜线](https:\\evil.example) [穿越](../README.md) [编码穿越](%2e%2e/README.md)

<img src=x onerror=alert(1)>

[<b>安全标签</b>](https://example.com/"onclick="x)`;
  const html = parseChangelog(markdown).published[0].sections[0].html;
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('https://example.com/&quot;onclick=&quot;x'));
  assert.ok(html.includes('&lt;b&gt;安全标签&lt;/b&gt;</a>'));
});

test('folds compatibility tables while keeping surrounding explanations visible', async () => {
  const { parseChangelog } = await changelog();
  const { published } = parseChangelog(`## 2026-11-09 · 引用调整
### 引用变化
旧图片地址返回 404。

| 已删除路径 | 推荐替代 | 原因 |
| :--- | ---: | --- |
| \`logo/example/old.png\` | [示例](logo/example/) | <svg> & **原件** |

下载现有文件可继续使用。

- 请按新路径更新引用。

### 素材更新
- 来源已核对。`);
  const [compatibility, assets] = published[0].sections;
  assert.equal(compatibility.compatibility, true);
  assert.equal(assets.compatibility, false);
  assert.equal(
    compatibility.html,
    '<p>旧图片地址返回 404。</p>' +
      '<details class="changelog-file-changes"><summary>查看受影响文件与替代</summary>' +
      '<div class="changelog-table-scroll">' +
      '<table><thead><tr><th scope="col">已删除路径</th><th scope="col">推荐替代</th><th scope="col">原因</th></tr></thead>' +
      '<tbody><tr><td><code>logo/example/old.png</code></td><td><a href="/logo/example/">示例</a></td>' +
      '<td>&lt;svg&gt; &amp; <strong>原件</strong></td></tr></tbody></table></div></details>' +
      '<p>下载现有文件可继续使用。</p><ul><li>请按新路径更新引用。</li></ul>',
  );
});

test('keeps tables in ordinary categories expanded', async () => {
  const { parseChangelog } = await changelog();
  const { published } = parseChangelog(`## 2026-11-09 · 素材说明
### 素材更新
| 品牌 | 用途 |
| --- | --- |
| 示例 | 官网字标 |`);
  const section = published[0].sections[0];
  assert.equal(section.compatibility, false);
  assert.ok(section.html.startsWith('<table>'));
  assert.ok(!section.html.includes('<details'));
});
