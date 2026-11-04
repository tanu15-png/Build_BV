import { createHash } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { verifySecret } from './hash.js';

export const memberName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');
// Internal identity only: members never supply an email or receive messages.
export function canteenMemberEmail(name: string, canteenId: string) {
  const id = createHash('sha256').update(`${canteenId}:${memberName(name).toLowerCase()}`).digest('hex').slice(0, 40);
  return `member-${id}@canteen.spoonate.invalid`;
}
export async function signInCanteenMember(db: PrismaClient, config: Config, input: {
  name: string; accessCode: string; tokenHash: string; previousTokenHash?: string; requestId: string;
}) {
  const name = memberName(input.name);
  if (!name || name.length > 120) throw new AppError(422, 'NAME_INVALID', 'Enter your name (up to 120 characters).');
  const candidates = await db.canteenAccessCode.findMany({ where: { active: true }, select: { canteenId: true, codeHash: true, version: true } });
  const matches = [];
  // Bound the work per request with the route's IP rate limit.
  for (const candidate of candidates) if (await verifySecret(input.accessCode.trim().toLowerCase(), candidate.codeHash)) matches.push(candidate);
  if (!matches.length) throw new AppError(401, 'ACCESS_CODE_INVALID', 'Incorrect member access code.');
  if (matches.length !== 1) throw new AppError(409, 'ACCESS_CODE_AMBIGUOUS', 'This access code matches more than one canteen. Ask an administrator to change it.');
  const selected = matches[0]!;
  const email = canteenMemberEmail(name, selected.canteenId);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
    const user = await tx.user.upsert({ where: { email },
      create: { email, name, roles: { create: { role: 'CANTEEN' } } }, update: {}, include: { roles: true } });
    if (user.status !== 'ACTIVE' || user.supabaseSubject || !user.roles.some(role => role.role === 'CANTEEN')) throw new AppError(403, 'ACCOUNT_DENIED', 'This member cannot sign in. Contact an administrator.');
    await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${selected.canteenId}::uuid FOR UPDATE`;
    const canteen = await tx.canteen.findUniqueOrThrow({ where: { id: selected.canteenId } });
    if (!canteen.operational) throw new AppError(403, 'CANTEEN_DISABLED', 'This canteen is not accepting new sign-ins.');
    const code = await tx.canteenAccessCode.findFirst({ where: { canteenId: canteen.id, active: true } });
    if (code?.version !== selected.version || code.codeHash !== selected.codeHash) throw new AppError(403, 'ACCESS_CODE_CHANGED', 'The member access code changed. Enter the current code.');
    const where = { userId_canteenId: { userId: user.id, canteenId: canteen.id } };
    const existing = await tx.canteenMembership.findUnique({ where });
    if (existing?.status === 'REVOKED') throw new AppError(403, 'MEMBERSHIP_REVOKED', 'Your access was removed. Contact an administrator.');
    const membership = await tx.canteenMembership.upsert({ where,
      create: { userId: user.id, canteenId: canteen.id, codeVersion: code.version }, update: { codeVersion: code.version } });
    if (input.previousTokenHash) await tx.session.updateMany({ where: { tokenHash: input.previousTokenHash, role: 'CANTEEN', revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.session.create({ data: { tokenHash: input.tokenHash, userId: user.id, role: 'CANTEEN', canteenId: canteen.id,
      membershipId: membership.id, expiresAt: new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'CANTEEN_MEMBER_LOGIN', target: canteen.id, requestId: input.requestId } });
    return { id: user.id, email: user.email, name: user.name, role: 'CANTEEN' as const, canteenId: canteen.id };
  }, { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 });
}
