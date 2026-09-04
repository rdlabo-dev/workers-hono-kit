/**
 * MySQL and Drizzle data-layer helpers exposed under `/db`. The root exports only the mysql2-backed
 * container lifecycle; Drizzle-specific runtime and types remain isolated in this subpath.
 *
 * @remarks
 * This module never depends on the type identity of `drizzle-orm`: the ORM instance is always
 * supplied by the consumer. That keeps the kit safe to use even when the kit and the consuming app
 * resolve separate copies of `drizzle-orm`.
 *
 * @packageDocumentation
 */

export { retryWhenDeadlock } from './retry.js';

export { createMysqlDatabase, createHyperdriveDatabase, databaseFrom } from './database.js';
export type {
  Database,
  DisposableDatabase,
  HyperdriveDatabase,
  ReadTransaction,
  QueryRunner,
  TxOf,
  CreateMysqlDatabaseOptions,
  CreateHyperdriveDatabaseOptions,
  Connection,
  Pool,
} from './database.js';

export { insertIdOf, affectedRowsOf, insertedIdsOf } from './write-result.js';
export type { DzWriteResult } from './write-result.js';

export { hyperdriveConnectionOptions, withMysqlConnections } from './connection.js';
export type { HyperdriveLike, ExecutionContextLike } from './connection.js';

export { MYSQL_TIMEZONE, toJstDate, jstTimestampParams, jstDatetimeParams, jstDateParams } from './jst.js';

export { jstTimestamp, jstDatetime, jstDate, jstOnUpdateNow } from './columns.js';

export { DRIZZLE_ORM_OPTIONS, honoDrizzleConfig, resolveDbSecret } from './orm-config.js';
export type { HonoDrizzleConfigOptions, ResolvedDbSecret } from './orm-config.js';

export { baselineMigrations, readBaselineEntry } from './migrate.js';
export type { BaselineMigrationsOptions, BaselineResult, BaselineEntry } from './migrate.js';

export { reopenGuardedPaymentFailedSet } from './payment-failed.js';
