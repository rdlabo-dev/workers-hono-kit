/**
 * Describes which credential boundary caused an authentication failure.
 *
 * Only `identity` means that the application's global authenticated identity is
 * no longer usable. `reauthentication` keeps the identity but requires a recent
 * sign-in, while `credential` is limited to a delegated/domain credential.
 */
export const AUTH_FAILURE_SCOPES = {
  identity: 'identity',
  reauthentication: 'reauthentication',
  credential: 'credential',
} as const;

export type AuthFailureScope = (typeof AUTH_FAILURE_SCOPES)[keyof typeof AUTH_FAILURE_SCOPES];

export const AUTH_IDENTITY_INVALID_CODE = 'AUTH_IDENTITY_INVALID';

export interface AuthFailureBody<
  TScope extends AuthFailureScope = AuthFailureScope,
  TCode extends string = string,
  TStatus extends 401 | 403 = 401,
> {
  statusCode: TStatus;
  message: string;
  code: TCode;
  authFailureScope: TScope;
}

/**
 * Creates the stable wire body for an authentication failure.
 *
 * Domain-specific codes remain owned by each application. The scope is the
 * shared lifecycle contract consumed by clients deciding which local state may
 * be invalidated.
 */
export const createAuthFailureBody = <TScope extends AuthFailureScope, TCode extends string>(
  authFailureScope: TScope,
  code: TCode,
  message: string,
): AuthFailureBody<TScope, TCode> => ({
  statusCode: 401,
  message,
  code,
  authFailureScope,
});

export const createIdentityAuthFailureBody = (
  message = 'Unauthorized',
): AuthFailureBody<'identity', typeof AUTH_IDENTITY_INVALID_CODE> =>
  createAuthFailureBody(AUTH_FAILURE_SCOPES.identity, AUTH_IDENTITY_INVALID_CODE, message);

/**
 * Creates an explicitly tagged identity failure with the historical HTTP 403
 * status used by some deployed products.
 *
 * New APIs should use {@link createIdentityAuthFailureBody}. This helper exists
 * for servers that must remain compatible with installed clients whose auth
 * interceptor recognizes the legacy 403 response.
 */
export const createLegacyIdentityAuthFailureBody = (
  message = 'Forbidden resource',
): AuthFailureBody<'identity', typeof AUTH_IDENTITY_INVALID_CODE, 403> => ({
  statusCode: 403,
  message,
  code: AUTH_IDENTITY_INVALID_CODE,
  authFailureScope: AUTH_FAILURE_SCOPES.identity,
});
