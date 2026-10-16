import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuQueue } from '../src/services/menuQueue.js';

const menu = { canteen: { id: 'canteen', slug: 'bella-bite', name: 'Bella Bite', version: 3, hours: '9 AM–5 PM' },
  categories: [{ id: 'snacks', canteenId: 'canteen', name: 'Snacks', version: 1, archived: false }],
  items: [{ id: 'tea', canteenId: 'canteen', categoryId: 'snacks', category: 'Snacks', name: 'Tea', pricePaise: 1000, version: 1, available: true, archived: false }] };
function setup() {
  const requests = [];
  let visible;
  const errors = [];
  const queue = createMenuQueue({ changed: value => { visible = value; }, failed: error => errors.push(error),
    request: (path, options) => new Promise((resolve, reject) => requests.push({ path, ...options, resolve, reject })),
  });
  queue.seed(menu);
  return { queue, requests, errors, visible: () => visible };
}
test('category, its first item and timings appear immediately while slow saves run in the background', async () => {
  const { queue, requests, visible } = setup();
  const category = queue.enqueue('/canteens/canteen/categories', 'POST', { name: 'Chinese' });
  const item = queue.enqueue('/canteens/canteen/menu', 'POST', { name: 'Noodles', categoryId: category.id, pricePaise: 6050 });
  const hours = queue.enqueue('/canteens/canteen/settings', 'PATCH', { expectedVersion: 3, hours: '8 AM–10 PM' });
  assert.equal(requests.length, 1);
  assert.equal(visible().pending, 3);
  assert.equal(visible().menu.items.at(-1).name, 'Noodles');
  assert.equal(visible().menu.canteen.hours, '8 AM–10 PM');
  queue.seed(menu); // A stale reload must not replace pending edits.
  assert.equal(visible().menu.items.at(-1).name, 'Noodles');
  requests[0].resolve({ id: 'saved-category', canteenId: 'canteen', name: 'Chinese', version: 1, archived: false });
  await category.completion;
  assert.equal(requests[1].body.categoryId, 'saved-category');
  assert.equal(visible().menu.items.at(-1).categoryId, 'saved-category');
  requests[1].resolve({ id: 'saved-item', canteenId: 'canteen', name: 'Noodles', categoryId: 'saved-category', category: 'Chinese', pricePaise: 6050, available: true, archived: false, version: 1 });
  await item.completion;
  assert.equal(requests[2].body.expectedVersion, 3);
  requests[2].resolve({ ...menu.canteen, hours: '8 AM–10 PM', version: 4 });
  await hours.completion;
  assert.equal(visible().pending, 0);
  assert.equal(visible().menu.items.at(-1).id, 'saved-item');
  assert.equal(visible().menu.categories.at(-1).clientId, category.id);
});
test('rapid edits to the same record use confirmed versions without losing newer drafts', async () => {
  const { queue, requests, visible } = setup();
  const price = queue.enqueue('/menu-items/tea', 'PATCH', { expectedVersion: 1, pricePaise: 1500 });
  const availability = queue.enqueue('/menu-items/tea', 'PATCH', { expectedVersion: 2, available: false });
  assert.equal(visible().menu.items[0].version, 3);
  assert.equal(visible().menu.items[0].available, false);
  requests[0].resolve({ ...menu.items[0], pricePaise: 1500, version: 2 });
  await price.completion;
  assert.equal(requests[1].body.expectedVersion, 2);
  assert.equal(visible().menu.items[0].available, false);
  requests[1].resolve({ ...menu.items[0], pricePaise: 1500, available: false, version: 3 });
  await availability.completion;
  assert.equal(visible().menu.items[0].pricePaise, 1500);
});
test('failed category creation rolls back its dependent item while independent changes continue', async () => {
  const { queue, requests, visible } = setup();
  const category = queue.enqueue('/canteens/canteen/categories', 'POST', { name: 'Chinese' });
  const item = queue.enqueue('/canteens/canteen/menu', 'POST', { name: 'Noodles', categoryId: category.id, pricePaise: 6050 });
  const hours = queue.enqueue('/canteens/canteen/settings', 'PATCH', { hours: '8 AM–10 PM' });
  requests[0].reject(Object.assign(new Error('Invalid category'), { status: 422 }));
  await assert.rejects(category.completion, /Invalid category/);
  await assert.rejects(item.completion, /earlier save failed/);
  assert.equal(visible().menu.items.length, 1);
  assert.equal(visible().menu.categories.length, 1);
  assert.equal(visible().menu.canteen.hours, '8 AM–10 PM');
  assert(requests[1].path.endsWith('/settings'));
  requests[1].resolve({ ...menu.canteen, hours: '8 AM–10 PM', version: 4 });
  await hours.completion;
});
test('a version conflict cancels the remaining queue and restores confirmed data', async () => {
  const { queue, requests, visible } = setup();
  const price = queue.enqueue('/menu-items/tea', 'PATCH', { pricePaise: 1500 });
  const hours = queue.enqueue('/canteens/canteen/settings', 'PATCH', { hours: '8 AM–10 PM' });
  requests[0].reject(Object.assign(new Error('Record changed'), { status: 409 }));
  await assert.rejects(price.completion, /Record changed/);
  await assert.rejects(hours.completion, /earlier save failed/);
  assert.equal(requests.length, 1);
  assert.equal(visible().pending, 0);
  assert.equal(visible().menu.items[0].pricePaise, 1000);
  assert.equal(visible().menu.canteen.hours, '9 AM–5 PM');
});
test('a session change cancels pending work and ignores a late save response', async () => {
  const { queue, requests, visible } = setup();
  const price = queue.enqueue('/menu-items/tea', 'PATCH', { pricePaise: 1500 });
  const snapshot = visible();
  queue.dispose();
  await assert.rejects(price.completion, /session changed/);
  requests[0].resolve({ ...menu.items[0], pricePaise: 1500, version: 2 });
  await Promise.resolve();
  assert.equal(visible(), snapshot);
  assert.throws(() => queue.enqueue('/menu-items/tea', 'PATCH', { pricePaise: 2000 }), /session changed/);
});

test('deleting after an edit uses the confirmed version and a failed deletion restores the item', async () => {
  const { queue, requests, visible } = setup();
  const edit = queue.enqueue('/menu-items/tea', 'PATCH', { pricePaise: 1500 });
  const deletion = queue.enqueue('/menu-items/tea', 'DELETE', { expectedVersion: 1 });
  assert.equal(visible().menu.items.length, 0);
  requests[0].resolve({ ...menu.items[0], pricePaise: 1500, version: 2 });
  await edit.completion;
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(requests[1].body.expectedVersion, 2);
  requests[1].reject(Object.assign(new Error('Delete failed'), { status: 500 }));
  await assert.rejects(deletion.completion, /Delete failed/);
  assert.equal(visible().menu.items[0].pricePaise, 1500);
  assert.equal(visible().pending, 0);
});
test('category deletion removes active and archived items and stays removed after confirmation', async () => {
  const { queue, requests, visible } = setup();
  queue.seed({ ...menu, items: [...menu.items, { ...menu.items[0], id: 'archived-tea', archived: true }] });
  const deletion = queue.enqueue('/menu-categories/snacks', 'DELETE', { expectedVersion: 1 });
  assert.equal(visible().menu.categories.length, 0);
  assert.equal(visible().menu.items.length, 0);
  requests[0].resolve({ ok: true });
  await deletion.completion;
  assert.equal(visible().menu.categories.length, 0);
  assert.equal(visible().menu.items.length, 0);
});
