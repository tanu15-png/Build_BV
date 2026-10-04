# SpoonAte frontend

React/Vite frontend for Build BV, with student, canteen and admin routes.

```bash
npm install
npm run dev
```

Checks:

```bash
npm run test
npm run lint
npm run build
```

Students sign up with name, password and an exact `@banasthali.in` email, then return to login and use email/password. The prototype stores plaintext passwords in browser account records; new session records omit passwords. Real email OTP verification at signup and password reset, server-side password hashes and secure sessions are pending backend work.

Canteen members enter email, select a canteen and enter its access code. Each development code is exactly its canteen name. Production login will also verify an email OTP. The dashboard lists browser-local member emails and valid signed-in session counts. Confirmed removal revokes access and sessions and blocks rejoining with the shared code; backend enforcement and admin restoration remain planned.

Single-canteen carts, availability controls, estimated pickup, acceptance, preparation, readiness notifications and staff pickup verification use browser storage. New test orders have permanent UUIDs plus three-character uppercase alphanumeric pickup codes unique within their `Asia/Kolkata` allocation day across all canteens and statuses. Campus midnight makes a new daily namespace available without deleting history. Cards show day, items, code and canteen; pickup date/time displays in IST. Code uniqueness across devices/concurrent writes requires PostgreSQL enforcement.

Payment is disabled. The future paid flow collects payment only after canteen acceptance and exposes the pickup code only after backend-verified success. No cancellation/refund flow is implemented.

Sessions are per-tab and records synchronize within the same browser/origin. Closing a staff tab may leave its session counted until the 12-hour expiry; counts do not represent online presence. Menus and preparation estimates are sample data. Admin demo credentials remain `admin@campuseats.com` / `admin123`, and `campusEats*` storage keys are retained for compatibility with earlier prototypes.

The planned database is Supabase-managed PostgreSQL accessed by Express/Prisma. Supabase Auth is not currently adopted. There is no backend/API integration yet.

See the [project README](../README.md), [architecture](../architecture.md), [backend plan](../backend/backend.md), [scale plan](../scale.md) and [implementation checklist](../todo.md).
