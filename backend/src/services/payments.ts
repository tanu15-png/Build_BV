import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Config } from '../config/env.js';
import type { Order, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { orderInclude, orderResponse, orderTransaction } from './orders.js';

const gatewayOrder = z.object({ id: z.string().regex(/^order_[A-Za-z0-9]+$/), amount: z.number().int(), currency: z.string(), receipt: z.string(), status: z.string() });
const gatewayPayment = z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/), order_id: z.string(), amount: z.number().int(), currency: z.string(), status: z.string(), captured: z.boolean().optional(), amount_refunded: z.number().int().default(0) });
export function validPaymentSignature(body: string | Buffer, signature: string | undefined, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export const requiresPayment = (order: Pick<Order, 'executionMode' | 'paymentStatus'>) => order.executionMode === 'RAZORPAY_TEST' && order.paymentStatus !== 'PAID';

export function createPayments(config: Config, db: PrismaClient, fetcher: typeof fetch = fetch) {
  async function call(path: string, body?: object): Promise<unknown> {
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Test payments are not configured yet.');
    let response: Response;
    try {
      response = await fetcher('https://api.razorpay.com/v1/' + path, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: 'Basic ' + Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64'), 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new AppError(503, 'PAYMENT_CONFIRMATION_PENDING', 'Payment confirmation is taking longer. Check payment status before retrying.'); }
    if (!response.ok) throw new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Unable to confirm with Razorpay. Check payment status shortly.');
    return response.json();
  }
  function assertAccount(order: Order) {
    if (order.paymentKeyId && order.paymentKeyId !== config.RAZORPAY_KEY_ID) throw new AppError(409, 'PAYMENT_ACCOUNT_CHANGED', 'This order belongs to a previous test payment account. Contact the canteen.');
  }
  async function owned(id: string, studentId?: string, canteenId?: string) {
    const order = await db.order.findFirst({ where: { id, ...(studentId ? { studentId } : {}), ...(canteenId ? { canteenId } : {}) } });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    return order;
  }
  async function locked<T>(order: Order, run: (tx: Prisma.TransactionClient, fresh: Order) => Promise<T>) {
    return orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.studentId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${order.canteenId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      return run(tx, await tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    });
  }
  async function changed(tx: Prisma.TransactionClient, order: Order, status: Order['status']) {
    const event = await tx.orderEvent.create({ data: { orderId: order.id, actorId: order.studentId, previousStatus: order.status, newStatus: status } });
    await tx.outboxEvent.create({ data: { eventId: event.id, payload: { type: 'ORDER_STATUS_CHANGED', orderId: order.id, status } } });
  }
  async function attach(order: Order, value: z.infer<typeof gatewayOrder>) {
    if (value.receipt !== order.id || value.amount !== order.totalPaise || value.currency !== 'INR') throw new AppError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Payment details do not match this order. Contact the canteen.');
    return locked(order, async (tx, fresh) => {
      if (fresh.razorpayOrderId && fresh.razorpayOrderId !== value.id) throw new AppError(409, 'PAYMENT_REFERENCE_CONFLICT', 'Payment reference needs staff review.');
      return tx.order.update({ where: { id: fresh.id }, data: { razorpayOrderId: value.id, paymentKeyId: config.RAZORPAY_KEY_ID,
        paymentLeaseUntil: null, paymentNextCheckAt: new Date(), version: { increment: 1 } } });
    });
  }
  async function discover(order: Order) {
    const response = z.object({ items: z.array(gatewayOrder) }).parse(await call(`orders?receipt=${encodeURIComponent(order.id)}&count=100`));
    const matches = response.items.filter(row => row.receipt === order.id);
    if (matches.length > 1) throw new AppError(409, 'PAYMENT_REFERENCE_CONFLICT', 'Payment reference needs staff review.');
    return matches[0] ? attach(order, matches[0]) : order;
  }
  async function confirm(order: Order, payment: z.infer<typeof gatewayPayment>) {
    if (payment.order_id !== order.razorpayOrderId || payment.amount !== order.totalPaise || payment.currency !== 'INR') throw new AppError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Payment does not match the accepted order.');
    if (payment.status !== 'captured' || payment.captured === false) return order;
    return locked(order, async (tx, fresh) => {
      if (fresh.paymentStatus === 'PAID') {
        if (fresh.razorpayPaymentId !== payment.id) throw new AppError(409, 'PAYMENT_REFERENCE_CONFLICT', 'Payment needs staff review.');
        return fresh;
      }
      if (fresh.executionMode !== 'RAZORPAY_TEST' || fresh.razorpayOrderId !== payment.order_id) throw new AppError(409, 'PAYMENT_REFERENCE_CONFLICT', 'Payment reference changed.');
      // An independently confirmed late payment is honoured, never silently discarded or refunded.
      const status = fresh.status === 'REJECTED' && fresh.closedReason === 'PAYMENT_EXPIRED' ? 'ACCEPTED' : fresh.status;
      if (!['ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'].includes(status) || payment.amount_refunded > 0) throw new AppError(409, 'PAYMENT_REVIEW_REQUIRED', 'Payment needs staff review. Contact the canteen.');
      const updated = await tx.order.update({ where: { id: fresh.id }, data: { status, paymentStatus: 'PAID', razorpayPaymentId: payment.id,
        paymentPaidAt: new Date(), closedReason: null, paymentLeaseUntil: null, paymentNextCheckAt: null, version: { increment: 1 } } });
      await changed(tx, fresh, status);
      await tx.auditLog.create({ data: { action: 'PAYMENT_CONFIRMED', target: `order:${fresh.id}`, actorId: fresh.studentId, requestId: `razorpay:${payment.id}`, metadata: { paymentId: payment.id, amountPaise: payment.amount } } });
      return updated;
    });
  }
  async function reconcile(order: Order) {
    if (order.executionMode !== 'RAZORPAY_TEST' || order.paymentStatus === 'PAID') return order;
    assertAccount(order);
    if (!order.razorpayOrderId && order.paymentKeyId) order = await discover(order);
    let payments: z.infer<typeof gatewayPayment>[] = [];
    if (order.razorpayOrderId) {
      payments = z.object({ items: z.array(gatewayPayment) }).parse(await call(`orders/${order.razorpayOrderId}/payments`)).items;
      const captured = payments.find(value => value.status === 'captured');
      if (captured) return confirm(order, captured);
      const authorized = payments.find(value => value.status === 'authorized');
      if (authorized) {
        if (authorized.amount !== order.totalPaise || authorized.currency !== 'INR' || authorized.order_id !== order.razorpayOrderId) throw new AppError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount needs staff review.');
        const capturedPayment = gatewayPayment.parse(await call(`payments/${authorized.id}/capture`, { amount: order.totalPaise, currency: 'INR' }));
        return confirm(order, capturedPayment);
      }
    }
    return locked(order, async (tx, fresh) => {
      if (fresh.paymentStatus === 'PAID' || !['ACCEPTED', 'REJECTED'].includes(fresh.status)) return fresh;
      if (fresh.status === 'REJECTED') return fresh;
      const expired = Boolean(fresh.paymentDeadline && fresh.paymentDeadline <= new Date());
      const processing = payments.some(value => !['failed', 'captured'].includes(value.status));
      // Unknown order creation can still produce a callback; keep checking rather than claiming cancellation.
      if (expired && !processing && !(fresh.paymentKeyId && !fresh.razorpayOrderId)) {
        const updated = await tx.order.update({ where: { id: fresh.id }, data: { status: 'REJECTED', closedReason: 'PAYMENT_EXPIRED', paymentStatus: 'PAYMENT_EXPIRED', version: { increment: 1 } } });
        await changed(tx, fresh, 'REJECTED'); return updated;
      }
      // A failed checkout setup is not an in-flight payment. Once its creation
      // lease ends, a successful receipt lookup with no match permits retry.
      const creationPending = !fresh.razorpayOrderId && fresh.paymentKeyId && fresh.paymentLeaseUntil && fresh.paymentLeaseUntil > new Date();
      const next = processing || creationPending ? 'PROCESSING' : payments.length ? 'FAILED' : fresh.razorpayOrderId || (fresh.paymentKeyId && !expired) ? 'AWAITING_PAYMENT' : fresh.paymentStatus;
      return next === fresh.paymentStatus ? fresh : tx.order.update({ where: { id: fresh.id }, data: { paymentStatus: next, version: { increment: 1 } } });
    });
  }
  async function checkout(id: string, studentId: string) {
    let order = await owned(id, studentId);
    if (order.executionMode !== 'RAZORPAY_TEST') throw new AppError(409, 'PAYMENT_NOT_REQUIRED', 'This order does not require Razorpay payment.');
    assertAccount(order);
    if (order.paymentStatus === 'PAID') return { paid: true };
    if (order.status !== 'ACCEPTED') throw new AppError(409, 'ACCEPTANCE_REQUIRED', 'Wait for canteen acceptance before paying.');
    if (order.totalPaise < 100) throw new AppError(409, 'PAYMENT_AMOUNT_INVALID', 'Razorpay requires an order value of at least ₹1.');
    if (order.razorpayOrderId || order.paymentKeyId) order = await reconcile(order);
    if (order.paymentStatus === 'PAID') return { paid: true };
    if (order.status !== 'ACCEPTED' || !order.paymentDeadline || order.paymentDeadline <= new Date()) throw new AppError(409, 'PAYMENT_WINDOW_CLOSED', 'The payment window has closed. Check payment status if you already paid.');
    if (order.paymentStatus === 'PROCESSING' && order.razorpayOrderId) throw new AppError(409, 'PAYMENT_PROCESSING', 'A payment is being confirmed. Check payment status before trying again.');
    if (!order.razorpayOrderId) {
      const lease = await locked(order, async (tx, fresh) => {
        if (fresh.razorpayOrderId) return fresh;
        if (fresh.status !== 'ACCEPTED' || fresh.paymentStatus === 'PAID') throw new AppError(409, 'ORDER_STATE_CONFLICT', 'Refresh this order before paying.');
        if (fresh.paymentLeaseUntil && fresh.paymentLeaseUntil > new Date()) throw new AppError(409, 'PAYMENT_PROCESSING', 'Checkout is opening on another device. Check payment status shortly.');
        return tx.order.update({ where: { id }, data: { paymentKeyId: config.RAZORPAY_KEY_ID, paymentStatus: 'PROCESSING',
          paymentLeaseUntil: new Date(Date.now() + 30000), paymentNextCheckAt: new Date(Date.now() + 30000), version: { increment: 1 } } });
      });
      order = lease;
      if (!order.razorpayOrderId) {
        try {
          // Receipt is the stable application order UUID (36 chars), unique at Razorpay too.
          const existing = await discover(order);
          order = existing.razorpayOrderId ? existing : await attach(order, gatewayOrder.parse(await call('orders', { amount: order.totalPaise, currency: 'INR', receipt: order.id, notes: { spoonate_order_id: order.id }, partial_payment: false })));
          order = await locked(order, (tx, fresh) => fresh.paymentStatus === 'PAID' || fresh.status !== 'ACCEPTED' ? Promise.resolve(fresh) : tx.order.update({ where: { id }, data: { paymentStatus: 'AWAITING_PAYMENT', version: { increment: 1 } } }));
        } catch { throw new AppError(503, 'PAYMENT_CONFIRMATION_PENDING', 'Checkout could not be confirmed. Check payment status shortly; do not start a separate order if you were debited.'); }
      }
    }
    if (order.paymentStatus === 'PAID') return { paid: true };
    if (order.status !== 'ACCEPTED' || !order.paymentDeadline || order.paymentDeadline <= new Date()) throw new AppError(409, 'PAYMENT_WINDOW_CLOSED', 'The payment window has closed. Check payment status if you already paid.');
    return { paid: false, keyId: config.RAZORPAY_KEY_ID, razorpayOrderId: order.razorpayOrderId, amountPaise: order.totalPaise, currency: 'INR', deadline: order.paymentDeadline!.toISOString() };
  }
  async function verify(id: string, studentId: string, value: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const order = await owned(id, studentId); assertAccount(order);
    if (order.executionMode !== 'RAZORPAY_TEST' || !order.razorpayOrderId || value.razorpay_order_id !== order.razorpayOrderId || !validPaymentSignature(`${order.razorpayOrderId}|${value.razorpay_payment_id}`, value.razorpay_signature, config.RAZORPAY_KEY_SECRET || '')) throw new AppError(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment verification failed. Check payment status.');
    const payment = gatewayPayment.parse(await call(`payments/${value.razorpay_payment_id}`));
    if (payment.id !== value.razorpay_payment_id || payment.order_id !== order.razorpayOrderId || payment.amount !== order.totalPaise || payment.currency !== 'INR') throw new AppError(400, 'PAYMENT_AMOUNT_MISMATCH', 'Payment does not match this order.');
    return reconcile(order);
  }
  async function check(id: string, studentId?: string, canteenId?: string) { return reconcile(await owned(id, studentId, canteenId)); }
  async function cancel(id: string, studentId: string) {
    const order = await owned(id, studentId);
    return locked(order, async (tx, fresh) => {
      if (fresh.paymentStatus === 'PAID') throw new AppError(409, 'PAID_ORDER_FINAL', 'Paid orders cannot be cancelled or refunded.');
      if (fresh.executionMode !== 'RAZORPAY_TEST' || !['RECEIVED', 'ACCEPTED'].includes(fresh.status)) throw new AppError(409, 'CANCELLATION_UNAVAILABLE', 'This order cannot be cancelled.');
      if (fresh.paymentKeyId || fresh.razorpayOrderId) throw new AppError(409, 'PAYMENT_STARTED', 'Payment checkout has started. Check its status; cancellation is unavailable while a payment could still complete.');
      await tx.order.update({ where: { id }, data: { status: 'REJECTED', paymentStatus: 'CANCELLED', closedReason: 'STUDENT_CANCELLED', version: { increment: 1 } } });
      await changed(tx, fresh, 'REJECTED');
    });
  }
  async function response(id: string) { return orderResponse(await db.order.findUniqueOrThrow({ where: { id }, include: orderInclude })); }
  async function webhook(body: Buffer, signature: string | undefined) {
    if (!config.RAZORPAY_WEBHOOK_SECRET || !validPaymentSignature(body, signature, config.RAZORPAY_WEBHOOK_SECRET)) throw new AppError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
    let payload: unknown; try { payload = JSON.parse(body.toString('utf8')); } catch { throw new AppError(400, 'WEBHOOK_INVALID', 'Invalid webhook.'); }
    const parsed = z.object({ event: z.string(), payload: z.object({ payment: z.object({ entity: z.object({ order_id: z.string(), id: z.string() }) }) }).optional() }).safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'WEBHOOK_INVALID', 'Invalid webhook.');
    if (!['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(parsed.data.event) || !parsed.data.payload) return;
    const reference = parsed.data.payload.payment.entity;
    // Unknown references can belong to another app on this account. They must not create an order here.
    const order = await db.order.findUnique({ where: { razorpayOrderId: reference.order_id } });
    if (order?.executionMode === 'RAZORPAY_TEST') await reconcile(order);
  }
  return { checkout, check, verify, cancel, response, webhook, reconcile };
}

export async function reconcilePaymentBatch(config: Config, db: PrismaClient, stopping = () => false, fetcher: typeof fetch = fetch) {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) return;
  const payments = createPayments(config, db, fetcher);
  const rows = await db.order.findMany({ where: { executionMode: 'RAZORPAY_TEST', paymentStatus: { in: ['AWAITING_PAYMENT', 'PROCESSING', 'FAILED', 'PAYMENT_EXPIRED'] },
    paymentKeyId: { in: [config.RAZORPAY_KEY_ID] }, OR: [{ paymentNextCheckAt: null }, { paymentNextCheckAt: { lte: new Date() } }] }, orderBy: { paymentNextCheckAt: 'asc' }, take: 2 });
  // Orders with no checkout still need an unpaid-acceptance deadline.
  const expired = await db.order.findMany({ where: { executionMode: 'RAZORPAY_TEST', status: 'ACCEPTED', paymentStatus: 'AWAITING_PAYMENT', paymentKeyId: null, paymentDeadline: { lte: new Date() } }, take: 10 });
  for (const order of [...rows, ...expired]) {
    if (stopping()) break;
    const claimed = await db.order.updateMany({ where: { id: order.id, version: order.version }, data: { paymentNextCheckAt: new Date(Date.now() + (order.status === 'REJECTED' ? 300000 : 30000)), version: { increment: 1 } } });
    if (!claimed.count) continue;
    try { await payments.reconcile(order); } catch { console.error(JSON.stringify({ event: 'payment_reconciliation_pending', orderId: order.id })); }
  }
}
