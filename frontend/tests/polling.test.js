import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { pollingInterval, startVisiblePolling } from '../src/services/polling.js';
function environment() {
  const windowTarget = new EventTarget(); const documentTarget = new EventTarget();
  documentTarget.visibilityState = 'visible';
  const timers = new Map(); let counter = 0; let connected = true;
  return { windowTarget, documentTarget, timers,
    online: () => connected, connect: value => { connected = value; },
    schedule: (run, ms) => { const id = ++counter; timers.set(id, { run, ms }); return id; },
    cancel: id => timers.delete(id),
    fire: async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.run(); await setImmediate(); },
  };
}
test('polling respects visibility and connectivity and wakes on focus/reconnect', async () => {
  const env = environment(); let requests = 0;
  const polling = startVisiblePolling({ ...env, refresh: async () => { requests++; } });
  await env.fire(); assert.equal(requests, 1);
  env.documentTarget.visibilityState = 'hidden'; await env.fire(); assert.equal(requests, 1);
  env.documentTarget.visibilityState = 'visible'; env.documentTarget.dispatchEvent(new Event('visibilitychange')); await setImmediate();
  assert.equal(requests, 2);
  env.connect(false); await env.fire(); assert.equal(requests, 2);
  env.connect(true); env.windowTarget.dispatchEvent(new Event('online')); await setImmediate(); assert.equal(requests, 3);
  env.windowTarget.dispatchEvent(new Event('focus')); await setImmediate(); assert.equal(requests, 4);
  polling.stop(); assert.equal(env.timers.size, 0);
  env.windowTarget.dispatchEvent(new Event('focus')); await setImmediate(); assert.equal(requests, 4);
});
test('session expiry stops the poller until a new authenticated poller is created', async () => {
  const env = environment(); let requests = 0;
  startVisiblePolling({ ...env, refresh: async () => { requests++; throw Object.assign(new Error('Expired'), { status: 401 }); } });
  await env.fire(); assert.equal(requests, 1); assert.equal(env.timers.size, 0);
  env.windowTarget.dispatchEvent(new Event('online')); await setImmediate(); assert.equal(requests, 1);
  const next = startVisiblePolling({ ...env, refresh: async () => { requests++; } }); await env.fire(); assert.equal(requests, 2); next.stop();
});
test('focus during a slow request schedules one follow-up without overlapping requests', async () => {
  const env = environment(); const pending = []; let requests = 0;
  const polling = startVisiblePolling({ ...env, refresh: () => { requests++; return new Promise(resolve => pending.push(resolve)); } });
  await env.fire(); env.windowTarget.dispatchEvent(new Event('focus')); env.windowTarget.dispatchEvent(new Event('online'));
  assert.equal(requests, 1); pending[0](); await setImmediate(); assert.equal(requests, 2);
  pending[1](); await setImmediate(); assert.equal(env.timers.size, 1); polling.stop();
});
test('poll intervals default to five seconds and reject invalid values', () => {
  assert.equal(pollingInterval(undefined), 5000); assert.equal(pollingInterval('5000'), 5000);
  assert.equal(pollingInterval('10000'), 10000); assert.equal(pollingInterval('0'), 5000); assert.equal(pollingInterval('bad'), 5000);
});
