import { createConnection } from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { MYSQL_TIMEZONE } from './jst.js';

/** Minimal structural shape retained by the compatibility connection-lifecycle API. */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Minimal structural shape of a Cloudflare Hyperdrive binding.
 *
 * @remarks
 * Declared structurally to avoid a dependency on `@cloudflare/workers-types`; any object with these
 * connection fields satisfies it.
 */
export interface HyperdriveLike {
  /** Database host to connect to. */
  host: string;
  /** Database user. */
  user: string;
  /** Database password. */
  password: string;
  /** Database name. */
  database: string;
  /** Database port. */
  port: number;
}

/**
 * Build mysql2 `createConnection` options from a Hyperdrive binding, applying the package defaults.
 *
 * @remarks
 * Three defaults are applied and can each be overridden via `extra`:
 *
 * - `disableEval: true` — `eval` is unavailable in the Workers runtime, so the driver's eval-based
 *   fast paths must be disabled.
 * - `decimalNumbers: true` — return `DECIMAL`/`NEWDECIMAL` columns as JS `number` rather than
 *   strings, so raw-SQL reads and Drizzle's inferred types align on a single numeric domain type.
 *   This assumes no column's precision exceeds the JS safe-integer range.
 * - `timezone: '+09:00'` — interpret and serialize JavaScript `Date` values as JST. This is a
 *   mysql2 client-side conversion option; it does not issue `SET time_zone` or change the MySQL
 *   session timezone. Non-JST deployments can override it via `extra: { timezone: '...' }`.
 *
 * @param hyperdrive - the Hyperdrive binding to derive connection fields from.
 * @param extra - additional mysql2 options merged last, overriding the defaults above.
 * @returns a plain options object to pass to mysql2 `createConnection`.
 */
export function hyperdriveConnectionOptions(
  hyperdrive: HyperdriveLike,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    host: hyperdrive.host,
    user: hyperdrive.user,
    password: hyperdrive.password,
    database: hyperdrive.database,
    port: hyperdrive.port,
    disableEval: true,
    decimalNumbers: true,
    timezone: MYSQL_TIMEZONE,
    ...extra,
  };
}

/**
 * Open primary and replica connections in parallel and run `fn` with them.
 *
 * Cloudflare Workers automatically cleans up connections created during an invocation. Calling
 * `Connection.end()` is unnecessary and can race work registered with `waitUntil`. The `ctx`
 * parameter remains for API compatibility and is intentionally not used for connection teardown.
 *
 * @typeParam T - resolved value produced by `fn`.
 * @param hyperdrives - the primary and replica Hyperdrive bindings to connect to.
 * @param ctx - the request execution context, retained for API compatibility.
 * @param fn - callback invoked with the open `primary` and `replica` connections.
 * @param connectionOptions - extra mysql2 options forwarded to {@link hyperdriveConnectionOptions}.
 * @returns the value resolved by `fn`.
 * @example
 * ```ts
 * const data = await withMysqlConnections(
 *   { primary: env.PRIMARY, replica: env.REPLICA },
 *   ctx,
 *   async ({ primary, replica }) => {
 *     const [rows] = await replica.query('SELECT 1');
 *     return rows;
 *   },
 * );
 * ```
 */
export async function withMysqlConnections<T>(
  hyperdrives: { primary: HyperdriveLike; replica: HyperdriveLike },
  ctx: ExecutionContextLike,
  fn: (connections: { primary: Connection; replica: Connection }) => Promise<T>,
  connectionOptions?: Record<string, unknown>,
): Promise<T> {
  void ctx;
  const [primary, replica] = await Promise.all([
    createConnection(hyperdriveConnectionOptions(hyperdrives.primary, connectionOptions)),
    createConnection(hyperdriveConnectionOptions(hyperdrives.replica, connectionOptions)),
  ]);
  return fn({ primary, replica });
}
