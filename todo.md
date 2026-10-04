# SpoonAte implementation checklist

Last checked: 2026-10-04. Based on source inspection and the frontend checks below.

`[x]` means implemented in the stated scope or verified; `[ ]` means remaining work. Checked frontend features are browser-storage prototype features, not completed backend features. The backend directory currently contains only its implementation plan.

Backend stack: **TypeScript + Node.js + Express + Zod + Prisma + PostgreSQL**. Keep dependencies minimal and use Node.js built-ins where practical. Follow [backend/backend.md](backend/backend.md) for endpoint contracts, business rules, phase dependencies and acceptance criteria.

Database hosting: **Supabase-managed PostgreSQL**, following [scale.md](scale.md). React calls the Express API; Express and the outbox worker access Supabase through Prisma. Supabase database hosting does not automatically implement authentication: student passwords, email OTPs, cookie sessions and canteen membership checks remain backend work. Supabase Auth is a separate future integration decision.

## Supabase integration - remaining work

- [ ] Create separate Supabase staging and production projects; select region, paid production plan, compute and recovery options using the requirements and load tests in scale.md.
- [ ] Configure server-only database credentials and TLS connections in backend environment configuration; add placeholder connection variables to .env.example without committing secrets or exposing credentials in frontend Vite variables.
- [ ] Set up a least-privilege application database role and separate migration credentials. Keep application tables inaccessible to anonymous/browser clients; disable the Supabase Data API if unused, or explicitly secure exposed schemas with tested grants and RLS policies.
- [ ] Connect the shared Prisma client to Supabase PostgreSQL. Select direct/session/transaction pooling against the pinned Prisma version and hosting environment; use a supported migration connection and verify prepared statements, interactive transactions and connectivity.
- [ ] Budget pooled and PostgreSQL connections across API replicas, workers, deployments and migration tools; leave operational headroom and test connection exhaustion behavior.
- [ ] Apply committed Prisma migrations to staging and production; create users, password hashes, email challenges, sessions, canteen memberships, menus, carts, orders, daily code allocations, notifications and outbox tables.
- [ ] Enforce campus-wide daily code uniqueness with UNIQUE(code_day, code), derive Asia/Kolkata dates from server time, and test simultaneous allocations, collision retries, midnight renewal and daily exhaustion on Supabase PostgreSQL.
- [ ] Seed the eight canteens and provision production access-code hashes and admin credentials without importing browser passwords or overwriting existing operator-managed data.
- [ ] Implement student signup OTP activation and email/password login using the backend and Supabase database; store salted password hashes only. Implement canteen email OTP verification, scoped memberships, shared session counts and atomic member/session revocation.
- [ ] Connect a production email provider for signup, canteen-login and password-reset OTPs; configure verified sending identity, delivery monitoring, expiry/resend controls and quotas for campus onboarding bursts.
- [ ] Deploy Express and the durable outbox worker on separately selected hosting; configure their Supabase connections, secrets, health checks and startup/shutdown behavior.
- [ ] Replace frontend localStorage account/order/member records with authenticated Express API calls backed by Supabase; verify student ordering, canteen updates and member removal across separate devices.
- [ ] Enable the required database backups/PITR and monitoring; test restoration, migrations, outages, query performance and peak-load scenarios before campus rollout.
- [ ] Evaluate Supabase Storage for menu images and Supabase Realtime for status updates only when those features are needed; define access policies and load-test quotas before adopting either.

## Completed documentation and frontend prototype

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

- [x] `cd frontend; npm run test`: passed on 2026-10-04; running `node --test --test-isolation=none --test-reporter=spec tests/orderRules.test.js` also confirmed all 19 individual cases passed.
- [x] `cd frontend; npm run lint`: passed on 2026-10-04.
- [x] `cd frontend; npm run build`: passed on 2026-10-04.
- [ ] Perform and record browser acceptance testing across student, canteen and admin profiles, including mobile layouts, keyboard navigation and refresh/reconnect behavior.

These checks verify frontend rules, source lint and the production bundle. They do not verify browser acceptance, database security, cross-device synchronization, backend behavior or production capacity.

## Phase 1 - Backend foundation and contracts

- [ ] Create backend/package.json, lockfile, strict TypeScript configuration and build/start/development/test scripts.
- [ ] Create Express app factory, server entry point, module Routers and shared Prisma client.
- [ ] Add Zod environment/body/params/query validation and response contracts aligned with frontend screens.
- [ ] Add .env.example, bounded JSON parsing, request IDs, redacted logs and the documented error envelope.
- [ ] Implement /health/live and /health/ready, origin handling and the frontend development API proxy.
- [ ] Establish PostgreSQL development/test databases and document local setup commands.
- [ ] Verify startup, invalid configuration, health checks and contract fixtures.

## Phase 2 - Database and provisioning

- [ ] Implement Prisma models, relations, constraints and indexes from the backend plan, including shared rate-limit storage.
- [ ] Generate committed migrations; test empty-database and upgrade application.
- [ ] Seed the eight stable canteen slugs and development menus without overwriting operator-managed data.
- [ ] Add canteen-code provisioning/rotation using salted scrypt hashes and an admin provisioning CLI.
- [ ] Block development codes and authentication bypasses in production; never seed the bundled demo admin password.

## Phase 3 - Student authentication

- [ ] Authenticate student email ownership using a one-time code sent to the exact @banasthali.in address. Domain validation alone is not authentication; do not activate the account or create an authenticated session before successful signup verification.
- [ ] Implement the confirmed student auth flow: name/email/password signup, email OTP verification before account activation, then registered email/password login. Hash passwords on the server and add email-verified password reset; successful signup returns to login.
- [ ] Remove plaintext student passwords from browser account/session storage during backend cutover; do not import prototype passwords into production accounts.
- [ ] Implement student signup/reset email challenges, email/password login, real email delivery, verification and resend endpoints.
- [ ] Enforce institutional email validation, account uniqueness, OTP expiry, single use, attempt limits and resend invalidation.
- [ ] Persist hashed opaque sessions; implement /auth/me, logout, expiry and revocation.
- [ ] Add CSRF bootstrap/checks, secure cookie configuration and shared rate limits.
- [ ] Test wrong passwords, unverified login, reset/session revocation, OTP replay, concurrent signup, unknown-email responses, delivery failure and account disabling.

## Phase 4 - Staff and admin authorization

- [ ] Authenticate canteen member email ownership using a one-time code sent to that member's email. The email OTP is separate from the canteen member access code and the three-character order pickup code.
- [ ] Bind each staff email challenge to its member email, selected canteen and access-code version; create the membership/session only after successful email verification and a valid canteen access code.
- [ ] Verify member email and the selected canteen's hashed access code before establishing staff membership/session.
- [ ] Recheck membership, account status, canteen scope and code version on staff requests.
- [ ] Implement provisioned admin authentication and server-assigned permissions.
- [ ] Add own-canteen member list/counts and removal endpoints. Show member emails, members with access, distinct people with valid sessions, and session counts; valid sessions are not online presence.
- [ ] On removal, revoke the canteen membership and all its sessions atomically, audit the actor/time, and block rejoining even with the existing member code until an admin explicitly restores access. Preserve orders/history and unrelated canteen memberships.
- [ ] Add audited account disabling, admin-only membership restoration and code rotation.
- [ ] Test forged roles, cross-canteen listing/removal, removal versus pending OTP completion, blocked rejoining, distinct-person counts, rotation races and CSRF enforcement.

## Phase 5 - Catalog, menus and availability

- [ ] Implement directory/menu reads and own-canteen item create/edit/archive endpoints.
- [ ] Implement explicit canteen and item availability updates with version conflicts.
- [ ] Validate integer-paise prices and preserve historical order snapshots.
- [ ] Replace sample menus, locations and hours with confirmed canteen-supplied data before real use.
- [ ] Test ownership, stale updates and pause behavior without blocking existing fulfillment.

## Phase 6 - Persistent carts

- [ ] Implement server cart read/add/edit/remove/clear endpoints scoped to the authenticated student.
- [ ] Enforce single-canteen contents transactionally, quantity bounds and availability checks.
- [ ] Return cart-line IDs, versions, current totals and a server-verifiable price quote.
- [ ] Allow unavailable-item removal and reject stale checkout reviews with an updated summary.
- [ ] Test simultaneous device updates, cart restoration and mixed-canteen conflicts.

## Phase 7 - Transactional test orders

- [ ] Implement checkout with pickup timestamp validation and actor-scoped idempotency keys.
- [ ] Lock/revalidate cart, canteen, items and quote in a Prisma transaction.
- [ ] Allocate pickup codes using server-derived Asia/Kolkata codeDay and UNIQUE(code_day, code) across all canteens/statuses; detect daily exhaustion.
- [ ] Atomically create order/item snapshots/history/outbox records, clear the cart and save the retry response.
- [ ] Test double submits, lost responses, price/availability races, daily collisions/exhaustion, midnight reuse, late pickup and rollback behavior.

## Phase 8 - Fulfillment transitions

- [ ] Implement own-canteen accept, prepare and ready command endpoints.
- [ ] Enforce consecutive state transitions, expected versions and idempotent command retries.
- [ ] Write status, actor/time, history and outbox events atomically.
- [ ] Verify concurrent staff updates and fulfillment after incoming orders are paused.

## Phase 9 - Notifications and synchronization

- [ ] Persist student notifications independently of browser storage and process the PostgreSQL outbox with retries/leases.
- [ ] Implement notification pagination and idempotent mark-read actions.
- [ ] Poll scoped orders/notifications; refresh after writes, on focus and after reconnect.
- [ ] Verify worker crash recovery, duplicate-event handling and offline notification recovery.

## Phase 10 - Pickup verification

- [ ] Implement collection by UUID plus matching pickup code, READY status and expected version; staff compare the dated student card. Pickup lookup by code requires allocation day and canteen.
- [ ] Rate-limit failed code attempts and record verifier/time/history atomically.
- [ ] Test early pickup, wrong codes, cross-canteen collection and simultaneous handover attempts.

## Phase 11 - Admin oversight

- [ ] Implement /admin/overview and paginated /admin/orders with search/status/canteen/date filters.
- [ ] Compute campus summaries and collected test order value from PostgreSQL.
- [ ] Connect audited account, membership and access-code maintenance controls.
- [ ] Verify totals, scope restrictions and retention of existing order history.

## Phase 12 - Frontend API integration and remaining screens

- [ ] Add frontend/src/services/api.js using fetch, credentials, CSRF headers and consistent error handling.
- [ ] Replace AuthContext local identity with student email/password login, signup/reset and canteen email challenges, verification UI and server session restoration.
- [ ] Connect the canteen member panel to paginated member/count/removal APIs; revalidate sessions after removal and add admin-only restoration controls.
- [ ] Add student and canteen email-code entry screens with resend cooldown, expiry, error handling and pending states; never use a frontend flag to mark an email verified.
- [ ] Replace OrderContext local records with server carts, orders, menus, availability and notifications.
- [ ] Map canteen slugs to UUIDs, cafeId to canteenId, cart item IDs to cart-line IDs, and rupees to integer paise.
- [ ] Use order UUIDs in navigation/mutations; show codeDay, orderCode, canteen and items on every order card, and pickup date/time in IST.
- [ ] Add pending/loading/retry states and reuse idempotency keys after uncertain responses.
- [ ] Add notification read/unread UI backed by the notification endpoints.
- [ ] Implement and route MenuManagement.jsx for menu creation, editing and archiving; it is currently an empty file. Availability toggles already exist on CanteenDashboard.
- [ ] Implement and route CanteenSettings.jsx for supported canteen settings; it is currently an empty file.
- [ ] Decide whether dedicated CanteenAnalytics.jsx is required; implement/route it if included. It is currently an empty file; basic dashboard counts already exist.
- [ ] Remove bundled canteen-code/admin-secret lookups from API mode and prevent silent local-write fallback on outages.
- [ ] Verify all role flows across separate devices with persistent server state.

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

Begin Phase 1, then Phase 2, completing the Supabase setup/connection/migration tasks alongside those phases. Connect each frontend feature as its endpoint becomes available, and complete the full API cutover in Phase 12. Check tasks only after their implementation and relevant acceptance checks pass; do not mark backend phases complete based on frontend demo behavior.
