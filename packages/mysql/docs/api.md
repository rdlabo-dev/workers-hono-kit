---
title: API
---

# API

Public exports are grouped by import path. The installed TypeScript declarations provide the full
generic signatures. Start with [Runtime](./runtime.md) for lifecycle and retry behavior.

## `@rdlabo/workers-mysql`

#### `function` createHyperdriveDatabase

Accepts `{ primaryHyperdrive, replicaHyperdrive, createOrm, connectionOptions? }` and returns
`HyperdriveDatabase<TDrizzle>`. `read<Row>` uses the replica; `query<Rows>` and `readTransaction`
use the primary; `write` and `transaction` await consumer ORM callbacks. `dispose` is a no-op.

#### `function` createMysqlDatabase

Accepts `{ orm, replica }` and returns `Database<TDrizzle>`. The caller owns the existing handles.
`databaseFrom(orm, replica)` is the positional equivalent.

#### `function` hyperdriveConnectionOptions

`hyperdriveConnectionOptions(hyperdrive, extra?)` creates mysql2 options from a structural
`HyperdriveLike` binding. See [Drizzle and dates](./drizzle.md) for defaults.

#### `function` withMysqlConnections

`withMysqlConnections({ primary, replica }, ctx, fn, connectionOptions?)` opens both connections
and awaits `fn({ primary, replica })`. `ctx` is retained for compatibility, not explicit teardown.

#### `function` retryWhenDeadlock

`retryWhenDeadlock(fn, retries = 3, delay = 100)` retries `ER_LOCK_DEADLOCK`, including wrapped
causes. `retries` is the maximum number of attempts; waits grow linearly by `delay` milliseconds.
Other errors are rethrown. The complete callback may run again.

#### Write results and dates

`insertIdOf`, `affectedRowsOf`, and `insertedIdsOf` extract mysql2/Drizzle write results.
`MYSQL_TIMEZONE`, `toJstDate`, `jstTimestampParams`, `jstDatetimeParams`, and `jstDateParams`
implement the independent fixed-JST wire contract.

Exported types: `Database`, `DisposableDatabase`, `HyperdriveDatabase`, `ReadTransaction`,
`QueryRunner`, `TxOf`, `CreateMysqlDatabaseOptions`, `CreateHyperdriveDatabaseOptions`,
`Connection`, `Pool`, `HyperdriveLike`, `ExecutionContextLike`, and `DzWriteResult`.

## `@rdlabo/workers-mysql/drizzle`

Requires the optional Drizzle peer. Exports `jstTimestamp`, `jstDatetime`, `jstDate`,
`jstOnUpdateNow`, `DRIZZLE_ORM_OPTIONS`, `workersDrizzleConfig`, and `resolveDbSecret`.
Types: `WorkersDrizzleConfigOptions` and `ResolvedDbSecret`.
`honoDrizzleConfig` and `HonoDrizzleConfigOptions` remain deprecated aliases.
Configuration/secret resolution is for Node.js tooling; column helpers are used in Worker schemas.

## `@rdlabo/workers-mysql/migrations`

Node.js only: `baselineMigrations`, `readBaselineEntry`, and `resolveDbSecret`.
Types: `BaselineMigrationsOptions`, `BaselineResult`, `BaselineEntry`, and `ResolvedDbSecret`.
See the safety requirements in [Migrations and testing](./tooling.md).

## `@rdlabo/workers-mysql/testing`

Node.js test helpers: `createTestDb`, `createPoolDatabase`, and `createNoopDatabase`.
Types: `TestDb`, `CreateTestDbOptions`, `TestDbConnection`, `CreatePoolDatabaseOptions`,
`Database`, `DisposableDatabase`, `QueryRunner`, and `TxOf`.

## `@rdlabo/workers-mysql/baseline-cli`

`runBaselineCli(): Promise<void>` runs the baseline command using process arguments and environment.
Prefer the installed `workers-mysql-db-baseline` executable for shell use.
