import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Config } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
export const cartInclude = { canteen: true, items: { orderBy: { id: 'asc' as const }, include: { menuItem: { include: { category: true } } } } } satisfies Prisma.CartInclude;
type LoadedCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
export function cartResponse(cart: LoadedCart, config: Config) {
  const canteenAvailable = Boolean(cart.canteen?.operational && cart.canteen.acceptingOrders);
  const items = cart.items.map(line => ({ id: line.id, menuItemId: line.menuItemId, canteenId: line.canteenId,
    name: line.menuItem.name, quantity: line.quantity, unitPricePaise: line.menuItem.pricePaise,
    categoryId: line.menuItem.categoryId, category: line.menuItem.category.name,
    description: line.menuItem.description, imageRef: line.menuItem.imageRef, menuVersion: line.menuItem.version,
    available: canteenAvailable && line.menuItem.available && !line.menuItem.archived && !line.menuItem.category.archived,
    archived: line.menuItem.archived }));
  const totalPaise = items.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);
  const snapshot = { id: cart.id, canteenId: cart.canteenId, version: cart.version, items, totalPaise,
    available: items.length > 0 && items.every(line => line.available) };
  const digest = createHash('sha256').update(JSON.stringify({ ...snapshot, canteenVersion: cart.canteen?.version,
    categories: cart.items.map(line => line.menuItem.category.version) })).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const payload = Buffer.from(JSON.stringify({ cartId: cart.id, studentId: cart.studentId, version: cart.version, digest, expiresAt })).toString('base64url');
  const signature = createHmac('sha256', config.SESSION_SECRET).update(`cart-quote:${payload}`).digest('base64url');
  return { ...snapshot, quote: `${payload}.${signature}`, quoteExpiresAt: expiresAt };
}
export function verifyCartQuote(quote: string, current: ReturnType<typeof cartResponse>, studentId: string, config: Config) {
  try {
    const [payload, signature, extra] = quote.split('.');
    if (!payload || !signature || extra) throw new Error();
    const wanted = createHmac('sha256', config.SESSION_SECRET).update(`cart-quote:${payload}`).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (wanted.length !== supplied.length || !timingSafeEqual(wanted, supplied)) throw new Error();
    const original = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const fresh = JSON.parse(Buffer.from(current.quote.split('.')[0]!, 'base64url').toString());
    if (original.studentId !== studentId || original.cartId !== current.id || original.version !== current.version ||
      original.digest !== fresh.digest || !Number.isFinite(Date.parse(original.expiresAt)) || Date.parse(original.expiresAt) <= Date.now()) throw new Error();
  } catch { throw new AppError(409, 'QUOTE_CHANGED', 'Your cart, menu or price review changed or expired. Review the updated cart.', { cart: current }); }
  if (current.totalPaise > 2147483647) throw new AppError(409, 'CART_LIMIT', 'Cart total is too large to order. Remove some items.', { cart: current });
  if (!current.available) throw new AppError(409, 'CART_UNAVAILABLE', 'Some items or this canteen are unavailable. Remove unavailable items or try again later.', { cart: current });
}
