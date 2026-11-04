import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCatalog } from '../src/services/catalog.js';
import { mergeCanteenMenu, prepareMenuChange, saveMenuChange } from '../src/services/menuChanges.js';

const menu = { canteen: { id: 'canteen', slug: 'bella-bite', name: 'Bella Bite', version: 3, operational: true, acceptingOrders: true, hours: '9 AM–5 PM' },
  categories: [{ id: 'snacks', canteenId: 'canteen', name: 'Snacks', version: 1, archived: false }],
  items: [{ id: 'tea', canteenId: 'canteen', categoryId: 'snacks', category: 'Snacks', name: 'Tea', pricePaise: 1000, version: 1, available: true, archived: false }] };
const catalog = { canteens: [menu.canteen, { id: 'other', slug: 'shanu', name: 'Shanu' }], categories: menu.categories, items: menu.items };

test('new items appear before the save completes and replace their temporary ID with the saved ID', async () => {
  let resolve;
  const network = new Promise(done => { resolve = done; });
  let visible = menu;
  let confirmed = false;
  const body = { name: ' Noodles ', categoryId: 'snacks', pricePaise: 6050 };
  const saving = saveMenuChange({ menu, path: '/canteens/canteen/menu', method: 'POST', body,
    request: async (_path, options) => { assert.deepEqual(options.body, body); return network; },
    optimistic: next => { visible = next; }, confirmed: next => { visible = next; confirmed = true; }, rollback: () => assert.fail('should save'),
  });
  assert.equal(confirmed, false);
  const draft = visible.items.find(item => item.name === 'Noodles');
  assert(draft.id.startsWith('pending-'));
  const mapped = mapCatalog(mergeCanteenMenu(catalog, visible));
  assert.equal(mapped.foods.find(item => item.id === draft.id).price, 60.5);
  resolve({ ...draft, id: 'saved-noodles', version: 1 });
  await saving;
  assert.equal(confirmed, true);
  assert.equal(visible.items.filter(item => item.name === 'Noodles').length, 1);
  assert.equal(visible.items.at(-1).id, 'saved-noodles');
  assert.equal(menu.items.length, 1);
});
test('a failed save restores the previous menu without changing other canteens', async () => {
  let reject;
  const network = new Promise((_resolve, fail) => { reject = fail; });
  let visible = menu;
  const saving = saveMenuChange({ menu, path: '/canteens/canteen/settings', method: 'PATCH', body: { expectedVersion: 3, hours: '8 AM–10 PM' },
    request: () => network, optimistic: next => { visible = next; }, confirmed: () => assert.fail('must not confirm'), rollback: previous => { visible = previous; },
  });
  assert.equal(mapCatalog(mergeCanteenMenu(catalog, visible)).cafes[0].hours, '8 AM–10 PM');
  reject(new Error('Database unavailable'));
  await assert.rejects(saving, /Database unavailable/);
  assert.equal(visible.canteen.hours, '9 AM–5 PM');
  assert.equal(mergeCanteenMenu(catalog, visible).canteens[1], catalog.canteens[1]);
});
test('category edits update item labels immediately and archived records stay out of the public catalog', () => {
  const change = prepareMenuChange(menu, '/menu-categories/snacks', 'PATCH', { expectedVersion: 1, name: 'Drinks' });
  assert.equal(change.optimistic.items[0].category, 'Drinks');
  assert.equal(change.optimistic.categories[0].version, 2);
  const archived = prepareMenuChange(menu, '/menu-items/tea', 'PATCH', { expectedVersion: 1, archived: true });
  assert.equal(mergeCanteenMenu(catalog, archived.optimistic).items.length, 0);
  const category = prepareMenuChange(menu, '/canteens/canteen/categories', 'POST', { name: 'Chinese' });
  assert(mapCatalog(mergeCanteenMenu(catalog, category.optimistic)).cafes[0].categories.includes('Chinese'));
});
