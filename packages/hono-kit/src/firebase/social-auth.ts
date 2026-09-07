import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { DecodedIdToken } from './firebase-verifier.js';

/** Apple Sign In OIDC issuer (`iss`) expected by {@link verifyAppleIdentityToken}. */
export const APPLE_IDENTITY_ISSUER = 'https://appleid.apple.com';

/**
 * Google OIDC issuers accepted by {@link verifyGoogleIdentityToken}.
 *
 * Google issues tokens with either the HTTPS form or the host-only form of
 * `accounts.google.com`; both are listed so verification matches either claim.
 */
export const GOOGLE_IDENTITY_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;

const appleJwks = createRemoteJWKSet(new URL(`${APPLE_IDENTITY_ISSUER}/auth/keys`));
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * Verify an Apple identity token and return its `sub` (Apple user id).
 *
 * Checks signature against Apple's JWKS (or an injected key resolver), enforces
 * {@link APPLE_IDENTITY_ISSUER}, and requires `aud` to equal the configured Services ID /
 * bundle id (`audience`).
 *
 * @param idToken - Raw Apple identity token JWT from Sign in with Apple.
 * @param audience - Expected `aud` claim (Apple Services ID or native bundle id).
 * @param getKey - Optional JWKS / key resolver; defaults to Apple's remote JWKS. Inject a
 *   static key in tests to avoid network I/O.
 * @returns The token `sub` (Apple user identifier).
 * @throws If signature, issuer, audience, or expiry fail verification, or `sub` is missing.
 */
export const verifyAppleIdentityToken = async (
  idToken: string,
  audience: string,
  getKey: JWTVerifyGetKey = appleJwks,
): Promise<string> => {
  const { payload } = await jwtVerify(idToken, getKey, { issuer: APPLE_IDENTITY_ISSUER, audience });
  if (!payload.sub) {
    throw new Error('Apple identity token has no subject');
  }
  return payload.sub;
};

/**
 * Verify a Google identity token and return its `sub` (Google user id).
 *
 * Checks signature against Google's OAuth2 certs (or an injected key resolver), accepts either
 * issuer in {@link GOOGLE_IDENTITY_ISSUERS}, and requires `aud` to match the configured OAuth
 * client id(s) (`audience`).
 *
 * @param idToken - Raw Google ID token JWT.
 * @param audience - Expected `aud` claim: a single OAuth client id, or a list when native and
 *   web clients share one login endpoint.
 * @param getKey - Optional JWKS / key resolver; defaults to Google's remote certs. Inject a
 *   static key in tests to avoid network I/O.
 * @returns The token `sub` (Google user identifier).
 * @throws If signature, issuer, audience, or expiry fail verification, or `sub` is missing.
 */
export const verifyGoogleIdentityToken = async (
  idToken: string,
  audience: string | readonly string[],
  getKey: JWTVerifyGetKey = googleJwks,
): Promise<string> => {
  const { payload } = await jwtVerify(idToken, getKey, {
    issuer: [...GOOGLE_IDENTITY_ISSUERS],
    audience: typeof audience === 'string' ? audience : [...audience],
  });
  if (!payload.sub) {
    throw new Error('Google identity token has no subject');
  }
  return payload.sub;
};

/**
 * Return whether a **verified** Firebase ID token already carries the given provider subject.
 *
 * Reads `firebase.identities[providerId]` for `subject`. When `requireSignInProvider` is true,
 * also requires `firebase.sign_in_provider === providerId` so the session was established with
 * that provider (login), not merely that the identity is linked while signed in another way.
 *
 * @remarks
 * `token` must already be a verified Firebase ID-token payload (for example from
 * {@link FirebaseVerifier.verifyIdToken} or auth middleware). This helper does not verify the
 * Firebase JWT itself.
 *
 * Typical policy:
 * - **Login** (`requireSignInProvider: true`): subject present and active sign-in provider matches.
 * - **Link / unlink / linkage checks** (default `false`): subject present in identities only.
 *
 * @param token - Verified Firebase ID-token payload (`DecodedIdToken`).
 * @param providerId - Firebase provider id (e.g. `'google.com'`, `'apple.com'`).
 * @param subject - Provider subject previously returned by {@link verifyGoogleIdentityToken} or
 *   {@link verifyAppleIdentityToken}.
 * @param requireSignInProvider - When `true`, also require `sign_in_provider === providerId`.
 * @returns `true` when the identity (and optional active provider) matches.
 */
export const hasFirebaseProviderIdentity = (
  token: DecodedIdToken,
  providerId: string,
  subject: string,
  requireSignInProvider = false,
): boolean => {
  const firebase = token as DecodedIdToken & {
    firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> };
  };
  const subjects = firebase.firebase?.identities?.[providerId];
  return (
    Array.isArray(subjects) &&
    subjects.includes(subject) &&
    (!requireSignInProvider || firebase.firebase?.sign_in_provider === providerId)
  );
};

/**
 * Apple developer credentials used to mint a Sign in with Apple `client_secret` JWT.
 */
export interface AppleClientSecretConfig {
  /** PEM-encoded PKCS#8 ES256 private key from the Apple developer key. */
  privateKey: string;
  /** Key id (`kid`) of the Apple developer key. */
  keyId: string;
  /** Apple Team ID used as the JWT `iss` claim. */
  teamId: string;
}

/**
 * Create a short-lived Sign in with Apple `client_secret` (ES256 JWT).
 *
 * The JWT is issued for `clientId` as `sub`, audience {@link APPLE_IDENTITY_ISSUER}, and expires
 * 120 seconds after `now`. Used for Apple's token and revoke endpoints.
 *
 * @param config - Apple Team ID, key id, and PKCS#8 private key.
 * @param clientId - Apple Services ID or native bundle id (`sub` claim).
 * @param now - Unix time in seconds for `iat` / `exp`; injectable for deterministic tests.
 *   Defaults to the system clock.
 * @returns A compact ES256 JWT suitable as Apple's `client_secret`.
 */
export const createAppleClientSecret = async (
  config: AppleClientSecretConfig,
  clientId: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .setAudience(APPLE_IDENTITY_ISSUER)
    .setSubject(clientId)
    .sign(await importPKCS8(config.privateKey, 'ES256'));
