import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { busyServices } from './dev-ports.mjs';

for (const host of ['127.0.0.1', '::1']) {
  test(`detects an occupied port on ${host} and releases its own probes`, async t => {
    const server = createServer();
    try {
      server.listen(0, host);
      await once(server, 'listening');
    } catch (error) {
      if (['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) return t.skip('IPv6 unavailable');
      throw error;
    }
    const service = { name: 'Test', port: server.address().port };
    try { assert.deepEqual(await busyServices([service]), [service]); }
    finally { await new Promise(resolve => server.close(resolve)); }
    assert.deepEqual(await busyServices([service]), []);
    assert.deepEqual(await busyServices([service]), []);
  });
}

test('the launcher rejects an occupied API port before spawning any services', async () => {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = server.address().port;
    const child = spawn(process.execPath, [fileURLToPath(new URL('./dev.mjs', import.meta.url))], {
      env: { ...process.env, PORT: String(port), npm_execpath: 'must-not-be-launched.cjs' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(output, /Development services were not started/);
    assert(output.includes(`API: ${port}`));
    assert(!output.includes('must-not-be-launched.cjs'));
    assert(!output.includes('outbox_worker_started'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
