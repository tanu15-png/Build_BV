import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCatalog, mapCart, rupeesToPaise } from '../src/services/catalog.js';
test('prices convert to integer paise without rounding or accepting malformed input', () => {
  assert.equal(rupeesToPaise('60.50'), 6050); assert.equal(rupeesToPaise('0.29'), 29); assert.equal(rupeesToPaise('5'), 500);
  for (const value of ['1.001', '-1', 'NaN', '1e3', '', '100001']) assert.throws(() => rupeesToPaise(value));
});
test('categories are scoped per canteen and carts retain server line identities and current paise prices', () => {
  const catalog = mapCatalog({ canteens: [{ id: 'canteen', slug: 'bella-bite', name: 'Bella Bite', operational: true, acceptingOrders: false }], categories: [{ id: 'chinese', canteenId: 'canteen', name: 'Chinese' }, { id: 'snacks', canteenId: 'other', name: 'Snacks' }], items: [{ id: 'noodles', canteenId: 'canteen', pricePaise: 6050, categoryId: 'chinese', category: 'Chinese' }] });
  assert.deepEqual(catalog.cafes[0].categories, ['Chinese']); assert.equal(catalog.cafes[0].status, 'Paused'); assert.equal(catalog.foods[0].price, 60.5);
  const cart = mapCart({ items: [{ id: 'line', menuItemId: 'noodles', canteenId: 'canteen', unitPricePaise: 7000, quantity: 2, available: false }] }, catalog.cafes);
  assert.equal(cart[0].id, 'noodles'); assert.equal(cart[0].lineId, 'line'); assert.equal(cart[0].cafeId, 'bella-bite'); assert.equal(cart[0].price, 70); assert.equal(cart[0].available, false);
});
