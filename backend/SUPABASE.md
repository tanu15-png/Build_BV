# Supabase setup and remaining operator work

The connected project is designated for development/staging. React calls Express; Express uses Prisma and the dedicated `spoonate_app` database login. `MIGRATION_DATABASE_URL` uses the separate owner login. Database credentials are server-only and must never appear in `VITE_*` variables.

## Local commands

From `backend`, with the existing private `.env`:

```bash
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev
```

`db:check` checks committed migrations, separate database identities, the application-to-pooler TLS socket, grants/RLS on all application tables, browser-role denial, prepared statements, interactive transaction commit/rollback, bounded application-pool exhaustion/recovery, the eight canteens and real Express readiness/directory responses. The CRUD probe rolls back and leaves no records. It opens a temporary local HTTP port and shuts it down when finished. It needs owner credentials to inspect migration/security state. It does not qualify production load, daily pickup-code races or Supabase service quotas.

To provision a fresh environment:

```bash
npm run provision:initial -- admin@example.edu "Admin Name"
```

This seeds missing canteens, creates a new admin and initial access codes only when absent, and preserves existing credentials. Newly generated secrets are written before database provisioning to `.env.provisioned`, which is ignored by Git. A retry reuses saved secrets; it does not reset an existing admin password or rotate active codes. Existing non-admin accounts are never promoted by this command. Keep the file private and transfer credentials through your password manager. For deliberate rotations or another admin, use the existing interactive `provision:code` and `provision:admin` commands.

## Current development settings

- Session pooler on port 5432; committed initial migration applied.
- `SEED_DEVELOPMENT_DATA=false`: directory only, with no sample menus or demo passwords.
- Runtime `DB_POOL_MAX=5`. Budget `API replicas × pool max + worker pools + deployment overlap + operational/migration headroom` against the selected Supabase connection limits. The qualification command adds two temporary one-connection pools.
- Runtime `DB_TIMEOUT_MS=10000` for the remote connection. The previous default is two seconds; configure timeouts for the actual hosting region after measurement.
- Distinct random session and OTP secrets are stored in `.env`.
- At the user's request, local URLs use `sslmode=require`, with `uselibpqcompat=true` on the `pg` application connection. This encrypts the connection without authenticating the server certificate. It does not satisfy the existing staging/production `verify-full` validation. Keep `APP_ENV=development` for local testing. Switching to deployed staging needs verified TLS, HTTPS frontend origin and a real email configuration.

## What the operator needs to do

1. Open `backend/.env.provisioned` privately and save the admin password and eight canteen codes in a password manager. Use the admin first-activation and staff login flows documented in [AUTH.md](AUTH.md).
2. In the Supabase dashboard, disable the unused Data API. Table-level grants and RLS are checked separately by `db:check`; turning off the API requires dashboard/management access.
3. Supply confirmed canteen menus, prices, locations and hours. Production-style seeding intentionally does not invent menu data.
4. Configure Supabase Auth custom SMTP and callback URLs as documented in [AUTH.md](AUTH.md). Gmail SMTP is selected for development; real inbox acceptance and production sending quotas remain operator work. SMTP credentials belong in the dashboard, not application environment files.
5. Before a production release, create a separate production project, select region/compute, configure backups/PITR and monitoring, and supply its separate credentials through hosting secret management. Do not reuse the development project for production.
6. Choose API/frontend hosting and domains. API and the future outbox worker need separate deployment configuration; the worker is implemented in Phase 9. A production deployment needs verified TLS and HTTPS.
7. Qualify restoration, rolling-deployment connection budgets, full load and cross-device role flows before rollout.

## Remaining implementation

Supabase Auth signup/login/reset, application cookie sessions/CSRF, staff membership authorization and admin activation are now implemented; live SMTP/browser acceptance remains pending. Persistent carts, order-code allocation, orders, status changes and outbox processing remain later phases. Authentication and member UI use the API; the full ordering data cutover is Phase 12. Storage/Realtime remain separate optional decisions.
