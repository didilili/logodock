import assert from 'node:assert/strict';
import { posix, win32 } from 'node:path';
import test from 'node:test';
import { isWithinDirectory, toPosixPath } from '../scripts/lib/paths.mjs';

test('catalog watching accepts POSIX and Windows source paths', () => {
  for (const path of [posix, win32]) {
    const root = path === win32 ? 'C:\\work\\logodock' : '/work/logodock';
    for (const folder of ['logo', 'schema', 'scripts']) {
      const directory = path.join(root, folder);
      const file = path.join(directory, 'example', 'source.json');
      assert.equal(isWithinDirectory(file, directory), true, file);
      assert.equal(isWithinDirectory(file, `${directory}${path.sep}`), true, file);
    }
  }
});

test('catalog watching keeps directory boundaries on both platforms', () => {
  for (const path of [posix, win32]) {
    const root = path === win32 ? 'C:\\work\\logodock' : '/work/logodock';
    const directory = path.join(root, 'logo');
    for (const file of [
      directory,
      path.join(root, 'logo-archive', 'metadata.json'),
      path.join(root, 'other', 'metadata.json'),
    ]) {
      assert.equal(isWithinDirectory(file, directory), false, file);
    }
  }
});

test('production inventory uses POSIX paths for native Windows and POSIX joins', () => {
  for (const path of [posix, win32]) {
    assert.equal(toPosixPath(path.join('logo', 'git', 'index.html')), 'logo/git/index.html');
    assert.match(toPosixPath(path.join('_app', 'immutable', 'app.js')), /^_app\/.*\.js$/);
    assert.match(toPosixPath(path.join('_app', 'immutable', 'app.css')), /^_app\/.*\.css$/);
  }
});
