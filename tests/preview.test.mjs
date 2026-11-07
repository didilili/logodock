import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function preview(t, basePath = '/') {
  const root = await mkdtemp(join(tmpdir(), 'logodock-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'site'));
  await writeFile(join(root, 'secret.txt'), 'outside');
  await writeFile(join(root, 'site/index.html'), '<h1>LogoDock</h1>');
  await writeFile(join(root, 'site/app.mjs'), 'export const ready = true;');
  await mkdir(join(root, 'site/logos/example'), { recursive: true });
  await writeFile(join(root, 'site/logos/example/index.html'), '<h1>Example</h1>');
  const { createPreviewServer } = await import('../scripts/lib/preview-server.mjs');
  const server = createPreviewServer(join(root, 'site'), { basePath });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('local preview serves HTML and browser modules with correct content types', async (t) => {
  const url = await preview(t);
  const index = await fetch(`${url}/?q=logo`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.equal(await index.text(), '<h1>LogoDock</h1>');
  const script = await fetch(`${url}/app.mjs`);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(await script.text(), 'export const ready = true;');
});

test('local preview handles HEAD, missing files, and unsupported methods', async (t) => {
  const url = await preview(t);
  const head = await fetch(`${url}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), String(Buffer.byteLength('<h1>LogoDock</h1>')));
  const missing = await fetch(`${url}/missing.svg`);
  assert.equal(missing.status, 404);
  await missing.text();
  const post = await fetch(`${url}/`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  await post.text();
});

test('local preview does not serve files outside its output directory', async (t) => {
  const url = await preview(t);
  for (const path of ['/%2e%2e%2fsecret.txt', '/%ZZ', '/.git/config']) {
    const response = await fetch(url + path);
    assert.ok([400, 403, 404].includes(response.status));
    assert.doesNotMatch(await response.text(), /outside/);
  }
});

test('local preview can verify a GitHub-style repository subpath', async (t) => {
  const url = await preview(t, '/logodock/');
  const index = await fetch(`${url}/logodock/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /LogoDock/);
  const script = await fetch(`${url}/logodock/app.mjs`);
  assert.equal(script.status, 200);
  await script.text();
  const root = await fetch(`${url}/`);
  assert.equal(root.status, 404);
  await root.text();
});

test('canonical directory redirects preserve asset selection and filters', async (t) => {
  const query = '?asset=icon-white.png&format=PNG&q=%E5%85%AC%E5%8F%B8';
  for (const base of ['/', '/logodock/']) {
    const url = await preview(t, base);
    const detail = await fetch(`${url}${base}logos/example${query}`, { redirect: 'manual' });
    assert.equal(detail.status, 308);
    assert.equal(detail.headers.get('location'), `${base}logos/example/${query}`);
    await detail.text();
    if (base !== '/') {
      const root = await fetch(`${url}${base.slice(0, -1)}${query}`, { redirect: 'manual' });
      assert.equal(root.headers.get('location'), `${base}${query}`);
      await root.text();
    }
  }
});
