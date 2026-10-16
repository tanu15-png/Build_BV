import type { Request } from 'express';
import type { Prisma, PrismaClient, OrderStatus } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { createSessionReader } from './session.js';
import { orderInclude, orderResponse } from './orders.js';
export async function requireAdmin(req: Request, config: Config, db: PrismaClient | Prisma.TransactionClient) {
  const { actor } = await createSessionReader(config, db)(req);
  if (actor.role !== 'ADMIN') throw new AppError(403, 'ADMIN_DENIED', 'Administrator access required.');
  return actor;
}
export async function adminOverview(tx: Prisma.TransactionClient) {
  const canteens = await tx.canteen.findMany({ orderBy: { slug: 'asc' } });
  const counts = await tx.order.groupBy({ by: ['canteenId', 'status'], _count: { _all: true }, _sum: { totalPaise: true } });
  const menus = await tx.menuItem.groupBy({ by: ['canteenId'], where: { archived: false, category: { archived: false } }, _count: { _all: true } });
  const codes = await tx.canteenAccessCode.findMany({ where: { active: true }, select: { canteenId: true, version: true } });
  const metrics = new Map<string, { totalOrders: number; activeOrders: number; collectedOrders: number; collectedValuePaise: number }>();
  for (const row of counts) {
    const value = metrics.get(row.canteenId) ?? { totalOrders: 0, activeOrders: 0, collectedOrders: 0, collectedValuePaise: 0 };
    value.totalOrders += row._count._all;
    if (row.status === 'COLLECTED') { value.collectedOrders += row._count._all; value.collectedValuePaise += row._sum.totalPaise ?? 0; }
    else value.activeOrders += row._count._all;
    metrics.set(row.canteenId, value);
  }
  const rows = canteens.map(canteen => ({ ...canteen,
    ...(metrics.get(canteen.id) ?? { totalOrders: 0, activeOrders: 0, collectedOrders: 0, collectedValuePaise: 0 }),
    menuItemCount: menus.find(row => row.canteenId === canteen.id)?._count._all ?? 0,
    activeCodeVersion: codes.find(row => row.canteenId === canteen.id)?.version ?? null,
  }));
  const summary = rows.reduce((sum, row) => ({ totalOrders: sum.totalOrders + row.totalOrders,
    activeOrders: sum.activeOrders + row.activeOrders, collectedOrders: sum.collectedOrders + row.collectedOrders,
    collectedValuePaise: sum.collectedValuePaise + row.collectedValuePaise }), { totalOrders: 0, activeOrders: 0, collectedOrders: 0, collectedValuePaise: 0 });
  if (!Number.isSafeInteger(summary.collectedValuePaise)) throw new AppError(500, 'SUMMARY_OVERFLOW', 'The collected order value exceeds the supported summary range.');
  return { ...summary, totalCanteens: rows.length, operationalCanteens: rows.filter(row => row.operational).length,
    acceptingCanteens: rows.filter(row => row.operational && row.acceptingOrders).length, canteens: rows };
}
export type AdminOrderQuery = { cursor?: string; limit: number; canteenId?: string; status?: OrderStatus;
  search?: string; from?: string; to?: string; codeDay?: string; orderCode?: string };
export function adminOrderWhere(q: AdminOrderQuery): Prisma.OrderWhereInput {
  if (q.from && q.to && new Date(q.from) > new Date(q.to)) throw new AppError(422, 'DATE_RANGE_INVALID', 'The start date must precede the end date.');
  const search = q.search?.trim();
  return { ...(q.canteenId ? { canteenId: q.canteenId } : {}), ...(q.status ? { status: q.status } : {}),
    ...(q.codeDay ? { codeDay: new Date(q.codeDay + 'T00:00:00Z') } : {}), ...(q.orderCode ? { orderCode: q.orderCode } : {}),
    ...((q.from || q.to) ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    ...(search ? { OR: [{ orderCode: { contains: search, mode: 'insensitive' } }, { canteen: { name: { contains: search, mode: 'insensitive' } } },
      { student: { name: { contains: search, mode: 'insensitive' } } }, { items: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ...(/^\d{4}-\d{2}-\d{2}$/.test(search) && Number.isFinite(Date.parse(search)) ? [{ codeDay: new Date(search + 'T00:00:00Z') }] : [])] } : {}) };
}
export async function adminOrders(tx: Prisma.TransactionClient, q: AdminOrderQuery) {
  const where = adminOrderWhere(q);
  let after: Prisma.OrderWhereInput = {};
  if (q.cursor) {
    const cursor = await tx.order.findFirst({ where: { AND: [where, { id: q.cursor }] } });
    if (!cursor) throw new AppError(422, 'CURSOR_INVALID', 'Refresh the order list before loading more.');
    after = { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] };
  }
  const rows = await tx.order.findMany({ where: { AND: [where, after] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1, include: orderInclude });
  const totalCount = await tx.order.count({ where });
  return { items: rows.slice(0, q.limit).map(orderResponse), nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null, totalCount };
}
