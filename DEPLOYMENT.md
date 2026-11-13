# Deployment

The application has **two frontends** (student and canteen), one Express API, and one durable notification worker. The admin frontend is removed and `/api/v1/admin` is disabled. Do not deploy an admin service or configure an admin host/password.

For Railway, follow [deploy/RAILWAY.md](deploy/RAILWAY.md). Keep one API replica: live catalog/order events are currently published within that process. Run the notification worker as a separate supervised service.

## Build and release

```bash
npm ci
npm run lint
npm test
npm run test:dev
npm run build
npm --prefix backend ci
npm --prefix backend run build
npm --prefix backend test
```

Supply the student's public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` during its build. The canteen frontend uses name-and-code login and needs no Supabase browser credentials. Never put database URLs or backend secrets in `VITE_*` variables.

Publish `apps/student/dist` and `apps/canteen/dist` to separate HTTPS hosts. Both hosts proxy `/api/` to the same private API, preserving the complete path, cookies, Origin and streaming. Static hosts must fall back to index.html for SPA deep links. Serve index.html without persistent caching; hashed assets and versioned posters may be immutable.

Configure backend `FRONTEND_ORIGIN` and `CANTEEN_ORIGIN` with those exact HTTPS origins. `ADMIN_ORIGIN` is no longer required. The supplied Railway frontend proxy forwards the edge's canonical X-Real-IP as a single X-Forwarded-For value; set `TRUST_PROXY_HOPS=1` on the private API. Keep its default `0` for direct/local access. With a different proxy, overwrite forwarded headers and configure the actual trusted ingress topology; do not expose the API directly while trusting caller-controlled headers. See [Railway headers](https://docs.railway.com/networking/public-networking/specs-and-limits) and [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).

Run migrations once as a release step using separate owner credentials; never migrate on API/worker startup. Application connections must use a restricted database role with verified TLS. Reapply [application-role.sql](backend/prisma/application-role.sql) when needed; all 27 application tables require the application role's grants and RLS policies. The new migrations copy existing server-role grants for reward/banner/offer tables.

## Initialize a fresh environment

With development seeds disabled:

1. Apply migrations and restricted-role grants.
2. Run backend `npm run db:seed` to create the single canteen directory entry.
3. Run `npm run provision:member-codes` to initialize the agreed member access code (or its backend `CANTEEN_ACCESS_PASSWORD` override).
4. Preview then import the real menu with `npm run menus:preview` and `npm run menus:import`.
5. Run `npm run banners:seed` after the menu exists to create the three default promotional menus. Existing banners are preserved.
6. Configure rewards, combos and actual discounts through the canteen dashboard. No sample financial discounts are automatically published.

Existing environments retain their menus, rewards, posters, offers, accounts and historical orders; do not reseed/reset data during normal releases.

## Qualification

Run integration tests on a **dedicated local test database**, never the application database:

```bash
cd backend
INTEGRATION_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/spoonate_test_runner npm run test:integration:local
```

The runner creates a fresh database per suite, runs all tests without skipping database suites, and drops only those generated databases afterward. The configured runner database must already exist and its local role must be able to create databases.

Backend `npm run db:check`, `npm run offers:check` and `npm run banners:check` qualify the configured environment. The offer probe rolls back all test writes. Real email verification still requires staging SMTP and Supabase configuration.

Before public launch, verify real student signup/OTP/login/recovery, canteen login, an order through collection, token earning/redemption, offers and banner schedules, mobile layout, proxy streaming/reconnect, and independent logout on the actual HTTPS domains. Confirm backups, restore procedure, worker recovery and connection budgets.

This is a **payment-free TEST ordering release**. It does not charge money. Payment processing and refunds require a separate integration. Sound uses browser audio and needs a normal staff interaction after a fresh page load; browsers may suspend audio in background tabs.

## Verified locally on 2026-11-13

- 137 shared frontend tests, 55 backend tests, 75 database integration checks, and 3 development-launcher checks passed; no database suites skipped.
- Lint, backend compilation/client generation, and both frontend production builds passed.
- Chromium exercised canteen login, desktop/mobile dashboards, matching banner menus, offers filtering, floating cart, discounted checkout, new-order audio, staff collection, token redemption, reward autosave, offer creation and the banner editor. No page exceptions or horizontal mobile overflow were observed.
- All three Docker images built from clean installs. Student, canteen, API and worker containers started successfully. Runtime checks covered SPA deep links, API proxying, streamed events, HttpOnly login/logout, reward reads and poster upload/read. The API runs as the non-root node user and excludes local environment files, tool dependencies and import backups.
- API shutdown completed cleanly with a connected event stream. The configured Supabase database passed migration, encrypted-connection, restricted application-role and RLS/grant checks on all 27 tables. Rollback probes retained no test records.
- A small local menu-read smoke test completed 200 requests with concurrency 20, all HTTP 200, with a measured p95 of 16 ms. This is not a production capacity benchmark.
- Backend dependency audit: zero advisories after compatible patches. Frontend production dependency audit: zero advisories. The remaining development-tool advisories were resolved afterward by consolidating supported ESLint at the workspace root and overriding its glob dependency to patched minimatch 11.0.8; lint and complete dependency audits pass.

Real production secrets, verified database certificate settings, HTTPS domains, Supabase SMTP delivery/recovery links and acceptance on the actual hosting environment still require release configuration. Local container tests used test-only settings and isolated databases. No real orders, menu prices or discounts were changed. This remains a payment-free release.

## Prepared production handoff

Follow [deploy/START-HERE.md](deploy/START-HERE.md). `npm run release:prepare` creates ignored per-service files once, and `npm run release:origins` safely updates the actual website origins without rotating secrets. `npm --prefix backend run release:check` validates their separation, strict TLS and the restricted database role, then checks public Supabase Auth settings without sending email. Public Supabase CA material is packaged under backend/certs. No Railway account is connected from this workspace, so public domains, hosted SMTP/templates and the actual release remain account-owner steps.

Follow-up release verification: all dependency audits now report zero advisories, the release-configuration separation test passes, and all three Docker images build with the final lockfile. The prepared production API image passed read-only readiness/catalog/banner checks using verified database TLS. Prisma migration status also passed with the packaged CA. The production preflight currently flags only the two placeholder website origins; replace them with your generated Railway domains. Hosted SMTP/template/inbox checks and publishing still require your accounts.
