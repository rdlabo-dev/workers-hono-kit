import type { Connection } from 'mysql2/promise';
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

  it('reconnects once and repeats a replica read after a fatal connection error', async () => {
    const firstQuery = vi.fn().mockRejectedValue(
      Object.assign(new Error('write EPIPE'), {
        code: 'EPIPE',
        fatal: true,
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
    const closed = Object.assign(new Error("Can't add new command when connection is in closed state"), {
      fatal: true,
    });
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

  it('reconnects a failed primary read and replaces an already-cached ORM', async () => {
    const closed = Object.assign(new Error('Connection lost: The server closed the connection.'), {
      code: 'PROTOCOL_CONNECTION_LOST',
      fatal: true,
    });
    const firstQuery = vi.fn().mockRejectedValue(closed);
    const secondQuery = vi.fn().mockResolvedValue([[{ id: 7 }], []]);
    const firstConnection = { query: firstQuery };
    const secondConnection = { query: secondQuery };
    mocks.createConnection.mockResolvedValueOnce(firstConnection).mockResolvedValueOnce(secondConnection);
    const createOrm = vi.fn((connection: Connection) => ({ connection, transaction: vi.fn() }));
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm,
    });

    await expect(db.write(async (orm) => orm.connection)).resolves.toBe(firstConnection);
    await expect(db.query<{ id: number }[]>('SELECT 7 AS id')).resolves.toEqual([{ id: 7 }]);
    await expect(db.write(async (orm) => orm.connection)).resolves.toBe(secondConnection);

    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
    expect(createOrm).toHaveBeenCalledTimes(2);
  });

  it('shares a replacement connection between concurrent failed primary reads', async () => {
    const closed = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET', fatal: true });
    const firstQuery = vi.fn().mockRejectedValue(closed);
    const secondQuery = vi.fn().mockResolvedValue([[], []]);
    mocks.createConnection.mockResolvedValueOnce({ query: firstQuery }).mockResolvedValueOnce({ query: secondQuery });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(Promise.all([db.query('SELECT 1'), db.query('SELECT 2')])).resolves.toEqual([[], []]);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
    expect(secondQuery).toHaveBeenCalledTimes(2);
  });

  it('runs raw and Drizzle reads on one consistent primary snapshot', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ id: 7 }], []]);
    const transaction = vi.fn((fn: (tx: string) => Promise<unknown>) => fn('tx'));
    mocks.createConnection.mockResolvedValue({ query });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction }),
    });

    await expect(
      db.readTransaction(async ({ orm, query: snapshotQuery }) => ({
        orm,
        rows: await snapshotQuery<{ id: number }[]>('SELECT 7 AS id'),
      })),
    ).resolves.toEqual({ orm: 'tx', rows: [{ id: 7 }] });

    expect(query).toHaveBeenNthCalledWith(1, 'SET TRANSACTION READ ONLY');
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT 7 AS id', []);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'repeatable read',
      withConsistentSnapshot: true,
    });
  });

  it('repeats a failed read-only transaction once on a fresh primary connection', async () => {
    const closed = Object.assign(new Error('Connection lost: The server closed the connection.'), {
      fatal: true,
    });
    const firstQuery = vi.fn().mockResolvedValueOnce([[], []]).mockRejectedValueOnce(closed);
    const secondQuery = vi
      .fn()
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ id: 7 }], []]);
    const firstConnection = { query: firstQuery };
    const secondConnection = { query: secondQuery };
    const sharedConnection = { query: vi.fn() };
    mocks.createConnection
      .mockResolvedValueOnce(firstConnection)
      .mockResolvedValueOnce(secondConnection)
      .mockResolvedValueOnce(sharedConnection);
    const createOrm = vi.fn((connection: Connection) => ({
      connection,
      transaction: (fn: (tx: string) => Promise<unknown>) => fn('tx'),
    }));
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm,
    });
    const operation = vi.fn(({ query }: { query: <T>(sql: string) => Promise<T> }) =>
      query<{ id: number }[]>('SELECT 7 AS id'),
    );

    await expect(db.readTransaction(operation)).resolves.toEqual([{ id: 7 }]);
    await expect(db.write(async (orm) => orm.connection)).resolves.toBe(sharedConnection);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(mocks.createConnection).toHaveBeenCalledTimes(3);
    expect(createOrm).toHaveBeenNthCalledWith(1, firstConnection);
    expect(createOrm).toHaveBeenNthCalledWith(2, secondConnection);
    expect(createOrm).toHaveBeenNthCalledWith(3, sharedConnection);
  });

  it('isolates a concurrent primary write from the read-only snapshot connection', async () => {
    let finishSnapshot: (() => void) | undefined;
    const snapshotBlocked = new Promise<void>((resolve) => {
      finishSnapshot = resolve;
    });
    let snapshotStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      snapshotStarted = resolve;
    });
    const snapshotConnection = { query: vi.fn().mockResolvedValue([[], []]) };
    const writeConnection = { query: vi.fn() };
    mocks.createConnection.mockResolvedValueOnce(snapshotConnection).mockResolvedValueOnce(writeConnection);
    const createOrm = vi.fn((connection: Connection) => ({
      connection,
      transaction: (fn: (tx: string) => Promise<unknown>) => fn('tx'),
    }));
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm,
    });

    const snapshot = db.readTransaction(async () => {
      snapshotStarted?.();
      await snapshotBlocked;
    });
    await started;
    await expect(db.write(async (orm) => orm.connection)).resolves.toBe(writeConnection);
    finishSnapshot?.();
    await snapshot;

    expect(createOrm).toHaveBeenNthCalledWith(1, snapshotConnection);
    expect(createOrm).toHaveBeenNthCalledWith(2, writeConnection);
  });

  it('sets READ ONLY before every deadlock retry attempt', async () => {
    const deadlock = Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });
    const query = vi.fn().mockResolvedValue([[], []]);
    const transaction = vi.fn((fn: (tx: string) => Promise<unknown>) => fn('tx'));
    mocks.createConnection.mockResolvedValue({ query });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction }),
    });
    const operation = vi.fn().mockRejectedValueOnce(deadlock).mockResolvedValueOnce('ok');

    await expect(db.readTransaction(operation)).resolves.toBe('ok');

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, 'SET TRANSACTION READ ONLY');
    expect(query).toHaveBeenNthCalledWith(2, 'SET TRANSACTION READ ONLY');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(transaction.mock.invocationCallOrder[0]);
    expect(query.mock.invocationCallOrder[1]).toBeLessThan(transaction.mock.invocationCallOrder[1]);
  });

  it('does not repeat a read-only transaction for an unrelated error', async () => {
    const failure = new Error('Invalid query');
    const query = vi.fn().mockResolvedValue([[], []]);
    const transaction = vi.fn((fn: (tx: string) => Promise<unknown>) => fn('tx'));
    mocks.createConnection.mockResolvedValue({ query });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction }),
    });
    const operation = vi.fn().mockRejectedValue(failure);

    await expect(db.readTransaction(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
    expect(mocks.createConnection).toHaveBeenCalledOnce();
  });

  it('recovers a connection-loss error wrapped by transaction rollback', async () => {
    const closed = new Error("Can't add new command when connection is in closed state");
    const firstQuery = vi.fn().mockResolvedValue([[], []]);
    const secondQuery = vi.fn().mockResolvedValue([[], []]);
    mocks.createConnection.mockResolvedValueOnce({ query: firstQuery }).mockResolvedValueOnce({ query: secondQuery });
    const createOrm = vi.fn(() => ({
      transaction: (fn: (tx: string) => Promise<unknown>) =>
        fn('tx').catch((error: unknown) => {
          throw new Error('Failed query: rollback', { cause: error });
        }),
    }));
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm,
    });
    const operation = vi.fn().mockRejectedValueOnce(closed).mockResolvedValueOnce('ok');

    await expect(db.readTransaction(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
  });

  it('stops after a replacement read-only transaction also loses its connection', async () => {
    const firstFailure = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    const secondFailure = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    const firstQuery = vi.fn().mockResolvedValue([[], []]);
    const secondQuery = vi.fn().mockResolvedValue([[], []]);
    mocks.createConnection.mockResolvedValueOnce({ query: firstQuery }).mockResolvedValueOnce({ query: secondQuery });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: (fn: (tx: string) => Promise<unknown>) => fn('tx') }),
    });
    const operation = vi.fn().mockRejectedValueOnce(firstFailure).mockRejectedValueOnce(secondFailure);

    await expect(db.readTransaction(operation)).rejects.toBe(secondFailure);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
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

  it('reconnects when mysql2 reports a closed connection without a fatal flag', async () => {
    const failure = new Error("Can't add new command when connection is in closed state");
    const replacementQuery = vi.fn().mockResolvedValue([[], []]);
    mocks.createConnection
      .mockResolvedValueOnce({ query: vi.fn().mockRejectedValue(failure) })
      .mockResolvedValueOnce({ query: replacementQuery });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction: vi.fn() }),
    });

    await expect(db.read('SELECT 1')).resolves.toEqual([]);
    expect(mocks.createConnection).toHaveBeenCalledTimes(2);
  });

  it('does not loop when the replacement connection also fails', async () => {
    const closed = Object.assign(new Error("Can't add new command when connection is in closed state"), {
      fatal: true,
    });
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

  it('never repeats writes or transactions after a fatal connection error', async () => {
    const fatal = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET', fatal: true });
    const write = vi.fn().mockRejectedValue(fatal);
    const transactionWork = vi.fn().mockRejectedValue(fatal);
    const transaction = vi.fn((fn: (tx: object) => Promise<unknown>) => fn({}));
    mocks.createConnection.mockResolvedValue({ query: vi.fn() });
    const db = createHyperdriveDatabase({
      primaryHyperdrive: hyperdrive,
      replicaHyperdrive: hyperdrive,
      createOrm: () => ({ transaction }),
    });

    await expect(db.write(write)).rejects.toBe(fatal);
    await expect(db.transaction(transactionWork)).rejects.toBe(fatal);
    expect(write).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
    expect(transactionWork).toHaveBeenCalledOnce();
    expect(mocks.createConnection).toHaveBeenCalledOnce();
  });
});
