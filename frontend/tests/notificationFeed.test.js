import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createNotificationFeed } from '../src/services/notificationFeed.js';
const notification = (id, readAt = null) => ({ id, orderId: 'order', type: 'READY', message: 'Ready', createdAt: '2026-10-16T12:00:00Z', readAt });
function setup() {
  const requests = []; let current; let expired = 0;
  const feed = createNotificationFeed({
    request: (path, options) => new Promise((resolve, reject) => requests.push({ path, ...options, resolve, reject })),
    changed: value => { current = value; }, unauthorized: () => { expired++; },
  });
  return { feed, requests, snapshot: () => current, expired: () => expired };
}
test('offline notifications recover from the server without browser storage and survive a new feed', async () => {
  const { feed, requests, snapshot } = setup();
  const offline = feed.refresh(); requests[0].reject(new Error('Offline'));
  await assert.rejects(offline, /Offline/);
  assert.equal(snapshot().items.length, 0);
  const recovered = feed.refresh();
  requests[1].resolve({ items: [notification('durable-ready')], unreadCount: 1, nextCursor: null });
  await recovered;
  assert.equal(snapshot().error, ''); assert.equal(snapshot().items[0].id, 'durable-ready');
  feed.dispose();
  const next = setup(); const login = next.feed.refresh();
  next.requests[0].resolve({ items: [notification('durable-ready')], unreadCount: 1, nextCursor: null });
  await login; assert.equal(next.snapshot().items[0].id, 'durable-ready');
});
test('pagination appends records and polls refresh all loaded pages including cross-device read state', async () => {
  const { feed, requests, snapshot } = setup();
  const first = feed.refresh(); requests[0].resolve({ items: [notification('new')], unreadCount: 2, nextCursor: 'new' }); await first;
  const more = feed.refresh(true); assert.match(requests[1].path, /cursor=new/);
  requests[1].resolve({ items: [notification('old')], unreadCount: 2, nextCursor: null }); await more;
  assert.deepEqual(snapshot().items.map(item => item.id), ['new', 'old']);
  const poll = feed.refresh(); requests[2].resolve({ items: [notification('new')], unreadCount: 1, nextCursor: 'new' });
  await setImmediate();
  requests[3].resolve({ items: [notification('old', '2026-10-16T12:01:00Z')], unreadCount: 1, nextCursor: null });
  await poll;
  assert.equal(snapshot().items.length, 2); assert(snapshot().items[1].readAt); assert.equal(snapshot().unreadCount, 1);
});
test('duplicate mark-read clicks share a request and stale polling cannot revert a confirmed read', async () => {
  const { feed, requests, snapshot } = setup();
  const first = feed.refresh(); requests[0].resolve({ items: [notification('ready')], unreadCount: 1, nextCursor: null }); await first;
  const poll = feed.refresh();
  const read = feed.markRead('ready'); const duplicate = feed.markRead('ready');
  assert.equal(read, duplicate); assert.equal(requests.length, 3); assert.equal(requests[2].method, 'PATCH');
  const saved = notification('ready', '2026-10-16T12:02:00Z'); requests[2].resolve(saved); await read;
  assert.equal(snapshot().unreadCount, 0);
  requests[1].resolve({ items: [notification('ready')], unreadCount: 1, nextCursor: null }); await poll;
  await setImmediate();
  assert.equal(snapshot().items[0].readAt, saved.readAt); assert.equal(snapshot().unreadCount, 0);
  requests[3].resolve({ items: [saved], unreadCount: 0, nextCursor: null }); await setImmediate();
  assert.equal(snapshot().unreadCount, 0); assert.deepEqual(snapshot().readingIds, []);
});
test('a rejected read stays unread and session expiry stops further authenticated requests', async () => {
  const { feed, requests, snapshot, expired } = setup();
  const first = feed.refresh(); requests[0].resolve({ items: [notification('ready')], unreadCount: 1, nextCursor: null }); await first;
  const read = feed.markRead('ready'); requests[1].reject(new Error('Offline')); await assert.rejects(read, /Offline/);
  assert.equal(snapshot().items[0].readAt, null); assert.equal(snapshot().unreadCount, 1);
  const poll = feed.refresh(); requests[2].reject(Object.assign(new Error('Sign in'), { status: 401 }));
  await assert.rejects(poll, /Sign in/); assert.equal(expired(), 1);
  await feed.refresh(); assert.equal(requests.length, 3);
});
test('logout discards late notification responses from the previous account', async () => {
  const { feed, requests, snapshot } = setup();
  const loading = feed.refresh(); const before = snapshot(); feed.dispose();
  requests[0].resolve({ items: [notification('private')], unreadCount: 1, nextCursor: null }); await loading;
  assert.equal(snapshot(), before); await feed.refresh(); assert.equal(requests.length, 1);
});
