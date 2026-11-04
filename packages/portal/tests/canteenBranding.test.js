import test from 'node:test';
import assert from 'node:assert/strict';
import { canteenPoster } from '../src/services/canteenBranding.js';
import { mapCatalog } from '../src/services/catalog.js';
test('supplied posters are scoped by canteen slug and never used as food photos', () => {
  for (const slug of ['annapurna', 'mukteshwari', 'spicy-bites', 'bella-bite', 'shanu', 'fun-n-frolic', 'desi-jayka']) assert.equal(canteenPoster(slug), `/canteens/${slug}.jpg`);
  assert.equal(canteenPoster('agarwal'), '/food-placeholder.svg');
  const mapped = mapCatalog({ canteens: [{ id: 'id', slug: 'bella-bite' }], categories: [], items: [{ id: 'tea', canteenId: 'id', pricePaise: 2000 }] });
  assert.equal(mapped.cafes[0].image, '/canteens/bella-bite.jpg'); assert.equal(mapped.foods[0].image, '/food-placeholder.svg');
});
