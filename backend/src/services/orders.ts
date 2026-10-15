import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';

export const orderInclude = {
  items: { orderBy: { id: 'asc' as const } },
  canteen: { select: { name: true } }, student: { select: { name: true } },
  events: { orderBy: [{ newStatus: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.OrderInclude;
export type LoadedOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type OrderOptions = { clock?: (tx: Prisma.TransactionClient) => Promise<Date>; codeIndex?: () => number };
export const codeCapacity = 36 ** 3;
export function campusDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export function pickupTime(value: string, now: Date) {
  const pickup = new Date(value);
  if (!Number.isFinite(pickup.getTime()) || pickup <= now || pickup.getTime() - now.getTime() > 60 * 60 * 1000) {
    throw new AppError(422, 'PICKUP_INVALID', 'Choose a future pickup time within the next 60 minutes.');
  }
  return pickup;
}
export function orderResponse(order: LoadedOrder) {
  return { id: order.id, studentId: order.studentId, canteenId: order.canteenId,
    canteenName: order.canteen.name, studentName: order.student.name,
    status: order.status, executionMode: order.executionMode, paymentStatus: order.paymentStatus,
    totalPaise: order.totalPaise, pickupAt: order.pickupAt.toISOString(), codeDay: order.codeDay.toISOString().slice(0, 10),
    orderCode: order.orderCode!, version: order.version, createdAt: order.createdAt.toISOString(),
    collectedAt: order.collectedAt?.toISOString() ?? null, pickupVerifiedBy: order.pickupVerifiedBy,
    items: order.items.map(line => ({ id: line.id, menuItemId: line.menuItemId, name: line.name, quantity: line.quantity, unitPricePaise: line.unitPricePaise })),
    events: order.events.map(event => ({ id: event.id, previousStatus: event.previousStatus, newStatus: event.newStatus, actorId: event.actorId, createdAt: event.createdAt.toISOString() })),
  };
}
export const requestHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function serverNow(tx: Prisma.TransactionClient, options: OrderOptions) {
  if (options.clock) return options.clock(tx);
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return row!.now;
}
export async function orderTransaction<T>(db: PrismaClient, maxWait: number, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(run, { maxWait, timeout: 30000 }); }
    catch (error) {
      const e = error as { code?: string; meta?: { code?: string } };
      const retryable = e.code === 'P2034' || ['40001', '40P01'].includes(e.meta?.code ?? '');
      if (!retryable) throw error;
      if (attempt === 2) throw new AppError(503, 'TRANSACTION_BUSY', 'The order is busy. Retry the same request.');
    }
  }
}
export async function allocateOrder(tx: Prisma.TransactionClient,
  input: { studentId: string; canteenId: string; totalPaise: number; pickupAt: Date; now: Date }, options: OrderOptions) {
  const day = new Date(campusDay(input.now) + 'T00:00:00.000Z');
  const id = randomUUID();
  for (let attempt = 0; attempt < 64; attempt++) {
    let code: string;
    if (attempt < 8) code = (options.codeIndex?.() ?? randomInt(codeCapacity)).toString(36).toUpperCase().padStart(3, '0');
    else {
      // Scan the finite namespace only after random collisions. The INSERT's unique constraint remains the arbiter.
      const [free] = await tx.$queryRaw<Array<{ code: string }>>`
        SELECT c.code FROM (
          SELECT substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (n / 1296) + 1, 1) ||
                 substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((n / 36) % 36) + 1, 1) ||
                 substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (n % 36) + 1, 1) AS code
          FROM generate_series(0, 46655) AS n
        ) c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.code_day = ${day}::date AND o.order_code = c.code)
        LIMIT 1`;
      if (!free) throw new AppError(409, 'ORDER_CODE_CAPACITY_EXHAUSTED', 'All pickup codes for today have been allocated. Please try again on the next campus day.');
      code = free.code;
    }
    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO orders (id, student_id, canteen_id, total_paise, pickup_at, code_day, order_code, created_at, updated_at)
      VALUES (${id}::uuid, ${input.studentId}::uuid, ${input.canteenId}::uuid, ${input.totalPaise},
        ${input.pickupAt}, ${day}::date, ${code}, ${input.now}, ${input.now})
      ON CONFLICT (code_day, order_code) DO NOTHING RETURNING id`;
    if (!inserted.length) continue;
    await tx.orderCodeAllocation.create({ data: { orderId: id, codeDay: day, code, allocatedAt: input.now } });
    return id;
  }
  throw new AppError(503, 'CODE_ALLOCATION_BUSY', 'Pickup codes are busy. Retry this order without changing your request.');
}
