import { describe, expect, it } from 'vitest';
import {
  AUTH_FAILURE_SCOPES,
  AUTH_IDENTITY_INVALID_CODE,
  createAuthFailureBody,
  createIdentityAuthFailureBody,
  createLegacyIdentityAuthFailureBody,
} from './auth-failure.js';

describe('auth failure protocol', () => {
  it('creates the standard global identity failure', () => {
    expect(createIdentityAuthFailureBody()).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
      code: AUTH_IDENTITY_INVALID_CODE,
      authFailureScope: AUTH_FAILURE_SCOPES.identity,
    });
  });

  it('preserves domain codes for narrower credential boundaries', () => {
    expect(createAuthFailureBody('credential', 'PUBLIC_BOOKING_SESSION_INVALID', 'Session expired')).toEqual({
      statusCode: 401,
      message: 'Session expired',
      code: 'PUBLIC_BOOKING_SESSION_INVALID',
      authFailureScope: 'credential',
    });
  });

  it('tags a historical 403 without changing its deployed status contract', () => {
    expect(createLegacyIdentityAuthFailureBody()).toEqual({
      statusCode: 403,
      message: 'Forbidden resource',
      code: AUTH_IDENTITY_INVALID_CODE,
      authFailureScope: AUTH_FAILURE_SCOPES.identity,
    });
  });
});
