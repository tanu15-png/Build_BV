import test from 'node:test';
import assert from 'node:assert/strict';
import { menuImageSrc, prepareMenuImage } from '../src/services/menuImages.js';

test('uploaded images resolve through the current portal while external URLs remain intact', () => {
  assert.equal(menuImageSrc('/banners/images/fixture'), '/api/v1/student/banners/images/fixture');
  assert.equal(menuImageSrc('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
});
test('menu photo compression preserves proportions, bounds size and cleans temporary URLs', async () => {
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  let released = false, drawn = false;
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() { drawn = true; } }), toBlob: callback => callback(new Blob(['compressed'], { type: 'image/webp' })) };
  URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => { released = true; };
  globalThis.Image = class { naturalWidth = 4000; naturalHeight = 2000; async decode() {} };
  globalThis.document = { createElement: () => canvas };
  try {
    const result = await prepareMenuImage(new Blob(['source'], { type: 'image/jpeg' }));
    assert.equal(canvas.width, 1200); assert.equal(canvas.height, 600); assert(drawn); assert(released); assert.equal(result.type, 'image/webp');
    await assert.rejects(() => prepareMenuImage(new Blob(['script'], { type: 'image/svg+xml' })), /JPEG, PNG or WebP/);
    await assert.rejects(() => prepareMenuImage({ type: 'image/jpeg', size: 9 * 1024 * 1024 }), /8 MB/);
  } finally { globalThis.Image = originalImage; globalThis.document = originalDocument; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});
