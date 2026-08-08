import { describe, expect, it, vi } from 'vitest';
import type { HyperdriveLike } from './connection.js';
import { createHyperdriveDatabase } from './database.js';

const end = vi.fn();
const query = vi.fn(async () => [[], []]);

vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn(async () => ({ end, query })),
}));

const hyperdrive: HyperdriveLike = {
  host: 'db.example',
  user: 'user',
  password: 'password',
  database: 'app',
  port: 3306,
};

describe('createHyperdriveDatabase lifecycle', () => {
  it('disposeは互換用no-opで、接続終了をWorkersに委ねる', async () => {
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await db.read('SELECT 1');
    await db.dispose();

    expect(query).toHaveBeenCalledWith('SELECT 1', []);
    expect(end).not.toHaveBeenCalled();
  });
});
