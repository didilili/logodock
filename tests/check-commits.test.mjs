import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const zero = '0'.repeat(40);
const script = fileURLToPath(new URL('../scripts/check-commits.mjs', import.meta.url));

async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'logodock-commits-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'LogoDock test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'LogoDock test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const tree = execFileSync('git', ['hash-object', '-w', '-t', 'tree', '--stdin'], {
    cwd,
    input: '',
    encoding: 'utf8',
  }).trim();
  const commit = (message, parent) =>
    git('commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message);
  const base = commit('feat(catalog): 初始化目录');
  const first = commit('feat(site): 添加页面', base);
  const head = commit('docs(project): 更新说明', first);
  return { cwd, base, first, head, commit };
}

test('CI checks every newly pushed commit', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, base, first, head } = await fixture(t);
  assert.deepEqual(
    commitsForEvent('push', { before: base, after: head }, { cwd, fetchMissing: false }),
    [first, head],
  );
});

test('PR checks the entire base-to-head range', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, base, first, head } = await fixture(t);
  assert.deepEqual(
    commitsForEvent(
      'pull_request',
      { pull_request: { base: { sha: base }, head: { sha: head } } },
      { cwd, fetchMissing: false },
    ),
    [first, head],
  );
});

test('force-push checks replacement commits even when the old tip is not an ancestor', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, base, head, commit } = await fixture(t);
  const replacement = commit('fix(site): 修复页面', base);
  assert.deepEqual(
    commitsForEvent('push', { before: head, after: replacement }, { cwd, fetchMissing: false }),
    [replacement],
  );
});

test('new branches include their root commit and deleted branches skip checks', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, base, first, head } = await fixture(t);
  assert.deepEqual(
    commitsForEvent('push', { before: zero, after: head }, { cwd, fetchMissing: false }),
    [base, first, head],
  );
  assert.deepEqual(commitsForEvent('push', { before: head, after: zero }, { cwd }), []);
});

test('invalid event SHAs and unavailable history fail instead of skipping commits', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, head } = await fixture(t);
  assert.throws(() => commitsForEvent('push', { before: '--all', after: head }, { cwd }), /SHA/);
  assert.throws(
    () =>
      commitsForEvent(
        'push',
        { before: 'f'.repeat(40), after: head },
        { cwd, fetchMissing: false },
      ),
    /history|commit/i,
  );
});

test('shallow history is rejected or completed before checking the whole range', async (t) => {
  const { commitsForEvent } = await import('../scripts/check-commits.mjs');
  const { cwd, base, first, head } = await fixture(t);
  execFileSync('git', ['update-ref', 'refs/heads/main', head], { cwd });
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd });
  const shallow = join(cwd, 'shallow');
  execFileSync('git', [
    'clone',
    '--quiet',
    '--depth=1',
    '--no-checkout',
    pathToFileURL(cwd).href,
    shallow,
  ]);
  execFileSync('git', ['fetch', '--quiet', '--depth=1', 'origin', base], { cwd: shallow });
  const event = { before: base, after: head };
  assert.throws(
    () => commitsForEvent('push', event, { cwd: shallow, fetchMissing: false }),
    /shallow|history/i,
  );
  assert.deepEqual(commitsForEvent('push', event, { cwd: shallow }), [first, head]);
});

test('CI rejects an earlier invalid message even when the latest message is valid', async (t) => {
  const { cwd, base, commit } = await fixture(t);
  const bad = commit('unstructured change', base);
  const head = commit('fix(site): 修复页面', bad);
  const eventPath = join(cwd, 'event.json');
  await writeFile(eventPath, JSON.stringify({ before: base, after: head }));
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /unstructured change/);
});
