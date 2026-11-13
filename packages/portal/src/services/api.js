import { apiBase } from '../portal.js';
import { createReadCache } from './readCache.js';
let csrfToken;
const reads = createReadCache();
const listeners = new Set();
let scope = '';
export function setApiCacheScope(next) {
  if (scope !== next) { reads.invalidate(); scope = next; }
}
const cacheKey = path => ['/catalog','/banners'].includes(path) ? `menu:${path}` : `${scope}:${path}`;
export const peekApiCache = path => reads.peek(cacheKey(path));
export function invalidateApiReads() {
  reads.invalidate();
  for (const listener of listeners) listener();
}
export function subscribeApiReads(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function api(path, options = {}, retry = true) {
  const cached = (options.method || 'GET') === 'GET' && (['/catalog','/banners'].includes(path) || (scope && (['/rewards','/banners/manage','/offers/manage'].includes(path) || /\/menu\/manage$/.test(path))));
  if (cached) return reads.get(cacheKey(path), () => request(path, options, retry), path.startsWith('/banners') ? 5000 : path === '/rewards' ? 15000 : 60000, options.fresh);
  return request(path, options, retry);
}
export class ApiError extends Error {
  constructor(message, status, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
async function request(path, { method = 'GET', body, token, signal, idempotencyKey, fresh = false } = {}, retry = true) {
  if (method !== 'GET' && !csrfToken) csrfToken = (await api('/auth/csrf')).csrfToken;
  const binary = typeof Blob !== 'undefined' && body instanceof Blob;
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method, credentials: 'include', cache: 'no-store', signal: signal || AbortSignal.timeout(20000),
      headers: { ...(fresh ? { 'Cache-Control': 'no-cache' } : {}), ...(body !== undefined ? { 'Content-Type': binary ? body.type : 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: binary ? body : JSON.stringify(body) } : {}),
    });
  } catch (issue) {
    if (issue?.name === 'TimeoutError') throw new ApiError('SpoonAte took too long to respond. Please retry.', 504, 'REQUEST_TIMEOUT');
    throw new ApiError('Unable to reach SpoonAte. Check your connection and retry.', 503, 'NETWORK_ERROR');
  }
  const result = await response.json().catch(() => null);
  if (result?.error?.code === 'CSRF_INVALID' && retry) {
    csrfToken = undefined;
    return api(path, { method, body, token, signal, idempotencyKey }, false);
  }
  if (!response.ok) throw new ApiError(result?.error?.message || 'Request failed. Please retry.', response.status, result?.error?.code, result?.error?.details);
  if (method !== 'GET' && /^\/(?:menu-|canteens\/|rewards|orders|banners|offers)/.test(path)) invalidateApiReads();
  return result;
}
