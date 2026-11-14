import { Router, raw } from 'express';
import { z } from 'zod';
import type { Config } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { createPayments } from '../services/payments.js';
import { AppError } from '../middleware/errorHandler.js';
import type { createCatalogEvents } from '../services/catalogEvents.js';

export function createPaymentWebhook(config: Config, db: PrismaClient, events: ReturnType<typeof createCatalogEvents>, fetcher: typeof fetch = fetch) {
  const router = Router(), payments = createPayments(config, db, fetcher);
  router.post('/', raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new AppError(400, 'WEBHOOK_INVALID', 'Expected a JSON webhook.');
    await payments.webhook(req.body, req.get('x-razorpay-signature'));
    events.publishOrders(); res.json({ ok: true });
  });
  return router;
}
export function createPaymentsRouter(config: Config, db: PrismaClient, fetcher: typeof fetch = fetch) {
  const router = Router(), current = createSessionReader(config, db), payments = createPayments(config, db, fetcher);
  const verification = z.object({ razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/), razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/), razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
  for (const action of ['checkout', 'verify', 'check', 'cancel'] as const) router.post(`/orders/:id/payment/${action}`, async (req, res) => {
    const { actor } = await current(req);
    if (!z.uuid().safeParse(req.params.id).success) throw new AppError(422, 'ORDER_INVALID', 'Choose a valid order.');
    if (actor.role !== 'STUDENT' && !(actor.role === 'CANTEEN' && action === 'check')) throw new AppError(403, 'STUDENT_REQUIRED', 'Only the student who placed the order can pay or cancel it.');
    const [rate] = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, window_ends_at, count) VALUES (${`payment:${actor.id}`}, clock_timestamp() + interval '1 minute', 1)
      ON CONFLICT (key) DO UPDATE SET count = CASE WHEN rate_limits.window_ends_at <= clock_timestamp() THEN 1 ELSE rate_limits.count + 1 END,
        window_ends_at = CASE WHEN rate_limits.window_ends_at <= clock_timestamp() THEN clock_timestamp() + interval '1 minute' ELSE rate_limits.window_ends_at END
      RETURNING count`;
    if (rate!.count > 30) throw new AppError(429, 'PAYMENT_RATE_LIMIT', 'Please wait a minute before checking payment again.');
    const id = req.params.id as string;
    if (action === 'checkout') { res.json(await payments.checkout(id, actor.id)); return; }
    if (action === 'verify') {
      const parsed = verification.safeParse(req.body);
      if (!parsed.success) throw new AppError(422, 'PAYMENT_INVALID', 'Invalid payment response. Check payment status.');
      await payments.verify(id, actor.id, parsed.data);
    } else if (action === 'cancel') await payments.cancel(id, actor.id);
    else await payments.check(id, actor.role === 'STUDENT' ? actor.id : undefined, actor.role === 'CANTEEN' ? actor.canteenId! : undefined);
    res.json(await payments.response(id));
  });
  return router;
}
