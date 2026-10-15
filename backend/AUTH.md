# Supabase Auth integration — 2026-10-15

Supabase Auth now manages passwords, email verification and recovery. Express verifies the exact Supabase access token through `/auth/v1/user` before linking the verified UUID to `users.supabase_subject`. Roles come from application records; Supabase user metadata cannot grant privileges. Existing application user IDs and order history are preserved. The identity-link migration is additive.

Express exchanges successful authentication for a random opaque `HttpOnly`, SameSite=Lax cookie. It stores an HMAC of the token, never the token itself. Cookie writes require an origin check and a signed double-submit CSRF token. Cookies use Secure when the frontend origin is HTTPS. The default absolute lifetime is 12 hours; idle timeout is not implemented. Every authenticated request checks account status and server-assigned role; staff requests also check membership and current access-code version. Sessions are shared between tabs, so use separate browser profiles to test different roles.

## Dashboard setup still required

In the SpoonAte Supabase project:

1. Keep the Email provider, Allow new signups and Confirm email enabled. Set the password minimum to 12 characters to match the signup/reset UI.
2. Configure custom SMTP. The selected development setup uses Gmail SMTP, port 587, sender `15.tanuverma@gmail.com`, sender name `SpoonAte`, and a separate Google app password. Passwords belong in the dashboard, never source control. Personal Gmail sending quotas are shared with Muselly and are not qualified for campus rollout.
3. Under Authentication → URL Configuration, use Site URL `http://localhost:5173` for development and allow redirect `http://localhost:5173/auth/callback**` (development wildcard). The callback uses `flow=signup`, `flow=staff`, `flow=admin-signup` or `flow=reset`. In production, replace localhost with the HTTPS application origin and allow only the intended callback URLs, including their flow query parameters.
4. Student signup requires a numeric OTP. Under Authentication → Email Templates → Confirm sign up, replace the email body with [email-templates/confirm-signup.html](email-templates/confirm-signup.html), which uses `{{ .Token }}` and contains no confirmation link. This dashboard change is required; a publishable key cannot update hosted templates. Magic link/Reset password templates may retain their existing link/code behavior. Resend is shown only on the verification screen, with a 60-second cooldown. Supabase independently enforces challenge and sending limits.
5. The Data API may remain disabled. Supabase Auth is separate; application tables remain accessible only through Express/Prisma.

Both `.env` files must use the project API origin (`https://PROJECT_REF.supabase.co`), not a dashboard URL. Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; backend uses `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `EMAIL_PROVIDER=supabase`. SMTP credentials are not needed in either file. Only the publishable key is used; no Supabase secret key is shipped or required for these flows.

Production hosting must proxy `/api` to Express on the frontend's origin, matching the development Vite proxy. A static-only host does not supply that API routing automatically. The current cookie design assumes this same-origin routing; unrelated frontend/API sites require a separate cookie/CORS deployment design.

## Operator and user flows

**Admin first activation:** open `/login`, choose Admin, select “First sign-in? Activate account”, and enter the provisioned email and initial password from private `.env.provisioned`. Express checks the existing admin role and initial salted password hash before requesting Supabase signup. Follow the email link (or enter its code), then log in normally. Successful verified identity binding clears the obsolete local password hash. If an account with this email already exists in Supabase Auth, use its password or password reset; activation never resets an existing Supabase password. Do not create a second application admin or copy prototype passwords.

**Student:** sign up with name, exact `@banasthali.in` email and a 12–256 character password, then enter the email OTP. Express submits the numeric code to Supabase, verifies the returned identity, activates the local profile and creates the application cookie session atomically. The student goes straight to the dashboard without another login. Later logins use email/password only, without requesting another OTP. Ordinary student/admin session exchange still requires a recent password-authentication claim; signup has its separate code-verification endpoint. Non-institutional identities cannot obtain student application access even if browser validation is bypassed. Forgot password is shown on login only, not signup.

**Staff:** select a canteen, enter member email and the provisioned code. Express validates the salted code and creates a ten-minute challenge bound to email, canteen and code version. Supabase then sends the email verification link/code. Completion requires a fresh email-authentication claim issued after the challenge began. The server locks the canteen, consumes the challenge once, rejects revoked memberships, and creates the scoped membership/session transactionally. Keep the link in the same browser where staff login began. Existing password or stale email sessions cannot complete a new staff challenge.

**Member management:** the canteen dashboard reads paginated members and shared valid-session counts from PostgreSQL. Removal locks the canteen and atomically revokes membership, its sessions and pending challenges, with an audit record. It preserves unrelated canteen memberships. Removed users cannot rejoin with the same shared code until an admin restores them. Restoration does not resurrect previous sessions; a fresh login is required.

**Reset/logout:** reset uses Supabase email recovery. Before saving the new password, the frontend asks Express to revoke the user's application sessions; if revocation fails, it does not claim a completed reset. It then updates the Supabase password and signs out Supabase sessions globally. Logout revokes the current application cookie session and clears the browser Supabase session. Server revocation is immediate; UI revalidates on focus/reconnect and every 30 seconds.

## Implemented Express endpoints

All paths below are under `/api/v1`; state-changing operations require the CSRF header and cookie.

| Endpoint | Behavior |
| --- | --- |
| `GET /auth/csrf` | Bootstrap signed CSRF token |
| `GET /auth/me` | Current verified application identity |
| `POST /auth/confirm-signup` | Accept institutional email + numeric OTP, verify it with Supabase, activate profile and issue student session |
| `POST /auth/admin/activate` | Check provisioned initial admin credentials, request confirmation |
| `POST /auth/admin/confirm` | Bind verified admin identity; no session |
| `POST /auth/canteen/login` | Validate canteen code, create email-bound staff challenge |
| `POST /auth/session` | Verify Supabase bearer, validate role/proof and issue app cookie |
| `POST /auth/logout` | Revoke current app session |
| `POST /auth/revoke-sessions` | Verified bearer revokes all linked app sessions |
| `GET /canteens/:id/members` | Own-canteen pagination and shared counts |
| `POST /canteens/:id/members/:memberId/revoke` | Own-canteen versioned removal |
| `PATCH /admin/memberships/:id` | Audited admin restore/revoke |
| `PATCH /admin/users/:id` | Audited enable/disable; disable revokes sessions |
| `POST /admin/canteens/:id/access-code` | Audited code rotation and session/challenge invalidation |

Signup initiation, password login, recovery and resend use the official Supabase browser client. Student signup OTP verification goes through Express, which verifies the numeric code with Supabase before issuing the application session; a bearer token alone cannot replace that code. The original custom password/OTP endpoints in the older plan/fixtures are superseded. PostgreSQL limits bound code guessing and session exchange; Supabase separately enforces direct Auth API limits. Admin maintenance APIs are implemented; their dedicated UI remains future work.

## Verification and limits

```bash
cd backend
npm run auth:check
npm run db:check
npm test
npm run typecheck
npm run build
# Fresh, dedicated LOCAL test database only; fixtures never use Supabase:
AUTH_TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:PORT/spoonate_auth_test npm run test:auth
```

On 2026-10-15, public Auth settings accepted the configured key and confirmed email signup with required verification. Both committed migrations are applied to the connected development database. Fourteen backend unit/security tests, sixteen PostgreSQL auth-suite cases (parent plus fifteen scenarios), frontend auth/order tests, frontend lint, both TypeScript configurations and production builds pass. Local database-backed auth tests used temporary PostgreSQL 18 with mocked Supabase responses; they are not live email or Supabase Auth acceptance tests. Checks include wrong/reused signup codes, automatic signup sessions, password-only subsequent login, forged roles, domain restrictions, identity binding, cookie/CSRF/origin rules, staff proofs, code rotation, shared counts, simultaneous login/removal, restoration, disabling and reset/logout revocation.

Live SMTP inbox delivery, callback allowlist and browser acceptance across separate devices remain to be verified by the operator. Gmail quotas, campus load, restoration, hosting and production TLS remain deployment work. Carts, orders, menus/availability and notifications still use the browser prototype; real authentication does not make those features persistent across devices. Prototype plaintext account/member/session storage is removed on startup; prototype passwords are never imported.
