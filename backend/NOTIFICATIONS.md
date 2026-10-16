# Phase 9: durable notifications and synchronization

Acceptance and ready transitions already commit an `order_events` row and an `outbox_events` row in the order transaction. A separate worker now creates PostgreSQL notification records for the owning student. The browser reads those records; order history and browser storage are not notification delivery sources. No email or push is sent by this worker.

## Run

Apply migrations, then run the API and worker as separate processes using the same application database and server environment:

```bash
npm run db:migrate
npm run dev
# In another terminal:
npm run worker:dev
```

For production, run `npm run build`, then `npm start` and `npm run worker:start` as separate supervised processes. Restart the worker after releases. API and worker use the server application role and each has its own bounded connection pool; include both pools in the database connection budget. The worker can run in multiple replicas.

Worker settings (defaults):

| Variable | Default | Meaning |
| --- | --- | --- |
| `OUTBOX_POLL_MS` | 1000 | Idle delay between database checks. |
| `OUTBOX_LEASE_SECONDS` | 60 | Claim lifetime; minimum 30 seconds, longer than the 15-second delivery transaction limit. |
| `OUTBOX_MAX_ATTEMPTS` | 10 | Delivery failures after this attempt move a job to `FAILED`. |
| `OUTBOX_BATCH_SIZE` | 25 | Maximum sequential claims per iteration; jobs are claimed immediately before processing. |
| `DB_POOL_MAX` | 10 | Per-process pool limit; use a smaller value for the worker where appropriate. |

## Delivery and recovery

Claims use an atomic PostgreSQL `UPDATE` with `FOR UPDATE SKIP LOCKED`. Due `PENDING` work and expired `PROCESSING` leases are eligible. Each claim receives a fresh fencing token and increments attempts. Before delivery, the worker locks the row and verifies that its token and lease are still valid. An old worker cannot complete or reschedule a new worker's claim.

The worker reads the immutable source event and its owning order, rather than trusting a recipient supplied in the JSON payload. Only `ACCEPTED` and `READY` events create student messages. Other status events are completed without a message. Notification insertion and outbox completion commit in the same transaction. The unique `(recipient_id, source_event_id, type)` key prevents duplicates even if multiple outbox rows reference the same event.

A crash before commit leaves the job reclaimable after lease expiry, with no partial delivery. A crash after commit leaves both the notification and completed job durable. An attempt that crashes at the retry limit remains reclaimable; the next delivery failure can mark it failed. Transient failures use exponential backoff from one second to five minutes. `last_error` stores a generic message and a bounded error code, without database/provider messages or credentials. Order transitions stay committed during delivery outages.

Inspect failures with a server/operator database connection:

```sql
SELECT state, count(*) FROM outbox_events GROUP BY state;
SELECT id, attempts, available_at, lease_until, last_error
FROM outbox_events WHERE state = 'FAILED' ORDER BY available_at;
```

After correcting the underlying issue, retry a specific failed job:

```bash
npm run worker:retry -- <failed-outbox-UUID>
```

For an installation without development dependencies, use `node --env-file-if-exists=.env dist/cli/outbox-retry.js <failed-outbox-UUID>` after building.

This resets only `FAILED` jobs. It cannot requeue live or completed work. Retrying a previously delivered source event still cannot create another notification.

## API and frontend

- `GET /api/v1/notifications?limit=25&cursor=<UUID>` returns `{ items, nextCursor, unreadCount }`. Ordering is newest-first by source event timestamp and UUID. Cursors must belong to the authenticated student. The unread count covers all their notifications, including unloaded pages.
- `PATCH /api/v1/notifications/<UUID>/read` takes `{}` with the normal CSRF cookie/header. It sets `readAt` once; repeated and concurrent requests return the same timestamp. Another student's notification returns `404`; canteen/admin sessions cannot use student notification endpoints.
- Notification history, unread state, and order links survive logout, browser reloads and offline periods. The UI offers pagination and explicit mark-read, and opening an order marks its notification read. The dashboard badge shows the server unread count.
- Orders, order details and notifications poll every five seconds while visible and online. `VITE_SYNC_INTERVAL_MS` can configure 1–60 seconds. Focus, reconnect and visibility restoration trigger an immediate refresh. Relevant writes refresh state. Session expiry stops authenticated polling; a new login starts it again. Account changes discard late responses.
- Notification polling refreshes all loaded pages. Confirmed reads cannot be reverted by an older in-flight response. The client never invents a notification from order history.

## Verification

Use a fresh, isolated local PostgreSQL database whose name contains `test`; the integration suite refuses the application database:

```bash
NOTIFICATION_TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5434/spoonate_notifications_test npm run test:notifications
npm test
npm run typecheck
```

The suite applies migrations and covers real accept/prepare/ready handlers, offline recovery in a new browser session, competing workers, expired-lease fencing, a subprocess killed after claiming, duplicate events/reprocessing, transaction rollback on delivery failure, backoff, terminal failures/operator retry, scoped pagination/counts, concurrent idempotent reads, cross-device read state, expired sessions, and the actual worker process running under an application role with RLS and graceful shutdown. Frontend tests cover offline notification recovery, loaded-page refresh, stale-read races, session isolation, focus/reconnect, hidden/offline polling, cancellation and non-overlapping requests.

Verified on 2026-10-16: all eight PostgreSQL integration tests passed against isolated PostgreSQL 18, along with 20 backend unit tests, backend application/test type checks and build, and frontend tests/lint/build. The integration database is temporary; the configured application database was not changed.
