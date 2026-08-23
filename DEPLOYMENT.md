# JanConnect Deployment Guide

This guide describes how to run JanConnect as a containerized Node application with PostgreSQL and Drizzle ORM. It supports local development, private infrastructure, and a single-host production deployment. The repository includes `Dockerfile`, `docker-compose.yml`, and `compose.env.example`.

> **Security rule:** Never commit `.env`, database passwords, JWT secrets, OAuth credentials, or storage credentials. Keep them in your deployment platform’s secret manager or in a local untracked `.env` file.

## Architecture

| Service | Container | Responsibility | Persistent storage |
|---|---|---|---|
| PostgreSQL | `db` | Stores JanConnect users, profiles, organizations, initiatives, posts, comments, likes, bookmarks, and reports. | `postgres_data` Docker volume. |
| Drizzle migration runner | `migrate` | Waits for PostgreSQL health, then applies the generated PostgreSQL migrations once. | None. It exits after completion. |
| JanConnect application | `app` | Serves the built Vite frontend and Node/Express/tRPC backend on port 3000. | None; media uses the configured S3-compatible storage. |

The application image runs the complete build pipeline: `vite build` creates the frontend assets and esbuild creates `dist/index.js` for the server. The production server reads `PORT` and `DATABASE_URL` at runtime. The Compose network uses the service hostname `db`, not `localhost`, for the database connection.

## Prerequisites

Install Docker Engine with the Compose plugin and verify that both commands work:

```bash
docker --version
docker compose version
```

The application source must include `pnpm-lock.yaml`, the PostgreSQL schema under `drizzle/`, and the generated PostgreSQL migration directory under `drizzle-pg/`. The container installs dependencies with the pnpm version declared in `package.json` through Corepack.

## Local Compose deployment

Copy the non-secret template to an untracked environment file and replace both placeholder secrets:

```bash
cp compose.env.example .env
```

Use a long random value for `POSTGRES_PASSWORD` and a separate long random value for `JWT_SECRET`. The default Compose database connection is assembled internally as:

```text
postgresql://POSTGRES_USER:POSTGRES_PASSWORD@db:5432/POSTGRES_DB
```

Build and start the database, one-shot migration runner, and application:

```bash
docker compose up --build
```

The `db` service first becomes healthy through `pg_isready`. The `migrate` service then runs `pnpm db:migrate:pg`. Only after that service exits successfully does the `app` service start. Open `http://localhost:3000` when the logs show the application server is listening.

For a detached deployment, use:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

The application is exposed through `${APP_PORT:-3000}` on the host. To use another host port, set `APP_PORT=8080` in `.env`; the container still listens on port 3000.

## Migration workflow

The Compose migration runner is intentionally separate from the long-running application. This makes migration failures visible and avoids hiding schema changes inside the application process. To rerun migrations after a schema change:

```bash
docker compose run --rm migrate
```

Then restart the application if necessary:

```bash
docker compose up -d app
```

The package scripts are also available outside containers when Node, pnpm, and a private PostgreSQL `DATABASE_URL` are configured:

```bash
pnpm db:generate:pg
pnpm db:migrate:pg
pnpm db:check:pg
pnpm check
pnpm test -- --run
```

Review generated SQL before applying it to a production database. The current migration sequence is stored under `drizzle-pg/`; apply the baseline before relationship and constraint migrations. Drizzle dialect conversion does not migrate existing MySQL/TiDB rows. Existing data requires a separately reviewed export, transformation, import, and reconciliation process.

## External PostgreSQL deployment

For Supabase, Neon, RDS, Cloud SQL, or another managed provider, retain the `app` service but replace the Compose-generated `DATABASE_URL` with the provider’s private secret. The URL normally has this shape:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Do not put the URL in `docker-compose.yml`. Use an environment interpolation or a platform secret, for example:

```yaml
services:
  app:
    environment:
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL in the deployment secret manager}
```

When using an external database, remove the local `db` dependency and run the migration command as a protected release job before starting application replicas. Do not let every replica run migrations concurrently.

## Production configuration

The application requires `DATABASE_URL` and `JWT_SECRET`. OAuth and storage values depend on the deployment’s enabled integrations. Public `VITE_*` values are consumed during the Docker image build and should be supplied as Compose build arguments or platform build-time variables. They are not substitutes for server-side secrets.

| Variable | Required | Scope | Purpose |
|---|---:|---|---|
| `POSTGRES_DB` | Local Compose | Compose | Database name for the local PostgreSQL container. |
| `POSTGRES_USER` | Local Compose | Compose | Database user for the local PostgreSQL container. |
| `POSTGRES_PASSWORD` | Local Compose | Secret | PostgreSQL password. |
| `DATABASE_URL` | External DB deployments | Runtime | PostgreSQL connection string; Compose assembles it for the local `db` service. |
| `JWT_SECRET` | Yes | Runtime | Signs application session cookies/tokens. |
| `PORT` | No | Runtime | Container port; defaults to 3000. |
| `VITE_APP_ID` | Usually | Build time | Public application identifier. |
| `VITE_APP_TITLE` | Usually | Build time | Public application title. |
| `VITE_OAUTH_PORTAL_URL` | OAuth deployments | Build time | Public OAuth portal URL. |
| `OAUTH_SERVER_URL` | OAuth deployments | Runtime | Server-side OAuth service URL. |
| `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` | Enabled server integrations | Runtime | Existing server-side Manus services such as storage or maps. |
| `VITE_FRONTEND_FORGE_API_URL` and `VITE_FRONTEND_FORGE_API_KEY` | Map-enabled frontend | Build time | Existing browser map proxy configuration. |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Owner features | Runtime | Project owner identity for existing system features. |

Use a secret manager for all runtime secrets in hosted environments. Rotate `POSTGRES_PASSWORD` and `JWT_SECRET` through the platform rather than editing the image. If `JWT_SECRET` changes, existing sessions may be invalidated.

## Backups and data safety

The `postgres_data` volume is the local database’s source of truth. Back it up before destructive operations, schema changes, or volume removal. A basic logical backup is:

```bash
docker compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  > janconnect-$(date +%Y%m%d-%H%M%S).dump
```

Restore only into a deliberately selected target database after verifying the dump and application compatibility:

```bash
docker compose exec -T db pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean --if-exists \
  < janconnect-backup.dump
```

For managed PostgreSQL, use the provider’s snapshot and point-in-time recovery facilities. Do not use `docker compose down -v` unless the local database can be destroyed; the `-v` flag deletes the named data volume.

## Health checks and operations

Inspect service state and recent logs with:

```bash
docker compose ps
docker compose logs --tail=200 db
docker compose logs --tail=200 migrate
docker compose logs --tail=200 app
```

If migrations fail, inspect the migration logs first. Correct the schema or connection configuration, then rerun `docker compose run --rm migrate`. If the database is healthy but the app cannot connect, confirm that `DATABASE_URL` uses `db` as the hostname inside Compose and that the application is not using `localhost`.

To stop the stack while preserving data:

```bash
docker compose down
```

To rebuild after source or dependency changes:

```bash
docker compose build --no-cache app migrate
docker compose up -d
```

## Deployment checklist

| Check | Expected result |
|---|---|
| Secrets | `.env` is untracked; no secret literals are committed. |
| Build | `docker compose build` completes the frontend and server build. |
| Database | PostgreSQL health check becomes healthy. |
| Migration | `migrate` exits with code 0 and applies the ordered `drizzle-pg` migrations. |
| Runtime | `app` listens on `PORT` and reaches PostgreSQL using the Compose service hostname. |
| Auth | OAuth URLs and JWT secret are configured for the target environment. |
| Storage | S3-compatible storage configuration is available for community media. |
| Backups | A tested PostgreSQL backup exists before production migration. |
| Monitoring | Application, migration, and PostgreSQL logs are collected by the host or platform. |
| Scaling | Only one release job runs migrations; application replicas start after migration success. |

## Limitations and project-specific notes

This repository’s server is a Node/Express/tRPC application, not a FastAPI process. The Compose configuration therefore runs the Node image and the Drizzle PostgreSQL migration commands already defined in `package.json`. The application still uses existing Manus OAuth, Forge map proxy, and S3-compatible storage integrations where configured; removing the Forge LLM integration does not remove those unrelated services.

The Dockerfile is provided for this Compose deployment because Compose needs to build the complete frontend/server image. Manus WebDev’s managed deployment can auto-generate a Node image; if the project is deployed there, follow the platform’s checkpoint and secret workflow rather than committing local deployment credentials.

## References

1. [`package.json`](./package.json) — Build, start, check, test, and PostgreSQL Drizzle scripts.
2. [`Dockerfile`](./Dockerfile) — Production image build and runtime command.
3. [`docker-compose.yml`](./docker-compose.yml) — PostgreSQL, migration, and application services.
4. [`drizzle.config.ts`](./drizzle.config.ts) — PostgreSQL Drizzle Kit configuration.
5. [`drizzle/schema.ts`](./drizzle/schema.ts) — PostgreSQL tables, enums, constraints, and indexes.
6. [`POSTGRESQL_SETUP.md`](./POSTGRESQL_SETUP.md) — Private PostgreSQL setup notes.
