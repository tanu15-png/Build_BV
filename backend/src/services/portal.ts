import type { Request } from 'express';
import type { Config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
export const portals = ['student', 'canteen', 'admin'] as const;
export type Portal = typeof portals[number];
const contexts = new WeakMap<Request, Portal>();
export function setPortal(req: Request, portal: Portal) { contexts.set(req, portal); }
export function requestPortal(req: Request): Portal {
  const portal = contexts.get(req);
  if (!portal) throw new AppError(404, 'PORTAL_REQUIRED', 'Use a portal API address.');
  return portal;
}
export const sessionCookie = (req: Request) => `spoonate_${requestPortal(req)}_session`;
export const csrfCookie = (req: Request) => `spoonate_${requestPortal(req)}_csrf`;
export function portalOrigin(config: Config, portal: Portal) {
  return { student: config.FRONTEND_ORIGIN, canteen: config.CANTEEN_ORIGIN, admin: config.ADMIN_ORIGIN }[portal];
}
export function requirePortalRole(req: Request, role: string) {
  if (requestPortal(req).toUpperCase() !== role) throw new AppError(403, 'PORTAL_ROLE_DENIED', 'Use the correct portal for this account.');
}
