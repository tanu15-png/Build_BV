import { run } from './run.js';
const id = process.argv[2];
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  console.error('Usage: npm run worker:retry -- <failed-outbox-UUID>'); process.exitCode = 1;
} else {
  void run(async db => {
    const result = await db.outboxEvent.updateMany({ where: { id, state: 'FAILED' }, data: {
      state: 'PENDING', attempts: 0, availableAt: new Date(), leaseUntil: null, leaseOwner: null, lastError: null,
    } });
    console.log(JSON.stringify({ event: 'outbox_retry', id, requeued: result.count }));
  });
}
