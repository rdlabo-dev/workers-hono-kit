/**
 * MySQL, Hyperdrive, and Drizzle infrastructure for Cloudflare Workers.
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
