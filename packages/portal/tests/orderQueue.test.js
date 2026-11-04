import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createOrderQueue } from '../src/services/orderQueue.js';
import { createOrderActions } from '../src/services/orderActions.js';
import { canteenOrderInSection } from '../src/utils/orderRules.js';

const initial = { id: 'one', status: 'RECEIVED', version: 1, items: [], events: [] };
function setup() {
  const requests = []; const storage = new Map(); const canonical = new Map([['one', initial]]);
  const timers = new Map(); let time = 0; let serial = 0; let state;
  const actions = createOrderActions({ actorId: 'staff', uuid: () => `command-${++serial}`,
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    api: (path, options) => new Promise((resolve, reject) => requests.push({ path, ...options, resolve, reject })),
  });
  const queue = createOrderQueue({
    execute: (order, status) => status === 'COLLECTED' ? actions.collect(order) : actions.transition(order, status),
    read: async id => canonical.get(id), changed: snapshot => { state = snapshot; },
    setTimer: (callback, delay) => { const id = ++serial; timers.set(id, { callback, due: time + delay }); return id; },
    clearTimer: id => timers.delete(id),
    now: () => time,
  });
  const response = (index, status, version) => {
    const id = requests[index].path.split('/')[2];
    const order = { ...initial, id, status, version }; canonical.set(id, order); requests[index].resolve(order);
  };
  return { queue, requests, canonical, response, state: () => state, timers,
    order: (id = 'one') => state.orders.find(order => order.id === id),
    advance: ms => {
      time += ms;
      for (const [id, timer] of timers) if (timer.due <= time) { timers.delete(id); timer.callback(); }
    },
  };
}

test('successive deliberate clicks advance immediately while saves use each confirmed version in sequence', async () => {
  const s = setup();
  const commands = ['ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'].map(status => { s.advance(400); return s.queue.enqueue(initial, status); });
  assert.equal(s.requests.length, 1); assert.equal(s.order().status, 'COLLECTED');
  assert.equal(s.order().collectionFeedback, true);
  for (const [index, status] of ['ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'].entries()) {
    assert.equal(s.requests[index].body.expectedVersion, index + 1);
    s.response(index, status, index + 2); await setImmediate();
    assert.equal(s.order().status, 'COLLECTED');
  }
  await Promise.all(commands);
  assert.deepEqual(s.requests.map(request => request.path.split('/').at(-1)), ['accept', 'prepare', 'ready', 'collect']);
  assert.equal(s.order().optimistic, false); assert.deepEqual(s.state().errors, {});
});

test('the 400 ms guard ignores accidental next-stage clicks without extending the guard', async () => {
  const s = setup();
  const first = s.queue.enqueue(initial, 'ACCEPTED');
  assert.equal(s.order().status, 'ACCEPTED');
  s.advance(100);
  assert.equal(s.queue.enqueue(initial, 'PREPARING'), first);
  s.advance(299);
  assert.equal(s.queue.enqueue(initial, 'PREPARING'), first);
  assert.equal(s.order().status, 'ACCEPTED');
  s.advance(1);
  const second = s.queue.enqueue(initial, 'PREPARING');
  assert.equal(s.order().status, 'PREPARING');
  assert.equal(s.requests.length, 1, 'progress must not wait for the backend');
  s.response(0, 'ACCEPTED', 2); await first; await setImmediate();
  s.response(1, 'PREPARING', 3); await second;
  assert.equal(s.requests.length, 2);
});

test('the collected acknowledgement lasts exactly three seconds independently of network speed', async () => {
  const s = setup(); const ready = { ...initial, status: 'READY', version: 4 }; s.canonical.set('one', ready);
  const command = s.queue.enqueue(ready, 'COLLECTED');
  assert.equal(canteenOrderInSection(s.order(), 'Active'), true);
  assert.equal(canteenOrderInSection(s.order(), 'Completed'), false);
  s.advance(2999); assert.equal(s.order().collectionFeedback, true);
  s.advance(1);
  assert.equal(s.order().collectionFeedback, false);
  assert.equal(canteenOrderInSection(s.order(), 'Active'), false);
  assert.equal(canteenOrderInSection(s.order(), 'Completed'), true);
  s.response(0, 'COLLECTED', 5); await command;
  assert.equal(s.order().collectionFeedback, false, 'a slow response must not restart the acknowledgement');
});

test('other orders remain usable and duplicate clicks do not create duplicate commands', async () => {
  const s = setup(); const other = { ...initial, id: 'two' }; s.canonical.set('two', other);
  const first = s.queue.enqueue(initial, 'ACCEPTED');
  const duplicate = s.queue.enqueue(initial, 'ACCEPTED'); assert.equal(first, duplicate);
  const second = s.queue.enqueue(other, 'ACCEPTED');
  assert.equal(s.requests.length, 2); assert.equal(s.order('two').status, 'ACCEPTED');
  s.response(1, 'ACCEPTED', 2); await second;
  assert.equal(s.order('two').optimistic, false); assert.equal(s.order().optimistic, true);
  s.response(0, 'ACCEPTED', 2); await first;
});

test('polling cannot replace queued progress with an earlier status', async () => {
  const s = setup();
  const first = s.queue.enqueue(initial, 'ACCEPTED'); s.advance(400); const second = s.queue.enqueue(initial, 'PREPARING');
  s.queue.seed([initial]); assert.equal(s.order().status, 'PREPARING');
  s.response(0, 'ACCEPTED', 2); await first; await setImmediate();
  s.queue.seed([initial]); assert.equal(s.order().status, 'PREPARING'); assert.equal(s.order().version, 2);
  s.response(1, 'PREPARING', 3); await second;
});

test('a failed save restores the confirmed order and retry resumes the intended sequence with the original key', async () => {
  const s = setup();
  const commands = ['ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'].map(status => { s.advance(400); return s.queue.enqueue(initial, status); });
  s.response(0, 'ACCEPTED', 2); await commands[0]; await setImmediate();
  const key = s.requests[1].idempotencyKey;
  s.requests[1].reject(Object.assign(new Error('Offline'), { status: 503 }));
  await Promise.all(commands.slice(1).map(command => assert.rejects(command, /Offline/)));
  await setImmediate();
  assert.equal(s.order().status, 'ACCEPTED'); assert.equal(s.order().collectionFeedback, false);
  assert.equal(s.timers.size, 0); assert.match(s.state().errors.one.message, /Could not save/);
  s.advance(400);
  const retry = s.queue.retry('one'); await setImmediate();
  assert.equal(s.order().status, 'COLLECTED'); assert.equal(s.requests[2].idempotencyKey, key);
  assert.deepEqual(s.requests[2].body, s.requests[1].body);
  for (const [offset, status] of ['PREPARING', 'READY', 'COLLECTED'].entries()) {
    s.response(offset + 2, status, offset + 3); await setImmediate();
  }
  await retry;
  assert.deepEqual(s.state().errors, {}); assert.equal(s.order().status, 'COLLECTED');
});

test('a lost collection response confirmed by a fresh read needs no error banner or second collection', async () => {
  const s = setup(); const ready = { ...initial, status: 'READY', version: 4 };
  const command = s.queue.enqueue(ready, 'COLLECTED');
  s.canonical.set('one', { ...ready, status: 'COLLECTED', version: 5 });
  s.requests[0].reject(Object.assign(new Error('Response lost'), { status: 503 }));
  await command;
  assert.deepEqual(s.state().errors, {}); assert.equal(s.order().status, 'COLLECTED');
  await s.queue.enqueue(ready, 'COLLECTED'); assert.equal(s.requests.length, 1);
});

test('a newer confirmed status skips actions already completed by another staff member', async () => {
  const s = setup();
  const commands = ['ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'].map(status => { s.advance(400); return s.queue.enqueue(initial, status); });
  const ready = { ...initial, status: 'READY', version: 4 };
  s.canonical.set('one', ready); s.queue.seed([ready]);
  s.requests[0].resolve({ ...initial, status: 'ACCEPTED', version: 2 });
  await setImmediate();
  assert.equal(s.requests.length, 2);
  assert.equal(s.requests[1].path, '/orders/one/collect'); assert.equal(s.requests[1].body.expectedVersion, 4);
  s.response(1, 'COLLECTED', 5); await Promise.all(commands);
  assert.equal(s.order().status, 'COLLECTED'); assert.deepEqual(s.state().errors, {});
});

test('a newer server status is never hidden behind an older queued action', async () => {
  const s = setup(); const command = s.queue.enqueue(initial, 'ACCEPTED');
  const ready = { ...initial, status: 'READY', version: 4 };
  s.canonical.set('one', ready); s.queue.seed([ready]);
  assert.equal(s.order().status, 'READY');
  s.requests[0].resolve({ ...initial, status: 'ACCEPTED', version: 2 }); await command;
  assert.equal(s.order().status, 'READY'); assert.equal(s.order().version, 4);
});

test('signing out cancels queued commands, clears timers and ignores late responses', async () => {
  const s = setup(); const ready = { ...initial, status: 'READY', version: 4 };
  const command = s.queue.enqueue(ready, 'COLLECTED'); const previous = s.state();
  s.queue.dispose(); await assert.rejects(command, /account changed/);
  assert.equal(s.timers.size, 0);
  s.response(0, 'COLLECTED', 5); await setImmediate();
  assert.equal(s.state(), previous);
  await assert.rejects(s.queue.enqueue(ready, 'COLLECTED'), /account changed/);
});
