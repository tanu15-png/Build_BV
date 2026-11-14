import { AppError } from '../middleware/errorHandler.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export function analyticsRange(period: unknown, date: unknown) {
  if (!['day', 'week', 'month'].includes(String(period)) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(422, 'STATS_RANGE_INVALID', 'Choose a valid date and period.');
  const day = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date || day.getUTCFullYear() < 2000 || day.getUTCFullYear() > 2100) throw new AppError(422, 'STATS_RANGE_INVALID', 'Choose a valid date.');
  const start = new Date(day);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'month') start.setUTCDate(1);
  const end = new Date(day); end.setUTCDate(end.getUTCDate() + 1);
  return { period: String(period), date, startDate: start.toISOString().slice(0, 10), start: new Date(start.getTime() - 19800000), end: new Date(end.getTime() - 19800000) };
}

export type SalesStats = { salesPaise: number; grossPaise: number; discountPaise: number; orders: number; rewards: number; quantity: number;
  items: { id: string; name: string; quantity: number; salesPaise: number }[]; buckets: { key: string; salesPaise: number }[] };

export async function salesStats(db: PrismaClient, canteenId: string, range: ReturnType<typeof analyticsRange>) {
  // Aggregate snapshots in PostgreSQL, not the paginated dashboard order list or current menu prices.
  const [row] = await db.$queryRaw<{ stats: SalesStats }[]>`
    WITH collected AS (
      SELECT id, total_paise, execution_mode, collected_at FROM orders
      WHERE canteen_id = ${canteenId}::uuid AND status = 'COLLECTED'
        AND (execution_mode <> 'RAZORPAY_TEST' OR payment_status = 'PAID')
        AND collected_at >= ${range.start} AND collected_at < ${range.end}
    ), sales AS (SELECT * FROM collected WHERE execution_mode <> 'REWARD'),
    lines AS (
      SELECT i.*, COALESCE(i.menu_item_id::text, 'deleted:' || i.name) AS identity
      FROM order_items i JOIN sales s ON s.id = i.order_id
    ), items AS (
      SELECT identity AS id, name, SUM(quantity)::float8 AS quantity,
        SUM(quantity::bigint * unit_price_paise)::float8 AS amount
      FROM lines GROUP BY identity, name
    ), buckets AS (
      SELECT CASE WHEN ${range.period} = 'day'
        THEN to_char(collected_at AT TIME ZONE 'Asia/Kolkata', 'HH24')
        ELSE to_char(collected_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') END AS key,
        SUM(total_paise)::float8 AS amount FROM sales GROUP BY 1
    )
    SELECT json_build_object(
      'salesPaise', COALESCE((SELECT SUM(total_paise) FROM sales), 0),
      'grossPaise', COALESCE((SELECT SUM(quantity::bigint * COALESCE(original_unit_price_paise, unit_price_paise)) FROM lines), 0),
      'discountPaise', COALESCE((SELECT SUM(quantity::bigint * (COALESCE(original_unit_price_paise, unit_price_paise) - unit_price_paise)) FROM lines), 0),
      'orders', (SELECT COUNT(*) FROM sales),
      'rewards', (SELECT COUNT(*) FROM collected WHERE execution_mode = 'REWARD'),
      'quantity', COALESCE((SELECT SUM(quantity) FROM lines), 0),
      'items', COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name, 'quantity', quantity, 'salesPaise', amount) ORDER BY quantity DESC, name) FROM items), '[]'::json),
      'buckets', COALESCE((SELECT json_agg(json_build_object('key', key, 'salesPaise', amount) ORDER BY key) FROM buckets), '[]'::json)
    ) AS stats`;
  return { ...range, start: range.start.toISOString(), end: range.end.toISOString(), ...row!.stats };
}
