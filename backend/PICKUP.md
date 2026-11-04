# Canteen-controlled collection

Canteen staff accept an order, start preparation, mark it ready, and select **Collected** when they hand over the food. Students do not enter or share a verification code. Customer names remain omitted from canteen order responses and screens.

Only active staff from the owning canteen can collect an order, and only from READY at its current version. Students and admins cannot perform collection. A pause on new orders does not prevent fulfilling existing orders.

## API

`POST /api/v1/canteen/orders/<UUID>/collect` requires the canteen session cookie, CSRF protection, an `Idempotency-Key` header and body `{ "expectedVersion": 4 }`. No code is accepted or checked. The public order reference and date remain available for identifying the correct order.

Collection atomically writes COLLECTED, the staff ID in the existing `pickupVerifiedBy` field, collection time, status history, audit log, outbox event and saved response. Locks and version checks prevent double collection. Repeating the same command key returns the original response; a separate command for an already collected order returns a conflict.

Existing READY orders are immediately eligible without a credential. Old credential rows are ignored and removed when those orders are collected. No schema migration is required. The legacy student-only `GET /api/v1/student/orders/<UUID>/pickup-code` endpoint returns `{ "code": null }` for compatibility; current screens do not call it.

## Verification

Run `npm test` and `npm run typecheck` in the backend. Run `test:pickup` with a fresh local `PICKUP_TEST_DATABASE_URL`, separate from the application database, to test role/canteen authorization, READY-only collection, CSRF, idempotency, stale versions, concurrent handovers, rollback on outbox failure and collection of legacy orders at paused canteens.
