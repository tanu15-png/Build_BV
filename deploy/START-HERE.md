# What you need to do

The release files are prepared locally. This workspace has no authenticated Railway connection, so no hosting project, public site or paid resource has been created. The application still uses payment-free TEST ordering.

## 1. Push the project

Commit and push the current application changes to the existing GitHub repository `tanu15-png/Build_BV`, using your normal Git client. Keep `deploy/.production/` private: Git and Docker ignore it. The GitHub **Release checks** workflow will run lint, both dependency audits, builds, unit tests, isolated PostgreSQL integration tests and Docker runtime smoke tests. Wait for it to pass before release.

The workflow uses the official [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) actions. Its database/passwords are temporary test fixtures, not production credentials.

## 2. Create the Railway services

Create a project from that repository and add four services named exactly `api`, `worker`, `student`, `canteen`. Use repository root `/` for all four.

For new services, configure these directly in Railway Settings (the legacy Config File option is deprecated):

- `api`: Dockerfile builder, path `deploy/Dockerfile.backend`, start `npm start`, pre-deploy `npm run db:migrate`, healthcheck `/health/ready`.
- `worker`: Dockerfile builder, path `deploy/Dockerfile.backend`, start `npm run worker:start`, no pre-deploy command or healthcheck.
- `student` and `canteen`: Dockerfile builder, path `deploy/Dockerfile.frontend`, no custom start command, healthcheck `/health/live`.

Use one replica and On Failure restart policy with 10 retries. Leave serverless disabled. The JSON files in this directory remain references for the equivalent legacy configuration.

Do not add an admin service. Keep API/worker private, without public domains or TCP proxies. Generate public HTTPS domains for student and canteen, each targeting port 8080. Keep API at one replica.

## 3. Set your actual website addresses

From the project root, run this with your two generated HTTPS origins (no trailing slash):

```bash
npm run release:origins -- --student-origin https://YOUR-STUDENT-DOMAIN --canteen-origin https://YOUR-CANTEEN-DOMAIN
npm --prefix backend run release:check
```

The first command updates only the public addresses in both private backend configurations; it preserves credentials and generated secrets. The second command checks the service files, strict database TLS, restricted-role permissions and public Supabase Auth settings, without changing database records or sending email.

The certificate from Supabase's official dashboard source is packaged in `backend/certs`. Generated database URLs already reference its container path. Do not weaken `sslmode=verify-full`.

## 4. Import the prepared private variables

The files are in `deploy/.production/` on this computer. Open them privately and paste each into the corresponding Railway service's Variables → Raw Editor:

- `api.env` → `api`
- `worker.env` → `worker`
- `student.env` → `student`
- `canteen.env` → `canteen`

Do not paste these files into chat or commit them. API/worker share fresh session/OTP secrets. Only API has migration-owner credentials. Student receives only public Supabase build settings; canteen receives no database or Supabase credentials. The API_UPSTREAM reference assumes the API service is named `api`.

These files use the existing Supabase project and existing restricted application/migration connections, with verified TLS. They do not create a new database or copy/reset data. If you want a separate production Supabase project, replace its connections/public project settings in these private files and run the fresh-environment initialization in DEPLOYMENT.md instead.

## 5. Finish Supabase email settings

In your existing Supabase project:

1. Keep Email signup and Confirm email enabled; set minimum password length to 8.
2. Configure a working SMTP sender. Only enter SMTP credentials in Supabase's dashboard.
3. Set Site URL to the student HTTPS origin. Allow `/auth/callback`, `/auth/callback?flow=signup`, and `/auth/callback?flow=reset` on that same origin.
4. Copy `backend/email-templates/confirm-signup.html` into Confirm sign up, and `backend/email-templates/reset-password.html` into Reset password. Both use a numeric `{{ .Token }}`.
5. Confirm database backups are enabled and you know how to restore one.

The preflight can verify public Auth settings; it cannot verify actual inbox delivery, hosted templates or backups through a publishable key. Canteen login uses a name and the agreed password; it has no email setup.

## 6. Deploy and check

Deploy API first, then worker and the two frontends. API's pre-deploy command applies pending migrations automatically. Do not reseed/import/reset the existing menu or orders.

Open both HTTPS sites. Use your own college email to verify signup OTP, login and password recovery. Enter the canteen dashboard with your name and the agreed canteen password. Place one test order, fulfil it through Collected, verify tokens, redeem a reward, and open a promotional menu/offer. Confirm notifications, new-order sound after normal staff interaction, and phone layout.

At this point the live acceptance test is complete. No payment will be collected: payment integration requires a separate merchant/provider setup and is not part of this release.

## Already completed

Application tests, browser tests and local container runtime checks are recorded in DEPLOYMENT.md. All dependency advisories, including lint tooling, are now resolved. The production CA certificate and ignored service configuration files are prepared. Fresh backend secrets were generated without printing them. No real menu, prices, orders or discounts were changed.
