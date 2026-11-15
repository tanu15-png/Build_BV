import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../src/schemas/contracts.js';

test('menu photos allow HTTPS URLs or exact uploaded-image references, never arbitrary local paths or embedded files', () => {
  const schema = contracts['POST /canteens/:id/menu']!.body;
  const base = { name: 'Photo fixture', categoryId: '00000000-0000-4000-8000-000000000001', pricePaise: 1000 };
  for (const imageRef of [null, 'https://example.com/photo.webp', '/banners/images/00000000-0000-4000-8000-000000000002']) assert(schema.safeParse({ ...base, imageRef }).success);
  for (const imageRef of ['http://example.com/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//example.com/photo.jpg', '/banners/images/../../secret', '/api/private', '/banners/images/00000000-0000-4000-8000-000000000002?x=1']) assert(!schema.safeParse({ ...base, imageRef }).success);
});
