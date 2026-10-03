# CampusEats implementation checklist

Last checked: 2026-10-03. Based on source inspection and the frontend checks below.

`[x]` means implemented in the stated scope or verified; `[ ]` means remaining work. Checked frontend features are browser-storage prototype features, not completed backend features. The backend directory currently contains only its implementation plan.

Backend stack: **TypeScript + Node.js + Express + Zod + Prisma + PostgreSQL**. Keep dependencies minimal and use Node.js built-ins where practical. Follow [backend/backend.md](backend/backend.md) for endpoint contracts, business rules, phase dependencies and acceptance criteria.

## Completed documentation and frontend prototype

- [x] Document product requirements, existing architecture and payment-free testing policy in README.md and architecture.md.
- [x] Define backend stack, planned folder structure, frontend endpoint mappings and 13 implementation phases in backend/backend.md.
- [x] Set up React/Vite, React Router, Tailwind CSS and Lucide React.
- [x] Add student, canteen and admin route guards and logout (frontend checks only).
- [x] Implement student signup with name and exact @banasthali.in domain validation, and registered-email-only login.
- [x] Implement canteen login with member email, selected canteen and matching development access code.
- [x] Implement demo admin login and campus overview.
- [x] Include all eight canteens, including Bella Bite, with separate sample menus.
- [x] Implement student directory, menu browsing, cart, checkout, success, history, tracking, notifications and profile screens.
- [x] Enforce a single-canteen cart, quantity changes, item removal and explicit cart clearing.
- [x] Check canteen/item availability on additions, quantity increases and checkout; use current menu prices at submission.
- [x] Offer estimated pickup in 10, 20, 30, 45 or 60 minutes and store an absolute timestamp.
- [x] Submit payment-free orders with unique three-character codes and handle local code-space exhaustion.
- [x] Implement RECEIVED -> ACCEPTED -> PREPARING -> READY -> COLLECTED with consecutive transitions.
- [x] Add canteen dashboard, order list/details, incoming-order pause/resume and item availability controls.
- [x] Verify the student's pickup code before collection and record verifier/time.
- [x] Derive acceptance/readiness notifications from locally persisted order history.
- [x] Filter local orders by student/canteen; give demo admins campus-wide visibility.
- [x] Add admin canteen summaries, order search, canteen/status filters and collected test order value.
- [x] Persist accounts, carts, orders and availability in localStorage; synchronize same-origin tabs; keep login in sessionStorage.
- [x] Keep payment disabled and omit cancellation/refund actions.

Evidence: frontend/src/App.jsx, context/AuthContext.jsx, context/OrderContext.jsx, hooks/usePersistentState.js, utils/authRules.js, utils/orderRules.js, data/mockData.js and the routed pages.

## Verification completed

- [x] `cd frontend; npm run test`: 15 tests passed on 2026-10-03.
- [x] `cd frontend; npm run lint`: passed on 2026-10-03.
- [x] `cd frontend; npm run build`: passed on 2026-10-03.
- [ ] Perform and record browser acceptance testing across student, canteen and admin profiles, including mobile layouts, keyboard navigation and refresh/reconnect behavior.

Tests and build initially encountered sandbox process restrictions; both passed when rerun with permission outside the sandbox. These checks verify the existing frontend, not database security, cross-device synchronization or backend behavior.

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

- [ ] Implement signup/login challenges, real email delivery, verification and resend endpoints.
- [ ] Enforce institutional email validation, account uniqueness, OTP expiry, single use, attempt limits and resend invalidation.
- [ ] Persist hashed opaque sessions; implement /auth/me, logout, expiry and revocation.
- [ ] Add CSRF bootstrap/checks, secure cookie configuration and shared rate limits.
- [ ] Test replay, concurrent signup, unknown-email responses, delivery failure and account disabling.

## Phase 4 - Staff and admin authorization

- [ ] Verify member email and the selected canteen's hashed access code before establishing staff membership/session.
- [ ] Recheck membership, account status, canteen scope and code version on staff requests.
- [ ] Implement provisioned admin authentication and server-assigned permissions.
- [ ] Add audited membership revocation, account disabling and code rotation.
- [ ] Test forged roles, cross-canteen access, rotation races and CSRF enforcement.

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
- [ ] Allocate unique pickup codes under database constraints and detect capacity exhaustion.
- [ ] Atomically create order/item snapshots/history/outbox records, clear the cart and save the retry response.
- [ ] Test double submits, lost responses, price/availability races, collisions and rollback behavior.

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

- [ ] Implement collection by UUID plus matching pickup code, READY status and expected version.
- [ ] Rate-limit failed code attempts and record verifier/time/history atomically.
- [ ] Test early pickup, wrong codes, cross-canteen collection and simultaneous handover attempts.

## Phase 11 - Admin oversight

- [ ] Implement /admin/overview and paginated /admin/orders with search/status/canteen/date filters.
- [ ] Compute campus summaries and collected test order value from PostgreSQL.
- [ ] Connect audited account, membership and access-code maintenance controls.
- [ ] Verify totals, scope restrictions and retention of existing order history.

## Phase 12 - Frontend API integration and remaining screens

- [ ] Add frontend/src/services/api.js using fetch, credentials, CSRF headers and consistent error handling.
- [ ] Replace AuthContext local identity with API challenges, email verification UI and server session restoration.
- [ ] Replace OrderContext local records with server carts, orders, menus, availability and notifications.
- [ ] Map canteen slugs to UUIDs, cafeId to canteenId, cart item IDs to cart-line IDs, and rupees to integer paise.
- [ ] Use order UUIDs in navigation and display orderCode for pickup.
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
- [ ] Allocate the public code only after verified payment and gate preparation on that result.
- [ ] Keep cancellation/refund APIs outside the defined scope unless requirements change.

## Next implementation step

Begin Phase 1, then Phase 2. Connect each frontend feature as its endpoint becomes available, and complete the full API cutover in Phase 12. Check tasks only after their implementation and relevant acceptance checks pass; do not mark backend phases complete based on frontend demo behavior.
