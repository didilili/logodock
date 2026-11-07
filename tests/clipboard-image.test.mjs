import assert from 'node:assert/strict';
import test from 'node:test';
import { canCopyPngImage, copyPngImage } from '../src/lib/clipboard-image.mjs';

class ClipboardItem {
  constructor(data) {
    this.data = data;
  }
  static supports(type) {
    return type === 'image/png';
  }
}
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
const response = (blob) => async () => ({ ok: true, blob: async () => blob });

test('PNG clipboard support requires write, ClipboardItem and PNG support when exposed', () => {
  assert.equal(canCopyPngImage({ write() {} }, ClipboardItem), true);
  assert.equal(canCopyPngImage(undefined, ClipboardItem), false);
  assert.equal(canCopyPngImage({ writeText() {} }, ClipboardItem), false);
  assert.equal(canCopyPngImage({ write() {} }, undefined), false);
  class UnsupportedItem extends ClipboardItem {
    static supports() {
      return false;
    }
  }
  assert.equal(canCopyPngImage({ write() {} }, UnsupportedItem), false);
});

test('queues clipboard.write before fetch resolves and preserves the original PNG Blob', async () => {
  let resolveFetch;
  const fetchResponse = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  let writeCalled = false;
  let written;
  const result = copyPngImage({
    url: '/logos/example/logo.png',
    fetcher: () => fetchResponse,
    ClipboardItemType: ClipboardItem,
    clipboard: {
      write: async (items) => {
        writeCalled = true;
        assert.ok(items[0].data['image/png'] instanceof Promise);
        written = await items[0].data['image/png'];
      },
    },
  });
  assert.equal(writeCalled, true, 'write must run synchronously within user activation');
  assert.equal(written, undefined);
  resolveFetch({ ok: true, blob: async () => png });
  assert.equal(await result, 'copied');
  assert.equal(written, png);
  assert.deepEqual(
    [...new Uint8Array(await written.arrayBuffer())],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
});

test('unexpected MIME and clipboard rejection report failure without a fabricated PNG or text fallback', async () => {
  let writtenBytes = 0;
  const clipboard = {
    write: async (items) => {
      await items[0].data['image/png'];
      writtenBytes += 1;
      throw new Error('Permission denied');
    },
  };
  const input = { url: '/logo.png', clipboard, ClipboardItemType: ClipboardItem };
  assert.equal(
    await copyPngImage({ ...input, fetcher: response(new Blob(['jpeg'], { type: 'image/jpeg' })) }),
    'failed',
  );
  assert.equal(writtenBytes, 0);
  assert.equal(await copyPngImage({ ...input, fetcher: response(png) }), 'failed');
  assert.equal(writtenBytes, 1);
});

test('a stale promised image rejects before the clipboard receives any old bytes', async () => {
  let current = true;
  let writtenBytes = 0;
  let promisedImage;
  const result = await copyPngImage({
    url: '/logo.png',
    ClipboardItemType: ClipboardItem,
    isCurrent: () => current,
    fetcher: async () => {
      current = false;
      return { ok: true, blob: async () => png };
    },
    clipboard: {
      write: async (items) => {
        promisedImage = items[0].data['image/png'];
        await promisedImage;
        writtenBytes += 1;
      },
    },
  });
  assert.equal(result, 'stale');
  assert.equal(writtenBytes, 0);
  await assert.rejects(promisedImage, /Stale image selection/);
});

test('revision changes during clipboard completion suppress stale success feedback', async () => {
  let current = true;
  assert.equal(
    await copyPngImage({
      url: '/logo.png',
      ClipboardItemType: ClipboardItem,
      isCurrent: () => current,
      fetcher: response(png),
      clipboard: {
        write: async (items) => {
          await items[0].data['image/png'];
          current = false;
        },
      },
    }),
    'stale',
  );
});
