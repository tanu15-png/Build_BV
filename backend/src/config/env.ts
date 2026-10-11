import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),

  DATABASE_URL: z.string().min(1),

  FRONTEND_ORIGIN: z.string().min(1),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;