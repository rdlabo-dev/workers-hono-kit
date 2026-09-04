import type { Pool } from 'mysql2/promise';
import { databaseFrom } from '../database.js';
import type { DisposableDatabase } from '../database.js';

/** Options for {@link createPoolDatabase}. */
export interface CreatePoolDatabaseOptions<TDrizzle> {
  /** Test pool used as both primary and replica. */
  pool: Pool;
  /** Drizzle instance built by the consumer with its own `drizzle-orm`. */
  orm: TDrizzle;
}

/** Create a `Database` backed by one pool used as both primary and replica. */
export function createPoolDatabase<TDrizzle>(
  options: CreatePoolDatabaseOptions<TDrizzle>,
): DisposableDatabase<TDrizzle> {
  const { pool, orm } = options;
  const base = databaseFrom(orm, pool);
  return {
    ...base,
    async dispose(): Promise<void> {
      await pool.end();
    },
  };
}

/** Create a no-op database stub that fails on unexpected writes. */
export function createNoopDatabase<TDrizzle = unknown>(): DisposableDatabase<TDrizzle> {
  return {
    read: async () => [],
    write: () => {
      throw new Error('noopDatabase.write accessed unexpectedly');
    },
    transaction: () => {
      throw new Error('noopDatabase.transaction accessed unexpectedly');
    },
    dispose: async () => {},
  };
}
