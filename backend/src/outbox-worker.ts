import { setTimeout } from 'node:timers/promises';
import { loadConfig } from './config/env.js';
import { createPrisma } from './lib/prisma.js';
import { createOutboxWorker } from './services/outbox.js';

async function main() {
  const config = loadConfig();
  const db = createPrisma(config);
  const worker = createOutboxWorker(db, config);
  const wake = new AbortController();
  let stopping = false;
  let deadline: NodeJS.Timeout | undefined;
  const stop = () => {
    if (stopping) return;
    stopping = true; wake.abort();
    deadline = globalThis.setTimeout(() => process.exit(1), 20000).unref();
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try {
    if (config.LOG_LEVEL !== 'silent') console.log(JSON.stringify({ event: 'outbox_worker_started' }));
    while (!stopping) {
      let processed = 0;
      try { processed = await worker.runBatch(() => stopping); }
      catch { console.error(JSON.stringify({ event: 'outbox_worker_database_error' })); }
      if (!stopping && processed < config.OUTBOX_BATCH_SIZE) {
        await setTimeout(config.OUTBOX_POLL_MS, undefined, { signal: wake.signal }).catch(() => {});
      }
    }
  } finally {
    await db.$disconnect(); if (deadline) clearTimeout(deadline);
    process.off('SIGTERM', stop); process.off('SIGINT', stop);
  }
}
void main().catch(() => { console.error('Outbox worker stopped. Check configuration and database connectivity.'); process.exitCode = 1; });
