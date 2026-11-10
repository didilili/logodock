import { resolve } from '$app/paths';
import source from '../../../CHANGELOG.md?raw';
import { parseChangelog } from '#lib/changelog.mjs';

export function load() {
  const { published } = parseChangelog(source, { basePath: resolve('/').replace(/\/$/, '') });
  return { releases: published };
}
