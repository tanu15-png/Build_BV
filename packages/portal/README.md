# Shared portal package

Common React providers, authentication UI, API client, hooks, components and styles for the three apps in `apps/`. Dashboard route trees live in their respective apps; the shared menu editor is used by canteen and admin. Each Vite config pins its portal at build time. API and event-stream requests use `/api/v1/<portal>/...`.

Run `npm test`, `npm run lint` and `npm run build` from the repository root. Configure public Supabase settings separately in each app's `.env`; backend secrets must never be placed in VITE variables. See the root README and DEPLOYMENT.md.
