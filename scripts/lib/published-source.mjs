import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

export function publishedSourceCommit(root, catalog) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(root)) return '';
    if (git('status', '--porcelain', '--untracked-files=all', '--', 'logo')) return '';
    const paths = catalog.brands.flatMap((brand) => [
      `logo/${brand.id}/metadata.json`,
      ...brand.assets.map((asset) => asset.path),
    ]);
    // Also reject ignored source files that exist locally but not in the commit.
    if (paths.length) git('ls-files', '--error-unmatch', '--', ...paths);
    const commit = git('rev-parse', 'HEAD');
    if (!/^[a-f0-9]{40}$/.test(commit)) return '';
    // The UI links to the canonical public repository. A clean local commit is
    // insufficient: it must also be a known published snapshot of that repo.
    const actionsSnapshot =
      process.env.GITHUB_ACTIONS === 'true' &&
      process.env.GITHUB_REPOSITORY?.toLowerCase() === 'didilili/logodock' &&
      process.env.GITHUB_SHA === commit;
    if (actionsSnapshot) return commit;
    const origin = git('remote', 'get-url', 'origin');
    if (
      !/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)didilili\/logodock(?:\.git)?\/?$/i.test(
        origin,
      )
    )
      return '';
    return git(
      'for-each-ref',
      '--format=%(refname)',
      `--contains=${commit}`,
      'refs/remotes/origin/',
    )
      ? commit
      : '';
  } catch {
    return ''; // Source archives and unpublished local resources have no fixed remote URL.
  }
}
