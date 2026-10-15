import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { contracts, idParams, pageQuery } from '../schemas/contracts.js';
import { supabaseAuth, type VerifiedUser } from '../services/supabase.js';
import { createSessionReader, cookies, type Actor } from '../services/session.js';
import { verifySecret } from '../services/hash.js';
import { rotateCode } from '../services/provision.js';

const sessionCookie = 'spoonate_session';
const csrfCookie = 'spoonate_csrf';
type Tx = Prisma.TransactionClient;
export function createAuthRouter(config: Config, db: PrismaClient, fetcher: typeof fetch = fetch) {
  const router = Router();
  const auth = supabaseAuth(config, fetcher);
  const hash = (value: string) => createHmac('sha256', config.SESSION_SECRET).update(value).digest('hex');
  const same = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
  const secure = config.FRONTEND_ORIGIN.startsWith('https://');
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/api/v1' };
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  const bearer = (req: Request) => {
    const token = req.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    return token;
  };
  function validCsrf(value: string) {
    const [nonce, signature] = value.split('.');
    return Boolean(nonce && signature && /^[a-f0-9]{64}$/.test(nonce) && same(signature, hash(`csrf:${nonce}`)));
  }
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/auth/csrf', (req, res) => {
    let token = cookies(req)[csrfCookie] ?? '';
    if (!validCsrf(token)) { const nonce = randomBytes(32).toString('hex'); token = `${nonce}.${hash(`csrf:${nonce}`)}`; }
    res.cookie(csrfCookie, token, { ...options, maxAge: config.SESSION_TTL_SECONDS * 1000 });
    res.json({ csrfToken: token });
  });
  router.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookie = cookies(req)[csrfCookie] ?? '';
    const header = req.get('x-csrf-token') ?? '';
    if (!validCsrf(cookie) || !same(cookie, header)) return next(new AppError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
    next();
  });
  async function rate(key: string, limit: number) {
    const rows = await db.$queryRaw<Array<{ count: number }>>`INSERT INTO rate_limits (key, window_ends_at, count)
      VALUES (${hash(`rate:${key}`)}, NOW() + INTERVAL '10 minutes', 1)
      ON CONFLICT (key) DO UPDATE SET count = CASE WHEN rate_limits.window_ends_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
      window_ends_at = CASE WHEN rate_limits.window_ends_at <= NOW() THEN NOW() + INTERVAL '10 minutes' ELSE rate_limits.window_ends_at END RETURNING count`;
    if (rows[0]!.count > limit) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
  }
  async function limit(req: Request, scope: string, email: string) {
    await rate(`ip:${req.ip}`, 1000);
    await rate(`${scope}:${email.toLowerCase()}`, 20);
  }
  async function localUser(tx: Tx, remote: VerifiedUser, student: boolean) {
    let user = await tx.user.findUnique({ where: { email: remote.email }, include: { roles: true } });
    if (!user) {
      const value = remote.user_metadata?.name ?? remote.user_metadata?.full_name;
      user = await tx.user.create({ data: {
        email: remote.email, supabaseSubject: remote.id,
        name: typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : remote.email.split('@')[0]!,
        emailVerifiedAt: new Date(remote.email_confirmed_at),
        ...(student ? { roles: { create: { role: 'STUDENT' } } } : {}),
      }, include: { roles: true } });
    }
    if (user.status !== 'ACTIVE' || (user.supabaseSubject && user.supabaseSubject !== remote.id)) throw new AppError(403, 'ACCOUNT_DENIED', 'This account cannot sign in. Contact an administrator.');
    if (!user.supabaseSubject) {
      const linked = await tx.user.updateMany({ where: { id: user.id, supabaseSubject: null, status: 'ACTIVE' }, data: { supabaseSubject: remote.id, emailVerifiedAt: new Date(remote.email_confirmed_at), passwordHash: null } });
      if (!linked.count) throw new AppError(409, 'ACCOUNT_CHANGED', 'Account changed. Please retry.');
    }
    if (student && !user.roles.some(role => role.role === 'STUDENT')) await tx.userRole.create({ data: { userId: user.id, role: 'STUDENT' } });
    return user;
  }
  function studentEmail(email: string) {
    if (!/^[^@\s]+@banasthali\.in$/.test(email)) throw new AppError(403, 'STUDENT_EMAIL_REQUIRED', 'Use your exact @banasthali.in email address.');
  }
  const current = createSessionReader(config, db);
  router.get('/auth/me', async (req, res) => { res.json((await current(req)).actor); });

  router.post('/auth/confirm-signup', validate(z.object({ email: z.email().trim().toLowerCase(), code: z.string().regex(/^\d{6,10}$/) }).strict()), async (req, res) => {
    const { email, code } = req.body as { email: string; code: string };
    studentEmail(email);
    await limit(req, 'confirm', email);
    const remote = await auth.verify(await auth.verifySignup(email, code));
    if (remote.email !== email) throw new AppError(401, 'OTP_INVALID', 'This code belongs to a different account.');
    const token = randomBytes(32).toString('hex');
    const previous = cookies(req)[sessionCookie];
    const actor = await db.$transaction(async tx => {
      const user = await localUser(tx, remote, true);
      if (previous) await tx.session.updateMany({ where: { tokenHash: hash(`session:${previous}`), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.session.create({ data: { tokenHash: hash(`session:${token}`), userId: user.id, role: 'STUDENT', expiresAt: new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000) } });
      return { id: user.id, email: user.email, name: user.name, role: 'STUDENT', canteenId: null };
    }, txOptions);
    res.cookie(sessionCookie, token, { ...options, maxAge: config.SESSION_TTL_SECONDS * 1000 });
    res.json(actor);
  });
  router.post('/auth/admin/activate', validate(contracts['POST /auth/admin/login']!.body), async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    await limit(req, 'admin-activate', email);
    const user = await db.user.findUnique({ where: { email }, include: { roles: true } });
    if (!user || user.supabaseSubject || user.status !== 'ACTIVE' || !user.roles.some(role => role.role === 'ADMIN') || !user.passwordHash || !await verifySecret(password, user.passwordHash)) throw new AppError(401, 'ADMIN_DENIED', 'Incorrect provisioned admin credentials or account already activated.');
    await auth.activateAdmin(email, password, user.name);
    res.json({ ok: true });
  });
  router.post('/auth/admin/confirm', async (req, res) => {
    const remote = await auth.verify(bearer(req));
    await limit(req, 'admin-confirm', remote.email);
    await db.$transaction(async tx => {
      const admin = await tx.user.findUnique({ where: { email: remote.email }, include: { roles: true } });
      if (!admin?.roles.some(role => role.role === 'ADMIN')) throw new AppError(403, 'ADMIN_DENIED', 'Your admin account must be provisioned.');
      await localUser(tx, remote, false);
    }, txOptions);
    res.json({ ok: true });
  });
  router.post('/auth/canteen/login', validate(contracts['POST /auth/canteen/login']!.body), async (req, res) => {
    const { email, canteenId, accessCode } = req.body as { email: string; canteenId: string; accessCode: string };
    await limit(req, 'staff-code', email);
    const code = await db.canteenAccessCode.findFirst({ where: { canteenId, active: true } });
    if (!code || !await verifySecret(accessCode, code.codeHash)) throw new AppError(401, 'ACCESS_CODE_INVALID', 'Incorrect canteen or access code.');
    const membership = await db.canteenMembership.findFirst({ where: { canteenId, user: { email } } });
    if (membership?.status === 'REVOKED') throw new AppError(403, 'MEMBERSHIP_REVOKED', 'Your access was removed. Contact an administrator.');
    const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);
    const challenge = await db.authChallenge.create({ data: {
      email, canteenId, purpose: 'CANTEEN_LOGIN', accessCodeVersion: code.version,
      otpHash: hash(randomBytes(32).toString('hex')), expiresAt,
    } });
    res.json({ challengeId: challenge.id, expiresAt: expiresAt.toISOString(), resendAfter: new Date(Date.now() + 60000).toISOString() });
  });
  router.post('/auth/session', validate(z.object({ role: z.enum(['STUDENT', 'CANTEEN', 'ADMIN']), challengeId: z.uuid().optional() }).strict()), async (req, res) => {
    const remote = await auth.verify(bearer(req));
    const { role, challengeId } = req.body as { role: Actor['role']; challengeId?: string };
    await limit(req, 'session', remote.email);
    if (role === 'STUDENT') studentEmail(remote.email);
    if (role !== 'CANTEEN' && !remote.authenticationMethods.some(method => method.method === 'password' && method.timestamp >= Math.floor(Date.now() / 1000) - 300)) {
      throw new AppError(401, 'PASSWORD_LOGIN_REQUIRED', 'Log in with your email and password.');
    }
    const token = randomBytes(32).toString('hex');
    const previous = cookies(req)[sessionCookie];
    const actor = await db.$transaction(async tx => {
      // Admin roles always come from provisioning, never Supabase user metadata.
      if (role === 'ADMIN') {
        const admin = await tx.user.findUnique({ where: { email: remote.email }, include: { roles: true } });
        if (!admin?.roles.some(r => r.role === 'ADMIN')) throw new AppError(403, 'ADMIN_DENIED', 'An administrator must provision your account.');
      }
      const user = await localUser(tx, remote, role === 'STUDENT');
      let canteenId: string | null = null;
      let membershipId: string | null = null;
      if (role === 'CANTEEN') {
        if (!challengeId) throw new AppError(401, 'CHALLENGE_REQUIRED', 'Verify your canteen email first.');
        const initial = await tx.authChallenge.findUnique({ where: { id: challengeId } });
        if (!initial?.canteenId) throw new AppError(401, 'CHALLENGE_INVALID', 'Start canteen sign-in again.');
        await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${initial.canteenId}::uuid FOR UPDATE`;
        const challenge = await tx.authChallenge.findUniqueOrThrow({ where: { id: challengeId } });
        const code = await tx.canteenAccessCode.findFirst({ where: { canteenId: initial.canteenId, active: true } });
        if (challenge.purpose !== 'CANTEEN_LOGIN' || challenge.email !== remote.email || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.accessCodeVersion !== code?.version) throw new AppError(401, 'CHALLENGE_INVALID', 'This sign-in expired or changed. Start again.');
        if (!remote.authenticationMethods.some(method => ['otp', 'magiclink', 'email/signup'].includes(method.method) && method.timestamp >= Math.floor(challenge.createdAt.getTime() / 1000))) throw new AppError(401, 'FRESH_EMAIL_REQUIRED', 'Use the verification email sent for this canteen sign-in.');
        const existing = await tx.canteenMembership.findUnique({ where: { userId_canteenId: { userId: user.id, canteenId: initial.canteenId } } });
        if (existing?.status === 'REVOKED') throw new AppError(403, 'MEMBERSHIP_REVOKED', 'Your access was removed. Contact an administrator.');
        const member = await tx.canteenMembership.upsert({ where: { userId_canteenId: { userId: user.id, canteenId: initial.canteenId } },
          create: { userId: user.id, canteenId: initial.canteenId, codeVersion: code!.version }, update: { codeVersion: code!.version } });
        await tx.userRole.upsert({ where: { userId_role: { userId: user.id, role: 'CANTEEN' } }, create: { userId: user.id, role: 'CANTEEN' }, update: {} });
        await tx.authChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
        canteenId = initial.canteenId; membershipId = member.id;
      }
      if (previous) await tx.session.updateMany({ where: { tokenHash: hash(`session:${previous}`), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.session.create({ data: { tokenHash: hash(`session:${token}`), userId: user.id, role, canteenId, membershipId, expiresAt: new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000) } });
      return { id: user.id, email: user.email, name: user.name, role, canteenId };
    }, txOptions);
    res.cookie(sessionCookie, token, { ...options, maxAge: config.SESSION_TTL_SECONDS * 1000 });
    res.json(actor);
  });
  router.post('/auth/logout', async (req, res) => {
    const token = cookies(req)[sessionCookie];
    if (token) await db.session.updateMany({ where: { tokenHash: hash(`session:${token}`), revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(sessionCookie, options); res.json({ ok: true });
  });
  router.post('/auth/revoke-sessions', async (req, res) => {
    const remote = await auth.verify(bearer(req));
    await limit(req, 'reset', remote.email);
    await db.session.updateMany({ where: { user: { supabaseSubject: remote.id }, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(sessionCookie, options); res.json({ ok: true });
  });

  async function canteenActor(req: Request, res: Response) {
    const { actor } = await current(req);
    if (actor.role !== 'CANTEEN' || actor.canteenId !== res.locals.params.id) throw new AppError(403, 'CANTEEN_DENIED', 'You can only manage your own canteen.');
    return actor;
  }
  router.get('/canteens/:id/members', validate(idParams, 'params'), validate(pageQuery, 'query'), async (req, res) => {
    const actor = await canteenActor(req, res);
    const { cursor, limit: size } = res.locals.query as { cursor?: string; limit: number };
    const result = await db.$transaction(async tx => {
      const code = await tx.canteenAccessCode.findFirstOrThrow({ where: { canteenId: actor.canteenId!, active: true } });
      const rows = await tx.canteenMembership.findMany({ where: { canteenId: actor.canteenId! }, orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: size + 1, include: { user: { select: { email: true, status: true } },
          sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } } });
      const accessWhere = { canteenId: actor.canteenId!, status: 'ACTIVE' as const, codeVersion: code.version, user: { status: 'ACTIVE' as const } };
      const membersWithAccess = await tx.canteenMembership.count({ where: accessWhere });
      const sessions = await tx.session.findMany({ where: { canteenId: actor.canteenId!, role: 'CANTEEN', revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' }, membership: accessWhere }, select: { userId: true } });
      return { items: rows.slice(0, size).map(row => ({ id: row.id, email: row.user.email, status: row.status, version: row.version,
        sessionCount: row.status === 'ACTIVE' && row.user.status === 'ACTIVE' && row.codeVersion === code.version ? row.sessions.length : 0 })),
        nextCursor: rows.length > size ? rows[size - 1]!.id : null, membersWithAccess, signedInPeople: new Set(sessions.map(s => s.userId)).size, sessionCount: sessions.length };
    }, { ...txOptions, isolationLevel: 'RepeatableRead' });
    res.json(result);
  });
  router.post('/canteens/:id/members/:memberId/revoke', validate(idParams.extend({ memberId: z.uuid() }), 'params'), validate(z.object({ expectedVersion: z.number().int().positive() }).strict()), async (req, res) => {
    const actor = await canteenActor(req, res);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${actor.canteenId}::uuid FOR UPDATE`;
      // Removal and sign-in both lock this canteen, so pending challenges cannot restore access.
      const caller = await tx.canteenMembership.findUnique({ where: { userId_canteenId: { userId: actor.id, canteenId: actor.canteenId! } } });
      const activeCode = await tx.canteenAccessCode.findFirst({ where: { canteenId: actor.canteenId!, active: true } });
      const activeSession = await tx.session.findUnique({ where: { tokenHash: hash(`session:${cookies(req)[sessionCookie] ?? ''}`) } });
      if (caller?.status !== 'ACTIVE' || caller.codeVersion !== activeCode?.version || !activeSession || activeSession.revokedAt || activeSession.expiresAt <= new Date()) throw new AppError(403, 'MEMBERSHIP_REVOKED', 'Your canteen access has ended.');
      const member = await tx.canteenMembership.findFirst({ where: { id: res.locals.params.memberId, canteenId: actor.canteenId! } });
      if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
      if (member.version !== req.body.expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'Member changed. Refresh and retry.');
      const at = new Date();
      await tx.canteenMembership.update({ where: { id: member.id }, data: { status: 'REVOKED', revokedAt: at, revokedBy: actor.id, version: { increment: 1 } } });
      await tx.session.updateMany({ where: { membershipId: member.id, revokedAt: null }, data: { revokedAt: at } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: member.userId } });
      await tx.authChallenge.updateMany({ where: { canteenId: actor.canteenId, email: user.email, consumedAt: null }, data: { consumedAt: at } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'MEMBERSHIP_REVOKED', target: member.id, requestId: res.locals.requestId } });
    }, txOptions);
    res.json({ ok: true });
  });
  async function adminActor(req: Request) {
    const { actor } = await current(req);
    if (actor.role !== 'ADMIN') throw new AppError(403, 'ADMIN_DENIED', 'Administrator access required.');
    return actor;
  }
  router.patch('/admin/memberships/:id', validate(idParams, 'params'), validate(contracts['PATCH /admin/memberships/:id']!.body), async (req, res) => {
    const actor = await adminActor(req);
    await db.$transaction(async tx => {
      const initial = await tx.canteenMembership.findUniqueOrThrow({ where: { id: res.locals.params.id } });
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${initial.canteenId}::uuid FOR UPDATE`;
      const member = await tx.canteenMembership.findUniqueOrThrow({ where: { id: initial.id } });
      if (member.version !== req.body.expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'Membership changed. Refresh and retry.');
      const code = await tx.canteenAccessCode.findFirstOrThrow({ where: { canteenId: member.canteenId, active: true } });
      const active = req.body.status === 'ACTIVE'; const at = new Date();
      await tx.canteenMembership.update({ where: { id: member.id }, data: { status: req.body.status, codeVersion: code.version, version: { increment: 1 },
        ...(active ? { restoredAt: at, restoredBy: actor.id } : { revokedAt: at, revokedBy: actor.id }) } });
      await tx.session.updateMany({ where: { membershipId: member.id, revokedAt: null }, data: { revokedAt: at } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: member.userId } });
      await tx.authChallenge.updateMany({ where: { canteenId: member.canteenId, email: user.email, consumedAt: null }, data: { consumedAt: at } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: active ? 'MEMBERSHIP_RESTORED' : 'MEMBERSHIP_REVOKED', target: member.id, requestId: res.locals.requestId } });
    }, txOptions);
    res.json({ ok: true });
  });
  router.patch('/admin/users/:id', validate(idParams, 'params'), validate(contracts['PATCH /admin/users/:id']!.body), async (req, res) => {
    const actor = await adminActor(req);
    await db.$transaction(async tx => {
      const user = await tx.user.update({ where: { id: res.locals.params.id }, data: { status: req.body.status } });
      if (user.status === 'DISABLED') {
        await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.authChallenge.updateMany({ where: { email: user.email, consumedAt: null }, data: { consumedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { actorId: actor.id, action: user.status === 'DISABLED' ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED', target: user.id, requestId: res.locals.requestId } });
    }, txOptions);
    res.json({ ok: true });
  });
  router.post('/admin/canteens/:id/access-code', validate(idParams, 'params'), validate(contracts['POST /admin/canteens/:id/access-code']!.body), async (req, res) => {
    const actor = await adminActor(req);
    const canteen = await db.canteen.findUniqueOrThrow({ where: { id: res.locals.params.id } });
    await rotateCode(db, config, canteen.slug, req.body.accessCode, { id: actor.id, requestId: res.locals.requestId });
    res.json({ ok: true });
  });
  return router;
}
