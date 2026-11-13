# Authentication setup

The active application has two portals: students and canteen. The admin website/API are retired. Students use Supabase email/password and numeric verification/recovery codes. Canteen members enter a name and the agreed canteen password; they need no email, OTP, Supabase browser keys or callback.

## Supabase dashboard settings

- Enable Email, Allow new signups, and Confirm email. Use a minimum password length of 8.
- Configure your verified SMTP sender in Supabase; SMTP passwords do not belong in frontend variables or the repository.
- Set Site URL to the actual student HTTPS origin. Allow its `/auth/callback`, `/auth/callback?flow=signup`, and `/auth/callback?flow=reset` URLs. Development may additionally use the corresponding localhost:5173 URLs.
- Confirm sign up: use [confirm-signup.html](email-templates/confirm-signup.html), containing `{{ .Token }}`.
- Reset password: use [reset-password.html](email-templates/reset-password.html), containing `{{ .Token }}`. Set the subject to Your SpoonAte password reset code. Save the hosted template and request a fresh message afterward.

A publishable key cannot update SMTP/templates or verify inbox delivery. Those account settings require your Supabase dashboard access. Canteen and admin callback URLs are not needed.

## Service variables and cookies

Student build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. API/worker: matching `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, exact student/canteen HTTPS origins, distinct shared backend session/OTP secrets, and the restricted database connection. See [START-HERE.md](../deploy/START-HERE.md) for prepared private files.

Frontends proxy their own `/api/` paths to Express. Application cookies are host-only, HttpOnly, SameSite=Lax and Secure on HTTPS; student and canteen cookies use separate names and portal paths. Signed CSRF and origin checks protect writes. PostgreSQL stores HMACs of session tokens. Every authenticated request checks account status and role; canteen sessions also require an active membership and current code version.

## User behavior

Students register with a name, exact `@banasthali.in` address and 8–256 character password, then enter the emailed signup code. Verification creates the application session immediately. Subsequent login uses email/password. Recovery verifies a numeric email code before changing the password and revokes prior application sessions. Browser validation is backed by server-side domain and identity checks; metadata cannot grant staff privileges.

Canteen entry reuses a normalized named membership scoped to the sole active canteen. Removed/disabled members and obsolete code versions cannot retain access. Member management and code rotation remain canteen-scoped. Legacy email-based staff endpoints are compatibility paths, not the current UI.

## Verification

`npm --prefix backend run release:check` checks the prepared production service files and public Auth settings without sending email. `npm --prefix backend run auth:check` checks local development project settings. Automated authentication tests use isolated PostgreSQL and mocked Supabase responses; real delivery/recovery acceptance must be completed with your own college email on the deployed HTTPS host.
