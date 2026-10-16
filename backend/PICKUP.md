# Phase 10: private numeric pickup verification

The public three-character `orderCode` remains the dated order reference. Collection uses a separate random numeric code from **1 to 100**, generated when staff mark the order READY. It appears only to the owning student. Staff ask for it at handover after comparing the student's name, order reference, allocation day and items.

## Student and staff flow

1. Staff accept, prepare, and mark the order READY. That transaction creates one encrypted pickup credential alongside the READY status/history/outbox write.
2. The student's dashboard, order tracking and order-success page fetch and display the numeric pickup code only while the order is READY. Reloading or polling returns the same code.
3. Staff select the exact order and enter the code shown by the student. The staff dashboard never receives the expected private code.
4. A correct code changes READY to COLLECTED. Status/version, verifier ID, collection time, history event, outbox row, success audit record and idempotent response commit together. The credential is deleted in that transaction.
5. Collected orders leave the active dashboard and remain in history. A lost-response retry returns the original result; another handover command reports already collected. Estimated arrival time and a pause on incoming orders do not prevent collection of an existing READY order.

## API

- `GET /api/v1/orders/<UUID>/pickup-code`: an active owning-student session receives `{ code: "42" }` for READY, or `{ code: null }` otherwise. Other students receive 404; staff/admin sessions receive 403. Existing READY orders from before this release receive one stable credential on first student access.
- `POST /api/v1/orders/<UUID>/collect`: active own-canteen staff, normal CSRF protection and `Idempotency-Key` are required. Body: `{ expectedVersion: 4, code: "42" }`. The code must be a whole number from 1 to 100; whitespace is trimmed. Public references do not authorize pickup; only the separate private number is accepted.
- Successful collection returns the normal public order response. Lists, details, conflicts, staff command responses, saved idempotency responses, notifications and outbox payloads never include the expected private code or encrypted credential.

All verification targets the permanent order UUID. Two-digit codes can repeat between orders and dates. They do not identify or locate an order. The public order reference plus allocation day remains useful for selecting and comparing an order.

## Attempts, storage and concurrency

- Five wrong codes on one order trigger a ten-minute cooldown. The attempt state is shared across staff and API replicas in PostgreSQL. Correct codes are also blocked during that cooldown.
- Twenty wrong codes by one staff account across orders trigger a ten-minute staff cooldown. Switching orders cannot bypass this limit. Attempt counters before reaching a limit expire after a ten-minute window.
- Wrong attempts and their audit records commit even though the API returns a mismatch error. A rejected attempt never changes order status. Cooldown responses return HTTP 429, `Retry-After` and `retryAfterSeconds`.
- The short code has 90 possible values, so this remains a convenience handover check with limited resistance to guessing. Staff must compare the student's dated order details before handing over food.
- Codes use Node's cryptographically secure `randomInt`. AES-256-GCM encrypts each code with a random nonce and binds it to its order UUID as authenticated data. The key is derived from the server `OTP_SECRET`; a plain hash of a value from this small range would be easy to enumerate offline. Keep that secret stable while there are uncollected credentials; changing it requires coordinated reissuance of those credentials.
- `pickup_credentials` has RLS and no public/browser-role grants. Migrations copy the existing server role's policy; new installations get access through `prisma/application-role.sql`.
- Staff writes lock user, canteen and selected order, then recheck session/membership, status, version, attempt limits and code. Concurrent verifications serialize. Exactly one can create the COLLECTED event.
- Idempotency request hashes are keyed so stored hashes cannot be used to enumerate the short code. Pending staff retries preserve the original entered code/version/key; wrong-code and cooldown errors allow staff to correct the input. No pickup code is included in audit metadata.

## Setup and verification

Apply the migration before restarting the API and notification worker:

```bash
npm run db:migrate
npm run build
```

Run the new suite against a fresh local test database, separate from the application database:

```bash
PICKUP_TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5434/spoonate_pickup_test npm run test:pickup
npm test
npm run typecheck
```

The suite verifies ready-only generation, privacy and cross-device persistence, ownership/roles/CSRF, early and malformed collection, stale versions, persisted order/staff attempt limits, concurrent handovers, exact retry responses, complete rollback on outbox failure, rollback of code creation on a failed READY transition, late pickup at a paused canteen, legacy READY orders, UUID/date isolation, and student/staff API operation under an application role with RLS.

Verified on 2026-10-16 against isolated PostgreSQL 18: all 13 pickup tests passed. Existing order (17) and notification (8) integration suites passed, along with 23 backend unit tests, backend application/test type checks and build, and frontend tests/lint/build. The configured application database was not changed by these tests.

## Range and running API check — 2026-10-16

Pickup codes now use the inclusive range 1–100, with no zero-padding. Existing encrypted codes remain valid. Staff entry accepts up to three digits; request/response contracts enforce the same range. Five wrong guesses still trigger the ten-minute cooldown. All 14 pickup integration tests (13 scenarios plus parent) passed, including private student retrieval and successful collection for 1, 9 and 100. Backend unit tests, application/test TypeScript checks and frontend tests/lint/build also passed. The configured development database reported all migrations applied. The suspended development API was replaced with the current source; database readiness and the pickup route through the frontend proxy were verified (unauthenticated requests return SESSION_REQUIRED rather than the generic NOT_FOUND).
