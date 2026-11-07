import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const zero = '0'.repeat(40);
const config = fileURLToPath(new URL('../commitlint.config.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@commitlint/cli/cli.js', import.meta.url));

export function commitsForEvent(
  eventName,
  event,
  { cwd = process.cwd(), fetchMissing = true } = {},
) {
  let before;
  let after;
  if (eventName === 'pull_request') {
    before = event.pull_request?.base?.sha;
    after = event.pull_request?.head?.sha;
  } else if (eventName === 'push') {
    ({ before, after } = event);
  } else {
    throw new Error(`Unsupported commit check event: ${eventName || '(missing)'}`);
  }
  for (const sha of [before, after]) {
    if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) {
      throw new Error('Commit check requires valid event SHAs.');
    }
  }
  if (eventName === 'push' && after === zero) return [];
  if (after === zero || (eventName === 'pull_request' && before === zero)) {
    throw new Error('Pull request commit SHAs cannot be empty.');
  }
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    if (!fetchMissing)
      throw new Error('Full commit history is required; the repository is shallow.');
    try {
      git('fetch', '--unshallow', '--no-tags', 'origin');
      if (git('rev-parse', '--is-shallow-repository') === 'true') {
        throw new Error('The repository is still shallow.');
      }
    } catch (cause) {
      throw new Error('Cannot complete shallow commit history.', { cause });
    }
  }
  for (const sha of new Set([before, after].filter((sha) => sha !== zero))) {
    try {
      git('cat-file', '-e', `${sha}^{commit}`);
    } catch {
      if (!fetchMissing) throw new Error(`Commit history is unavailable for ${sha}.`);
      try {
        // Fetch the complete ancestry: shallow exclusions could include unrelated old commits.
        git('fetch', '--no-tags', 'origin', sha);
        git('cat-file', '-e', `${sha}^{commit}`);
      } catch (cause) {
        throw new Error(`Cannot fetch commit history for ${sha}.`, { cause });
      }
    }
  }
  // A zero "before" marks a new branch. Include the root rather than dropping it.
  const range = before === zero ? after : `${before}..${after}`;
  return git('rev-list', '--reverse', '--topo-order', range).split('\n').filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.env.GITHUB_EVENT_PATH)
      throw new Error('GITHUB_EVENT_PATH is required for CI checks.');
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const commits = commitsForEvent(process.env.GITHUB_EVENT_NAME, event);
    let failed = false;
    for (const sha of commits) {
      const message = execFileSync('git', ['show', '-s', '--format=%B', sha], { encoding: 'utf8' });
      const result = spawnSync(process.execPath, [cli, '--config', config], {
        input: message,
        encoding: 'utf8',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        console.error(`Invalid commit message (${sha.slice(0, 7)}):`);
        process.stderr.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        failed = true;
      }
    }
    process.exitCode = failed ? 1 : 0;
    console.log(`Checked ${commits.length} commit messages.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
