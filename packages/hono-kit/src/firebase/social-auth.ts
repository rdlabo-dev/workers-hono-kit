import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { DecodedIdToken } from './firebase-verifier.js';

export const APPLE_IDENTITY_ISSUER = 'https://appleid.apple.com';
export const GOOGLE_IDENTITY_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;

const appleJwks = createRemoteJWKSet(new URL(`${APPLE_IDENTITY_ISSUER}/auth/keys`));
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

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

export interface AppleClientSecretConfig {
  privateKey: string;
  keyId: string;
  teamId: string;
}

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
