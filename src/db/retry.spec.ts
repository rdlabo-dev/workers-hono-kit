import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryWhenDeadlock } from './retry.js';

const deadlock = () => Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('retryWhenDeadlock', () => {
  it('成功すればそのまま返す（retry しない）', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(retryWhenDeadlock(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ER_LOCK_DEADLOCK は指定回数まで retry して最終的に成功する', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw deadlock();
      }
      return 'recovered';
    });
    await expect(retryWhenDeadlock(fn, 3, 1)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('Promise を返す前の同期 ER_LOCK_DEADLOCK も retry する', async () => {
    let calls = 0;
    const success = async () => 'recovered';
    const fn = vi.fn((): Promise<string> => {
      calls += 1;
      if (calls === 1) {
        throw deadlock();
      }
      return success();
    });

    await expect(retryWhenDeadlock(fn, 2, 1)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('causeに包まれたER_LOCK_DEADLOCKもretryする', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Failed query', { cause: deadlock() }))
      .mockResolvedValueOnce('recovered');

    await expect(retryWhenDeadlock(fn, 2, 1)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retry を使い切ってもデッドロックなら最後のエラーを投げる', async () => {
    const fn = vi.fn(async () => {
      throw deadlock();
    });
    await expect(retryWhenDeadlock(fn, 3, 1)).rejects.toMatchObject({ code: 'ER_LOCK_DEADLOCK' });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('デッドロック以外のエラーは即座に再 throw（retry しない）', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(retryWhenDeadlock(fn, 3, 1)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('指数バックオフで待つ（delay * (attempt+1)）', async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      handler: (...args: unknown[]) => void,
      timeout?: number,
    ) => {
      delays.push(timeout ?? 0);
      handler(); // 同期実行してテストを高速化
      return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
    }) as typeof globalThis.setTimeout);
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls < 3) {
        throw deadlock();
      }
      return 'ok';
    };
    await expect(retryWhenDeadlock(fn, 3, 100)).resolves.toBe('ok');
    expect(delays).toEqual([100, 200]); // 1回目=100, 2回目=200
  });
});
