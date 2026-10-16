import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
export const pickupFailureLimit = 5;
export const pickupStaffFailureLimit = 20;
export const pickupWindowMs = 10 * 60 * 1000;
const key = (secret: string) => createHmac('sha256', secret).update('spoonate:pickup-code:encryption:v1').digest();
export const generatePickupCode = () => String(randomInt(1, 101));
export function encryptPickupCode(code: string, orderId: string, secret: string) {
  if (!/^(?:[1-9][0-9]?|100)$/.test(code)) throw new Error('Invalid pickup code');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(orderId));
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.');
}
export function decryptPickupCode(value: string, orderId: string, secret: string) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid pickup credential');
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv!);
  cipher.setAAD(Buffer.from(orderId)); cipher.setAuthTag(tag!);
  return Buffer.concat([cipher.update(encrypted!), cipher.final()]).toString('utf8');
}
export function matchesPickupCode(encrypted: string, code: string, orderId: string, secret: string) {
  const expected = Buffer.from(decryptPickupCode(encrypted, orderId, secret));
  const submitted = Buffer.from(code);
  return expected.length === submitted.length && timingSafeEqual(expected, submitted);
}
export async function ensurePickupCredential(tx: Prisma.TransactionClient, orderId: string, secret: string) {
  const existing = await tx.pickupCredential.findUnique({ where: { orderId } });
  if (existing) return existing;
  return tx.pickupCredential.create({ data: { orderId, encryptedCode: encryptPickupCode(generatePickupCode(), orderId, secret) } });
}
export const pickupStaffRateKey = (actorId: string, secret: string) => createHmac('sha256', secret).update(`rate:pickup:staff:${actorId}`).digest('hex');
export const collectionRequestHash = (body: unknown, secret: string) => createHmac('sha256', secret).update('pickup-collection:' + JSON.stringify(body)).digest('hex');
