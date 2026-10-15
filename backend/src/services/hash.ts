import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export async function hashSecret(secret: string) {
  if (!secret || secret.length > 256) throw new Error('Secret must contain 1 to 256 characters');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(secret, salt, 64) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifySecret(secret: string, encoded: string) {
  if (!secret || secret.length > 256) return false;
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]!) || !/^[a-f0-9]{128}$/.test(parts[2]!)) return false;
  const actual = await scrypt(secret, parts[1]!, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(parts[2]!, 'hex'));
}
