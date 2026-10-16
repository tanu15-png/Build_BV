import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { adminOrderQuery, createAdminResource } from '../src/services/adminData.js';
test('admin order filters use UUIDs, exact public references, and inclusive campus dates converted to UTC', () => {
  const path = adminOrderQuery({ search: ' Tea ', status: 'READY', canteenId: 'canteen-uuid', from: '2026-10-16', to: '2026-10-17', codeDay: '2026-10-15', orderCode: ' a01 ' });
  const query = new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('search'), 'Tea'); assert.equal(query.get('canteenId'), 'canteen-uuid');
  assert.equal(query.get('orderCode'), 'A01'); assert.equal(query.get('codeDay'), '2026-10-15');
  assert.equal(query.get('from'), '2026-10-15T18:30:00.000Z'); assert.equal(query.get('to'), '2026-10-17T18:29:59.999Z');
  assert.equal(adminOrderQuery({}), '/admin/orders?limit=25');
});
function setup() {
  const requests = []; let state; let expired = 0;
  const resource = createAdminResource({ path: '/admin/orders?limit=25',
    request: path => new Promise((resolve, reject) => requests.push({ path, resolve, reject })),
    changed: value => { state = value; }, unauthorized: () => { expired++; },
  });
  return { resource, requests, state: () => state, expired: () => expired };
}
test('admin pagination preserves all loaded pages and full-campus metadata during polling', async () => {
  const { resource, requests, state } = setup();
  const first = resource.refresh(); requests[0].resolve({ items: [{ id: 'new' }], nextCursor: 'new', meta: { overview: { totalOrders: 200 }, totalCount: 2 } }); await first;
  const more = resource.refresh(true); assert.match(requests[1].path, /cursor=new/);
  requests[1].resolve({ items: [{ id: 'old' }], nextCursor: null, meta: { totalCount: 2 } }); await more;
  assert.equal(state().meta.overview.totalOrders, 200);
  const poll = resource.refresh(); requests[2].resolve({ items: [{ id: 'new', status: 'READY' }], nextCursor: 'new', meta: { overview: { totalOrders: 201 } } }); await setImmediate();
  requests[3].resolve({ items: [{ id: 'old', status: 'COLLECTED' }], nextCursor: null }); await poll;
  assert.deepEqual(state().items.map(item => item.id), ['new', 'old']); assert.equal(state().meta.overview.totalOrders, 201);
});
test('a confirmed admin write invalidates an older in-flight read before it can replace the screen', async () => {
  const { resource, requests, state } = setup();
  const first = resource.refresh(); requests[0].resolve({ items: [{ id: 'user', status: 'ACTIVE' }], nextCursor: null }); await first;
  const poll = resource.refresh(); const saved = resource.invalidate();
  requests[1].resolve({ items: [{ id: 'user', status: 'ACTIVE' }], nextCursor: null }); await poll; await saved; await setImmediate();
  assert.equal(requests.length, 3);
  requests[2].resolve({ items: [{ id: 'user', status: 'DISABLED' }], nextCursor: null }); await setImmediate();
  assert.equal(state().items[0].status, 'DISABLED');
});
test('filter/account changes discard late responses, and authorization failure stops further admin reads', async () => {
  const first = setup(); const request = first.resource.refresh(); first.resource.dispose();
  first.requests[0].resolve({ items: [{ id: 'private-admin-order' }], nextCursor: null }); await request;
  assert.equal(first.state().items.length, 0);
  const next = setup(); const denied = next.resource.refresh(); next.requests[0].reject(Object.assign(new Error('Sign in'), { status: 401 }));
  await assert.rejects(denied, /Sign in/); assert.equal(next.expired(), 1);
  await next.resource.refresh(); assert.equal(next.requests.length, 1);
});
test('an offline admin resource retains confirmed records and recovers on refresh', async () => {
  const { resource, requests, state } = setup(); const first = resource.refresh();
  requests[0].resolve({ items: [{ id: 'order' }], nextCursor: null }); await first;
  const offline = resource.refresh(); requests[1].reject(new Error('Offline')); await assert.rejects(offline, /Offline/);
  assert.equal(state().items[0].id, 'order'); assert.equal(state().error, 'Offline');
  const recovered = resource.refresh(); requests[2].resolve({ items: [{ id: 'order', status: 'READY' }], nextCursor: null }); await recovered;
  assert.equal(state().error, ''); assert.equal(state().items[0].status, 'READY');
});
