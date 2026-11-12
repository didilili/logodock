import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, repositoryRoot } from '../scripts/lib/catalog.mjs';
import { fixtureSvg as svg } from './helpers/catalog-fixtures.mjs';

const digest = createHash('sha256').update(svg).digest('hex');
const cli = fileURLToPath(new URL('../scripts/prepare-asset.mjs', import.meta.url));

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-prepare-asset-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logo'));
  return root;
}

test('prepare-asset creates an isolated draft with exact bytes and pending manual rights', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  const run = spawnSync(
    process.execPath,
    [
      cli,
      input,
      '--id',
      'sample',
      '--name',
      'Sample',
      '--output',
      output,
      '--entity-type',
      'organization',
      '--label',
      'Original icon',
      '--category',
      'developer-tools',
      '--topic',
      'developer-ecosystem',
    ],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  const draft = JSON.parse(await readFile(join(output, 'metadata.json'), 'utf8'));
  assert.equal(draft.schemaVersion, 4);
  assert.equal(draft.entityType, 'organization');
  assert.deepEqual(draft.identity, { nameZh: null, nameEn: null, legalNames: [], sources: [] });
  assert.equal(draft.assets[0].language, 'none');
  assert.equal(draft.assets[0].layout, 'standalone');
  assert.equal(draft.assets[0].color, 'brand');
  assert.equal(Object.hasOwn(draft.assets[0], 'usage'), false);
  assert.deepEqual(draft.assets[0].provenance, { sourceType: '', processing: '' });
  assert.equal(draft.defaultAsset, 'source.svg');
  assert.deepEqual(draft.categories, ['developer-tools']);
  assert.deepEqual(draft.topics, ['developer-ecosystem']);
  assert.equal(draft.assets[0].label, 'Original icon');
  assert.equal(draft.assets[0].sha256, digest);
  assert.equal(draft.assets[0].bytes, Buffer.byteLength(svg));
  assert.equal(draft.assets[0].rights.status, 'pending-review');
  assert.equal(draft.assets[0].source, '');
  assert.equal(draft.assets[0].rights.reference, '');
  assert.equal(await readFile(join(output, 'source.svg'), 'utf8'), svg);
  assert.match(run.stdout, /manual|review|人工|审核/i);
  await mkdir(join(root, 'logo/sample'));
  await writeFile(join(root, 'logo/sample/source.svg'), svg);
  await writeFile(join(root, 'logo/sample/metadata.json'), JSON.stringify(draft));
  await assert.rejects(loadCatalog(root), /Invalid catalog:/);
});

test('prepare-asset accepts explicit reviewed app usage without making it the default', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  const output = join(root, 'app-draft');
  await writeFile(input, svg);
  const run = spawnSync(
    process.execPath,
    [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output, '--usage', 'app-icon'],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  const draft = JSON.parse(await readFile(join(output, 'metadata.json'), 'utf8'));
  assert.equal(draft.assets[0].usage, 'app-icon');
});

test('prepare-asset never overwrites, validates image content and gives readable usage errors', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  await mkdir(output);
  await writeFile(join(output, 'metadata.json'), 'preserve me');
  const args = [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output];
  const existing = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(existing.status, 1);
  assert.match(existing.stderr, /already exists|已存在/i);
  assert.equal(await readFile(join(output, 'metadata.json'), 'utf8'), 'preserve me');
  await writeFile(input, '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
  const invalid = spawnSync(process.execPath, [...args.slice(0, -1), join(root, 'invalid')], {
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /SVG/);
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--output/);
  const unknown = spawnSync(process.execPath, [cli, '--permitted'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.doesNotMatch(unknown.stderr, /at file:|node:internal/);
});

test('prepare-asset blocks catalog destinations including symlinked parents', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  await writeFile(input, svg);
  const alias = join(root, 'catalog-alias');
  await symlink(join(repositoryRoot, 'logo'), alias);
  const output = join(alias, `draft-test-no-write-${process.pid}`);
  const run = spawnSync(
    process.execPath,
    [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /outside logo/);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
});

test('prepare-asset rejects hidden image filenames before writing a draft', async (t) => {
  const root = await workspace(t);
  const input = join(root, '.logo.svg');
  const output = join(root, 'draft');
  await writeFile(input, svg);
  const run = spawnSync(
    process.execPath,
    [cli, input, '--id', 'sample', '--name', 'Sample', '--output', output],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /non-hidden.*filename|filename.*dot/i);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  assert.equal(await readFile(input, 'utf8'), svg);
});
