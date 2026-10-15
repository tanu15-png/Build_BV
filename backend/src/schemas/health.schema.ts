import { z } from 'zod';
export const healthResponseSchema = z.discriminatedUnion('status', [
  z.object({ ok: z.literal(true), status: z.literal('alive') }).strict(),
  z.object({ ok: z.literal(true), status: z.literal('ready') }).strict(),
  z.object({ ok: z.literal(false), status: z.literal('not_ready') }).strict(),
]);
