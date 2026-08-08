import { jwtVerify } from 'jose';
import type { CryptoKey, JWK, JWTVerifyGetKey, KeyObject } from 'jose';
import type { DecodedIdToken, FirebaseVerifier } from './firebase-verifier.js';
import type { IdentityToolkit } from './identity-toolkit.js';

/**
 * Union of every key shape `jose`'s `jwtVerify` accepts.
 *
 * @remarks
 * `jose` v6 removed `KeyLike`, so the verification key is modelled here as either a static
 * key (production uses `createRemoteJWKSet`, tests use a generated `CryptoKey`) or a dynamic
 * `JWTVerifyGetKey` resolver function. This union covers both `jwtVerify` overloads' key
 * parameters.
 *
 * @internal
 */
type KeyInput = CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey;

/**
 * URL of Google's securetoken JWKS endpoint, which serves the public keys used to sign
 * Firebase ID tokens.
 *
 * @remarks
 * Passed to `createRemoteJWKSet` (see `createRemoteFirebaseVerifier`) so RS256 signatures can
 * be verified against Google's rotating public keys.
 */
export const SECURETOKEN_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Expected rejection for Firebase-specific claims that passed JOSE signature/claim verification. */
export class FirebaseIdTokenValidationError extends Error {
  /** Stable machine-readable code for authentication failure classifiers. */
  readonly code = 'ERR_FIREBASE_ID_TOKEN_INVALID';

  /**
   * Create a Firebase ID-token validation rejection.
   *
   * @param claim - Firebase-specific claim which failed validation.
   */
  constructor(readonly claim: 'subject' | 'exp' | 'iat' | 'auth_time') {
    super(`Firebase ID token has an invalid ${claim}`);
    this.name = 'FirebaseIdTokenValidationError';
  }
}

/**
 * Verifies Firebase ID tokens with `jose` RS256 against Google's securetoken JWKS, and
 * optionally looks up or deletes users via the Google Identity Toolkit REST API.
 *
 * This replaces the `firebase-admin` Auth surface (`verifyIdToken` / `getUser` /
 * `deleteUser`) in environments where the Node SDK cannot run, such as Cloudflare Workers.
 * Token verification follows Firebase's documented third-party JWT validation requirements:
 * issuer and audience equal to the project id, an RS256 signature, a non-empty subject (the
 * uid), and valid `exp`, `iat`, and `auth_time` timestamps.
 *
 * @remarks
 * The verification key is supplied as `keyResolver`:
 * - Production: `createRemoteJWKSet(new URL(SECURETOKEN_JWK_URL))`, which fetches and caches
 *   Google's public keys.
 * - Tests: a generated public key, allowing fully offline verification with no network.
 *
 * `getUser` / `deleteUser` delegate to {@link IdentityToolkit} (a network call); when no
 * `IdentityToolkit` is configured they throw.
 *
 * @see {@link FirebaseVerifier} for the abstract boundary this implements.
 */
export class JoseFirebaseVerifier implements FirebaseVerifier {
  /**
   * Create a verifier.
   *
   * @param opts - Verifier configuration.
   * @param opts.projectId - The Firebase project id, used as both the expected token issuer
   *   (`https://securetoken.google.com/<projectId>`) and audience.
   * @param opts.keyResolver - The RS256 verification key or a dynamic key resolver function.
   * @param opts.identity - Optional Identity Toolkit client enabling `getUser` / `deleteUser`.
   * @param opts.now - Optional clock returning the current time in seconds; injectable for
   *   deterministic tests. Defaults to the system clock.
   */
  constructor(
    private readonly opts: {
      projectId: string;
      keyResolver: KeyInput;
      identity?: IdentityToolkit;
      now?: () => number; // seconds; injectable for tests
    },
  ) {}

  /**
   * Verify a Firebase ID token and return its decoded payload.
   *
   * Checks the RS256 signature against the configured key, enforces the expected issuer and
   * audience (the project id), and applies Firebase's documented ID-token checks: a required
   * future `exp`, a non-empty string subject of at most 128 characters, plus finite `iat` and
   * `auth_time` values that are not in the future. Timestamp comparisons use strict zero clock
   * tolerance.
   *
   * @param idToken - The raw Firebase ID token (JWT) to verify.
   * @returns The decoded payload, with `uid` set from `sub` and `email` lifted to a top-level field.
   * @throws If the signature, issuer, audience, or expiry are invalid, if the subject is
   *   missing/non-string/too long, or if `iat`/`auth_time` is missing, non-finite, or in the future.
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    const now = this.nowSeconds();
    const options = {
      issuer: `https://securetoken.google.com/${this.opts.projectId}`,
      audience: this.opts.projectId,
      algorithms: ['RS256'] as string[],
      requiredClaims: ['exp'],
      currentDate: new Date(now * 1000),
      clockTolerance: 0,
    };
    // Branch so each call matches a single jwtVerify overload (static key vs getKey fn).
    const key = this.opts.keyResolver;
    const { payload } =
      typeof key === 'function' ? await jwtVerify(idToken, key, options) : await jwtVerify(idToken, key, options);
    // Apply Firebase's documented checks beyond signature/iss/aud/exp.
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
      throw new FirebaseIdTokenValidationError('subject');
    }
    if (!Number.isFinite(payload.exp)) {
      throw new FirebaseIdTokenValidationError('exp');
    }
    const issuedAt = payload.iat;
    if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || issuedAt > now) {
      throw new FirebaseIdTokenValidationError('iat');
    }
    const authTime = payload.auth_time;
    if (typeof authTime !== 'number' || !Number.isFinite(authTime) || authTime > now) {
      throw new FirebaseIdTokenValidationError('auth_time');
    }
    return { ...payload, uid: payload.sub, email: payload.email as string | undefined };
  }

  /**
   * Look up a user record by uid via the Identity Toolkit REST API.
   *
   * @param uid - The user's unique id.
   * @returns The user's `uid` and optional `email`, or `null` when the user does not exist.
   * @throws If no Identity Toolkit client was configured on this verifier.
   */
  async getUser(uid: string): Promise<{ uid: string; email?: string } | null> {
    if (!this.opts.identity) {
      throw new Error('Identity Toolkit not configured');
    }
    return this.opts.identity.lookup(uid, this.nowSeconds());
  }

  /**
   * Look up multiple user records by uid via the Identity Toolkit REST API.
   *
   * Batches the lookups into `ceil(uids.length / 100)` `accounts:lookup` requests instead of
   * one request per uid.
   *
   * @param uids - The users' unique ids to look up.
   * @returns The `uid`/`email` of every matching user. Uids Firebase does not recognize are
   *   simply absent from the result (never `null` entries).
   * @throws If no Identity Toolkit client was configured on this verifier.
   */
  async getUsers(uids: string[]): Promise<{ uid: string; email?: string }[]> {
    if (!this.opts.identity) {
      throw new Error('Identity Toolkit not configured');
    }
    return this.opts.identity.lookupMany(uids, this.nowSeconds());
  }

  /**
   * Delete a user by uid via the Identity Toolkit REST API.
   *
   * @param uid - The user's unique id.
   * @returns A promise that resolves once the user has been deleted.
   * @throws If no Identity Toolkit client was configured on this verifier, or the deletion fails.
   */
  async deleteUser(uid: string): Promise<void> {
    if (!this.opts.identity) {
      throw new Error('Identity Toolkit not configured');
    }
    await this.opts.identity.remove(uid, this.nowSeconds());
  }

  /**
   * Return the current time in seconds, using the injected clock when provided.
   *
   * @returns The current Unix time in seconds.
   * @internal
   */
  private nowSeconds(): number {
    const now = this.opts.now ? this.opts.now() : Math.floor(Date.now() / 1000);
    if (!Number.isFinite(now)) {
      throw new Error('Firebase verifier clock returned an invalid time');
    }
    return now;
  }
}
