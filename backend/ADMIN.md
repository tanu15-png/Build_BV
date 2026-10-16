# Admin oversight — Phase 11

Implemented and verified on 2026-10-16. Admins use `/admin` for full-campus summaries, filtered orders and account/canteen maintenance. Existing staff fulfillment permissions remain enforced by the API.

## Reports and synchronization

`GET /admin/overview` groups the complete PostgreSQL order history by canteen and status in a repeatable-read transaction. It returns total, active and collected counts, collected test order value in integer paise, operational/accepting canteen counts, and per-canteen menu counts and active join-code versions. Empty and disabled canteens remain in the report. Aggregate values support sums beyond the individual order's PostgreSQL integer range. These are payment-free test values, not paid revenue.

`GET /admin/orders` accepts `limit` (1–100, default 25), `cursor`, `canteenId`, `status`, `search`, `from`, `to`, `codeDay` and `orderCode`. Search covers the public reference, student name, canteen name and historical item names. Date ranges filter creation time; the UI converts inclusive IST calendar dates to UTC. Allocation day and exact three-character reference can be combined to distinguish reused references. Responses include `items`, `nextCursor` and the matching `totalCount`. Pagination sorts newest creation time, then UUID; invalid or filtered-out cursors are rejected.

The dashboard refreshes all loaded pages while visible and online, and refreshes on focus, reconnect and writes. It discards responses from previous filters/accounts or reads started before a write. Offline failures retain confirmed records and show a retry action. Campus summaries are independent of order filters and page size. Admins use this feed rather than the student/staff order poller.

## Maintenance

All endpoints require an active ADMIN cookie session. Writes also require origin/CSRF checks and commit their audit record in the same transaction. Actors are rechecked after locking; audit failures roll back the changes. Safe account and membership responses exclude authentication subjects, password/code/session hashes and pickup credentials.

| API | Behavior |
| --- | --- |
| `GET /admin/users` | Paginated accounts, filtered by name/email, role and account status. |
| `GET /admin/memberships` | Paginated memberships, filtered by name/email, canteen and status; indicates outdated join-code versions. |
| `PATCH /admin/users/:id` | Enable/disable with optional `expectedUpdatedAt`; the UI always supplies it. Disabling revokes all sessions and pending challenges. Self-disabling is rejected; concurrent administrators cannot disable each other and leave both disabled. Enabling requires fresh login. |
| `PATCH /admin/memberships/:id` | Restore/revoke with `expectedVersion`; refreshes the current code version and ends old scoped sessions/challenges. A disabled account must first be enabled. Unrelated memberships and order history survive. |
| `PATCH /admin/canteens/:id` | Versioned name/hours, pause/resume and operational status. Disabling also pauses new orders and consumes pending sign-ins. New staff sign-ins and student additions/checkout are blocked; already authenticated staff can finish existing orders. Enabling leaves orders paused until explicitly resumed. |
| `POST /admin/canteens/:id/access-code` | Salted hash rotation through the provisioning service; optional `expectedCodeVersion` (0 for initial provisioning), always supplied by the UI. Revokes current staff sessions and pending sign-ins for that canteen. No secret is returned or included in audit metadata. |

Admins manage menu categories/items at `/admin/canteens/:canteenId/menu` using the shared, versioned menu APIs. Each admin menu write records actor, request, canteen and changed field names. Archival/restoration and confirmed deletion remain separate actions; deletion preserves historical order snapshots. Admin oversight does not authorize acceptance, preparation, readiness, collection or viewing a student's private pickup code.

## Apply and verify

From `backend`, apply committed migrations with `npm run db:migrate`, then restart the API and frontend. Migration `20261016000400_admin_pagination` adds timestamp/UUID indexes for order, account and membership pagination; it changes no stored history. Tests used disposable local databases and did not migrate the configured Supabase project.

```bash
ADMIN_TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:PORT/spoonate_admin_test npm run test:admin
```

Use a fresh local database for each run; the suite creates fixtures and mocks Supabase without sending email. All 14 admin scenarios passed (15 tests including the parent): more than 100 orders, tied timestamps, reused daily references, composed filters, a 3-billion-paise aggregate, authorization/CSRF, session revocation, concurrent login/disabling, concurrent admin changes, scoped restoration/rotation, disabled-canteen fulfillment, immutable snapshots, audit rollback, application-role RLS and expired sessions. Authentication regressions also passed (16 scenarios, 17 tests including the parent), along with 25 backend unit/contract tests, frontend tests, lint, TypeScript checks and production builds. Frontend feed tests cover pagination, write invalidation, account/filter changes, offline recovery and authorization failure. Manual browser acceptance and production qualification remain release work.
