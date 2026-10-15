import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';
export function createPrisma(config: Pick<Config, 'DATABASE_URL' | 'DB_TIMEOUT_MS'> & Partial<Pick<Config, 'DB_POOL_MAX'>>) {
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL, max: config.DB_POOL_MAX ?? 10,
    connectionTimeoutMillis: config.DB_TIMEOUT_MS, query_timeout: config.DB_TIMEOUT_MS,
    statement_timeout: config.DB_TIMEOUT_MS });
  return new PrismaClient({ adapter });
}
