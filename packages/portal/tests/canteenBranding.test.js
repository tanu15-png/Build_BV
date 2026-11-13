import test from 'node:test';
import assert from 'node:assert/strict';
import { canteenPoster } from '../src/services/canteenBranding.js';
import { mapCatalog } from '../src/services/catalog.js';
test('the single-canteen app uses a generic poster and food fallback', () => {
  assert.equal(canteenPoster('canteen'), '/food-placeholder.svg');
  assert.equal(canteenPoster('unknown'), '/food-placeholder.svg');
  const mapped = mapCatalog({ canteens: [{ id: 'id', slug: 'canteen' }], categories: [], items: [{ id: 'tea', canteenId: 'id', pricePaise: 2000 }] });
  assert.equal(mapped.cafes[0].image, '/food-placeholder.svg');
  assert.equal(mapped.foods[0].image, '/food-placeholder.svg');
});
