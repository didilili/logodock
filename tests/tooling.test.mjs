import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const cleanEnv = { ...process.env, CI: '', HUSKY: '', NODE_ENV: 'development' };

function run(cwd, command, args, options = {}) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', env: cleanEnv, ...options });
}

function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

async function temporary(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'logodock-tooling-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}

async function copyScript(cwd, name) {
  await mkdir(join(cwd, 'scripts'), { recursive: true });
  await cp(join(root, 'scripts', name), join(cwd, 'scripts', name));
}

async function linkDependencies(cwd) {
  await symlink(
    join(root, 'node_modules'),
    join(cwd, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

async function stagedFixture(t, { unborn = false } = {}) {
  const cwd = await temporary(t);
  if (unborn) {
    git(cwd, 'init', '--quiet');
  } else {
    // Share the existing read-only objects to get a HEAD without making a commit.
    git(root, 'clone', '--quiet', '--shared', '--no-checkout', root, cwd);
  }
  git(cwd, 'read-tree', '--empty');
  await copyScript(cwd, 'check-staged.mjs');
  await linkDependencies(cwd);
  for (const file of [
    'lint-staged.config.mjs',
    'eslint.config.mjs',
    '.prettierrc.json',
    '.prettierignore',
  ]) {
    await cp(join(root, file), join(cwd, file));
  }
  return cwd;
}

async function stage(cwd, file, contents, worktree = contents) {
  await mkdir(join(cwd, file, '..'), { recursive: true });
  const result = run(cwd, 'git', ['hash-object', '-w', '--stdin'], { input: contents });
  assert.equal(result.status, 0, result.stderr);
  git(cwd, 'update-index', '--add', '--cacheinfo', `100644,${result.stdout.trim()},${file}`);
  await writeFile(join(cwd, file), worktree);
}

async function snapshot(cwd, files) {
  return {
    index: git(cwd, 'ls-files', '--stage', '-z'),
    status: git(cwd, 'status', '--porcelain=v1', '-z'),
    stash: git(cwd, 'stash', 'list'),
    files: await Promise.all(files.map((file) => readFile(join(cwd, file), 'utf8'))),
  };
}

test('source SVG bytes survive staging and checkout without line-ending conversion', async (t) => {
  const cwd = await temporary(t);
  git(cwd, 'init', '--quiet');
  await cp(join(root, '.gitattributes'), join(cwd, '.gitattributes'));
  const file = 'logos/example/logo.svg';
  const original = '<svg xmlns="http://www.w3.org/2000/svg">\r\n</svg>\r\n';
  await mkdir(join(cwd, 'logos/example'), { recursive: true });
  await writeFile(join(cwd, file), original);
  git(cwd, 'add', '--', '.gitattributes', file);
  assert.equal(git(cwd, 'show', `:${file}`), original);
  git(cwd, 'diff', '--cached', '--check');
  await rm(join(cwd, file));
  git(cwd, 'checkout-index', '--', file);
  assert.equal(await readFile(join(cwd, file), 'utf8'), original);
});

test('hook installation skips archives, CI, production and HUSKY=0 without dependencies', async (t) => {
  const cwd = await temporary(t);
  await copyScript(cwd, 'install-hooks.mjs');
  const archive = run(cwd, process.execPath, ['scripts/install-hooks.mjs']);
  assert.equal(archive.status, 0, archive.stderr);
  git(cwd, 'init', '--quiet');
  for (const extra of [{ CI: 'true' }, { CI: '1' }, { NODE_ENV: 'production' }, { HUSKY: '0' }]) {
    const result = run(cwd, process.execPath, ['scripts/install-hooks.mjs'], {
      env: { ...cleanEnv, ...extra },
    });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('explicit hook installation configures a local Git checkout', async (t) => {
  const cwd = await temporary(t);
  git(cwd, 'init', '--quiet');
  await copyScript(cwd, 'install-hooks.mjs');
  await linkDependencies(cwd);
  const result = run(cwd, process.execPath, ['scripts/install-hooks.mjs']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(cwd, 'config', '--local', 'core.hooksPath').trim(), '.husky/_');
  assert.match(await readFile(join(cwd, '.husky/_/pre-commit'), 'utf8'), /h/);
});

test('staged checks lint the index snapshot and preserve partial work on success and failure', async (t) => {
  const cwd = await stagedFixture(t);
  const file = 'scripts/中文 空格 \'"$;.mjs';
  const valid = "console.log('暂存快照');\n";
  const invalid = 'const = ;\n';

  for (const [staged, worktree, expected] of [
    [valid, invalid, 0],
    [invalid, valid, 1],
  ]) {
    await stage(cwd, file, staged, worktree);
    const before = await snapshot(cwd, [file]);
    const result = run(cwd, process.execPath, ['scripts/check-staged.mjs']);
    assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(await snapshot(cwd, [file]), before);
  }
});

test('staged checks refuse an unborn HEAD without changing staged or unstaged content', async (t) => {
  const valid = "console.log('暂存快照');\n";
  const invalid = 'const = ;\n';
  for (const [name, staged, worktree] of [
    ['invalid staged content with an unstaged repair', invalid, valid],
    ['valid staged content with unstaged work', valid, invalid],
  ]) {
    await t.test(name, async (t) => {
      const cwd = await stagedFixture(t, { unborn: true });
      const file = 'scripts/partial.mjs';
      await stage(cwd, file, staged, worktree);
      const before = await snapshot(cwd, [file]);
      const indexBefore = await readFile(join(cwd, '.git/index'));
      const result = run(cwd, process.execPath, ['scripts/check-staged.mjs']);
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.deepEqual(await snapshot(cwd, [file]), before);
      assert.deepEqual(await readFile(join(cwd, '.git/index')), indexBefore);
      assert.match(result.stderr, /existing HEAD commit/);
    });
  }
});

test('format failures stay check-only and ignored source artwork is skipped', async (t) => {
  const cwd = await stagedFixture(t);
  const file = 'scripts/unformatted.mjs';
  const artwork = 'logos/example/original.json';
  await stage(cwd, artwork, '{ "original" :   true }');
  const ignoredBefore = await snapshot(cwd, [artwork]);
  const ignored = run(cwd, process.execPath, ['scripts/check-staged.mjs']);
  assert.equal(ignored.status, 0, `${ignored.stdout}\n${ignored.stderr}`);
  assert.deepEqual(await snapshot(cwd, [artwork]), ignoredBefore);

  await stage(cwd, file, 'console.log(  "保持原样"  )\n');
  const before = await snapshot(cwd, [file, artwork]);
  const result = run(cwd, process.execPath, ['scripts/check-staged.mjs']);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(await snapshot(cwd, [file, artwork]), before);
});

test('unexpected task edits fail without automatic staging and restore the original files', async (t) => {
  const cwd = await stagedFixture(t);
  const file = 'scripts/task-output.mjs';
  await stage(cwd, file, "console.log('original');\n", "console.log('work in progress');\n");
  await writeFile(
    join(cwd, 'lint-staged.config.mjs'),
    "export default { '*.mjs': 'node scripts/mutate.mjs' };\n",
  );
  await writeFile(
    join(cwd, 'scripts/mutate.mjs'),
    "import { writeFileSync } from 'node:fs';\nwriteFileSync(process.argv[2], 'changed by a task');\n",
  );
  const trace = join(cwd, 'git-trace.log');
  await writeFile(trace, '');
  const before = await snapshot(cwd, [file]);
  const result = run(cwd, process.execPath, ['scripts/check-staged.mjs'], {
    env: { ...cleanEnv, GIT_TRACE: trace },
  });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /Tasks modified files/);
  assert.deepEqual(await snapshot(cwd, [file]), before);
  assert.doesNotMatch(await readFile(trace, 'utf8'), /built-in: git add(?:\s|$)/);
});
