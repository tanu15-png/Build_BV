# Three-website deployment

The repository contains three independently built React/Vite apps and one shared Express API plus its existing notification worker. Use one Supabase Auth/PostgreSQL project per environment. No new Prisma migration or database split is needed for portal separation; continue applying existing migrations once through the backend release process.

## Build and release

From the repository root, run `npm ci`. Supply the account and canteen apps' public Supabase environment variables at build time. The admin app needs no Supabase browser credentials. Configure its team password using backend-only ADMIN_ACCESS_PASSWORD in the runtime secret store. Run `npm run build`, or build independently:

```bash
npm run build --workspace=@spoonate/student
npm run build --workspace=@spoonate/canteen
npm run build --workspace=@spoonate/admin
```

Publish `apps/student/dist`, `apps/canteen/dist`, and `apps/admin/dist` to their respective HTTPS hosts. Static hosting must use an index.html fallback for application routes such as `/dashboard/orders/<uuid>` and `/auth/callback`. Root package installation is required even when only one app is built because shared workspace dependencies live at the repository root.

For the backend, install from its own lockfile (`npm --prefix backend ci`), run `npm --prefix backend run build`, and run the API (`npm --prefix backend start`) and worker (`npm --prefix backend run worker:start`) as separately supervised services. Keep all database credentials and server secrets in backend environment/secret storage. Run migrations as an explicit release step, never on API startup. Follow backend/README.md for database grants, backups and staging qualification.

## Hosts and proxy

Example domain mapping:

- students.example.edu → student build; backend `FRONTEND_ORIGIN=https://students.example.edu`
- canteen.example.edu → canteen build; backend `CANTEEN_ORIGIN=https://canteen.example.edu`
- admin.example.edu → admin build; backend `ADMIN_ORIGIN=https://admin.example.edu`

On each host, reverse-proxy `/api/` to the shared API, preserving the complete path, HTTP method, Origin, Cookie, Set-Cookie, and streaming behavior. Do not redirect browser requests to a separate API host. No cookie-domain rewriting is needed. Each frontend sends requests to its own host with a portal namespace:

- student: `/api/v1/student/...`
- canteen: `/api/v1/canteen/...`
- admin: `/api/v1/admin/...`

Use `deploy/nginx.conf.example` as the HTTP routing template behind a TLS terminator, or add the deployment platform's certificate configuration. Replace hostnames, build directories, and the API upstream. External traffic must use HTTPS; deployed environment validation requires it. Configure /health/live and /health/ready probes against the API service.

The catalog event stream must not be buffered or cached. Initially use one API replica; the current in-process catalog publisher requires a shared event transport before multiple API replicas are introduced. Keep the worker active for durable order notifications.

## Email and sessions

In Supabase Auth URL Configuration, allow the student HTTPS callback path (`https://<student-host>/auth/callback`). Student signup stays OTP-based. Canteen access uses only a name and member code; it has no email callback or Supabase browser keys. Admin access uses only the backend-configured team password, without a Supabase callback, email address, OTP or account activation. Keep ADMIN_ORIGIN configured for portal origin validation.

Session cookies have distinct names (`spoonate_student_session`, `spoonate_canteen_session`, `spoonate_admin_session`), portal-specific paths, HttpOnly and SameSite=Lax; HTTPS deployments also set Secure. CSRF cookies and signatures are scoped by portal. Cookies omit Domain, remaining host-only. Supabase browser storage and pending verification state are also namespaced. Backend origin and session-role checks reject attempts to use another portal's authentication.

Old unified cookies are ignored. Users sign in once on each portal after rollout, without recreating accounts or data. Ordinary login/logout is portal-local. Password resets intentionally revoke every application session for that same identity; disabling accounts or revoking memberships continues to end affected sessions.

## Release acceptance

Run frontend tests, lint and all three builds; backend tests, TypeScript checks and build. In staging, open all three sites in one browser and verify student signup/login, canteen name-and-code entry, admin team-password entry, student email links, account recovery, and order placement → preparation → collection. Log out of each portal and confirm the other two stay signed in. Verify direct deep links and the catalog event stream through the actual proxy. Live email delivery and production deployment require the operator's hosting/DNS/Supabase configuration.
