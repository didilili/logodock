import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publishedSourceCommit } from '../../../scripts/lib/published-source.mjs';
import type { Catalog } from '../types';
const dev = import.meta.env.DEV;

let snapshot: Promise<{ catalog: Catalog; sourceCommit: string }> | undefined;
async function readSnapshot() {
  if (dev && process.env.LOGODOCK_VALIDATION_ERROR) throw new Error(process.env.LOGODOCK_VALIDATION_ERROR);
  // prepare-site validates the source before writing this generated snapshot.
  // Reading by cwd also keeps source-relative Node validation code out of SSR bundles.
  const catalog = JSON.parse(await readFile(join(process.cwd(), 'static/index.json'), 'utf8')) as Catalog;
  return { catalog, sourceCommit: publishedSourceCommit(process.cwd(), catalog) };
}
export function catalogSnapshot() {
  // Build-time reuse only. Development reads current files, not a frozen snapshot.
  return dev ? readSnapshot() : (snapshot ??= readSnapshot());
}
