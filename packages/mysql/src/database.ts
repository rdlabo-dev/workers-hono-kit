import { createConnection } from 'mysql2/promise';
import type { Connection, Pool } from 'mysql2/promise';
import { hyperdriveConnectionOptions } from './connection.js';
import type { HyperdriveLike } from './connection.js';
import { retryWhenDeadlock } from './retry.js';

/**
 * Dual-connection data layer that separates reads from writes.
 *
 * @remarks
 * The two sides of the database are deliberately handled differently:
 *
 * - Reads go to the **replica** as raw SQL (`QueryRunner.query`) by default, returning plain rows.
 *   Hyperdrive-backed databases also expose `query()` for freshness-sensitive primary SELECTs.
 * - Writes and transactions go to the **primary** through the Drizzle ORM for type safety, but only
 *   via `write(fn)` / `transaction(fn)` — the raw query builder is never exposed. The builder is
 *   awaited inside those methods, which removes a foot-gun: a Drizzle builder is a lazy thenable, so
 *   a bare `return builder` would silently become a no-op.
 *
 * Both sides retry on `ER_LOCK_DEADLOCK`.
 *
 * This package deliberately avoids depending on the type identity of `drizzle-orm`: the consumer creates
 * the ORM instance with its own copy of `drizzle-orm` and passes it in, and {@link Database} is
 * generic over that ORM type (`TDrizzle`). This keeps the ORM's `MySqlTable`/`SQL` brands from
 * clashing even when the package and consumer resolve separate copies of `drizzle-orm`.
 */

/**
 * Minimal connection interface used for reads.
 *
 * @remarks
 * A mysql2 `Connection` or `Pool` satisfies this structurally.
 */
export interface QueryRunner {
  /**
   * Run a parameterized SQL query.
   *
   * @param sql - the SQL text, with `?` placeholders for `params`.
   * @param params - optional positional parameters.
   * @returns the driver's raw result (typically `[rows, fields]`).
   */
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Extract the transaction-handle type that a Drizzle instance passes to its `.transaction(cb)`
 * callback.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 */
export type TxOf<TDrizzle> = TDrizzle extends {
  transaction(cb: (tx: infer Tx) => Promise<unknown>): Promise<unknown>;
}
  ? Tx
  : unknown;

/**
 * The read/write surface of the data layer.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type used for writes and transactions.
 * @typeParam TTx - the transaction-handle type, inferred from `TDrizzle` by default.
 */
export interface Database<TDrizzle, TTx = TxOf<TDrizzle>> {
  /**
   * Run a raw SQL read against the replica. Hyperdrive-backed databases retry deadlocks and repeat
   * the SELECT once on a fresh connection after mysql2 reports a fatal connection error.
   *
   * @typeParam T - the row shape.
   * @param sql - the SQL text, with `?` placeholders for `params`.
   * @param params - optional positional parameters.
   * @returns the rows returned by the query.
   */
  read<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Run a single INSERT/UPDATE/DELETE against the primary, awaited with deadlock retry.
   *
   * @typeParam T - the value resolved by `fn`.
   * @param fn - callback that receives the Drizzle ORM and returns the awaited write.
   * @returns the value resolved by `fn`.
   */
  write<T>(fn: (dz: TDrizzle) => Promise<T>): Promise<T>;
  /**
   * Run multiple writes inside a single transaction; the whole transaction is retried on deadlock.
   *
   * @typeParam T - the value resolved by `fn`.
   * @param fn - callback that receives the transaction handle and returns the awaited work.
   * @returns the value resolved by `fn`.
   */
  transaction<T>(fn: (tx: TTx) => Promise<T>): Promise<T>;
}

/**
 * A {@link Database} that opens its own connections.
 *
 * @remarks
 * Used by variants that open connections internally. Lifecycle behavior depends on the backing
 * implementation: pool-backed databases close their pool, while Hyperdrive-backed databases leave
 * invocation-scoped connection cleanup to the Workers runtime.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 * @typeParam TTx - the transaction-handle type, inferred from `TDrizzle` by default.
 */
export interface DisposableDatabase<TDrizzle, TTx = TxOf<TDrizzle>> extends Database<TDrizzle, TTx> {
  /**
   * Release resources owned by the implementation. Hyperdrive-backed databases keep this method as
   * a compatibility no-op; pool-backed databases use it to close their pool.
   *
   * @returns a promise that resolves after implementation-specific cleanup.
   */
  dispose(): Promise<void>;
}

/**
 * A Hyperdrive-backed database with an explicit primary query path.
 *
 * @remarks
 * Use `query()` only for SELECTs that require read-after-write consistency or cannot use the
 * configured replica. Fatal connection errors recreate the primary connection and repeat the
 * SELECT at most once. Writes and transactions are never repeated for connection errors.
 * Read-only transactions are serialized on a separately cached primary connection so their
 * snapshot boundaries cannot mix with ordinary primary operations or with each other. Do not call
 * `readTransaction()` recursively from its own callback.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 * @typeParam TTx - the transaction-handle type, inferred from `TDrizzle` by default.
 */
export interface HyperdriveDatabase<TDrizzle, TTx = TxOf<TDrizzle>> extends DisposableDatabase<TDrizzle, TTx> {
  /**
   * Run a raw SQL SELECT against the primary database.
   *
   * @typeParam T - the complete rows result type (for example, `User[]`).
   * @param sql - the SQL text, with `?` placeholders for `params`.
   * @param params - optional positional parameters.
   * @returns the rows returned by the query, typed as `T`.
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  /**
   * Run a repeatable-read, consistent snapshot on the primary database.
   *
   * @remarks
   * The callback is repeated at most once on a fresh connection after a fatal connection error.
   * This is safe only because the transaction is declared read-only. Use {@link transaction} for
   * writes; write transactions are never repeated after connection loss. Calls are serialized on
   * one dedicated connection, so recursive `readTransaction()` calls are not supported.
   */
  readTransaction<T>(fn: (reader: ReadTransaction<TTx>) => Promise<T>): Promise<T>;
}

/** Primary read-only transaction handles that share one consistent snapshot. */
export interface ReadTransaction<TTx> {
  /**
   * The consumer's Drizzle transaction handle.
   *
   * @remarks
   * Drizzle's type does not distinguish read-only transactions. MySQL enforces read-only mode at
   * runtime; applications may expose a narrower SELECT-only facade when they need compile-time
   * enforcement.
   */
  orm: TTx;
  /** Run raw SQL on the same primary connection and snapshot. */
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>;
}

interface DrizzleLike<TTx> {
  transaction<T>(
    cb: (tx: TTx) => Promise<T>,
    config?: { isolationLevel?: string; withConsistentSnapshot?: boolean },
  ): Promise<T>;
}

/**
 * Options for {@link createMysqlDatabase}.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 */
export interface CreateMysqlDatabaseOptions<TDrizzle> {
  /**
   * The Drizzle ORM used for writes, created by the consumer with its own `drizzle-orm`
   * (e.g. `drizzle(primary, { schema, ... })`).
   */
  orm: TDrizzle;
  /** The connection used for reads (raw SQL). */
  replica: QueryRunner;
}

/**
 * Assemble a {@link Database} from an already-connected ORM and replica.
 *
 * @remarks
 * The caller (typically the worker entry point) owns creating the connections and the ORM, and is
 * responsible for closing the connections; this variant does not manage their lifecycle.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 * @param options - the write ORM and the read connection.
 * @returns a {@link Database} backed by the supplied ORM and replica.
 * @example
 * ```ts
 * const db = createMysqlDatabase({
 *   orm: drizzle(primary, { schema, ...DRIZZLE_ORM_OPTIONS }),
 *   replica,
 * });
 * const rows = await db.read<User>('SELECT * FROM users WHERE id = ?', [id]);
 * ```
 */
export function createMysqlDatabase<TDrizzle>(options: CreateMysqlDatabaseOptions<TDrizzle>): Database<TDrizzle> {
  return databaseFrom(options.orm, options.replica);
}

/**
 * Options for {@link createHyperdriveDatabase}.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 */
export interface CreateHyperdriveDatabaseOptions<TDrizzle> {
  /** The Hyperdrive binding for the primary (write) connection. */
  primaryHyperdrive: HyperdriveLike;
  /** The Hyperdrive binding for the replica (read) connection. */
  replicaHyperdrive: HyperdriveLike;
  /**
   * Factory that builds the write ORM from the primary connection, using the consumer's
   * `drizzle-orm`.
   */
  createOrm: (primary: Connection) => TDrizzle;
  /**
   * Extra options forwarded to mysql2 `createConnection`, merged on top of the defaults applied by
   * {@link hyperdriveConnectionOptions} (`disableEval: true`, `decimalNumbers: true`, and
   * `timezone: '+09:00'`). Pass a field here to override any of those defaults.
   */
  connectionOptions?: Record<string, unknown>;
}

/**
 * Create a {@link HyperdriveDatabase} that lazily opens its connections from Hyperdrive bindings.
 *
 * @remarks
 * Construct one per request. Connections and the ORM are created on first use and reused for the
 * lifetime of the instance. `read()` uses the replica, while `query()` provides an explicit
 * primary SELECT path. Workers automatically cleans up connections at the end of the invocation,
 * so callers do not need to close them manually. Either SELECT path is repeated once on a fresh
 * connection after a fatal mysql2 connection error. Writes and transactions are never repeated
 * for connection errors because their commit state can be ambiguous.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 * @param options - the primary/replica Hyperdrive bindings, the ORM factory, and connection options.
 * @returns a {@link HyperdriveDatabase} whose compatibility `dispose()` method is a no-op; Workers
 *   cleans up its invocation-scoped connections automatically.
 * @example
 * ```ts
 * const db = createHyperdriveDatabase({
 *   primaryHyperdrive: env.PRIMARY,
 *   replicaHyperdrive: env.REPLICA,
 *   createOrm: (primary) => drizzle(primary, { schema, ...DRIZZLE_ORM_OPTIONS }),
 * });
 * await db.write((dz) => dz.insert(users).values(user));
 * ```
 */
export function createHyperdriveDatabase<TDrizzle>(
  options: CreateHyperdriveDatabaseOptions<TDrizzle>,
): HyperdriveDatabase<TDrizzle> {
  const { primaryHyperdrive, replicaHyperdrive, createOrm, connectionOptions } = options;
  let primaryConn: Promise<Connection> | undefined;
  let replicaConn: Promise<Connection> | undefined;
  let readTransactionConn: Promise<Connection> | undefined;
  let orm: TDrizzle | undefined;
  let readTransactionOrm: TDrizzle | undefined;
  let readTransactionTail: Promise<void> | undefined;

  const primary = (): Promise<Connection> => (primaryConn ??= connect(primaryHyperdrive, connectionOptions));
  const replica = (): Promise<Connection> => (replicaConn ??= connect(replicaHyperdrive, connectionOptions));
  const readTransactionConnection = (): Promise<Connection> =>
    (readTransactionConn ??= connect(primaryHyperdrive, connectionOptions));
  const ormFor = async (): Promise<TDrizzle> => (orm ??= createOrm(await primary()));
  const readFrom = <T>(connection: Promise<Connection>, sql: string, params: unknown[]): Promise<T[]> =>
    retryWhenDeadlock(async () => {
      const [rows] = (await (await connection).query(sql, params)) as [unknown, unknown];
      return rows as T[];
    });
  const readWithRecovery = async <T>(
    connectionFor: () => Promise<Connection>,
    reset: (failedConnection: Promise<Connection>) => void,
    sql: string,
    params: unknown[],
  ): Promise<T[]> => {
    const connection = connectionFor();
    const outcome = await readFrom<T>(connection, sql, params).then(
      (rows) => ({ ok: true, rows }) as const,
      (error: unknown) => ({ ok: false, error }) as const,
    );
    if (outcome.ok) {
      return outcome.rows;
    }
    if (!isFatalConnectionError(outcome.error)) {
      throw outcome.error;
    }
    reset(connection);
    return readFrom<T>(connectionFor(), sql, params);
  };
  const resetPrimary = (failedConnection: Promise<Connection>): void => {
    if (primaryConn === failedConnection) {
      primaryConn = undefined;
      orm = undefined;
    }
  };
  const resetReadTransaction = (failedConnection: Promise<Connection>): void => {
    if (readTransactionConn === failedConnection) {
      readTransactionConn = undefined;
      readTransactionOrm = undefined;
    }
  };
  const withReadTransactionLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = readTransactionTail ? readTransactionTail.then(fn, fn) : fn();
    readTransactionTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const runReadTransaction = async <T>(
    connection: Promise<Connection>,
    fn: (reader: ReadTransaction<TxOf<TDrizzle>>) => Promise<T>,
  ): Promise<T> => {
    const conn = await connection;
    const dz = (readTransactionOrm ??= createOrm(conn)) as DrizzleLike<TxOf<TDrizzle>>;
    return retryWhenDeadlock(async () => {
      await conn.query('SET TRANSACTION READ ONLY');
      return dz.transaction(
        (tx) =>
          fn({
            orm: tx,
            query: async <TRows = unknown>(sql: string, params: unknown[] = []): Promise<TRows> => {
              const [rows] = (await conn.query(sql, params)) as [unknown, unknown];
              return rows as TRows;
            },
          }),
        { isolationLevel: 'repeatable read', withConsistentSnapshot: true },
      );
    });
  };

  return {
    read<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return readWithRecovery(
        replica,
        (failedConnection) => {
          if (replicaConn === failedConnection) {
            replicaConn = undefined;
          }
        },
        sql,
        params,
      );
    },
    query<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
      return readWithRecovery(primary, resetPrimary, sql, params) as Promise<T>;
    },
    async readTransaction<T>(fn: (reader: ReadTransaction<TxOf<TDrizzle>>) => Promise<T>): Promise<T> {
      return withReadTransactionLock(async () => {
        const connection = readTransactionConnection();
        const outcome = await runReadTransaction(connection, fn).then(
          (value) => ({ ok: true, value }) as const,
          (error: unknown) => ({ ok: false, error }) as const,
        );
        if (outcome.ok) {
          return outcome.value;
        }
        if (!isFatalConnectionError(outcome.error)) {
          throw outcome.error;
        }
        resetReadTransaction(connection);
        return runReadTransaction(readTransactionConnection(), fn);
      });
    },
    async write<T>(fn: (dz: TDrizzle) => Promise<T>): Promise<T> {
      const dz = await ormFor();
      return retryWhenDeadlock(() => fn(dz));
    },
    async transaction<T>(fn: (tx: TxOf<TDrizzle>) => Promise<T>): Promise<T> {
      const dz = (await ormFor()) as DrizzleLike<TxOf<TDrizzle>>;
      return retryWhenDeadlock(() => dz.transaction(fn));
    },
    /** @deprecated Workers cleans up invocation-scoped connections automatically. */
    async dispose(): Promise<void> {
      return;
    },
  };
}

/**
 * Internal helper that assembles a {@link Database} from an ORM and a replica connection.
 *
 * @typeParam TDrizzle - the consumer's Drizzle ORM type.
 * @param orm - the Drizzle ORM used for writes and transactions.
 * @param replica - the connection used for reads.
 * @returns a {@link Database} wiring reads to `replica` and writes to `orm`, both with deadlock retry.
 * @internal
 */
export function databaseFrom<TDrizzle>(orm: TDrizzle, replica: QueryRunner): Database<TDrizzle> {
  const drizzleLike = orm as DrizzleLike<TxOf<TDrizzle>>;
  return {
    read<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return retryWhenDeadlock(async () => {
        const [rows] = (await replica.query(sql, params)) as [unknown, unknown];
        return rows as T[];
      });
    },
    write<T>(fn: (dz: TDrizzle) => Promise<T>): Promise<T> {
      return retryWhenDeadlock(() => fn(orm));
    },
    transaction<T>(fn: (tx: TxOf<TDrizzle>) => Promise<T>): Promise<T> {
      return retryWhenDeadlock(() => drizzleLike.transaction(fn));
    },
  };
}

/**
 * Re-export of the mysql2 `Connection` and `Pool` types.
 *
 * @remarks
 * Both are structurally assignable to this package's {@link QueryRunner}.
 */
export type { Connection, Pool };

function connect(hyperdrive: HyperdriveLike, extra?: Record<string, unknown>): Promise<Connection> {
  return createConnection(hyperdriveConnectionOptions(hyperdrive, extra));
}

function isFatalConnectionError(error: unknown): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    const value = current as { cause?: unknown; code?: unknown; fatal?: unknown; message?: unknown };
    if (
      value.fatal === true ||
      value.code === 'PROTOCOL_CONNECTION_LOST' ||
      value.code === 'ECONNRESET' ||
      value.code === 'EPIPE' ||
      (typeof value.message === 'string' &&
        (value.message.includes('Connection lost:') ||
          value.message.includes("Can't add new command when connection is in closed state")))
    ) {
      return true;
    }
    current = value.cause;
  }
  return false;
}
