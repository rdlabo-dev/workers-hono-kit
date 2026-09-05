---
title: Migrations and testing
---

# Migrations and testing

These helpers are for Node.js tooling, not Worker request bundles. Import them from their dedicated
entry points. The consumer owns migrations, credentials, test fixtures, and database provisioning.

## Drizzle configuration

`workersDrizzleConfig` from `/drizzle` builds a MySQL Drizzle Kit configuration with snake-case
casing. Supply your `database`, `schema`, and `out` paths explicitly.
`workersDrizzleConfig` automatically reads `DB_SECRET`: when set, its connection details override
even explicitly supplied `database`, host, port, user, and password options, as well as `DB_*`
environment variables. Before running migrations, verify the secret's target; specifying a local
`database` option alone does not restrict the connection to that database.
`resolveDbSecret()` reads `DB_SECRET` JSON (`host`, `username`, `password`, `dbname`, optional
`port`). It returns `undefined` if unset and throws for invalid input rather than silently falling
back. Never commit or log database secrets.

## Existing-database baseline

`baselineMigrations({ db, migrationsFolder })` from `/migrations` records the first migration as
applied **without executing its schema SQL**. It does not verify that the existing schema matches
that SQL. Compare them, back up the target, and confirm credentials before invoking it.

For a fresh database, run the normal Drizzle migrator, not baseline. Baseline refuses an empty
database or unexpected migration history and is a no-op if the baseline marker already exists.

The installed CLI is `workers-mysql-db-baseline --migrations ./drizzle`. It uses `DB_SECRET` or
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. This command writes migration
metadata; it is not a dry run. `/baseline-cli` exports `runBaselineCli` for tooling integrations.

## Local tests

`createTestDb({ dbName, migrationsFolder, connection })` from `/testing` returns fixture helpers.
Use an isolated disposable database and explicit local connection settings:

- `resetSchema()` **drops and recreates the database**, then applies migrations.
- `truncateAll(pool)` deletes table contents, excluding migration bookkeeping.
- `seed(pool, table, row)` inserts a fixture.
- `createTestPool()` creates a pool; close it with `pool.end()` after testing.
- `mysqlReachable()` probes connectivity, not schema correctness.

Never point these helpers at shared or production data. Distinct test runs should use distinct
database names. `createPoolDatabase({ pool, orm })` uses one pool for reads/writes and closes it
on `dispose()`. `createNoopDatabase()` returns empty reads and throws on unexpected writes or
transactions; it is a stub, not an acceptance test against MySQL.

See [API](./api.md) for the available types.
