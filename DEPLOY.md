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
| `JWT_SECRET` | yes | Signs session cookies (sessions last 30 days, `SESSION_TTL_MS` in `shared/const.ts`). At least 32 characters in production, e.g. `openssl rand -base64 48`. Changing it logs everyone out. |
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID (server side). |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret. |
| `OWNER_OPEN_ID` | no | Google account `sub` that becomes admin on its next login. |
| `SUPABASE_URL` | yes in production | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes in production | Server only. Never expose it to the browser or commit it. |
| `VITE_GOOGLE_CLIENT_ID` | build time | Same value as `GOOGLE_CLIENT_ID`. Baked into the client bundle at build. |
| `VITE_GOOGLE_MAPS_API_KEY` | build time | Baked into the client bundle at build. Restrict it (see below). |
| `VITE_GOOGLE_MAPS_MAP_ID` | build time, required in production | Map ID for advanced markers. Development falls back to Google's `DEMO_MAP_ID`; production builds have no fallback, so markers won't render without it. |

`.env.example` lists the same variables. `VITE_*` values must be present when `pnpm build` runs; changing them later requires a rebuild.

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm build              # client to public/, server to dist/index.js
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
3. Create a Map ID in Cloud Console (Map Management, JavaScript, vector or raster) and set it as `VITE_GOOGLE_MAPS_MAP_ID` before `pnpm build`. Only development builds fall back to `DEMO_MAP_ID`.

## Supabase Storage

1. Storage → **New bucket** → name `post-media`, **Public bucket: off**.
2. In the bucket settings, set the file size limit to **3 MB** and allowed MIME types to `image/jpeg, image/png, image/webp, image/gif`. The server already enforces both; this is a second layer.
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
- [ ] Maps key restricted by referrer and API; `VITE_GOOGLE_MAPS_MAP_ID` set at build time.
- [ ] `post-media` bucket is private and the category images are uploaded; a category card image loads.
- [ ] Image upload on the Community page works while signed in and is rejected when signed out.
- [ ] `GET /healthz` returns 200 through the load balancer and is wired to its health check.
- [ ] Response headers include `Content-Security-Policy` and `Strict-Transport-Security`; the browser console shows no CSP violations on Home, Explore (map view) and Community.
- [ ] `OWNER_OPEN_ID` set, and the admin panel is reachable only for that account.
- [ ] `.env` is not in the image or repository (`.dockerignore` and `.gitignore` exclude it).
- [ ] `pnpm audit` reviewed; remaining advisories are the known dev-only ones (vitest 2.x) and drizzle-orm 0.44 (see below).
- [ ] Logs are collected; search for `[tRPC] cause:`, `[Database]` and `[StorageProxy]` after launch.

## Deploying to Vercel

The Express app runs as a single Vercel Function (Fluid compute). `server.js` at the repo root re-exports the bundle that `pnpm build` writes to `dist/index.js`; the client build goes to `public/`, which Vercel serves from its CDN. `vercel.json` sets the install and build commands, sends every path except `/api/*`, `/media/*` and `/healthz` to `index.html` (so `/explore`, `/admin` etc. work on refresh), and applies the same security headers the server sends.

### Project settings

| Setting | Value |
|---|---|
| Framework Preset | **Express** (if Vercel suggests Vite, change it) |
| Install Command | `pnpm install --frozen-lockfile` (also set in `vercel.json`) |
| Build Command | `pnpm build` (also set in `vercel.json`) |
| Output Directory | leave empty; the Express preset serves `public/` |
| Root Directory | repo root |
| Function region | same region as the Supabase project (Settings → Functions → Function Region, e.g. Mumbai `bom1` for Supabase `ap-south-1`) |

### Environment variables

Set these for Production (and Preview if you use it). `VITE_*` values are compiled into the client during the build, so redeploy after changing them.

| Variable | When it's read |
|---|---|
| `NODE_ENV` = `production` | runtime (enables CSP, secure cookies, DB TLS, error masking) |
| `DATABASE_URL` | runtime; Supabase **transaction pooler**, port **6543**: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` (no `?sslmode`) |
| `DATABASE_POOL_MAX` = `1`–`3` | runtime; each function instance keeps its own pool |
| `DATABASE_CA_CERT` | runtime (recommended) |
| `JWT_SECRET` | runtime |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | runtime |
| `OWNER_OPEN_ID` | runtime (optional) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | runtime |
| `VITE_GOOGLE_CLIENT_ID` | **build time** |
| `VITE_GOOGLE_MAPS_API_KEY` | **build time** |
| `VITE_GOOGLE_MAPS_MAP_ID` | **build time** |

`PORT` is not used on Vercel.

### Database

- Use the transaction pooler (6543) for the app: functions scale out, and session-mode or direct connections run out quickly. The app is compatible with transaction mode: it uses no named prepared statements, `SET`, `LISTEN`/`NOTIFY`, advisory locks or temp tables, and the admin `SELECT ... FOR UPDATE` calls run inside a single transaction, which the pooler keeps on one connection.
- Migrations are not run by the build. Run them yourself before deploying a release that needs them, from your machine, against the **session pooler (5432) or direct connection**: `DATABASE_URL=<session or direct url> pnpm db:migrate:pg`.

### Uploads and rate limits

- Vercel rejects request bodies over 4.5 MB. Images are sent as base64 JSON (about 4/3 of the file size), so the upload limit is **3 MB** (`MAX_UPLOAD_BYTES` in `shared/const.ts`).
- Rate limits use in-memory counters, which are **per function instance** on Vercel: the effective limit grows with the number of warm instances. For strict limits, put Vercel Firewall rate-limiting rules on `/api/oauth/callback`, `/api/upload-media` and `/api/trpc`.
- `trust proxy` is 1 on Vercel, and Vercel overwrites `X-Forwarded-For` with the client IP, so `req.ip` is the real client.

### Google OAuth for the Vercel domain

Add to the OAuth client (and restrict the Maps key to the same referrers):

- Authorized JavaScript origin: `https://<project>.vercel.app` (and your custom domain)
- Authorized redirect URI: `https://<project>.vercel.app/api/oauth/callback` (and `https://<custom-domain>/api/oauth/callback`)

Preview deployments get their own URLs, which Google won't accept unless each is registered, so test login on the production or a fixed domain.

### After the first deploy

- `GET https://<domain>/healthz` returns `{"status":"ok"}`.
- Refresh on `/explore` and `/admin` loads the app (not a 404).
- Response headers on `/` include `Content-Security-Policy`.
- If you change the CSP in `server/_core/index.ts`, update the copy in `vercel.json` too; pages served from the CDN use that one.

## Known remaining advisories

- **vitest 2.x** (and its `tinypool`, `@vitest/mocker`, Vite 5, esbuild 0.21): dev/test only, never shipped. Fixing requires vitest 3+.
- **drizzle-orm 0.44** (GHSA-gpj5-g38j-94v9, identifier escaping): the app never builds SQL identifiers from user input. The fix is in 0.45, which is a breaking release under 0.x semver; upgrade deliberately and re-test.
