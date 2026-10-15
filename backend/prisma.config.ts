import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node --env-file-if-exists=.env --import tsx src/cli/seed.ts' },
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgresql://localhost:5432/spoonate' },
});
