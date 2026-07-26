import { describe, expect, it } from 'vitest';
import {
  AUTH_FAILURE_SCOPES,
  AUTH_IDENTITY_INVALID_CODE,
  createAuthFailureBody,
  createIdentityAuthFailureBody,
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
});
