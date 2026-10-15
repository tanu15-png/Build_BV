import { z } from 'zod';
const databaseUrl = z.string().url().refine(v => /^postgres(ql)?:/.test(v), 'Expected PostgreSQL URL');
const flag = z.enum(['true', 'false']).default('false').transform(v => v === 'true');
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: databaseUrl,
  MIGRATION_DATABASE_URL: databaseUrl.optional(),
  SUPABASE_URL: z.url().refine(v => v.startsWith('https://') && new URL(v).origin === v, 'Expected HTTPS project origin').optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20).refine(v => v.startsWith('sb_publishable_'), 'Expected publishable key, never a secret key').optional(),
  FRONTEND_ORIGIN: z.url().refine(v => new URL(v).origin === v, 'Expected origin without path'),
  ORDER_MODE: z.literal('TEST').default('TEST'),
  SEED_DEVELOPMENT_DATA: flag,
  EMAIL_VERIFICATION_BYPASS: z.literal('false').default('false'),
  SESSION_SECRET: z.string().min(32),
  OTP_SECRET: z.string().min(32),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43200),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().max(900).default(600),
  JSON_LIMIT_BYTES: z.coerce.number().int().min(1024).max(1048576).default(102400),
  DB_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  EMAIL_PROVIDER: z.enum(['console', 'http', 'supabase']).default('console'),
  EMAIL_API_URL: z.url().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email().optional(),
  LOG_LEVEL: z.enum(['info', 'silent']).default('info'),
}).superRefine((v, ctx) => {
  if (Boolean(v.SUPABASE_URL) !== Boolean(v.SUPABASE_PUBLISHABLE_KEY) || (v.EMAIL_PROVIDER === 'supabase' && !v.SUPABASE_URL)) {
    ctx.addIssue({ code: 'custom', message: 'Supabase requires project URL and publishable key together' });
  }
  const deployed = ['staging', 'production'].includes(v.APP_ENV) || v.NODE_ENV === 'production';
  if (deployed && !v.SUPABASE_URL) ctx.addIssue({ code: 'custom', message: 'Deployed environments require Supabase Auth configuration' });
  if (deployed && (v.SEED_DEVELOPMENT_DATA || v.EMAIL_PROVIDER === 'console' || !v.FRONTEND_ORIGIN.startsWith('https://'))) {
    ctx.addIssue({ code: 'custom', message: 'Deployed environments require HTTPS, real email and disabled development seeds' });
  }
  if (v.EMAIL_PROVIDER === 'http' && (!v.EMAIL_API_URL?.startsWith('https://') || !v.EMAIL_API_KEY || !v.EMAIL_FROM)) {
    ctx.addIssue({ code: 'custom', message: 'HTTP email requires HTTPS URL, API key and sender' });
  }
  if (deployed && (new URL(v.DATABASE_URL).searchParams.get('sslmode') !== 'verify-full' || v.SESSION_SECRET === v.OTP_SECRET || [v.SESSION_SECRET, v.OTP_SECRET].some(secret => secret.startsWith('replace-')))) {
    ctx.addIssue({ code: 'custom', message: 'Deployed environments require verified database TLS and distinct secrets' });
  }
});
export type Config = z.infer<typeof envSchema>;
export function loadConfig(input: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment configuration: ${result.error.issues.map(i => i.path.join('.') || 'deployment policy').join(', ')}`);
  return result.data;
}
