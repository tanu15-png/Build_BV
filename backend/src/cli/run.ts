import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';
export async function run(action: (db: PrismaClient, config: Config) => Promise<unknown>) {
  let db: PrismaClient | undefined;
  try { const config = loadConfig(); db = createPrisma(config); await action(db, config); }
  catch { console.error('Command failed. Check configuration, unique account/slug, database connectivity and input requirements.'); process.exitCode = 1; }
  finally { await db?.$disconnect(); }
}
