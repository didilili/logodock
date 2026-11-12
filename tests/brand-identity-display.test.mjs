import assert from 'node:assert/strict';
import test from 'node:test';
import { identityNames } from '../src/lib/catalog-display.mjs';

test('a reviewed short display name leads while official names remain available', () => {
  assert.deepEqual(
    identityNames({
      name: '阿里巴巴',
      identity: { nameZh: '阿里巴巴集团', nameEn: 'Alibaba Group' },
    }),
    { primary: '阿里巴巴', secondary: 'Alibaba Group' },
  );
  assert.deepEqual(
    identityNames({ name: 'Codeberg', identity: { nameZh: null, nameEn: 'Codeberg' } }),
    { primary: 'Codeberg', secondary: '' },
  );
  assert.deepEqual(identityNames({ identity: { nameZh: '示例', nameEn: 'Example' } }), {
    primary: '示例',
    secondary: 'Example',
  });
});
