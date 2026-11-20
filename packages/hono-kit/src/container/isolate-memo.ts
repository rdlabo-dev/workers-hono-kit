/**
 * Isolate-scoped async memoization for container bootstrap (secrets, env resolution, etc.).
 *
 * A successful value is reused across requests in the same isolate. Concurrent cold calls run
 * independently so pending I/O cannot outlive the Cloudflare request that created it.
 *
 * @remarks
 * The memo is not keyed by argument. The first successful value is retained until reset.
 * A failed load leaves the cache unchanged.
 *
 * @packageDocumentation
 */

/** Callable memo with an explicit reset for tests and isolate teardown. */
export interface IsolateMemo<T, TArg> {
  (arg: TArg): Promise<T>;
  reset(): void;
}

/**
 * Create an isolate-scoped memoized async resolver.
 *
 * @param loader - Async factory called whenever there is no cached value.
 * @returns A function that resolves to the memoized value, plus {@link IsolateMemo.reset}.
 * @example
 * ```ts
 * const resolveSecrets = createIsolateMemo(async (env: Env) => {
 *   const secret = await getAuthenticationSecret(awsOpts(env));
 *   return { firebaseSaJson: secret.firebaseProduction };
 * });
 *
 * // first request populates the cache; SM failure is not cached:
 * await resolveSecrets(env).catch(() => undefined);
 * await resolveSecrets(env); // retries SM
 * ```
 */
export function createIsolateMemo<T, TArg>(loader: (arg: TArg) => Promise<T>): IsolateMemo<T, TArg> {
  let cache: { result?: { value: T } } = {};

  const resolve = async (arg: TArg): Promise<T> => {
    const entry = cache;
    if (entry.result) {
      return entry.result.value;
    }

    const value = await loader(arg);
    entry.result ??= { value };
    return entry.result.value;
  };

  resolve.reset = () => {
    cache = {};
  };

  return resolve;
}
