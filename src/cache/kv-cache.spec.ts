import { describe, expect, it, vi } from 'vitest';
import { KVCache } from './kv-cache.js';
import type { KVCacheErrorContext, KVNamespace } from './kv-cache.js';

class FakeKV implements KVNamespace {
  store = new Map<string, string>();
  puts: { key: string; value: string; ttl?: number }[] = [];
  deletes: string[] = [];
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    this.puts.push({ key, value, ttl: options?.expirationTtl });
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.deletes.push(key);
  }
}

class FailingKV extends FakeKV {
  getError?: Error;
  putError?: Error;
  deleteError?: Error;

  override async get(key: string): Promise<string | null> {
    if (this.getError) {
      throw this.getError;
    }
    return super.get(key);
  }

  override async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (this.putError) {
      throw this.putError;
    }
    return super.put(key, value, options);
  }

  override async delete(key: string): Promise<void> {
    if (this.deleteError) {
      throw this.deleteError;
    }
    return super.delete(key);
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('KVCache', () => {
  it('set→get が JSON を round-trip する', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.set('users', 'byId', 5, { id: 5, name: 'a' });
    expect(await cache.get('users', 'byId', 5)).toEqual({ id: 5, name: 'a' });
  });

  it('キーは appName+version+table_type_column（number id はそのまま）', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.set('users', 'byId', 5, { x: 1 });
    expect(kv.puts[0].key).toBe('testv8_users_byId_5');
  });

  it('string id は sha256hex でハッシュ化する', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test', version: 'v9_' });
    await cache.set('users', 'byKey', 'あ', { x: 1 });
    expect(kv.puts[0].key).toBe(`testv9_users_byKey_${await sha256Hex('あ')}`);
  });

  it('lifetime は minTtl(既定60)で下限クランプ、未指定は defaultLifetime', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.set('t', 'x', 1, { a: 1 }, 10); // 10 < 60 → 60
    await cache.set('t', 'x', 2, { a: 1 }); // 未指定 → 600
    expect(kv.puts[0].ttl).toBe(60);
    expect(kv.puts[1].ttl).toBe(600);
  });

  it('falsy な data は書き込まない / get ミスは undefined', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.set('t', 'x', 1, null);
    await cache.set('t', 'x', 2, 0);
    expect(kv.puts).toHaveLength(0);
    expect(await cache.get('t', 'x', 999)).toBeUndefined();
  });

  it('delete はキーを消す', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.set('t', 'x', 1, { a: 1 });
    await cache.delete('t', 'x', 1);
    expect(await cache.get('t', 'x', 1)).toBeUndefined();
    expect(kv.deletes).toEqual(['testv8_t_x_1']);
  });

  it('setMany / getMany', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    await cache.setMany([
      { table: 't', type: 'x', id: 1, data: { v: 1 } },
      { table: 't', type: 'x', id: 2, data: { v: 2 }, lifetime: 30 },
    ]);
    expect(
      await cache.getMany<{ v: number }>([
        { table: 't', type: 'x', id: 1 },
        { table: 't', type: 'x', id: 2 },
        { table: 't', type: 'x', id: 3 },
      ]),
    ).toEqual([
      { id: 1, value: { v: 1 } },
      { id: 2, value: { v: 2 } },
      { id: 3, value: undefined },
    ]);
  });

  it('1024 バイト超のキーはキャッシュしない（cache-aside で DB 直読みに落ちる）', async () => {
    const kv = new FakeKV();
    const cache = new KVCache(kv, { appName: 'test' });
    const huge = 'x'.repeat(2000);
    await cache.set(huge, 'x', 1, { a: 1 });
    expect(kv.puts).toHaveLength(0);
    expect(await cache.get(huge, 'x', 1)).toBeUndefined();
  });

  it.each([
    ['read', 'getError'],
    ['write', 'putError'],
    ['delete', 'deleteError'],
  ] as const)('reports a %s failure with limited cache context', async (operation, errorField) => {
    const kv = new FailingKV();
    const error = new Error(`${operation} failed`);
    kv[errorField] = error;
    const onError = vi.fn<(error: unknown, context: KVCacheErrorContext) => void>();
    const cache = new KVCache(kv, { appName: 'secret-app', onError });

    if (operation === 'read') {
      await expect(cache.get('users', 'private-email', 'user@example.com')).resolves.toBeUndefined();
    }
    if (operation === 'write') {
      await expect(cache.set('users', 'private-email', 'user@example.com', { secret: 1 })).resolves.toBeUndefined();
    }
    if (operation === 'delete') {
      await expect(cache.delete('users', 'private-email', 'user@example.com')).resolves.toBeUndefined();
    }

    expect(onError).toHaveBeenCalledWith(error, { operation, table: 'users' });
    const context = onError.mock.calls[0][1];
    expect(context).toEqual({ operation, table: 'users' });
    expect(context).not.toHaveProperty('id');
    expect(context).not.toHaveProperty('type');
    expect(context).not.toHaveProperty('key');
    expect(context).not.toHaveProperty('value');
  });

  it('reports parse and serialization failures separately', async () => {
    const kv = new FakeKV();
    kv.store.set('testv8_users_byId_1', '{broken');
    const onError = vi.fn<(error: unknown, context: KVCacheErrorContext) => void>();
    const cache = new KVCache(kv, { appName: 'test', onError });

    await expect(cache.get('users', 'byId', 1)).resolves.toBeUndefined();
    const circular: { self?: unknown } = {};
    circular.self = circular;
    await expect(cache.set('users', 'byId', 1, circular)).resolves.toBeUndefined();

    expect(onError.mock.calls.map(([, context]) => context)).toEqual([
      { operation: 'parse', table: 'users' },
      { operation: 'serialize', table: 'users' },
    ]);
  });

  it('reports JSON values that serialize to undefined without writing them', async () => {
    const kv = new FakeKV();
    const onError = vi.fn<(error: unknown, context: KVCacheErrorContext) => void>();
    const cache = new KVCache(kv, { appName: 'test', onError });

    await expect(cache.set('users', 'byId', 1, () => undefined)).resolves.toBeUndefined();

    expect(kv.puts).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError), { operation: 'serialize', table: 'users' });
  });

  it('does not report misses, falsy values, or oversized keys', async () => {
    const kv = new FakeKV();
    const onError = vi.fn<(error: unknown, context: KVCacheErrorContext) => void>();
    const cache = new KVCache(kv, { appName: 'test', onError });
    const huge = 'x'.repeat(2000);

    await cache.get('users', 'byId', 1);
    await cache.set('users', 'byId', 1, null);
    await cache.set(huge, 'byId', 1, { value: true });
    await cache.delete(huge, 'byId', 1);

    expect(onError).not.toHaveBeenCalled();
  });

  it('isolates and exposes reporter failures without breaking cache callers', async () => {
    const kv = new FailingKV();
    kv.getError = new Error('KV unavailable');
    const reporterError = new Error('reporter unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = new KVCache(kv, {
      appName: 'test',
      onError: () => {
        throw reporterError;
      },
    });

    await expect(cache.get('users', 'byId', 1)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('[KVCache] error reporter failed', reporterError);
  });
});
