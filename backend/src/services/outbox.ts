import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';

export type OutboxClaim = { id: string; leaseOwner: string; attempts: number };
export const retryDelayMs = (attempt: number) => Math.min(300000, 1000 * 2 ** Math.min(18, Math.max(0, attempt - 1)));
export function deliveryError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? `Delivery failed (${code}).` : 'Notification delivery failed.';
}
export function notificationData(event: Prisma.OrderEventGetPayload<{ include: { order: { include: { canteen: true } } } }>) {
  if (event.newStatus !== 'ACCEPTED' && event.newStatus !== 'READY') return null;
  const order = event.order;
  if (!order.orderCode) throw new Error('Order code missing');
  const reference = `${order.orderCode} (${order.codeDay.toISOString().slice(0, 10)})`;
  return { recipientId: order.studentId, sourceEventId: event.id, orderId: order.id, type: event.newStatus,
    createdAt: event.createdAt,
    message: event.newStatus === 'READY'
      ? `${order.canteen.name} has prepared order ${reference}. Open your order to see your private pickup code.`
      : `${order.canteen.name} accepted order ${reference}.` };
}
export function createOutboxWorker(db: PrismaClient, config: Pick<Config, 'DB_TIMEOUT_MS' | 'OUTBOX_LEASE_SECONDS' | 'OUTBOX_MAX_ATTEMPTS' | 'OUTBOX_BATCH_SIZE'>) {
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  async function claim(): Promise<OutboxClaim | null> {
    // Each claim gets a unique fencing token, including reclaims by the same process.
    const token = randomUUID();
    const rows = await db.$queryRaw<OutboxClaim[]>`
      WITH candidate AS (
        SELECT id FROM outbox_events
        WHERE (state = 'PENDING' AND available_at <= clock_timestamp())
           OR (state = 'PROCESSING' AND lease_until <= clock_timestamp())
        ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE outbox_events AS o SET state = 'PROCESSING', attempts = o.attempts + 1,
        lease_owner = ${token}, lease_until = clock_timestamp() + ${config.OUTBOX_LEASE_SECONDS} * interval '1 second'
      FROM candidate WHERE o.id = candidate.id
      RETURNING o.id, o.lease_owner AS "leaseOwner", o.attempts`;
    return rows[0] ?? null;
  }
  async function deliver(job: OutboxClaim) {
    return db.$transaction(async tx => {
      const locked = await tx.$queryRaw<Array<{ eventId: string }>>`
        SELECT event_id AS "eventId" FROM outbox_events
        WHERE id = ${job.id}::uuid AND state = 'PROCESSING' AND lease_owner = ${job.leaseOwner}
          AND lease_until > clock_timestamp() FOR UPDATE`;
      if (!locked[0]) return false; // The lease expired or another worker owns it now.
      const event = await tx.orderEvent.findUniqueOrThrow({ where: { id: locked[0].eventId }, include: { order: { include: { canteen: true } } } });
      const notification = notificationData(event);
      if (notification) await tx.notification.createMany({ data: [notification], skipDuplicates: true });
      // Notification insertion and completion commit together; crashes roll back both.
      await tx.outboxEvent.update({ where: { id: job.id }, data: { state: 'COMPLETED', leaseOwner: null, leaseUntil: null, lastError: null } });
      return true;
    }, txOptions);
  }
  async function fail(job: OutboxClaim, error: unknown) {
    const state = job.attempts >= config.OUTBOX_MAX_ATTEMPTS ? 'FAILED' : 'PENDING';
    await db.$executeRaw`
      UPDATE outbox_events SET state = ${state}, lease_owner = NULL, lease_until = NULL,
        available_at = clock_timestamp() + ${retryDelayMs(job.attempts)} * interval '1 millisecond',
        last_error = ${deliveryError(error)}
      WHERE id = ${job.id}::uuid AND state = 'PROCESSING' AND lease_owner = ${job.leaseOwner}
        AND lease_until > clock_timestamp()`;
  }
  async function runBatch(stopping: () => boolean = () => false) {
    let processed = 0;
    while (processed < config.OUTBOX_BATCH_SIZE && !stopping()) {
      const job = await claim();
      if (!job) break;
      try { await deliver(job); }
      catch (error) { await fail(job, error); }
      processed++;
    }
    return processed;
  }
  return { claim, deliver, fail, runBatch };
}
