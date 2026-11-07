import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { prepareSite } from '../scripts/prepare-site.mjs';

test('generated public staging contains only current validated files, removing stale siblings', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'logodock-staging-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logos'), { recursive: true });
  await cp(new URL('../logos/git', import.meta.url), join(root, 'logos/git'), { recursive: true });
  await mkdir(join(root, 'static/logos/retired'), { recursive: true });
  await writeFile(join(root, 'static/old-private.json'), 'must not be published');
  await writeFile(join(root, 'static/logos/retired/icon.svg'), '<svg/>');
  const catalog = await prepareSite(root);
  assert.deepEqual((await readdir(join(root, 'static'))).sort(), [
    '.nojekyll',
    'index.json',
    'logos',
  ]);
  assert.deepEqual(await readdir(join(root, 'static/logos')), ['git']);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'static/index.json'), 'utf8')), catalog);
});
