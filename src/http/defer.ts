import type { ExecutionContextLike } from './execution-context.js';

/**
 * Fire-and-forget executor: registers a promise without awaiting it in the request path.
 *
 * @remarks
 * On Cloudflare Workers, un-awaited work after the response may be killed unless it is registered
 * via `ctx.waitUntil`. Inject a {@link createWaitUntilDefer} instance from the worker entry;
 * use {@link defaultDefer} in tests and other contexts without an execution context.
 */
export type DeferExecutor = (promise: Promise<unknown>) => void;

const reportDeferFailure = (error: unknown): void => {
  console.error('[defer] background task failed', error);
};

/**
 * Default defer implementation (NestJS `void promise` equivalent). Reports rejections without
 * propagating them. Used when no `ExecutionContext` is available (tests, partial scheduled paths).
 */
export const defaultDefer: DeferExecutor = (promise) => {
  void promise.catch(reportDeferFailure);
};

/**
 * Build a {@link DeferExecutor} that keeps the worker alive until `promise` settles.
 *
 * @param ctx - Workers execution context (`waitUntil`).
 */
export function createWaitUntilDefer(ctx: ExecutionContextLike): DeferExecutor {
  return (promise) => {
    ctx.waitUntil(promise.catch(reportDeferFailure));
  };
}
