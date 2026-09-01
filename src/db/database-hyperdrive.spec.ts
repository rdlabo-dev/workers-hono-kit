import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HyperdriveLike } from './connection.js';
import { createHyperdriveDatabase } from './database.js';

const mocks = vi.hoisted(() => ({ createConnection: vi.fn() }));

vi.mock('mysql2/promise', () => ({
  createConnection: mocks.createConnection,
}));

const hyperdrive: HyperdriveLike = {
  host: 'db.example',
  user: 'user',
  password: 'password',
  database: 'app',
  port: 3306,
};

describe('createHyperdriveDatabase lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disposeは互換用no-opで、接続終了をWorkersに委ねる', async () => {
    const end = vi.fn();
    const query = vi.fn(async () => [[], []]);
    mocks.createConnection.mockResolvedValue({ end, query });
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

  it('reconnects once and repeats a replica read after connection loss', async () => {
    const firstQuery = vi.fn().mockRejectedValue(
      Object.assign(new Error('Connection lost: server closed the connection'), {
        code: 'PROTOCOL_CONNECTION_LOST',
      }),
    );
    const secondQuery = vi.fn().mockResolvedValue([[{ id: 7 }], []]);
    mocks.createConnection.mockResolvedValueOnce({ query: firstQuery }).mockResolvedValueOnce({ query: secondQuery });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(db.read<{ id: number }>('SELECT 7 AS id')).resolves.toEqual([{ id: 7 }]);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
    expect(firstQuery).toHaveBeenCalledOnce();
    expect(secondQuery).toHaveBeenCalledOnce();
  });

  it('shares a replacement connection between concurrent failed reads', async () => {
    const closed = new Error("Can't add new command when connection is in closed state");
    const firstQuery = vi.fn().mockRejectedValue(closed);
    const secondQuery = vi.fn().mockResolvedValue([[], []]);
    mocks.createConnection.mockResolvedValueOnce({ query: firstQuery }).mockResolvedValueOnce({ query: secondQuery });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(Promise.all([db.read('SELECT 1'), db.read('SELECT 2')])).resolves.toEqual([[], []]);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
    expect(secondQuery).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect for an unrelated query error', async () => {
    const failure = Object.assign(new Error('Invalid query'), { code: 'ER_PARSE_ERROR' });
    mocks.createConnection.mockResolvedValue({ query: vi.fn().mockRejectedValue(failure) });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(db.read('BROKEN SQL')).rejects.toBe(failure);
    expect(mocks.createConnection).toHaveBeenCalledOnce();
  });

  it('does not loop when the replacement connection also fails', async () => {
    const closed = new Error("Can't add new command when connection is in closed state");
    const replacementFailure = new Error('replacement unavailable');
    mocks.createConnection
      .mockResolvedValueOnce({ query: vi.fn().mockRejectedValue(closed) })
      .mockResolvedValueOnce({ query: vi.fn().mockRejectedValue(replacementFailure) });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(db.read('SELECT 1')).rejects.toBe(replacementFailure);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
  });
});
