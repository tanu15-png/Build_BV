import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma, AccountStatus, MembershipStatus, Role } from '../generated/prisma/client.js';
import { contracts } from '../schemas/contracts.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin, adminOrders, adminOverview, type AdminOrderQuery } from '../services/admin.js';
import type { createCatalogEvents } from '../services/catalogEvents.js';
export function createAdminRouter(config: Config, db: PrismaClient, events: ReturnType<typeof createCatalogEvents>) {
  const router = Router();
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  function route(key: string) {
    const contract = contracts[key]!;
    return [validate(contract.params, 'params'), validate(contract.query, 'query'), ...(key.startsWith('GET ') ? [] : [validate(contract.body)])];
  }
  router.get('/admin/overview', ...route('GET /admin/overview'), async (req, res) => {
    await requireAdmin(req, config, db);
    res.json(await db.$transaction(adminOverview, { ...txOptions, isolationLevel: 'RepeatableRead' }));
  });
  router.get('/admin/orders', ...route('GET /admin/orders'), async (req, res) => {
    await requireAdmin(req, config, db);
    res.json(await db.$transaction(tx => adminOrders(tx, res.locals.query as AdminOrderQuery), { ...txOptions, isolationLevel: 'RepeatableRead' }));
  });
  router.get('/admin/users', ...route('GET /admin/users'), async (req, res) => {
    await requireAdmin(req, config, db);
    const q = res.locals.query as { cursor?: string; limit: number; search?: string; status?: AccountStatus; role?: Role };
    const where: Prisma.UserWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.role ? { roles: { some: { role: q.role } } } : {}),
      ...(q.search?.trim() ? { OR: [{ email: { contains: q.search.trim(), mode: 'insensitive' } }, { name: { contains: q.search.trim(), mode: 'insensitive' } }] } : {}) };
    const page = await db.$transaction(async tx => {
      let after: Prisma.UserWhereInput = {};
      if (q.cursor) {
        const row = await tx.user.findFirst({ where: { AND: [where, { id: q.cursor }] } });
        if (!row) throw new AppError(422, 'CURSOR_INVALID', 'Refresh accounts before loading more.');
        after = { OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }] };
      }
      const rows = await tx.user.findMany({ where: { AND: [where, after] }, take: q.limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, email: true, name: true, status: true, createdAt: true, updatedAt: true, roles: { select: { role: true } } } });
      return { items: rows.slice(0, q.limit).map(row => ({ ...row, roles: row.roles.map(value => value.role), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })), nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null };
    }, { ...txOptions, isolationLevel: 'RepeatableRead' });
    res.json(page);
  });
  router.get('/admin/memberships', ...route('GET /admin/memberships'), async (req, res) => {
    await requireAdmin(req, config, db);
    const q = res.locals.query as { cursor?: string; limit: number; search?: string; status?: MembershipStatus; canteenId?: string };
    const where: Prisma.CanteenMembershipWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.canteenId ? { canteenId: q.canteenId } : {}),
      ...(q.search?.trim() ? { user: { OR: [{ email: { contains: q.search.trim(), mode: 'insensitive' } }, { name: { contains: q.search.trim(), mode: 'insensitive' } }] } } : {}) };
    const page = await db.$transaction(async tx => {
      let after: Prisma.CanteenMembershipWhereInput = {};
      if (q.cursor) {
        const row = await tx.canteenMembership.findFirst({ where: { AND: [where, { id: q.cursor }] } });
        if (!row) throw new AppError(422, 'CURSOR_INVALID', 'Refresh memberships before loading more.');
        after = { OR: [{ joinedAt: { lt: row.joinedAt } }, { joinedAt: row.joinedAt, id: { lt: row.id } }] };
      }
      const rows = await tx.canteenMembership.findMany({ where: { AND: [where, after] }, take: q.limit + 1, orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
        include: { user: { select: { email: true, name: true, status: true } }, canteen: { select: { name: true, accessCodes: { where: { active: true }, select: { version: true } } } } } });
      return { items: rows.slice(0, q.limit).map(row => ({ id: row.id, userId: row.userId, canteenId: row.canteenId, email: row.user.email,
        userName: row.user.name, accountStatus: row.user.status, canteenName: row.canteen.name, status: row.status, version: row.version,
        requiresAccessCode: row.codeVersion !== row.canteen.accessCodes[0]?.version })), nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null };
    }, { ...txOptions, isolationLevel: 'RepeatableRead' });
    res.json(page);
  });
  router.patch('/admin/canteens/:id', ...route('PATCH /admin/canteens/:id'), async (req, res) => {
    const actor = await requireAdmin(req, config, db);
    const { expectedVersion, ...data } = req.body;
    const updated = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await requireAdmin(req, config, tx);
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${res.locals.params.id}::uuid FOR UPDATE`;
      const existing = await tx.canteen.findUnique({ where: { id: res.locals.params.id } });
      if (!existing) throw new AppError(404, 'CANTEEN_NOT_FOUND', 'Canteen not found.');
      if (existing.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'Canteen changed. Refresh and retry.');
      const row = await tx.canteen.update({ where: { id: existing.id }, data: { ...data, ...(data.operational === false ? { acceptingOrders: false } : {}), version: { increment: 1 } } });
      if (data.operational === false) await tx.authChallenge.updateMany({ where: { canteenId: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'ADMIN_CANTEEN_UPDATED', target: row.id, requestId: res.locals.requestId,
        metadata: { fields: Object.keys(data), operational: row.operational, acceptingOrders: row.acceptingOrders } } });
      return row;
    }, txOptions);
    events.publish(updated.id); res.json(updated);
  });
  return router;
}
