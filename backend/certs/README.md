# Supabase database CA

`supabase-prod-ca-2021.crt` is a public CA certificate, not a credential. Its download URL is taken from [Supabase's dashboard configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json):

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Downloaded over verified HTTPS on 2026-11-13. SHA-256 certificate fingerprint:

`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Valid until 2031-04-26. The backend Dockerfile copies this directory to `/app/certs`. Generated production connection URLs use `sslmode=verify-full` and this root certificate. The release preflight maps that container path to the local certificate for read-only verification. No certificate or hostname verification is disabled.

For a future provider CA rotation, obtain the replacement from the authenticated project dashboard or its verified official source, update the fingerprint, and rerun strict TLS qualification before release. See [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).
