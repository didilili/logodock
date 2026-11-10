import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishedSourceCommit } from '../scripts/lib/published-source.mjs';

const search = () => import('../src/lib/catalog-search.mjs');
const brands = [
  {
    id: 'example',
    name: 'Example Inc.',
    aliases: ['示例公司', 'Example Company'],
    assets: [{ file: 'icon.svg', rights: { license: 'MIT' } }],
  },
  {
    id: 'another',
    name: 'Another Company',
    aliases: ['另一家公司'],
    assets: [{ file: 'wordmark.svg', rights: { license: 'CC BY 4.0' } }],
  },
];

// Git snapshot guards are pure source checks. They must not launch a Vite build
// for each temporary repository.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'logodock-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'logo/example'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  const metadata = {
    id: 'example',
    aliases: [],
    assets: [
      { file: 'icon.svg', path: 'logo/example/icon.svg' },
      { file: 'wordmark.svg', path: 'logo/example/wordmark.svg' },
    ],
  };
  await writeFile(join(root, 'logo/example/metadata.json'), JSON.stringify(metadata));
  for (const asset of metadata.assets)
    await writeFile(
      join(root, asset.path),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>',
    );
  await writeFile(join(root, 'src/app.mjs'), 'export const ready = true;');
  return { root, catalog: { brands: [metadata] } };
}

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commitAssets(
  root,
  { published = true, origin = 'https://github.com/didilili/logodock.git' } = {},
) {
  git(root, 'init', '--quiet');
  git(root, 'add', 'logo');
  git(
    root,
    '-c',
    'user.name=LogoDock test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'fixture assets',
  );
  const commit = git(root, 'rev-parse', 'HEAD');
  if (published) {
    git(root, 'remote', 'add', 'origin', origin);
    git(root, 'update-ref', 'refs/remotes/origin/main', commit);
  }
  return commit;
}

test('normalizes Unicode, casing, and repeated whitespace', async () => {
  assert.equal(
    (await search()).normalizeQuery('  ＥＸＡＭＰＬＥ\t公司\n  Logo '),
    'example 公司 logo',
  );
});

test('matches names, IDs, Chinese aliases, and all search terms', async () => {
  const { filterBrands } = await search();
  for (const query of ['EXAMPLE', '示例公司', 'example 公司', 'example icon MIT']) {
    assert.deepEqual(filterBrands(brands, query), [brands[0]]);
  }
  assert.deepEqual(filterBrands(brands, 'another 示例'), []);
});

test('empty queries return all brands and unknown queries return none', async () => {
  const { filterBrands } = await search();
  assert.deepEqual(filterBrands(brands, ' \t '), brands);
  assert.deepEqual(filterBrands(brands, 'absent'), []);
  assert.deepEqual(filterBrands([], ''), []);
});

test('search preserves input data and returns original brand objects', async () => {
  const input = structuredClone(brands);
  const snapshot = structuredClone(input);
  for (const brand of input) {
    Object.freeze(brand.aliases);
    for (const asset of brand.assets) {
      Object.freeze(asset.rights);
      Object.freeze(asset);
    }
    Object.freeze(brand.assets);
    Object.freeze(brand);
  }
  Object.freeze(input);
  const result = (await search()).filterBrands(input, 'example');
  assert.equal(result[0], input[0]);
  assert.deepEqual(input, snapshot);
});

test('fixed links use HEAD only when source assets are tracked and unchanged', async (t) => {
  const { root, catalog } = await fixture(t);
  const commit = commitAssets(root);
  assert.equal(publishedSourceCommit(root, catalog), commit);
  const path = join(root, 'logo/example/metadata.json');
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  metadata.aliases.push('另一个名字');
  await writeFile(path, JSON.stringify(metadata));
  assert.equal(publishedSourceCommit(root, catalog), '');
  git(root, 'add', 'logo');
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('uncommitted new asset content never gets a misleading fixed remote URL', async (t) => {
  const { root, catalog } = await fixture(t);
  commitAssets(root);
  catalog.brands[0].assets.push({ file: 'new-icon.svg', path: 'logo/example/new-icon.svg' });
  await writeFile(
    join(root, 'logo/example/new-icon.svg'),
    await readFile(join(root, 'logo/example/icon.svg')),
  );
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('ignored asset files absent from HEAD do not produce fixed links', async (t) => {
  const { root, catalog } = await fixture(t);
  await writeFile(join(root, '.gitignore'), 'logo/example/wordmark.svg\n');
  commitAssets(root);
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('uncommitted website edits do not invalidate an unchanged asset snapshot', async (t) => {
  const { root, catalog } = await fixture(t);
  const commit = commitAssets(root);
  await writeFile(join(root, 'src/app.mjs'), 'export const ready = false;');
  assert.equal(publishedSourceCommit(root, catalog), commit);
});

test('clean local commits without a known published snapshot do not produce fixed links', async (t) => {
  const { root, catalog } = await fixture(t);
  commitAssets(root, { published: false });
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('unpushed commits do not become fixed remote links', async (t) => {
  const { root, catalog } = await fixture(t);
  commitAssets(root);
  await writeFile(
    join(root, 'logo/example/metadata.json'),
    '{"id":"example","aliases":["本地新提交"]}',
  );
  git(root, 'add', 'logo');
  git(
    root,
    '-c',
    'user.name=LogoDock test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'local changes',
  );
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('a different repository remote cannot produce links to the canonical repository', async (t) => {
  const { root, catalog } = await fixture(t);
  commitAssets(root, { origin: 'https://github.com/example/logodock.git' });
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('source archives without Git do not advertise a fixed published commit', async (t) => {
  const { root, catalog } = await fixture(t);
  assert.equal(publishedSourceCommit(root, catalog), '');
});

test('shape and format filters intersect on files without changing the original catalog', async () => {
  const { matchingBrands } = await import('../src/lib/catalog-presentation.mjs');
  const assets = [
    { file: 'icon.svg', variant: 'icon' },
    { file: 'wordmark.png', variant: 'wordmark' },
  ];
  const brand = { ...brands[0], assets };
  assert.equal(matchingBrands([brand], { shape: 'icon', format: 'PNG' }).length, 0);
  assert.deepEqual(matchingBrands([brand], { shape: 'wordmark', format: 'PNG' })[0].assets, [
    assets[1],
  ]);
  assert.equal(brand.assets.length, 2);
});

test('directory URL state round-trips only available filters without adding a brand selection', async () => {
  const { directoryUrl, readDirectoryState } = await import('../src/lib/catalog-presentation.mjs');
  const available = [
    { ...brands[0], entityType: 'company', assets: [{ file: 'icon.svg', variant: 'icon' }] },
  ];
  const state = {
    q: 'Example & 示例',
    type: 'company',
    shape: 'icon',
    format: 'SVG',
    category: '',
  };
  const url = directoryUrl('https://example.com/logodock/?other=1', state);
  assert.equal(url.pathname, '/logodock/');
  assert.equal(url.searchParams.get('brand'), null);
  assert.equal(url.searchParams.get('other'), '1');
  assert.deepEqual(readDirectoryState(url, available), state);
  assert.deepEqual(
    readDirectoryState('https://example.com/?shape=fake&type=bad&format=EXE', available),
    { q: '', type: '', format: '', shape: '', category: '' },
  );
});
