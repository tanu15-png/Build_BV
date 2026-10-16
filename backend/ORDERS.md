# Transactional checkout and fulfillment (Phases 7–8)

POST /orders requires a student session, CSRF token, Idempotency-Key (16–128 allowed letters/digits/colon/underscore/hyphen), expected cart version, signed quote and an offset-aware pickup timestamp. Pickup must be in the future and at most sixty minutes ahead according to PostgreSQL server time. Ten/twenty/thirty/forty-five/sixty-minute UI choices are supported. Prices, actor, canteen, status, payment mode and campus day are server-derived.

Checkout locks user, cart, canteen, sorted menu items and categories in that order. Existing cart/catalog operations use compatible user/canteen locks. It revalidates the current quote, contents, quantities, prices and availability under those locks. The same transaction creates the order and immutable item snapshots, permanently reserves the daily code, writes initial history/outbox, clears the cart and saves the completed idempotency response. Any failure rolls all of this back. Serialization/deadlock conflicts retry at most three transactions; a continuing conflict returns retryable 503.

The completed actor/action/key response survives for the order lifetime. Identical retries return its exact original body/status before validating a now-empty/new cart, expired pickup or changed campus day. Different input with that key returns 409. No pending claims survive a rolled-back attempt.

Public campus order references are three base-36 characters (46,656 per Asia/Kolkata day). Eight cryptographically random attempts use INSERT ON CONFLICT DO NOTHING against the unique order day/code constraint; collisions do not poison the transaction. A bounded fallback scans for free codes and still relies on the unique INSERT to win races. Exhaustion returns ORDER_CODE_CAPACITY_EXHAUSTED without consuming the cart. Prior allocations, including collected and previous-day orders, are never removed or reassigned.

POST /orders/:id/accept, /prepare and /ready require an active owning-canteen session, CSRF, expected order version and Idempotency-Key. They lock user, canteen and scoped order, recheck membership, and permit only RECEIVED → ACCEPTED → PREPARING → READY. A stale or skipped action returns ORDER_STATE_CONFLICT with the current order. An exact command retry returns the original saved response without another history/outbox event, even if the order advanced later. Pausing incoming orders or a delayed pickup does not prevent fulfillment. Status/version, actor/time history, outbox and command response commit atomically.

GET /orders and GET /orders/:id enforce student ownership, canteen membership scope or admin role. Pagination uses UUID cursors and stable timestamp/UUID ordering; canteen queues order by pickup then creation/id. The response includes immutable prices, permanent UUID, code/day, pickup timestamp, names and timestamped history. No short code is used as a route identity. List filters never widen the caller's scope.

Frontend orders use API records, refresh every fifteen seconds and on focus/reconnect, and retain uncertain checkout/command requests in actor-scoped sessionStorage before sending. Exact payloads and keys survive page refresh and CSRF recovery. Definitive validation/conflict errors permit a new reviewed request. No order write falls back to browser records. Direct details work independently of the first list page.

Outbox entries are processed by the separate Phase 9 worker into durable student notifications with scoped read APIs. See [NOTIFICATIONS.md](NOTIFICATIONS.md) for startup, leases, retries, recovery and synchronization. Phase 10 collection uses a separate student-only two-digit READY credential; see [PICKUP.md](PICKUP.md). Cancellation/refund/payment actions are absent.

## Verification

Run npm test, npm run typecheck, npm run build and the tests TypeScript configuration. Use a fresh local test database with ORDER_TEST_DATABASE_URL and npm run test:orders. The integration suite rejects nonlocal/test URLs and covers concurrent duplicate/different-key submits, cross-canteen codes, full 46,656-code exhaustion, midnight reuse, stale prices/quotes/carts, pause/menu races, scoped reads, rollback, staff races, exact command replays, late fulfillment and revoked sessions. No email is sent.

npm run orders:check runs the same Express handlers on the connected database with temporary fixtures inside one outer rollback-only transaction. It checks real application-role SQL, checkout/replay, code allocation and accept/prepare/ready, then verifies that its temporary canteen disappeared. This is a database/handler smoke test, not live Supabase Auth/browser acceptance; standalone transaction concurrency is covered by the isolated integration suite.

The initial migration already provides the required order/allocation/event/outbox/idempotency tables and uniqueness/immutability constraints. These phases require no additional schema migration.
