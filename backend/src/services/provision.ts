import { randomUUID } from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { hashSecret } from './hash.js';
import type { Config } from '../config/env.js';
export const directory = [
  ['mukteshwari', "Mukteshwari's Canteen"], ['shanu', "Shanu's Canteen"], ['spicy-bites', 'Spicy Bites'],
  ['annapurna', 'Annapurna Canteen'], ['agarwal', 'Agarwal Canteen'], ['fun-n-frolic', "Fun 'N' Frolic"],
  ['desi-jayka', 'Desi Jayka'], ['bella-bite', 'Bella Bite'],
] as const;
export function developmentSeedsAllowed(config: Config) {
  return config.SEED_DEVELOPMENT_DATA && ['development', 'test'].includes(config.APP_ENV) && config.NODE_ENV !== 'production';
}
export async function seed(db: PrismaClient, config: Config) {
  for (const [slug, name] of directory) {
    await db.canteen.upsert({ where: { slug }, create: { slug, name }, update: {} });
    if (!developmentSeedsAllowed(config)) continue;
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM canteens WHERE slug = ${slug} FOR UPDATE`;
      const canteen = await tx.canteen.findUniqueOrThrow({ where: { slug } });
      if (await tx.canteenAccessCode.count({ where: { canteenId: canteen.id } }) === 0) {
        await tx.canteenAccessCode.create({ data: { canteenId: canteen.id, codeHash: await hashSecret(name), version: 1 } });
      }
      // Seed only a completely empty menu; never overwrite operator-managed records or availability.
      if (await tx.menuItem.count({ where: { canteenId: canteen.id } }) === 0) {
        const snacks = await tx.menuCategory.upsert({ where: { canteenId_name: { canteenId: canteen.id, name: 'Snacks' } }, create: { canteenId: canteen.id, name: 'Snacks' }, update: {} });
        const drinks = await tx.menuCategory.upsert({ where: { canteenId_name: { canteenId: canteen.id, name: 'Drinks' } }, create: { canteenId: canteen.id, name: 'Drinks' }, update: {} });
        await tx.menuItem.createMany({ data: [
          { canteenId: canteen.id, name: 'Sample Masala Sandwich', categoryId: snacks.id, pricePaise: 4500 },
          { canteenId: canteen.id, name: 'Sample Tea', categoryId: drinks.id, pricePaise: 1500 },
        ] });
      }
    });
  }
}
export async function rotateCode(db: PrismaClient, config: Config, slug: string, code: string, actor?: { id: string; requestId: string; expectedCodeVersion?: number; authorize?: (tx: Prisma.TransactionClient) => Promise<void> }) {
  if (code.length < 12 || code.length > 256) throw new AppError(422, 'ACCESS_CODE_INVALID', 'Access code must contain 12 to 256 characters');
  if (!developmentSeedsAllowed(config) && directory.some(([, name]) => name.toLowerCase() === code.toLowerCase())) throw new AppError(422, 'ACCESS_CODE_INVALID', 'Development codes are prohibited');
  const codeHash = await hashSecret(code);
  return db.$transaction(async tx => {
    if (actor) { await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`; await actor.authorize?.(tx); }
    await tx.$queryRaw`SELECT id FROM canteens WHERE slug = ${slug} FOR UPDATE`;
    const canteen = await tx.canteen.findUniqueOrThrow({ where: { slug } });
    const last = await tx.canteenAccessCode.findFirst({ where: { canteenId: canteen.id }, orderBy: { version: 'desc' } });
    if (actor?.expectedCodeVersion !== undefined && actor.expectedCodeVersion !== (last?.version ?? 0)) throw new AppError(409, 'VERSION_CONFLICT', 'Access code changed. Refresh before rotating it again.');
    const version = (last?.version ?? 0) + 1;
    await tx.canteenAccessCode.updateMany({ where: { canteenId: canteen.id, active: true }, data: { active: false } });
    await tx.canteenAccessCode.create({ data: { canteenId: canteen.id, codeHash, version, rotatedBy: actor?.id } });
    await tx.session.updateMany({ where: { canteenId: canteen.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { canteenId: canteen.id, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: actor?.id, action: 'CANTEEN_CODE_ROTATED', target: canteen.id, requestId: actor?.requestId ?? randomUUID(), metadata: { version, source: actor ? 'admin-api' : 'operator-cli' } } });
    return version;
  });
}
export async function provisionAdmin(db: PrismaClient, email: string, name: string, password: string) {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name.trim() || name.length > 120) throw new Error('Valid email and name required');
  if (password.length < 12 || password.length > 256 || password.toLowerCase() === 'admin123') throw new Error('Admin password must contain 12 to 256 characters; demo credentials are prohibited');
  const passwordHash = await hashSecret(password);
  await db.$transaction(async tx => {
    // Existing accounts must be managed through an explicit reset/role management workflow.
    const user = await tx.user.create({ data: { email, name: name.trim(), passwordHash, emailVerifiedAt: new Date(), roles: { create: { role: 'ADMIN' } } } });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_PROVISIONED', target: user.id, requestId: randomUUID(), metadata: { source: 'operator-cli' } } });
  });
}
