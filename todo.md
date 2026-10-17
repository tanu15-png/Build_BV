# SpoonAte implementation checklist

Last checked: 2026-10-16. Backend phase audit and verification are recorded in backend/README.md; Supabase setup and operator actions are recorded in backend/SUPABASE.md; historical frontend checks remain dated below.

`[x]` means implemented in the stated scope or verified; `[ ]` means remaining work. Historical frontend checks describe the earlier browser prototype. The backend now contains the foundation, database/provisioning and Supabase Auth integration; menus, categories, availability and carts use server APIs; checkout and accept/prepare/ready now use server APIs; historical browser orders are ignored. Student signup/password login were reported working by the operator; broader staff/admin/browser acceptance and production deployment qualification remain pending.

Backend stack: **TypeScript + Node.js + Express + Zod + Prisma + PostgreSQL**. Keep dependencies minimal and use Node.js built-ins where practical. Follow [backend/backend.md](backend/backend.md) for endpoint contracts, business rules, phase dependencies and acceptance criteria.

Database hosting: **Supabase-managed PostgreSQL**, following [scale.md](scale.md). Supabase Auth now manages passwords, email verification and recovery. Express verifies Auth tokens, issues revocable opaque cookie sessions, and enforces application roles/canteen memberships through Prisma. See [backend/AUTH.md](backend/AUTH.md) for the adopted authentication revision, tests and remaining live-email/dashboard acceptance.

## Supabase integration - connected development project

- [x] Apply all three committed migrations (initial schema, Supabase identity binding and menu categories) to the connected development project using separate owner credentials.
- [x] Add server-only database/Auth environment variables and documented placeholders; keep local credentials Git-ignored and expose only the Auth publishable key to Vite.
- [x] Configure the dedicated application role, application-table RLS/grants and server-only connection URLs; use session pooling on port 5432.
- [x] Seed all eight canteens without demo menus or browser account imports; generate separate backend session/OTP secrets.
- [x] Provision the operator-specified admin and initial canteen access codes; save generated credentials in Git-ignored backend/.env.provisioned without printing passwords.
- [x] Add repeatable `db:check` and `provision:initial` commands, plus a configurable bounded application pool.
- [x] Verify the connected session pool: encrypted application connection, applied migrations, restricted grants/RLS on all 20 tables, browser-role denial, named prepared statements, interactive commit/rollback, bounded application-pool timeout/recovery and real Express health/directory responses.
- [x] Re-run initial provisioning and confirm the existing admin and all eight active canteen codes are preserved.

Scope: this is development setup using the requested encrypted `sslmode=require` connection. The full staging/production TLS, load, restore and application-feature requirements below remain release work. See [backend/SUPABASE.md](backend/SUPABASE.md).

## Supabase integration - remaining work

- [ ] Create separate Supabase staging and production projects; select region, paid production plan, compute and recovery options using the requirements and load tests in scale.md.
- [ ] Configure and qualify verified TLS and separate server-only credentials for deployed staging/production; development uses the requested encrypted `require` mode.
- [ ] Confirm the unused Supabase Data API is disabled in the dashboard. Dedicated application/migration roles, table grants/RLS and browser-role denial are implemented and verified for the connected development project.
- [ ] Qualify production hosting/pooling against the pinned Prisma version and selected resources; development session-pool connectivity, prepared statements and interactive transactions are verified.
- [ ] Budget pooled and PostgreSQL connections across API replicas, workers, deployments and migration tools; leave operational headroom and test connection exhaustion behavior.
- [ ] Apply committed Prisma migrations to staging and production; create users, password hashes, email challenges, sessions, canteen memberships, menus, carts, orders, daily code allocations, notifications and outbox tables.
- [ ] Enforce campus-wide daily code uniqueness with UNIQUE(code_day, code), derive Asia/Kolkata dates from server time, and test simultaneous allocations, collision retries, midnight renewal and daily exhaustion on Supabase PostgreSQL.
- [ ] Seed the eight canteens and provision production access-code hashes and admin credentials without importing browser passwords or overwriting existing operator-managed data.
- [ ] Complete live email/browser acceptance for the implemented Supabase signup/login, staff verification, scoped memberships, shared counts and atomic member/session revocation. See backend/AUTH.md for the implemented code and provider limits.
- [ ] Connect a production email provider for signup, canteen-login and password-reset OTPs; configure verified sending identity, delivery monitoring, expiry/resend controls and quotas for campus onboarding bursts.
- [ ] Deploy Express and the durable outbox worker on separately selected hosting; configure their Supabase connections, secrets, health checks and startup/shutdown behavior.
- [ ] Complete durable notification APIs/worker and live cross-device browser acceptance. Authentication, memberships, menus, carts, orders and accept/prepare/ready now use the backend.
- [ ] Enable the required database backups/PITR and monitoring; test restoration, migrations, outages, query performance and peak-load scenarios before campus rollout.
- [ ] Evaluate Supabase Storage for menu images and Supabase Realtime for status updates only when those features are needed; define access policies and load-test quotas before adopting either.

## Historical documentation and frontend prototype

The auth/account/member browser-storage entries below record the original prototype. They are superseded by the Supabase Auth implementation in Phases 3/4; old plaintext identity storage is removed on startup. Ordering remains a browser prototype.

- [x] Document product requirements, existing architecture and payment-free testing policy in README.md and architecture.md.
- [x] Define backend stack, planned folder structure, frontend endpoint mappings and 13 implementation phases in backend/backend.md.
- [x] Set up React/Vite, React Router, Tailwind CSS and Lucide React.
- [x] Add student, canteen and admin route guards and logout (frontend checks only).
- [x] Implement prototype student signup with name, exact @banasthali.in domain validation and password, and registered-email/password login. Signup returns to login without creating a session; email ownership is not yet verified.
- [x] Implement canteen login with member email, selected canteen and matching development access code.
- [x] Add a browser-local canteen member panel with emails, valid signed-in counts, confirmed removal, session revocation and blocked rejoining. Real email OTP and cross-device enforcement remain backend work.
- [x] Implement demo admin login and campus overview.
- [x] Include all eight canteens, including Bella Bite, with separate sample menus.
- [x] Implement student directory, menu browsing, cart, checkout, success, history, tracking, notifications and profile screens.
- [x] Enforce a single-canteen cart, quantity changes, item removal and explicit cart clearing.
- [x] Check canteen/item availability on additions, quantity increases and checkout; use current menu prices at submission.
- [x] Offer estimated pickup in 10, 20, 30, 45 or 60 minutes; store an absolute timestamp and display pickup date/time in IST.
- [x] Submit payment-free orders with permanent UUIDs and three-character codes unique within the campus allocation day; renew at Asia/Kolkata midnight and handle local daily exhaustion.
- [x] Implement RECEIVED -> ACCEPTED -> PREPARING -> READY -> COLLECTED with consecutive transitions.
- [x] Add canteen dashboard, order list/details, incoming-order pause/resume and item availability controls.
- [x] Verify the student's pickup code before collection and record verifier/time.
- [x] Derive acceptance/readiness notifications from locally persisted order history.
- [x] Filter local orders by student/canteen; give demo admins campus-wide visibility.
- [x] Add admin canteen summaries, order search, canteen/status filters and collected test order value.
- [x] Persist accounts, memberships, staff sessions, carts, orders and availability in localStorage; synchronize same-origin tabs; keep login in sessionStorage.
- [x] Keep payment disabled and omit cancellation/refund actions.

Evidence: frontend/src/App.jsx, context/AuthContext.jsx, context/OrderContext.jsx, hooks/usePersistentState.js, utils/authRules.js, utils/orderRules.js, data/mockData.js and the routed pages.

## Verification completed

- [x] Frontend tests (32), lint and build: passed on 2026-10-15, including auth, category/price mapping and historical order rules.
- [x] Backend `npm test`: 14 tests passed; isolated PostgreSQL `test:auth`: 16 cases passed on 2026-10-15, including OTP signup with immediate sign-in and replay rejection (mocked Supabase, no emails sent).
- [x] Backend source/test TypeScript checks and production build: passed on 2026-10-15.
- [x] Live `auth:check` and `db:check`: passed for the connected development project on 2026-10-15.
- [ ] Perform and record browser acceptance testing across student, canteen and admin profiles, including mobile layouts, keyboard navigation and refresh/reconnect behavior.

Verification scope: frontend rules/lint/build, backend auth/authorization against isolated PostgreSQL, and live development database security/connectivity/public Auth settings. Live inbox/callback/browser behavior, cross-device order synchronization and production capacity remain unverified.

## Phase 1 - Backend foundation and contracts

- [x] Create backend/package.json, lockfile, strict TypeScript configuration and build/start/development/test scripts.
- [x] Create Express app factory, server entry point, module Routers and shared Prisma client.
- [x] Add Zod environment/body/params/query validation and response contracts aligned with frontend screens.
- [x] Add .env.example, bounded JSON parsing, request IDs, redacted logs and the documented error envelope.
- [x] Implement /health/live and /health/ready, origin handling and the frontend development API proxy.
- [x] Provide isolated PostgreSQL development/test setup and document local commands.
- [x] Verify startup, invalid configuration, health checks and contract fixtures.

## Phase 2 - Database and provisioning

- [x] Implement Prisma models, relations, constraints and indexes from the backend plan, including shared rate-limit storage.
- [x] Generate committed migrations; test empty-database and existing populated-database application.
- [x] Seed the eight stable canteen slugs and development menus without overwriting operator-managed data.
- [x] Add canteen-code provisioning/rotation using salted scrypt hashes and an admin provisioning CLI.
- [x] Block development codes and authentication bypasses in production; never seed the bundled demo admin password.

- [x] Qualify the connected development project's separate database roles, encrypted session pool, prepared statements and interactive transactions.
- [ ] Qualify deployed staging/production projects, verified TLS and production connection/load/recovery budgets.

Verification (2026-10-14): backend unit/HTTP/contract checks **8 passed**; native PostgreSQL migration/seed/provisioning integration suite **passed**; source/test type checks and backend production build **passed**.

Phase 1/2 deployment dependency: production project/credentials, verified TLS, load/recovery qualification and production provisioning require operator setup. Development Supabase integration and authentication code are implemented; live email/browser acceptance and the remaining ordering API cutover are pending. See [backend/README.md](backend/README.md).

## Phase 3 - Student authentication

- [x] Require student signup email OTP, verify the code on the server, activate the institutional profile and sign in immediately. Subsequent login uses email/password only; forgot password appears on login, and resend appears only on verification.
- [x] Bind verified Supabase subjects uniquely while preserving existing application UUIDs. Let Supabase manage student passwords; never import prototype passwords.
- [x] Remove plaintext student accounts and prototype identity/member/session records from browser storage on startup.
- [x] Implement hashed opaque cookie sessions, /auth/me, logout, absolute expiry and revocation, plus origin/signed-CSRF checks and shared application rate limits.
- [x] Verify configured project/key and live public Auth settings: email signup enabled and confirmation required; no test email sent.
- [x] Test unverified/domain/role denial, subject-binding conflicts, OTP-required signup with automatic session creation, cookie/CSRF/origin checks, recovery revocation, account disabling and redacted provider failure mapping.
- [ ] Apply the OTP-only Confirm sign up template from backend/email-templates/confirm-signup.html in the Supabase dashboard; then verify real code delivery and signup-to-dashboard behavior.
- [ ] Complete real inbox/callback/browser acceptance, including wrong passwords, unknown-email reset, expired/wrong/replayed OTPs, resend invalidation, concurrent Supabase signup and delivery outages. Configure production sending quotas/abuse controls; application tests mock Supabase rather than proving provider behavior.

## Phase 4 - Staff and admin authorization

- [x] Integrate fresh Supabase staff email verification, separate from the canteen access code and order pickup code.
- [x] Bind ten-minute staff challenges to email, canteen and access-code version; consume once under the canteen lock after a fresh email-authentication proof. Reject stale/password-only proofs and revoked memberships.
- [x] Recheck account status, server role, canteen scope, membership and code version on authenticated staff requests.
- [x] Implement provisioned-admin activation/verified identity binding and password login; ignore client metadata when assigning permissions.
- [x] Add paginated own-canteen members, distinct-person/session counts, versioned removal and frontend integration.
- [x] Atomically revoke scoped membership/sessions/pending challenges with audit records; block rejoining until explicit admin restoration and preserve unrelated memberships/history.
- [x] Add audited admin account enable/disable, membership restore/revoke and access-code rotation APIs.
- [x] Test forged roles, cross-canteen denial, stale/replayed challenges, code rotation, shared counts, removal-versus-login concurrency, restoration, scoped preservation and CSRF/rate limits against isolated PostgreSQL.
- [ ] Complete real staff/admin email/browser acceptance and concurrent rotation scenarios on Supabase. Build dedicated admin maintenance controls when that UI is implemented.

- [x] Apply the category migration to development Supabase and rerun db:check: restricted role, RLS/browser denial on 20 tables, prepared statements, bounded pool, interactive transactions and live directory/catalog contracts pass.

## Phase 5 - Catalog, menus and availability

- [x] Implement the database-backed public canteen directory (`GET /api/v1/canteens`).
- [x] Implement menu reads and own-canteen item create/edit/archive endpoints.
- [x] Implement explicit canteen and item availability updates with version conflicts.
- [x] Validate integer-paise prices and preserve historical order snapshots.
- [ ] Replace sample menus, locations and hours with confirmed canteen-supplied data before real use.
- [x] Test ownership, stale updates and pause behavior without blocking existing fulfillment.

- [x] Add canteen-owned categories with case-insensitive unique names, rename/archive/restore and category-scoped items.
- [x] Let staff enter pickup location and opening hours through Manage menu.

## Phase 6 - Persistent carts

- [x] Implement server cart read/add/edit/remove/clear endpoints scoped to the authenticated student.
- [x] Enforce single-canteen contents transactionally, quantity bounds and availability checks.
- [x] Return cart-line IDs, versions, current totals and a server-verifiable price quote.
- [x] Allow unavailable-item removal and reject stale checkout reviews with an updated summary.
- [x] Test simultaneous device updates, cart restoration and mixed-canteen conflicts.

Student menus/carts now use server records with polling, focus/reconnect refresh, loading/errors and conflict recovery. Legacy local carts/availability are discarded. Checkout performs a server review; checkout and accept/prepare/ready now use server APIs.

- [x] Verify category/cart integration against isolated PostgreSQL: 12 suite cases including concurrent updates, ownership, stale/forged/expired quotes, archive/restore, pause behavior and oversized-cart removal.
- [x] Recheck authentication (16 suite cases), schema/provisioning (1 suite), backend unit tests (14), TypeScript checks and production builds; verify populated legacy category backfill.

## Phase 7 - Transactional test orders

- [x] Implement checkout with pickup timestamp validation and actor-scoped idempotency keys.
- [x] Lock/revalidate cart, canteen, items and quote in a Prisma transaction.
- [x] Allocate pickup codes using server-derived Asia/Kolkata codeDay and UNIQUE(code_day, code) across all canteens/statuses; detect daily exhaustion.
- [x] Atomically create order/item snapshots/history/outbox records, clear the cart and save the retry response.
- [x] Test double submits, lost responses, price/availability races, daily collisions/exhaustion, midnight reuse, late pickup and rollback behavior.

## Phase 8 - Fulfillment transitions

- [x] Implement own-canteen accept, prepare and ready command endpoints.
- [x] Enforce consecutive state transitions, expected versions and idempotent command retries.
- [x] Write status, actor/time, history and outbox events atomically.
- [x] Verify concurrent staff updates and fulfillment after incoming orders are paused.

- [x] Verify order integration with 17 isolated PostgreSQL cases, including real full-day code exhaustion, checkout/menu races, staff races and order/fulfillment outbox rollback. Backend unit tests (16), frontend tests (39), source/test type checks and production builds pass. Live Supabase orders:check passed checkout/replay/allocation/scoped reads and accept/prepare/ready; all temporary records rolled back. Real browser acceptance remains pending.

## Phase 9 - Notifications and synchronization

- [x] Persist student notifications independently of browser storage and process the PostgreSQL outbox with retries/leases.
- [x] Implement notification pagination and idempotent mark-read actions.
- [x] Poll scoped orders/notifications; refresh after writes, on focus and after reconnect.
- [x] Verify worker crash recovery, duplicate-event handling and offline notification recovery.

Verified on 2026-10-16: all eight isolated PostgreSQL notification integration tests passed, including a killed worker, lease recovery, duplicate events, retry/backoff/operator retry, application-role RLS, offline recovery and scoped idempotent reads. Backend unit tests (20), application/test type checks and builds, plus frontend tests/lint/build passed. See [backend/NOTIFICATIONS.md](backend/NOTIFICATIONS.md). Apply migrations and start the separate worker in the running application environment; that environment was not changed by the isolated tests.

## Phase 10 - Pickup verification

- [x] Generate a separate encrypted student-only random numeric code (1–100) when an order becomes READY; preserve the public dated order reference.
- [x] Implement collection by UUID, matching private pickup code, READY status and expected version; staff compare the student's name and dated order details.
- [x] Persist the five-wrong-guess per-order cooldown and staff-wide limits across replicas, and record verifier/time/history/outbox/audit atomically; consume the code and preserve safe retries.
- [x] Test early pickup, malformed/wrong codes, privacy/scope, cooldowns, cross-canteen collection, simultaneous handovers, rollback, late pickup and legacy READY orders.

Verified on 2026-10-16: all 13 isolated PostgreSQL pickup tests passed, plus the existing order (17) and notification (8) integration suites, 23 backend unit tests, frontend tests/lint/build, backend build and application/test type checks. See [backend/PICKUP.md](backend/PICKUP.md). Apply migrations and restart the API/worker in the running application environment; the tests used disposable local databases.

## Phase 11 - Admin oversight

- [x] Implement /admin/overview and paginated /admin/orders with search/status/canteen/date filters.
- [x] Compute campus summaries and collected test order value from PostgreSQL.
- [x] Connect audited account, membership and access-code maintenance controls.
- [x] Verify totals, scope restrictions and retention of existing order history.

Verified on 2026-10-16: 14 isolated PostgreSQL admin scenarios (15 tests including parent) passed, covering full-history totals, stable pagination, role restrictions, concurrent account/session changes, audited maintenance, application-role RLS and retained history. Authentication regressions (17 tests), backend unit/contracts (25), frontend tests/lint/build and backend build/application/test type checks passed. See [backend/ADMIN.md](backend/ADMIN.md). Apply the pagination migration and restart the running application; isolated tests did not change Supabase. Manual browser acceptance remains pending.

## Phase 12 - Frontend API integration and remaining screens

- [x] Add frontend/src/services/api.js using fetch, credentials, CSRF headers and consistent error handling.
- [x] Replace AuthContext local identity with Supabase signup/login/reset, server session restoration and canteen email challenges.
- [x] Connect the canteen member panel to paginated member/count/removal APIs and revalidate sessions after removal.
- [x] Add dedicated admin-only account/membership restoration, canteen/menu maintenance and join-code rotation UI with audited backend authorization.
- [x] Add student/canteen email-code entry, callback and recovery screens with resend cooldown, expiry, errors and pending states; backend proof establishes identity.
- [x] Replace OrderContext local carts/orders/menus/availability with server records; add scoped paginated reads, UUID detail routes and persisted retry keys.
- [x] Replace derived notification previews with the durable notification API/worker in Phase 9.
- [x] Map canteen slugs/UUIDs for staff login and authenticated canteen identity.
- [x] Verify catalog/cart/order UUID mappings and integer-paise writes; rupee values are display/edit inputs converted by the shared price helper.
- [x] Use order UUIDs in navigation/mutations; show allocation day/code, canteen and items on order cards, and pickup date/time in IST.
- [x] Add order pending/loading/retry states and retain the exact request/key after uncertain checkout or fulfillment responses.
- [x] Add notification read/unread UI backed by the notification endpoints.
- [x] Implement and route MenuManagement.jsx for canteen-owned categories/items, editing/moving, archival/restoration, details and availability.
- [x] Remove the unused standalone settings page by product decision; keep supported details under Manage Menu and quick pause/resume on the dashboard.
- [ ] Decide whether dedicated CanteenAnalytics.jsx is required; implement/route it if included. It is currently an empty file; basic dashboard counts already exist.
- [x] Remove bundled canteen-code/demo-admin lookups from login and fail closed when auth APIs are unavailable.
- [x] Verify active ordering paths use server writes and report API failures; browser prototype records never become authoritative outage fallback data.
- [ ] Verify all role flows across separate devices with persistent server state.

Audit (2026-10-16): removed unused CanteenSettings.jsx; supported settings remain in Manage Menu. Login now loads current canteen names/slugs/status from `/canteens`, with loading/error/retry handling and disabled-canteen selection blocked. Active catalog/cart/order writes use UUIDs, integer paise, versions and server APIs; existing frontend tests cover price mapping, failed writes and uncertain retries. Saved menus, availability, carts, orders/history, private pickup credentials, memberships and notifications/read state persist in PostgreSQL. Browser cookies and Supabase proof/pending-request state are local to each browser; unsaved forms and unconfirmed queues do not synchronize. Sample frontend menus/access-code fixtures and old prototype helpers remain for historical tests, with no imports from active screens. Backend development seeds are opt-in and disabled in the current configuration. The configured API readiness check passed; the notification worker was started after finding it absent. Cross-device browser/email acceptance and production deployment/recovery/load qualification remain unchecked; the separate analytics screen still needs a scope decision.

## Phase 13 - Release readiness

- [ ] Pass backend unit, contract, authorization, PostgreSQL integration and concurrency checks.
- [ ] Complete the coverage checklist in backend/backend.md and record browser acceptance evidence.
- [ ] Deploy migrations, PostgreSQL, Express API and worker to staging with HTTPS and production secrets.
- [ ] Exercise email/database outages, process restarts, retry recovery, backups/restoration and deployment rollback.
- [ ] Monitor API failures, outbox backlog, login abuse, stalled orders and pickup-code capacity.
- [ ] Release in TEST mode and update README.md, architecture.md and this checklist to match the implemented system.

## Future payment work - after the payment-free release

- [ ] Resolve the operational/product decisions listed in the backend payment plan before enabling charges.
- [ ] Select a provider and implement payment only after canteen acceptance.
- [ ] Verify provider events, deduplicate attempts and reconcile delayed/unknown payment outcomes.
- [ ] Reserve daily code capacity before payment; retain its campus day across midnight/retries, assign/expose the public code only after verified payment and gate preparation on that result.
- [ ] Keep cancellation/refund APIs outside the defined scope unless requirements change.

## Project alignment audit - 2026-10-04

- [x] Review all six Markdown files, frontend routes/screens, contexts, rules, test cases and configuration against the agreed product decisions; verify relative documentation links.
- [x] Standardize visible branding and document titles to SpoonAte. Existing campusEats browser-storage keys and admin@campuseats.com demo credentials remain compatibility identifiers.
- [x] Align docs with prototype student name/email/password signup returning to login and email/password login; document planned signup/reset OTP, password hashes and secure server sessions.
- [x] Align canteen member emails/counts/removal with the prototype and record real OTP, shared counts, scoped session revocation and admin restoration as backend work.
- [x] Show daily pickup code/day rather than permanent UUID in the student dashboard; retain UUID routes and display pickup date/time in Asia/Kolkata on order screens.
- [x] Name Supabase PostgreSQL consistently as the planned database host, with Express/Prisma application auth, separately hosted API/worker and optional future Supabase Auth/Storage/Realtime decisions.
- [x] Adjust scale-test order rates/durations to stay within 46,656 allocations per campus day per isolated scenario; retain short peak tests, capacity-exhaustion tests and unbenchmarked qualification status.
- [ ] Complete real signup/canteen OTP, password reset, server sessions, migrations, daily-code concurrency enforcement and frontend API cutover before treating the prototype as production.
- [ ] Complete browser acceptance and staging/load/recovery qualification; do not infer 30,000-user capacity from frontend checks.

## Next implementation step

Complete the dashboard URL/SMTP and real email/browser acceptance steps in backend/AUTH.md. Run `auth:check` and `db:check` from backend. Phases 5–11 catalog/categories, persistent carts, transactional orders, fulfillment, durable notifications, private pickup verification and admin oversight are implemented. Apply migrations and run the notification worker alongside the API. Continue with the remaining frontend API integration and acceptance in Phase 12. Do not mark provider acceptance, production qualification or ordering complete based on the authentication tests.

## Run frontend and backend locally

Use three WSL terminals and keep the API, notification worker and frontend running. Dependencies and private environment files are already configured for this workspace; do not overwrite `.env` files with examples.

Backend terminal:

```bash
cd /mnt/c/projects/build_bv/backend
npm run dev
```

Notification worker terminal (after applying migrations with `npm run db:migrate` from `backend`):

```bash
cd /mnt/c/projects/build_bv/backend
npm run worker:dev
```

Frontend terminal:

```bash
cd /mnt/c/projects/build_bv/frontend
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173/login`. The frontend proxies `/api` requests to Express on port 4000. Database readiness is `http://localhost:4000/health/ready`. Supabase hosts the database, so this setup does not require starting local Docker/PostgreSQL. If a server is already running, reuse it or stop that server with Ctrl+C before starting another on the same port. Ctrl+C stops each development server.

Next coding phase: **Phase 12 — Frontend API integration and remaining screens**. Phase 11 database-wide admin summaries, paginated order search and audited maintenance are implemented and verified; see backend/ADMIN.md. Apply migrations, restart the API/worker and keep the worker running. Real menu/hour data and live authentication acceptance remain operator inputs/checks.
