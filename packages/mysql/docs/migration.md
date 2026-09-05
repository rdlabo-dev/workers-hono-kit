---
title: Migration
---

# Migration

The database utilities are standalone from kit `0.12.0`. Install `@rdlabo/workers-mysql` directly;
keep `@rdlabo/workers-hono-kit` only if using its Hono integration. `mysql2` is included, while
`drizzle-orm` remains an optional peer for `/drizzle` and `/testing`. TypeScript consumers need
the Node declarations described in the [README](../README.md).

| Previous import                        | New import                         |
| -------------------------------------- | ---------------------------------- |
| Kit root `createContainerRuntime`      | `@rdlabo/workers-hono-kit/mysql`   |
| Kit root `retryWhenDeadlock`           | `@rdlabo/workers-mysql`            |
| Kit `/db` runtime and JST wire helpers | `@rdlabo/workers-mysql`            |
| Kit `/db` column/configuration helpers | `@rdlabo/workers-mysql/drizzle`    |
| Kit `/db` baseline helpers             | `@rdlabo/workers-mysql/migrations` |
| Kit `/testing` database helpers        | `@rdlabo/workers-mysql/testing`    |

The old `/db` and DB-related `/testing` paths are temporarily deprecated re-exports. Do not import
the legacy aggregate `/db` in new Worker code: use the dedicated runtime entry points to keep
Node-only migration code out of the Worker bundle. Rename `honoDrizzleConfig` to
`workersDrizzleConfig` when updating configuration.

No Hono dependency is required by this database package. The fixed-JST storage contract also
remains separate from configurable business timezones; see [Drizzle and dates](./drizzle.md).
