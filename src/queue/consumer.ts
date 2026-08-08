/**
 * Consumer-side helper for processing a Cloudflare Queues `MessageBatch` with per-message success and
 * failure handling, including explicit acknowledgement of permanent failures.
 *
 * A queue consumer invocation receives at most `max_batch_size` messages (configured in
 * `wrangler.toml`), which is precisely the mechanism that bounds its subrequest budget: with a small
 * `max_batch_size`, each invocation performs a fixed, small number of external calls no matter how
 * many messages are backed up in the queue. {@link processBatch} applies the standard
 * ack-on-success / retry-on-failure discipline so one poison message does not fail its whole batch.
 * Errors explicitly tagged with `retryable: false` are reported and acknowledged because delivering
 * the same payload again cannot make them converge.
 *
 * Messages are processed sequentially. This keeps the number of *simultaneously open* subrequests at
 * one, staying well clear of the Workers concurrent-connection ceiling, and makes the per-invocation
 * subrequest count deterministic (`<= max_batch_size`). For a queue consumer — which is not on a
 * user-facing latency path — sequential processing is the safer default.
 *
 * @example
 * ```ts
 * // Worker `queue` handler
 * export default {
 *   async queue(batch: MessageBatchLike<{ userId: number }>, env: Env) {
 *     await processBatch(batch, async ({ userId }) => {
 *       await reloadOneCustomer(env, userId); // exactly one external payment call
 *     });
 *   },
 * };
 * ```
 *
 * @packageDocumentation
 */

/**
 * Minimal subset of `@cloudflare/workers-types`' `Message` used by {@link processBatch}.
 *
 * Declared locally so consumers are not forced to depend on `@cloudflare/workers-types`.
 *
 * @typeParam Body - Type of the message body.
 */
export interface QueueMessageLike<Body = unknown> {
  /** Unique id assigned by the Queues runtime. */
  readonly id: string;
  /** Number of delivery attempts so far (starts at 1 on first delivery). */
  readonly attempts: number;
  /** The message payload. */
  readonly body: Body;
  /** Explicitly acknowledge this message so it is not redelivered. */
  ack: () => void;
  /** Mark this message for redelivery, optionally after a delay. */
  retry: (options?: { delaySeconds?: number }) => void;
}

/**
 * Minimal subset of `@cloudflare/workers-types`' `MessageBatch` used by {@link processBatch}.
 *
 * @typeParam Body - Type of each message body in the batch.
 */
export interface MessageBatchLike<Body = unknown> {
  /** Name of the queue this batch was delivered from. */
  readonly queue: string;
  /** The messages in this batch; length is bounded by the consumer's `max_batch_size`. */
  readonly messages: readonly QueueMessageLike<Body>[];
}

/**
 * Options for {@link processBatch}.
 *
 * @typeParam Body - Type of each message body.
 */
export interface ProcessBatchOptions<Body = unknown> {
  /**
   * Invoked when `handler` throws for a message, before the message is retried or acknowledged as a
   * permanent failure. Use it to log or report; it must not throw. Defaults to `console.error`.
   */
  onError?: (error: unknown, message: QueueMessageLike<Body>) => void;
  /**
   * Delay, in seconds, applied when re-queuing a failed message. Omit to retry with the queue's
   * default backoff.
   */
  retryDelaySeconds?: number;
}

/**
 * Outcome counts returned by {@link processBatch}.
 */
export interface ProcessBatchResult {
  /** Messages whose handler completed successfully and were acked. */
  processed: number;
  /** Messages whose handler failed permanently and were acked instead of retried. */
  discarded: number;
  /** Messages whose handler threw and were marked for retry. */
  failed: number;
}

/**
 * Error contract for failures that cannot converge by redelivering the same queue message.
 *
 * Domain packages should use a named error class with this flag. {@link processBatch} owns the
 * transport decision: it reports the failure through `onError`, acknowledges the message, and does
 * not spend retries or dead-letter capacity on it.
 */
export interface NonRetryableErrorLike {
  readonly retryable: false;
}

/** Return whether an unknown thrown value explicitly opts out of queue retry. */
export function isNonRetryableError(error: unknown): error is NonRetryableErrorLike {
  return typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === false;
}

/**
 * Process every message in `batch` sequentially, acking successes and permanent failures while
 * retrying transient or unclassified failures.
 *
 * Each message is passed to `handler`; if it resolves the message is acked. A thrown error is routed
 * to {@link ProcessBatchOptions.onError}; errors tagged with `retryable: false` are then acked and
 * counted as discarded, while all other errors are marked for retry (honoring
 * {@link ProcessBatchOptions.retryDelaySeconds}). One failing message never affects the others, and
 * the returned counts let tests assert that the per-invocation workload — and therefore the
 * subrequest count — stayed bounded by the batch size.
 *
 * @typeParam Body - Type of each message body.
 * @param batch - The delivered message batch.
 * @param handler - Async work for a single message; performs the bounded external call(s). Receives
 *   the decoded `body` and the raw message (for `attempts`, `id`, etc.).
 * @param options - Error reporting and retry tuning; see {@link ProcessBatchOptions}.
 * @returns The number of processed, discarded, and retryable-failed messages.
 * @example
 * ```ts
 * const { processed, failed } = await processBatch(
 *   batch,
 *   async ({ id }) => sendOneMail(id),
 *   { retryDelaySeconds: 30, onError: (e, m) => report(e, m.id) },
 * );
 * ```
 */
export async function processBatch<Body>(
  batch: MessageBatchLike<Body>,
  handler: (body: Body, message: QueueMessageLike<Body>) => Promise<void>,
  options?: ProcessBatchOptions<Body>,
): Promise<ProcessBatchResult> {
  const onError =
    options?.onError ??
    ((error, message) => {
      console.error(`[queue:${batch.queue}] message ${message.id} failed`, error);
    });
  const retryOptions =
    options?.retryDelaySeconds === undefined ? undefined : { delaySeconds: options.retryDelaySeconds };

  let processed = 0;
  let discarded = 0;
  let failed = 0;
  for (const message of batch.messages) {
    try {
      await handler(message.body, message);
      message.ack();
      processed++;
    } catch (error) {
      try {
        onError(error, message);
      } catch {
        // onError contract says "must not throw"; guard defensively so disposition and remaining messages still run.
      }
      if (isNonRetryableError(error)) {
        message.ack();
        discarded++;
        continue;
      }
      message.retry(retryOptions);
      failed++;
    }
  }
  return { processed, discarded, failed };
}
