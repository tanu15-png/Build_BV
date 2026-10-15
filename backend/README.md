# SpoonAte backend

Phase 1 foundation and Phase 2 database/provisioning implementation. Student/staff authentication and ordering handlers remain in later phases. `/api/v1/canteens` exposes a safe directory; `/health/live` checks the process and `/health/ready` checks the database within a deadline. Other business routes return the standard 404 envelope until implemented.

Requires Node.js 24+ and PostgreSQL 17 (or Supabase PostgreSQL).

```bash
cd backend
npm ci
cp .env.example .env
# Generate distinct SESSION_SECRET and OTP_SECRET values and edit .env.
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The compose file provides separate development (5433) and test (5434) databases. Credentials are local examples. Development data is opt-in: set `SEED_DEVELOPMENT_DATA=true` only with `APP_ENV=development` or `test`. Without it, seeding inserts only missing canteen directory entries. Existing names, menus, availability and code hashes are retained. Development sample menus are labeled as samples; real menus require operator input.

```bash
npm test
npm run typecheck
npm run build
# Use a fresh dedicated test database, never the application database.
TEST_DATABASE_URL=postgresql://spoonate:local-only-password@localhost:5434/spoonate_test npm run test:integration
```

The integration suite applies the initial migration and applies deployment again to verify an existing database remains valid, then checks repeatable seeds, constraints, salted hashes, rotation, admin provisioning and directory responses. It inserts fixtures and expects a fresh test database for each run; recreate the test container before rerunning it. It skips when `TEST_DATABASE_URL` is absent. Concurrent order allocation belongs to Phase 7. API response/request schemas for all 37 planned business operations are exported in `src/schemas/contracts.ts`; request IDs and idempotency keys are HTTP headers. The contract fixtures use UUIDs, integer paise, versioned writes and an absolute pickup timestamp. The directory response is `{canteens: [...]}`. Future feature implementations must follow these schemas and validate query/params/body through shared middleware.

Provision secrets interactively, without shell arguments, echoing, or plaintext SQL:

```bash
npm run provision:code
npm run provision:admin
```

Code rotation serializes on the canteen row, increments its version, revokes scoped sessions/pending challenges and records an audit event. Reseeding never restores old codes. Admin provisioning creates a new verified account with a server-assigned admin role; existing email addresses are rejected. Passwords and codes use salted scrypt hashes. No demo admin is seeded. The frontend prototype remains separate until the later API cutover.

The runtime validates environment settings without printing their values. Production/staging require HTTPS, a configured real email provider, distinct secrets and `sslmode=verify-full` database TLS. Development seeds and verification bypasses are forbidden. Email delivery itself is Phase 3 work. Only TEST orders are supported. Worker processing and its startup command are added in Phase 9 alongside the actual worker implementation.

## Supabase deployment qualification

Create separate staging/production projects and supply credentials outside source control. Use a dedicated existing application login with no schema ownership, no superuser access, and no `BYPASSRLS`. Use a separate owner connection in `MIGRATION_DATABASE_URL` for migrations through the direct endpoint or session pool. Prisma 7 uses `@prisma/adapter-pg`; each API process has a maximum of ten connections and bounded connect/query timeouts. Budget those across replicas and workers against the selected Supabase plan before deployment. Transaction-pool mode must be qualified on staging for interactive transactions and prepared statements before selection; local tests do not qualify Supabase pooling.

Migrations enable RLS and revoke browser-role grants on application tables. Disable the Data API if unused. Apply `prisma/application-role.sql` using the owner connection and an existing dedicated application role name to allow server access while keeping `anon` and `authenticated` denied. Store the role's password using the provider's secret management, never this SQL file.

```bash
npm run db:migrate
psql "$MIGRATION_DATABASE_URL" -v app_role=spoonate_app -f prisma/application-role.sql
npm run db:seed
```

Run migrations **before** applying application-role grants; reapply grants when later migrations add tables. Do not run migrations automatically during API startup. Provision production codes and admin accounts through the CLI, then verify `/health/ready`, seed repeatability, interactive transaction commit/rollback, app-role read/write access, browser-role denial, TLS and connection exhaustion on staging. Supabase provisioning and qualification require project access and are not established by local verification.

## Verification recorded 2026-10-14

- `npm test`: 8 tests passed (configuration, HTTP/origin/error/log behavior, readiness deadlines, hashes, body/params/query validation and shared frontend fixtures).
- `npm run typecheck` and `tsc -p tests/tsconfig.json`: passed.
- `npm run build`: passed.
- `npm run test:integration`: passed against an isolated native PostgreSQL runtime with separate development/test databases. The initial migration applied to an empty database and deployment reapplied successfully after operator data changes. Seeds, eight names, hashes, rotation, provisioning, constraints and safe directory responses passed. Docker access was unavailable, so the verification runtime was installed temporarily under `/tmp`; it is not an application dependency.
- Supabase staging/production connectivity, actual least-privilege roles, pooling and production credentials remain unverified and require project access.
