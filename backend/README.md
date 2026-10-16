# SpoonAte backend

Phase 1 foundation, Phase 2 database/provisioning and Supabase Auth integration are implemented. See [AUTH.md](AUTH.md) for verified signup, password login/reset, staff email challenges, cookie sessions, member removal and admin authorization. Catalog, carts, test orders, fulfillment, notifications, pickup verification and admin oversight are implemented; the feature documents below record their verification and deployment steps. `/api/v1/canteens` exposes a safe directory; `/health/live` checks the process and `/health/ready` checks the database within a deadline. Unimplemented business routes return the standard 404 envelope.

Requires Node.js 24+ and PostgreSQL 17 (or Supabase PostgreSQL). For the connected development project, private credential locations, verification commands and remaining operator work, see [SUPABASE.md](SUPABASE.md).

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

The integration suite applies the initial migration and applies deployment again to verify an existing database remains valid, then checks repeatable seeds, constraints, salted hashes, rotation, admin provisioning and directory responses. It inserts fixtures and expects a fresh test database for each run; recreate the test container before rerunning it. It skips when `TEST_DATABASE_URL` is absent. Concurrent order allocation belongs to Phase 7. API response/request schemas for all 50 business operations are exported in `src/schemas/contracts.ts`; request IDs and idempotency keys are HTTP headers. The contract fixtures use UUIDs, integer paise, versioned writes and an absolute pickup timestamp. The directory response is `{canteens: [...]}`. Future feature implementations must follow these schemas and validate query/params/body through shared middleware.

Provision secrets interactively, without shell arguments, echoing, or plaintext SQL:

```bash
npm run provision:code
npm run provision:admin
```

Code rotation serializes on the canteen row, increments its version, revokes scoped sessions/pending challenges and records an audit event. Reseeding never restores old codes. Admin provisioning creates a new verified account with a server-assigned admin role; existing email addresses are rejected. Passwords and codes use salted scrypt hashes. No demo admin is seeded. The frontend prototype remains separate until the later API cutover.

The runtime validates environment settings without printing their values. Production/staging require HTTPS, a configured email provider (`supabase` uses dashboard SMTP), distinct secrets and `sslmode=verify-full` database TLS. Development seeds and verification bypasses are forbidden. Live SMTP/browser acceptance remains pending. Only TEST orders are supported. Worker processing and its startup command are added in Phase 9 alongside the actual worker implementation.

## Supabase deployment qualification

Create separate staging/production projects and supply credentials outside source control. Use a dedicated existing application login with no schema ownership, no superuser access, and no `BYPASSRLS`. Use a separate owner connection in `MIGRATION_DATABASE_URL` for migrations through the direct endpoint or session pool. Prisma 7 uses `@prisma/adapter-pg`; each API process uses `DB_POOL_MAX` connections at most (default ten, configured to five for the connected development project), with bounded connect/query timeouts. Budget those across replicas and workers against the selected Supabase plan before deployment. Transaction-pool mode must be qualified on staging for interactive transactions and prepared statements before selection; local tests do not qualify Supabase pooling.

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
- Supabase setup was subsequently applied to the connected development project; see the 2026-10-15 record below. Production qualification remains pending.

## Supabase verification recorded 2026-10-15

- Seeded all eight canteens with development sample data disabled; provisioned the operator-specified admin and eight initial access codes. Generated passwords/codes are stored only in Git-ignored `.env.provisioned`.
- `npm run provision:initial -- <admin-email> "<admin-name>"` reapplied without rotating existing codes or replacing the admin account.
- `npm run db:check`: passed on the connected Supabase session pool. Verified separate identities, TLS on the client socket, committed migrations, RLS and app CRUD grants on 19 tables, denied browser-role access, no app schema-creation privilege, named prepared statements, transaction commit/CRUD rollback, application-pool exhaustion/recovery, all eight canteens and actual Express health/directory responses. The qualification probe retained no database records.
- `npm test`: nine tests passed, including configurable pool bounds. `npm run typecheck` and `npm run build`: passed.
- Local connections deliberately use the operator-requested `require` mode; full staging/production TLS enforcement is unchanged. Supabase server connection exhaustion, peak load, restoration and Data API dashboard configuration remain pending. Authentication code was subsequently integrated as documented below; live email acceptance and the ordering API cutover remain pending.

## Supabase Auth verification — 2026-10-15

See [AUTH.md](AUTH.md) for the current design, implemented endpoints and dashboard/operator steps. The additive identity-link migration is applied. Public Auth settings and database qualification pass. Fourteen backend unit tests and sixteen isolated PostgreSQL auth-suite cases pass, including OTP-required signup with automatic sign-in, replay rejection and simultaneous member removal/sign-in; the suite mocks Supabase and sends no email. Frontend tests/lint/build and backend build plus application/test TypeScript checks pass. Live OTP-template/inbox delivery and manual browser role flows remain operator verification.

## Categories, menus and carts

See [CATALOG.md](CATALOG.md) for the implemented Phase 5–6 APIs, migration, menu workflow, cart/quote rules and isolated tests. Staff enter confirmed canteen data through Manage menu. Transactional order placement and fulfillment are now implemented; see ORDERS.md.

## Transactional test orders and fulfillment

Phases 7–8 implement persistent checkout and scoped accept/prepare/ready commands. See [ORDERS.md](ORDERS.md) for locking, idempotency, daily-code allocation, API contracts and verification. Run test:orders against a fresh local ORDER_TEST_DATABASE_URL; orders:check performs a rolled-back live database/handler probe. Phase 9 durable notification processing is implemented; Phase 10 collection verification is implemented with a separate private numeric READY code. See [PICKUP.md](PICKUP.md) for migration, attempt limits, APIs and verification. See [NOTIFICATIONS.md](NOTIFICATIONS.md) for worker startup, scoped APIs, read state and crash/retry verification.

## Admin oversight

Phase 11 adds full-history campus aggregates, paginated order search and audited account, membership, canteen/menu and join-code maintenance. See [ADMIN.md](ADMIN.md) for APIs, authorization, synchronization, migration and test evidence. Run `test:admin` with a fresh local `ADMIN_TEST_DATABASE_URL`. Admins retain read-only fulfillment access.
