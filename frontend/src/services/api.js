let csrfToken;
export class ApiError extends Error {
  constructor(message, status, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export async function api(path, { method = 'GET', body, token, signal, idempotencyKey } = {}, retry = true) {
  if (method !== 'GET' && !csrfToken) csrfToken = (await api('/auth/csrf')).csrfToken;
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method, credentials: 'include', cache: 'no-store', signal: signal || AbortSignal.timeout(20000),
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new ApiError('Unable to reach SpoonAte. Check your connection and retry.', 503, 'NETWORK_ERROR'); }
  const result = await response.json().catch(() => null);
  if (result?.error?.code === 'CSRF_INVALID' && retry) {
    csrfToken = undefined;
    return api(path, { method, body, token, signal, idempotencyKey }, false);
  }
  if (!response.ok) throw new ApiError(result?.error?.message || 'Request failed. Please retry.', response.status, result?.error?.code, result?.error?.details);
  return result;
}
