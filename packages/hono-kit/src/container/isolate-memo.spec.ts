import { describe, expect, it, vi } from 'vitest';
import { createIsolateMemo } from './isolate-memo.js';

describe('createIsolateMemo', () => {
  it('reuses a resolved value', async () => {
    const loader = vi.fn(async (n: number) => n * 2);
    const resolve = createIsolateMemo(loader);

    await expect(resolve(3)).resolves.toBe(6);
    await expect(resolve(99)).resolves.toBe(6);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok');
    const resolve = createIsolateMemo(loader);

    await expect(resolve('a')).rejects.toThrow('transient');
    await expect(resolve('b')).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('lets a second request succeed while the first request is pending', async () => {
    let failFirst!: (error: Error) => void;
    const firstLoad = new Promise<string>((_resolve, reject) => {
      failFirst = reject;
    });
    const loader = vi.fn().mockReturnValueOnce(firstLoad).mockResolvedValueOnce('ready');
    const resolve = createIsolateMemo(loader);

    const first = resolve('cancelled request');
    await expect(resolve('next request')).resolves.toBe('ready');
    const failure = expect(first).rejects.toThrow('request ended');
    failFirst(new Error('request ended'));
    await failure;

    await expect(resolve('another request')).resolves.toBe('ready');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not let a load that started before reset populate the new cache', async () => {
    let finishFirst!: (value: string) => void;
    const firstLoad = new Promise<string>((resolve) => {
      finishFirst = resolve;
    });
    const loader = vi.fn().mockReturnValueOnce(firstLoad).mockResolvedValueOnce('new');
    const resolve = createIsolateMemo(loader);

    const first = resolve(null);
    resolve.reset();
    await expect(resolve(null)).resolves.toBe('new');
    finishFirst('old');
    await expect(first).resolves.toBe('old');
    await expect(resolve(null)).resolves.toBe('new');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reset clears the cache', async () => {
    const loader = vi.fn(async () => 'v1');
    const resolve = createIsolateMemo(loader);

    await resolve(null);
    resolve.reset();
    loader.mockResolvedValueOnce('v2');
    await expect(resolve(null)).resolves.toBe('v2');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
