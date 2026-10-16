import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createCatalogEvents } from '../src/services/catalogEvents.js';

test('catalog events notify all open browsers and reconnects request a fresh snapshot', async () => {
  const events = createCatalogEvents();
  const app = express(); app.get('/events', events.subscribe);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const streams: ReadableStreamDefaultReader<Uint8Array>[] = [];
  async function connect() {
    const response = await fetch(`${base}/events`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body!.getReader(); streams.push(reader);
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: catalog-change\ndata: \{\}/);
    return reader;
  }
  try {
    const first = await connect(); const second = await connect();
    events.publish('saved-canteen');
    for (const stream of [first, second]) {
      assert.match(new TextDecoder().decode((await stream.read()).value), /"canteenId":"saved-canteen"/);
    }
    await first.cancel();
    const reconnected = await connect();
    events.publish('next-save');
    assert.match(new TextDecoder().decode((await reconnected.read()).value), /next-save/);
  } finally {
    await Promise.all(streams.map(reader => reader.cancel().catch(() => {})));
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
