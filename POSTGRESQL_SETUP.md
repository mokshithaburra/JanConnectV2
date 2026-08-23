# JanConnect PostgreSQL setup

JanConnect now uses the PostgreSQL Drizzle dialect and the `pg` driver. The application reads `DATABASE_URL` at runtime; no database URL is stored in source control, migrations, or this document.

## Configure privately

Set `DATABASE_URL` in the environment where JanConnect runs. Do not commit a `.env` file or paste credentials into source files. The expected shape is:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

The exact SSL option depends on the provider. For a local development database, a URL such as `postgresql://USER:PASSWORD@127.0.0.1:5432/janconnect` is appropriate when PostgreSQL is running in the same environment as the application.

## Apply the staged baseline

From the project root, after setting `DATABASE_URL` privately, review or regenerate the baseline migration and then apply it:

```bash
pnpm db:generate:pg
pnpm db:migrate:pg
```

The generated baseline is kept under `drizzle-pg/`. The previous MySQL migration history under `drizzle/` is preserved as an archive and must not be applied to PostgreSQL.

## Verify the connection

Run the type checker and tests after the migration:

```bash
pnpm check
pnpm test -- --run
```

Then start the application and verify authentication, initiative discovery, community reads/writes, bookmarks, profile stats, and moderation queries. If migrating existing production data, export and transform the old MySQL data separately before inserting it into PostgreSQL; do not assume that a schema baseline copies existing rows.

## Important safety note

The repository contains only schema and migration code. It does not contain a database password or provider credential. The migration is intentionally not applied by the development agent because the private PostgreSQL endpoint must be configured by the project owner in the target environment first.
