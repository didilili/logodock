import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import lintStaged from 'lint-staged';

// lint-staged cannot back up partial work before the initial commit.
const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], { stdio: 'ignore' });
if (head.status !== 0) {
  console.error(
    'Staged checks require an existing HEAD commit to safely restore partially staged files. No files were checked or changed.',
  );
  process.exitCode = 1;
} else {
  const success = await lintStaged({
    configPath: fileURLToPath(new URL('../lint-staged.config.mjs', import.meta.url)),
    // Never auto-stage task output; restore the original state if a task fails.
    failOnChanges: true,
    revert: true,
  });

  process.exitCode = success ? 0 : 1;
}
