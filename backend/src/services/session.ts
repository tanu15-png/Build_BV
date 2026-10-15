import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
export type Actor = { id: string; email: string; name: string; role: 'STUDENT' | 'CANTEEN' | 'ADMIN'; canteenId: string | null };
export function cookies(req: Request) {
  return Object.fromEntries((req.headers.cookie ?? '').split(';').map(part => part.trim().split('=')).filter(parts => parts.length === 2));
}
export function createSessionReader(config: Config, db: PrismaClient | Prisma.TransactionClient) {
  const sessionCookie = 'spoonate_session';
  const hash = (value: string) => createHmac('sha256', config.SESSION_SECRET).update(value).digest('hex');
  const studentEmail = (email: string) => { if (!/^[^@\s]+@banasthali\.in$/.test(email)) throw new AppError(403, 'STUDENT_EMAIL_REQUIRED', 'Use your exact @banasthali.in email address.'); };
  return async function current(req: Request) {
    const token = cookies(req)[sessionCookie];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError(401, 'SESSION_REQUIRED', 'Sign in to continue.');
    const session = await db.session.findUnique({ where: { tokenHash: hash(`session:${token}`) }, include: {
      user: { include: { roles: true } }, membership: true,
      canteen: { include: { accessCodes: { where: { active: true }, select: { version: true } } } },
    } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE' || !session.user.supabaseSubject) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has ended. Sign in again.');
    if (!session.user.roles.some(role => role.role === session.role)) throw new AppError(403, 'ROLE_DENIED', 'Account permissions have changed.');
    if (session.role === 'STUDENT') studentEmail(session.user.email);
    if (session.role === 'CANTEEN' && (!session.membership || session.membership.status !== 'ACTIVE' || session.membership.codeVersion !== session.canteen?.accessCodes[0]?.version)) throw new AppError(401, 'MEMBERSHIP_REVOKED', 'Your canteen access has ended. Sign in again or contact an administrator.');
    const actor: Actor = { id: session.user.id, email: session.user.email, name: session.user.name, role: session.role, canteenId: session.canteenId };
    return { session, actor };
  }
}
