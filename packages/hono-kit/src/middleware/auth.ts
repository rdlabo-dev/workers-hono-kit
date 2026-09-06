import type { Context, Env, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getAppInfo } from '../http/app-info.js';
import type { AppInfo } from '../http/app-info.js';

/** Processing stage at which authentication middleware failed. */
export type AuthMiddlewareFailureStage = 'token' | 'verify' | 'appInfo' | 'resolveUserId' | 'setContext';

/** Safe metadata describing an authentication middleware failure without including the token. */
export interface AuthMiddlewareFailureDetails {
  /** Stage which rejected or failed. */
  stage: AuthMiddlewareFailureStage;
  /** Whether the configured token header contained a non-blank value. */
  tokenPresent: boolean;
}

/** Expected rejection raised when the configured authentication header is absent or blank. */
export class AuthTokenMissingError extends Error {
  /** Stable machine-readable code for application classifiers. */
  readonly code = 'AUTH_TOKEN_MISSING';

  constructor() {
    super('Authentication token is missing');
    this.name = 'AuthTokenMissingError';
  }
}

/**
 * Configuration for {@link createAuthMiddleware}.
 *
 * @typeParam E - The Hono `Env` (bindings/variables) of the application.
 * @typeParam Verified - The value produced by {@link AuthMiddlewareOptions.verify} (e.g. a decoded token or user record).
 * @typeParam Id - The resolved user identifier type.
 */
export interface AuthMiddlewareOptions<E extends Env, Verified, Id = unknown> {
  /** Header carrying the ID token. Defaults to `'x-amz-security-token'`. */
  tokenHeader?: string;
  /**
   * Reject an absent or blank token before calling {@link AuthMiddlewareOptions.verify}.
   *
   * @remarks
   * Defaults to `false` for backward compatibility: existing consumers historically receive an
   * empty string in `verify` when the header is absent. Enable this when the application wants a
   * typed {@link AuthTokenMissingError} and does not use an empty token as custom input.
   */
  rejectMissingToken?: boolean;
  /**
   * Verify the raw token and return the decoded value or user record.
   *
   * @param token - The raw token, or an empty string when absent unless `rejectMissingToken` is enabled.
   * @param c - The current Hono context.
   * @returns The verified value passed to {@link AuthMiddlewareOptions.resolveUserId}/{@link AuthMiddlewareOptions.setContext}.
   * @throws If the token is invalid; rejecting/throwing triggers the failure path.
   */
  verify: (token: string, c: Context<E>) => Promise<Verified>;
  /**
   * Resolve the database user id (creating the user if necessary).
   *
   * @remarks
   * Omit this to run in **token-only** mode (verification only, e.g. for login). Create-on-miss
   * behavior (such as `getUserId(...).catch(() => createUser(...))`) should be composed here by the
   * caller.
   *
   * @param verified - The value returned by {@link AuthMiddlewareOptions.verify}.
   * @param c - The current Hono context.
   * @param appInfo - The resolved application info for the request.
   * @returns The resolved user id.
   */
  resolveUserId?: (verified: Verified, c: Context<E>, appInfo: AppInfo) => Promise<Id>;
  /**
   * Store the verification result on the context variables.
   *
   * @remarks
   * Inject the application-specific variable names here (e.g. `decodedToken`, `userRecord`, `userProtocol`).
   *
   * @param c - The current Hono context.
   * @param data - The verified value, resolved app info, and (when available) the user id.
   */
  setContext: (c: Context<E>, data: { verified: Verified; appInfo: AppInfo; userId?: Id }) => void;
  /**
   * Override the failure behavior.
   *
   * @remarks
   * Defaults to `throw new HTTPException(failureStatus, { message: failureMessage })`. Provide this to
   * return a custom `Response` instead (e.g. `c.json(body, status)`).
   *
   * @param err - The error thrown during verification/resolution.
   * @param c - The current Hono context.
   * @returns The failure response to send.
   */
  onFailure?: (err: unknown, c: Context<E>, details: AuthMiddlewareFailureDetails) => Response | Promise<Response>;
  /**
   * Report a failed authentication attempt.
   *
   * @remarks
   * When omitted, the historical behavior (`console.error(err)`) is preserved. Applications should
   * provide this hook to suppress expected credential rejections while reporting dependency and
   * internal failures through their normal observability path. The hook must never include raw
   * authentication tokens in logs or telemetry.
   */
  reportFailure?: (err: unknown, c: Context<E>, details: AuthMiddlewareFailureDetails) => void | Promise<void>;
  /** Status used by the default `onFailure`. Defaults to `403`. */
  failureStatus?: ContentfulStatusCode;
  /** Message used by the default `onFailure`. Defaults to `'Forbidden resource'`. */
  failureMessage?: string;
}

/**
 * Create an authentication middleware equivalent to a NestJS `AuthGuard` / `TokenGuard`.
 *
 * The middleware runs a fixed skeleton — read the token header, `verify`, `getAppInfo`,
 * `resolveUserId`, `setContext`, and on error `reportFailure` then `onFailure` — while the
 * application injects the variable parts (token verification, user-id resolution, context variable
 * names, and the failure response). Omitting {@link AuthMiddlewareOptions.resolveUserId} yields a
 * token-only middleware.
 *
 * @typeParam E - The Hono `Env` of the application.
 * @typeParam Verified - The value produced by `verify`.
 * @typeParam Id - The resolved user identifier type.
 * @param options - The verification, resolution, and failure hooks; see {@link AuthMiddlewareOptions}.
 * @returns A {@link MiddlewareHandler} that authenticates the request and populates the context.
 * @throws HTTPException From the default failure handler when `onFailure` is not supplied.
 *
 * @example
 * ```ts
 * const auth = createAuthMiddleware({
 *   verify: (token, c) => verifier.verifyIdToken(token),
 *   resolveUserId: (decoded) => findUserId(decoded.uid),
 *   setContext: (c, { verified, userId }) => {
 *     c.set('decodedToken', verified);
 *     c.set('userId', userId);
 *   },
 * });
 * app.use('/api/*', auth);
 * ```
 */
export function createAuthMiddleware<E extends Env = Env, Verified = unknown, Id = unknown>(
  options: AuthMiddlewareOptions<E, Verified, Id>,
): MiddlewareHandler<E> {
  const {
    tokenHeader = 'x-amz-security-token',
    rejectMissingToken = false,
    verify,
    resolveUserId,
    setContext,
    onFailure,
    reportFailure,
    failureStatus = 403,
    failureMessage = 'Forbidden resource',
  } = options;

  return async (c, next) => {
    let stage: AuthMiddlewareFailureStage = 'token';
    let tokenPresent = false;
    const authenticate = async () => {
      const token = c.req.header(tokenHeader) ?? '';
      tokenPresent = token.trim().length > 0;
      if (!tokenPresent && rejectMissingToken) {
        throw new AuthTokenMissingError();
      }
      stage = 'verify';
      const verified = await verify(token, c);
      stage = 'appInfo';
      const appInfo = getAppInfo(c);
      stage = 'resolveUserId';
      const userId = resolveUserId ? await resolveUserId(verified, c, appInfo) : undefined;
      stage = 'setContext';
      setContext(c, { verified, appInfo, userId });
    };
    const outcome = await authenticate().then(
      () => ({ ok: true }) as const,
      (error: unknown) => ({ ok: false, error }) as const,
    );
    if (!outcome.ok) {
      const details = { stage, tokenPresent } satisfies AuthMiddlewareFailureDetails;
      if (reportFailure) {
        const report = async () => reportFailure(outcome.error, c, details);
        await report().catch((reportingError: unknown) => {
          // Observability must never alter the authentication response.
          console.error(reportingError);
        });
      } else {
        // Preserve the historical default for consumers that have not adopted classified reporting.
        console.error(outcome.error);
      }
      if (onFailure) {
        return onFailure(outcome.error, c, details);
      }
      throw new HTTPException(failureStatus, { message: failureMessage });
    }
    await next();
  };
}
