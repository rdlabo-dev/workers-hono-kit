import { describe, expect, it, vi } from 'vitest';
import { processBatch } from './consumer.js';
import type { MessageBatchLike, QueueMessageLike } from './consumer.js';

/**
 * Build a fake message whose `ack`/`retry` are spies.
 */
function createMessage<Body>(id: string, body: Body): QueueMessageLike<Body> {
  return {
    id,
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function createBatch<Body>(messages: QueueMessageLike<Body>[], queue = 'test-queue'): MessageBatchLike<Body> {
  return { queue, messages };
}

describe('processBatch', () => {
  it('全メッセージ成功時は各 ack、retry なし', async () => {
    const messages = [createMessage('a', 1), createMessage('b', 2)];
    const handler = vi.fn(async () => undefined);
    const result = await processBatch(createBatch(messages), handler);

    expect(result).toEqual({ processed: 2, discarded: 0, failed: 0 });
    expect(handler).toHaveBeenCalledTimes(2);
    for (const m of messages) {
      expect(m.ack).toHaveBeenCalledOnce();
      expect(m.retry).not.toHaveBeenCalled();
    }
  });

  it('handler は body とメッセージを受け取る', async () => {
    const message = createMessage('a', { userId: 42 });
    const handler = vi.fn(async () => undefined);
    await processBatch(createBatch([message]), handler);
    expect(handler).toHaveBeenCalledWith({ userId: 42 }, message);
  });

  it('1 件の失敗は他に波及せず、当該のみ retry される', async () => {
    const messages = [createMessage('a', 1), createMessage('b', 2), createMessage('c', 3)];
    const onError = vi.fn();
    const handler = vi.fn(async (body: number) => {
      if (body === 2) {
        throw new Error('boom');
      }
    });
    const result = await processBatch(createBatch(messages), handler, { onError });

    expect(result).toEqual({ processed: 2, discarded: 0, failed: 1 });
    expect(messages[0].ack).toHaveBeenCalledOnce();
    expect(messages[1].ack).not.toHaveBeenCalled();
    expect(messages[1].retry).toHaveBeenCalledOnce();
    expect(messages[2].ack).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][1]).toBe(messages[1]);
  });

  it('Promise を返す前の同期 throw も当該のみ retry し、後続処理を継続する', async () => {
    const messages = [createMessage('a', 1), createMessage('b', 2)];
    const error = new Error('synchronous failure');
    const onError = vi.fn();
    const success = async () => undefined;
    const handler = vi.fn((body: number): Promise<void> => {
      if (body === 1) {
        throw error;
      }
      return success();
    });

    const result = await processBatch(createBatch(messages), handler, { onError });

    expect(result).toEqual({ processed: 1, discarded: 0, failed: 1 });
    expect(onError).toHaveBeenCalledWith(error, messages[0]);
    expect(messages[0].retry).toHaveBeenCalledOnce();
    expect(messages[1].ack).toHaveBeenCalledOnce();
  });

  it('ack の同期 throw も当該のみ retry し、後続処理を継続する', async () => {
    const messages = [createMessage('a', 1), createMessage('b', 2)];
    const error = new Error('ack failure');
    messages[0].ack = vi.fn(() => {
      throw error;
    });
    const onError = vi.fn();

    const result = await processBatch(createBatch(messages), async () => undefined, { onError });

    expect(result).toEqual({ processed: 1, discarded: 0, failed: 1 });
    expect(onError).toHaveBeenCalledWith(error, messages[0]);
    expect(messages[0].retry).toHaveBeenCalledOnce();
    expect(messages[1].ack).toHaveBeenCalledOnce();
  });

  it('retryDelaySeconds を retry に渡す', async () => {
    const message = createMessage('a', 1);
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    await processBatch(createBatch([message]), handler, { retryDelaySeconds: 30, onError: vi.fn() });
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
  });

  it('retryDelaySeconds 未指定なら引数なしで retry', async () => {
    const message = createMessage('a', 1);
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    await processBatch(createBatch([message]), handler, { onError: vi.fn() });
    expect(message.retry).toHaveBeenCalledWith(undefined);
  });

  it('onError が例外を投げても retry と残メッセージ処理が継続する', async () => {
    const messages = [createMessage('a', 1), createMessage('b', 2), createMessage('c', 3)];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = vi.fn(async (body: number) => {
      if (body === 1) {
        throw new Error('handler fail');
      }
    });
    const throwingOnError = vi.fn(() => {
      throw new Error('onError blew up');
    });
    const result = await processBatch(createBatch(messages), handler, { onError: throwingOnError });

    expect(result).toEqual({ processed: 2, discarded: 0, failed: 1 });
    expect(messages[0].retry).toHaveBeenCalledOnce();
    expect(messages[1].ack).toHaveBeenCalledOnce();
    expect(messages[2].ack).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("queueDisposition='discard' の恒久エラーは報告して ack し、retry/DLQ を消費しない", async () => {
    const messages = [createMessage('permanent', 1), createMessage('next', 2)];
    const error = Object.assign(new Error('customer mapping is missing'), { queueDisposition: 'discard' as const });
    const onError = vi.fn();
    const handler = vi.fn(async (body: number) => {
      if (body === 1) {
        throw error;
      }
    });

    const result = await processBatch(createBatch(messages), handler, { onError });

    expect(result).toEqual({ processed: 1, discarded: 1, failed: 0 });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error, messages[0]);
    expect(messages[0].ack).toHaveBeenCalledOnce();
    expect(messages[0].retry).not.toHaveBeenCalled();
    expect(messages[1].ack).toHaveBeenCalledOnce();
  });

  it('他ライブラリの retryable=false は Queue の discard 指示と誤認しない', async () => {
    const message = createMessage('sdk-error', 1);
    const error = Object.assign(new Error('upstream retry policy'), { retryable: false as const });

    const result = await processBatch(
      createBatch([message]),
      async () => {
        throw error;
      },
      { onError: vi.fn() },
    );

    expect(result).toEqual({ processed: 0, discarded: 0, failed: 1 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
  });

  it('恒久エラーの onError が失敗しても console fallback 後に ack し、後続処理を続ける', async () => {
    const messages = [createMessage('permanent', 1), createMessage('next', 2)];
    const permanent = Object.assign(new Error('permanent'), { queueDisposition: 'discard' as const });
    const reportingError = new Error('reporter unavailable');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await processBatch(
      createBatch(messages),
      async (body) => {
        if (body === 1) {
          throw permanent;
        }
      },
      {
        onError: () => {
          throw reportingError;
        },
      },
    );

    expect(result).toEqual({ processed: 1, discarded: 1, failed: 0 });
    expect(errorSpy).toHaveBeenCalledWith(
      '[queue:test-queue] onError failed for message permanent',
      reportingError,
      'original error:',
      permanent,
    );
    expect(messages[0].ack).toHaveBeenCalledOnce();
    expect(messages[0].retry).not.toHaveBeenCalled();
    expect(messages[1].ack).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it('1 invocation の外部呼び出し数はバッチ長で bound される', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => createMessage(String(i), i));
    let externalCalls = 0;
    const handler = vi.fn(async () => {
      externalCalls++; // 1 メッセージ = 1 外部呼び出し想定
    });
    await processBatch(createBatch(messages), handler);
    // max_batch_size 相当（ここでは 10）を超えて呼ばれない
    expect(externalCalls).toBe(10);
    expect(externalCalls).toBeLessThanOrEqual(messages.length);
  });
});
