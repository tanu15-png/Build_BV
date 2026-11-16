import test from 'node:test';
import assert from 'node:assert/strict';
import { canteenPoster } from '../src/services/canteenBranding.js';
import { mapCatalog } from '../src/services/catalog.js';
test('canteen branding uses the supplied logo while dishes retain their food fallback', () => {
  assert.equal(canteenPoster('canteen'), '/brand/spoonate-logo.svg');
  assert.equal(canteenPoster('unknown'), '/brand/spoonate-logo.svg');
  const mapped = mapCatalog({ canteens: [{ id: 'id', slug: 'canteen' }], categories: [], items: [{ id: 'tea', canteenId: 'id', pricePaise: 2000 }] });
  assert.equal(mapped.cafes[0].image, '/brand/spoonate-logo.svg');
  assert.equal(mapped.foods[0].image, '/food-placeholder.svg');
});
