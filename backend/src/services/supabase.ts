import { z } from 'zod';
import type { Config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const verifiedUser = z.object({
  id: z.uuid(), email: z.email(), email_confirmed_at: z.string().min(1),
  is_anonymous: z.boolean().optional(), user_metadata: z.record(z.string(), z.unknown()).optional(),
});
export type VerifiedUser = z.infer<typeof verifiedUser> & { authenticationMethods: Array<{ method: string; timestamp: number }> };
export function supabaseAuth(config: Config, fetcher: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit) {
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured.');
    let response: Response;
    try {
      response = await fetcher(`${config.SUPABASE_URL}/auth/v1${path}`, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...init.headers },
      });
    } catch { throw new AppError(503, 'AUTH_UNAVAILABLE', 'Unable to contact authentication. Please retry.'); }
    if (!response.ok) {
      if (response.status === 429) throw new AppError(429, 'AUTH_RATE_LIMITED', 'Please wait before trying again.');
      if (response.status >= 500) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
      throw new AppError(401, 'AUTH_REJECTED', 'Authentication could not be verified. Sign in again.');
    }
    return response;
  }
  return {
    async verifySignup(email: string, code: string): Promise<string> {
      let response: Response;
      try { response = await request('/verify', { method: 'POST', body: JSON.stringify({ type: 'signup', email, token: code }) }); }
      catch (error) {
        if (error instanceof AppError && error.status === 401) throw new AppError(401, 'OTP_INVALID', 'The OTP is invalid or expired. Request a new code.');
        throw error;
      }
      let value: unknown;
      try { value = await response.json(); } catch { throw new AppError(503, 'AUTH_UNAVAILABLE', 'Invalid authentication service response.'); }
      const parsed = z.object({ access_token: z.string().min(20) }).safeParse(value);
      if (!parsed.success) throw new AppError(401, 'OTP_INVALID', 'Email verification could not be completed. Request a new code.');
      return parsed.data.access_token;
    },
    async verify(token: string): Promise<VerifiedUser> {
      const response = await request('/user', { headers: { Authorization: `Bearer ${token}` } });
      let value: unknown;
      try { value = await response.json(); } catch { throw new AppError(503, 'AUTH_UNAVAILABLE', 'Invalid authentication service response.'); }
      const parsed = verifiedUser.safeParse(value);
      if (!parsed.success || parsed.data.is_anonymous) throw new AppError(401, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
      // Claims are consulted only after Supabase has verified this exact token.
      const claimsSchema = z.object({ sub: z.uuid(), amr: z.array(z.object({ method: z.string(), timestamp: z.number().int() })).default([]) });
      let claims;
      try { claims = claimsSchema.parse(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())); }
      catch { throw new AppError(401, 'AUTH_REJECTED', 'Invalid authentication token.'); }
      if (claims.sub !== parsed.data.id) throw new AppError(401, 'AUTH_REJECTED', 'Invalid authentication identity.');
      return { ...parsed.data, email: parsed.data.email.toLowerCase(), authenticationMethods: claims.amr };
    },
    async activateAdmin(email: string, password: string, name: string) {
      await request(`/signup?redirect_to=${encodeURIComponent(`${config.FRONTEND_ORIGIN}/auth/callback?flow=admin-signup`)}`, {
        method: 'POST', body: JSON.stringify({ email, password, data: { name } }),
      });
    },
  };
}
