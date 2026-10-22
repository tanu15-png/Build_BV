import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/services/api.js';
test('API requests distinguish a slow response timeout from a failed connection', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
    await assert.rejects(api('/notifications'), error => error.code === 'REQUEST_TIMEOUT' && error.status === 504 && /too long/.test(error.message));
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api('/notifications'), error => error.code === 'NETWORK_ERROR' && error.status === 503);
    globalThis.fetch = async () => Response.json({ items: [], unreadCount: 0, nextCursor: null });
    assert.deepEqual(await api('/notifications'), { items: [], unreadCount: 0, nextCursor: null });
  } finally { globalThis.fetch = original; }
});
