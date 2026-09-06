/**
 * Compatibility re-export of `@rdlabo/workers-mysql` (and its `/drizzle` / `/migrations` entry points).
 * Prefer installing those packages and importing their APIs directly. Symbol-level `@deprecated`
 * tags mark each promoted export; kit-owned payment SQL helpers are not deprecated.
 *
 * @packageDocumentation
 */
/* eslint-disable @typescript-eslint/no-deprecated -- compatibility aliases of promoted/canonical APIs */

import {
  MYSQL_TIMEZONE as mysqlTimezoneCanonical,
  affectedRowsOf as affectedRowsOfCanonical,
  createHyperdriveDatabase as createHyperdriveDatabaseCanonical,
  createMysqlDatabase as createMysqlDatabaseCanonical,
  databaseFrom as databaseFromCanonical,
  hyperdriveConnectionOptions as hyperdriveConnectionOptionsCanonical,
  insertIdOf as insertIdOfCanonical,
  insertedIdsOf as insertedIdsOfCanonical,
  jstDateParams as jstDateParamsCanonical,
  jstDatetimeParams as jstDatetimeParamsCanonical,
  jstTimestampParams as jstTimestampParamsCanonical,
  retryWhenDeadlock as retryWhenDeadlockCanonical,
  toJstDate as toJstDateCanonical,
  withMysqlConnections as withMysqlConnectionsCanonical,
} from '@rdlabo/workers-mysql';
import type {
  Connection as ConnectionCanonical,
  CreateHyperdriveDatabaseOptions as CreateHyperdriveDatabaseOptionsCanonical,
  CreateMysqlDatabaseOptions as CreateMysqlDatabaseOptionsCanonical,
  Database as DatabaseCanonical,
  DisposableDatabase as DisposableDatabaseCanonical,
  DzWriteResult as DzWriteResultCanonical,
  ExecutionContextLike as ExecutionContextLikeCanonical,
  HyperdriveDatabase as HyperdriveDatabaseCanonical,
  HyperdriveLike as HyperdriveLikeCanonical,
  Pool as PoolCanonical,
  QueryRunner as QueryRunnerCanonical,
  ReadTransaction as ReadTransactionCanonical,
  TxOf as TxOfCanonical,
} from '@rdlabo/workers-mysql';
import {
  DRIZZLE_ORM_OPTIONS as drizzleOrmOptionsCanonical,
  honoDrizzleConfig as honoDrizzleConfigCanonical,
  jstDate as jstDateCanonical,
  jstDatetime as jstDatetimeCanonical,
  jstOnUpdateNow as jstOnUpdateNowCanonical,
  jstTimestamp as jstTimestampCanonical,
  resolveDbSecret as resolveDbSecretCanonical,
  workersDrizzleConfig as workersDrizzleConfigCanonical,
} from '@rdlabo/workers-mysql/drizzle';
import type {
  HonoDrizzleConfigOptions as HonoDrizzleConfigOptionsCanonical,
  ResolvedDbSecret as ResolvedDbSecretCanonical,
  WorkersDrizzleConfigOptions as WorkersDrizzleConfigOptionsCanonical,
} from '@rdlabo/workers-mysql/drizzle';
import {
  baselineMigrations as baselineMigrationsCanonical,
  readBaselineEntry as readBaselineEntryCanonical,
} from '@rdlabo/workers-mysql/migrations';
import type {
  BaselineEntry as BaselineEntryCanonical,
  BaselineMigrationsOptions as BaselineMigrationsOptionsCanonical,
  BaselineResult as BaselineResultCanonical,
} from '@rdlabo/workers-mysql/migrations';

/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const retryWhenDeadlock: typeof retryWhenDeadlockCanonical = retryWhenDeadlockCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const createMysqlDatabase: typeof createMysqlDatabaseCanonical = createMysqlDatabaseCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const createHyperdriveDatabase: typeof createHyperdriveDatabaseCanonical = createHyperdriveDatabaseCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const databaseFrom: typeof databaseFromCanonical = databaseFromCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const insertIdOf: typeof insertIdOfCanonical = insertIdOfCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const affectedRowsOf: typeof affectedRowsOfCanonical = affectedRowsOfCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const insertedIdsOf: typeof insertedIdsOfCanonical = insertedIdsOfCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const hyperdriveConnectionOptions: typeof hyperdriveConnectionOptionsCanonical =
  hyperdriveConnectionOptionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const withMysqlConnections: typeof withMysqlConnectionsCanonical = withMysqlConnectionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const MYSQL_TIMEZONE: typeof mysqlTimezoneCanonical = mysqlTimezoneCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const toJstDate: typeof toJstDateCanonical = toJstDateCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const jstTimestampParams: typeof jstTimestampParamsCanonical = jstTimestampParamsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const jstDatetimeParams: typeof jstDatetimeParamsCanonical = jstDatetimeParamsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export const jstDateParams: typeof jstDateParamsCanonical = jstDateParamsCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type TxOf<TDrizzle> = TxOfCanonical<TDrizzle>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type Database<TDrizzle, TTx = TxOfCanonical<TDrizzle>> = DatabaseCanonical<TDrizzle, TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type DisposableDatabase<TDrizzle, TTx = TxOfCanonical<TDrizzle>> = DisposableDatabaseCanonical<TDrizzle, TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type HyperdriveDatabase<TDrizzle, TTx = TxOfCanonical<TDrizzle>> = HyperdriveDatabaseCanonical<TDrizzle, TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type ReadTransaction<TTx> = ReadTransactionCanonical<TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type QueryRunner = QueryRunnerCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type CreateMysqlDatabaseOptions<TDrizzle> = CreateMysqlDatabaseOptionsCanonical<TDrizzle>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type CreateHyperdriveDatabaseOptions<TDrizzle> = CreateHyperdriveDatabaseOptionsCanonical<TDrizzle>;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type Connection = ConnectionCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type Pool = PoolCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type DzWriteResult = DzWriteResultCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type HyperdriveLike = HyperdriveLikeCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql` instead. */
export type ExecutionContextLike = ExecutionContextLikeCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const jstTimestamp: typeof jstTimestampCanonical = jstTimestampCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const jstDatetime: typeof jstDatetimeCanonical = jstDatetimeCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const jstDate: typeof jstDateCanonical = jstDateCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const jstOnUpdateNow: typeof jstOnUpdateNowCanonical = jstOnUpdateNowCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const DRIZZLE_ORM_OPTIONS: typeof drizzleOrmOptionsCanonical = drizzleOrmOptionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const workersDrizzleConfig: typeof workersDrizzleConfigCanonical = workersDrizzleConfigCanonical;
/** @deprecated Import `workersDrizzleConfig` from `@rdlabo/workers-mysql/drizzle` instead. */
export const honoDrizzleConfig: typeof honoDrizzleConfigCanonical = honoDrizzleConfigCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export const resolveDbSecret: typeof resolveDbSecretCanonical = resolveDbSecretCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export type WorkersDrizzleConfigOptions = WorkersDrizzleConfigOptionsCanonical;
/** @deprecated Import `WorkersDrizzleConfigOptions` from `@rdlabo/workers-mysql/drizzle` instead. */
export type HonoDrizzleConfigOptions = HonoDrizzleConfigOptionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/drizzle` instead. */
export type ResolvedDbSecret = ResolvedDbSecretCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/migrations` instead. */
export const baselineMigrations: typeof baselineMigrationsCanonical = baselineMigrationsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/migrations` instead. */
export const readBaselineEntry: typeof readBaselineEntryCanonical = readBaselineEntryCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/migrations` instead. */
export type BaselineMigrationsOptions = BaselineMigrationsOptionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/migrations` instead. */
export type BaselineResult = BaselineResultCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/migrations` instead. */
export type BaselineEntry = BaselineEntryCanonical;

// Payment-domain SQL remains owned by workers-hono-kit rather than the generic MySQL package.
export { reopenGuardedPaymentFailedSet } from './payment-failed.js';
