import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const repository = new URL('../', import.meta.url);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('Vite serves base-path SSR, native assets and schema recovery without a production rebuild', { timeout: 45000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'logodock-dev-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['scripts', 'schema', 'logos', 'src']) {
    await cp(new URL(folder, repository), join(root, folder), { recursive: true });
  }
  for (const file of await readdir(repository)) {
    if (/^(?:package\.json|(?:svelte|vite|tsconfig)\.config\.[^.]+|tsconfig\.json)$/.test(file)) {
      await cp(new URL(file, repository), join(root, file));
    }
  }
  await symlink(new URL('node_modules', repository), join(root, 'node_modules'), 'dir');
  const child = spawn(process.execPath, ['scripts/dev.mjs', '--port', '0', '--base', '/logodock/'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(() => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  }));
  async function eventually(check, label) {
    const started = Date.now();
    while (Date.now() - started < 10000) {
      try {
        if (await check()) return;
      } catch (error) {
        // Vite may briefly close HTTP while reloading validated source modules.
        if (!['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET'].includes(error.cause?.code)) throw error;
      }
      if (child.exitCode !== null) throw new Error(`Vite exited (${child.exitCode}): ${output}`);
      await delay(100);
    }
    assert.fail(`${label}\n${output}`);
  }
  let url;
  await eventually(async () => {
    url = output.match(/http:\/\/(?:127\.0\.0\.1|localhost):\d+\/logodock\//)?.[0];
    return Boolean(url);
  }, 'Vite did not print its local base URL.');
  const home = await fetch(url);
  assert.equal(home.status, 200, await home.clone().text());
  const devHtml = await home.text();
  assert.ok(devHtml.includes('__sveltekit_dev'), 'Development HTML must use the SvelteKit development bootstrap.');
  const viteClient = await fetch(`${url}@vite/client`);
  assert.equal(viteClient.status, 200);
  assert.ok((await viteClient.text()).includes('createHotContext'), 'The base path must serve Vite hot-update modules.');
  const detail = await fetch(`${url}logos/git/`);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /Git Logo|Git/);
  const source = await fetch(`${url}logos/git/icon-orange.svg`);
  assert.equal(source.status, 200);
  assert.equal(await source.text(), await readFile(new URL('logos/git/icon-orange.svg', repository), 'utf8'));

  // Exercise Svelte's SSR escaping with real, schema-valid hostile metadata in
  // the same server. No string-renderer-specific fixture or extra build.
  const metadataPath = join(root, 'logos/alibaba/metadata.json');
  const originalMetadata = await readFile(metadataPath, 'utf8');
  const hostile = JSON.parse(originalMetadata);
  const attack = `"><img src=x onerror=alert(1)></script><script>alert('x')</script>&\u2028`;
  hostile.name = hostile.identity.nameZh = attack;
  await writeFile(metadataPath, JSON.stringify(hostile));
  await eventually(async () => {
    const response = await fetch(`${url}logos/alibaba/`);
    const html = await response.text();
    if (response.status !== 200 || !html.includes('&lt;img src=x')) return false;
    assert.ok(!html.includes('<img src=x'), 'Metadata cannot create an image element.');
    assert.ok(!html.includes("<script>alert('x')</script>"), 'Metadata cannot create a script element.');
    return true;
  }, 'Changed metadata must be escaped in actual SSR output.');
  await writeFile(metadataPath, originalMetadata);

  const schemaPath = join(root, 'schema/metadata.schema.json');
  const original = await readFile(schemaPath, 'utf8');
  const schema = JSON.parse(original);
  schema.properties.entityType.enum = ['not-a-real-type'];
  await writeFile(schemaPath, JSON.stringify(schema));
  await eventually(async () => {
    const response = await fetch(url);
    await response.text();
    return response.status >= 500;
  }, 'A changed invalid schema must not continue serving a stale valid catalog.');
  await writeFile(schemaPath, original);
  await eventually(async () => {
    const response = await fetch(url);
    const body = await response.text();
    return response.status === 200 && body.includes('LogoDock');
  }, 'The development server must recover after restoring the schema.');
});
