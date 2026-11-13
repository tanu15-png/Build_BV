# Railway deployment

Start with [START-HERE.md](START-HERE.md) for your exact account steps and prepared private variable files.

Create **four services** from this repository: `api`, `worker`, `student`, `canteen`. There is no admin service. All services use repository root `/` as their build context.

## Service configuration

Set the Railway Config File path:

- API: `/deploy/railway-api.json`
- Worker: `/deploy/railway-worker.json`
- Both frontends: `/deploy/railway-frontend.json`

Clear automatically detected build/start overrides. Frontends use the Nginx image entrypoint. The API pre-deploy step runs migrations. The worker starts independently and never runs migrations. Use one API replica until catalog events have a shared transport.

## Frontends

Set `PORT=8080` and `PORTAL=student` or `PORTAL=canteen`. On each frontend:

```text
API_UPSTREAM=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000
```

On student only, supply build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Rebuild after changing them. Never expose server secrets through Vite variables.

Generate HTTPS domains for the two frontends targeting port 8080. Keep API and worker private, with no public domain or TCP proxy. Keep all four services in the same trusted project/environment. API listens on port 4000 with a dual-stack listener.

The frontend proxy forwards Railway's canonical `X-Real-IP` to the private API as a single `X-Forwarded-For` address. Set `TRUST_PROXY_HOPS=1` on API; this avoids treating every user as the same proxy IP for login rate limiting. This template assumes Railway HTTP ingress; see [Railway's header specification](https://docs.railway.com/networking/public-networking/specs-and-limits). Do not reuse that trust boundary for untrusted direct access.

## API and worker variables

Configure these privately on both services:

```text
NODE_ENV=production
APP_ENV=production
DATABASE_URL=<restricted application-role connection, sslmode=verify-full>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
FRONTEND_ORIGIN=https://<student-domain>
CANTEEN_ORIGIN=https://<canteen-domain>
SESSION_SECRET=<random secret, at least 32 characters>
OTP_SECRET=<different random secret, at least 32 characters>
EMAIL_PROVIDER=supabase
ORDER_MODE=TEST
SEED_DEVELOPMENT_DATA=false
EMAIL_VERIFICATION_BYPASS=false
DB_POOL_MAX=5
DB_TIMEOUT_MS=10000
```

API additionally needs `PORT=4000`, `TRUST_PROXY_HOPS=1`, and `MIGRATION_DATABASE_URL` (owner credentials through direct/session connectivity, not transaction pooling). Worker does not need migration credentials. An optional backend `CANTEEN_ACCESS_PASSWORD` overrides the agreed member-code provisioning value; never put it in frontend variables or logs.

No admin host/password is required. Origins must be distinct exact HTTPS origins without trailing slashes. TLS certificates must validate; provide a CA when necessary instead of disabling verification.

## Database, menu and email

Follow [DEPLOYMENT.md](../DEPLOYMENT.md) for role grants, fresh-environment initialization, menu import and default poster setup. Keep development seeds disabled in production. Configure working SMTP and student OTP/recovery templates in Supabase; see [AUTH.md](../backend/AUTH.md). Allow `https://<student-domain>/auth/callback` and use the student host as the Supabase site URL. Canteen login needs no email callback.

Deploy API first after variables, domains and database permissions are configured, then worker and frontends. Verify health/readiness, SPA deep links, poster uploads, streamed events, real login, ordering, rewards and offer expiry over the real HTTPS hosts. Enable backups and monitor notification failures/connection usage.

Local code qualification does not verify Railway account settings, DNS, real SMTP, production TLS or deployed connectivity. The three Docker images have been built and smoke-tested locally using isolated test settings. Orders remain payment-free TEST mode.
