# Deploying JanConnect

JanConnect is a single Node process (Express + tRPC) that also serves the built React app. It needs PostgreSQL, a Google OAuth client, a Google Maps API key and a Supabase Storage bucket.

## Environment variables

The server checks these at startup and exits with a list of what is missing.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` for real deployments. Enables CSP, `trust proxy`, secure cookies, DB TLS and generic error messages. |
| `PORT` | no | Defaults to `3000`. |
| `DATABASE_URL` | yes | `postgresql://USER:PASSWORD@HOST:5432/DATABASE`. Do not add `?sslmode=...`; it overrides the app's TLS settings. |
| `DATABASE_CA_CERT` | recommended | PEM text of the database CA. When set, the server certificate is verified. Without it TLS is still used, but unverified (a warning is logged). |
| `DATABASE_POOL_MAX` | no | Max pooled connections, default `10`. Keep it below your pooler's per-client limit. |
| `JWT_SECRET` | yes | Signs session cookies. At least 32 characters in production, e.g. `openssl rand -base64 48`. Changing it logs everyone out. |
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID (server side). |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret. |
| `OWNER_OPEN_ID` | no | Google account `sub` that becomes admin on its next login. |
| `SUPABASE_URL` | yes in production | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes in production | Server only. Never expose it to the browser or commit it. |
| `VITE_GOOGLE_CLIENT_ID` | build time | Same value as `GOOGLE_CLIENT_ID`. Baked into the client bundle at build. |
| `VITE_GOOGLE_MAPS_API_KEY` | build time | Baked into the client bundle at build. Restrict it (see below). |

`.env.example` lists the same variables. `VITE_*` values must be present when `pnpm build` runs; changing them later requires a rebuild.

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm build              # client to dist/public, server to dist/index.js
pnpm db:migrate:pg      # apply drizzle-pg migrations (run once per release, not per replica)
pnpm start              # NODE_ENV=production node dist/index.js
```

- Health check: `GET /healthz` returns `200 {"status":"ok"}` when the database answers, `503` otherwise.
- The process shuts down cleanly on `SIGTERM`/`SIGINT` (stops accepting connections, closes the DB pool, exits within 10 s).
- Run it behind exactly one reverse proxy or load balancer that terminates TLS and sets `X-Forwarded-For` / `X-Forwarded-Proto`. The app trusts one proxy hop; adjust `app.set("trust proxy", 1)` in `server/_core/index.ts` if you have more.
- Rate limits are per client IP and per process: 20 requests / 15 min on `/api/oauth/callback`, 30 / 15 min on `/api/upload-media`, 300 / min on `/api/trpc`. With several replicas each keeps its own counters.

## Google OAuth

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID (type "Web application"):

1. **Authorized JavaScript origins:** `https://your-domain.example`
2. **Authorized redirect URIs:** `https://your-domain.example/api/oauth/callback`
   The app builds this from the page origin, so it must match the public URL exactly (scheme, host, no trailing slash). Add `http://localhost:3000/api/oauth/callback` separately for local development.
3. OAuth consent screen: publish it (or add test users), with scopes `openid`, `email`, `profile`.
4. To make yourself admin, log in once, read your `openId` from the `users` table, set `OWNER_OPEN_ID` to it, and log in again.

## Google Maps

1. Enable **Maps JavaScript API** and **Places API** for the key.
2. Restrict the key to **HTTP referrers** `https://your-domain.example/*` (plus `http://localhost:3000/*` for development) and to those APIs only. The key is public in the bundle; the referrer restriction is what protects it.
3. `client/src/components/Map.tsx` uses `mapId: "DEMO_MAP_ID"`, which is meant for development. Create a Map ID in Cloud Console (Map Management) for production.

## Supabase Storage

1. Storage → **New bucket** → name `post-media`, **Public bucket: off**.
2. In the bucket settings, set the file size limit to **5 MB** and allowed MIME types to `image/jpeg, image/png, image/webp, image/gif`. The server already enforces both; this is a second layer.
3. Do not add storage policies for `anon`/`authenticated`. Only the server (service role) reads and writes; browsers get short-lived signed URLs through `/media/*`.
4. Upload the category images to the bucket root with these exact names:
   `tree-planting_bcf46eee.jpg`, `community-cleanup_713c313f.jpg`, `community-response_073bea00.jpg`, `blood-donation_1347c69e.jpg`, `disaster-relief_7502ce0b.jpg`, `public-action_c1407b2e.jpg`, `relief-response_f57f47c4.jpg`.
5. If the database is Supabase Postgres, apply the RLS migration (`drizzle-pg/0001_enable_rls.sql`) with the same role the app connects as, so the app keeps access as table owner.

## Pre-launch checklist

- [ ] `NODE_ENV=production`, and every required variable is set (the server refuses to start otherwise).
- [ ] `JWT_SECRET` is random, at least 32 characters, and differs from development.
- [ ] `DATABASE_CA_CERT` is set (no "certificate is not verified" warning in the logs).
- [ ] Migrations applied: `pnpm db:migrate:pg`.
- [ ] Google OAuth redirect URI and JavaScript origin match the production domain; login round-trip works.
- [ ] Maps key restricted by referrer and API; production Map ID configured.
- [ ] `post-media` bucket is private and the category images are uploaded; a category card image loads.
- [ ] Image upload on the Community page works while signed in and is rejected when signed out.
- [ ] `GET /healthz` returns 200 through the load balancer and is wired to its health check.
- [ ] Response headers include `Content-Security-Policy` and `Strict-Transport-Security`; the browser console shows no CSP violations on Home, Explore (map view) and Community.
- [ ] `OWNER_OPEN_ID` set, and the admin panel is reachable only for that account.
- [ ] `.env` is not in the image or repository (`.dockerignore` and `.gitignore` exclude it).
- [ ] `pnpm audit` reviewed; remaining advisories are the known dev-only ones (vitest 2.x) and drizzle-orm 0.44 (see below).
- [ ] Logs are collected; search for `[tRPC] cause:`, `[Database]` and `[StorageProxy]` after launch.

## Known remaining advisories

- **vitest 2.x** (and its `tinypool`, `@vitest/mocker`, Vite 5, esbuild 0.21): dev/test only, never shipped. Fixing requires vitest 3+.
- **drizzle-orm 0.44** (GHSA-gpj5-g38j-94v9, identifier escaping): the app never builds SQL identifiers from user input. The fix is in 0.45, which is a breaking release under 0.x semver; upgrade deliberately and re-test.
