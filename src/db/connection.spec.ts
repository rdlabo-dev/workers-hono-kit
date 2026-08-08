import { describe, expect, it, vi } from 'vitest';
import { hyperdriveConnectionOptions, withMysqlConnections } from './connection.js';
import type { HyperdriveLike } from './connection.js';

const opened: Record<string, unknown>[] = [];
let holdConnections = false;
let pendingConnections: (() => void)[] = [];

vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn((opts: Record<string, unknown>) => {
    opened.push(opts);
    const connection = { end: vi.fn() };
    if (!holdConnections) {
      return Promise.resolve(connection);
    }
    return new Promise((resolve) =>
      pendingConnections.push(() => {
        resolve(connection);
      }),
    );
  }),
}));

const hd: HyperdriveLike = { host: 'db.example', user: 'u', password: 'p', database: 'app', port: 3306 };

describe('hyperdriveConnectionOptions', () => {
  it('Hyperdrive から mysql2 オプションを作り disableEval/decimalNumbers を付与する', () => {
    expect(hyperdriveConnectionOptions(hd)).toEqual({
      host: 'db.example',
      user: 'u',
      password: 'p',
      database: 'app',
      port: 3306,
      disableEval: true,
      decimalNumbers: true,
      timezone: '+09:00',
    });
  });

  it('extra で timezone 等を追加できる', () => {
    expect(hyperdriveConnectionOptions(hd, { timezone: '+09:00' })).toMatchObject({
      timezone: '+09:00',
      disableEval: true,
    });
  });
});

describe('withMysqlConnections', () => {
  it('両接続を並列に開き、Workersに終了処理を委ねる', async () => {
    opened.length = 0;
    pendingConnections = [];
    holdConnections = true;
    const waited: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waited.push(p);
      },
    };

    const resultPromise = withMysqlConnections({ primary: hd, replica: hd }, ctx, async (conns) => {
      expect(conns.primary).toBeDefined();
      expect(conns.replica).toBeDefined();
      return 'done';
    });

    expect(opened).toHaveLength(2);
    for (const resolve of pendingConnections) {
      resolve();
    }

    await expect(resultPromise).resolves.toBe('done');
    expect(waited).toHaveLength(0);
    holdConnections = false;
  });
});
