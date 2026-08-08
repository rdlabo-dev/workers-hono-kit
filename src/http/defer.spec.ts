import { describe, expect, it, vi } from 'vitest';
import { createWaitUntilDefer, defaultDefer } from './defer.js';

afterEach(() => vi.restoreAllMocks());

describe('defaultDefer', () => {
  it('does not report resolved promises', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      defaultDefer(Promise.resolve('ok'));
    }).not.toThrow();
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('reports rejections without propagating them', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');
    expect(() => {
      defaultDefer(Promise.reject(error));
    }).not.toThrow();
    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith('[defer] background task failed', error);
  });
});

describe('createWaitUntilDefer', () => {
  it('registers a rejection-reporting promise without failing the execution context', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let registered: Promise<unknown> | undefined;
    const waitUntil = vi.fn();
    waitUntil.mockImplementation((promise: Promise<unknown>) => {
      registered = promise;
    });
    const defer = createWaitUntilDefer({ waitUntil });
    const error = new Error('boom');
    const promise = Promise.reject(error);
    defer(promise);

    expect(registered).not.toBe(promise);
    await expect(registered).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('[defer] background task failed', error);
  });
});
