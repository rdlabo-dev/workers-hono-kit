import { exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import {
  APPLE_IDENTITY_ISSUER,
  createAppleClientSecret,
  hasFirebaseProviderIdentity,
  verifyAppleIdentityToken,
  verifyGoogleIdentityToken,
} from './social-auth.js';

describe('social auth', () => {
  it('matches a Firebase provider subject and optionally its active sign-in provider', () => {
    const token = {
      uid: 'firebase',
      firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['google-sub'] } },
    };
    expect(hasFirebaseProviderIdentity(token, 'google.com', 'google-sub', true)).toBe(true);
    expect(hasFirebaseProviderIdentity(token, 'apple.com', 'google-sub')).toBe(false);
  });

  it('verifies Google issuer, audience, signature, and subject', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const createToken = (withSubject: boolean) => {
      let token = new SignJWT({})
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('web-client')
        .setIssuedAt()
        .setExpirationTime('2m');
      if (withSubject) {
        token = token.setSubject('google-sub');
      }
      return token.sign(privateKey);
    };
    const token = await createToken(true);

    await expect(verifyGoogleIdentityToken(token, ['ios-client', 'web-client'], async () => publicKey)).resolves.toBe(
      'google-sub',
    );
    await expect(verifyGoogleIdentityToken(token, 'another-client', async () => publicKey)).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(await createToken(false), 'web-client', async () => publicKey),
    ).rejects.toThrow('Google identity token has no subject');
  });

  it('verifies an Apple identity token and requires its subject', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const createToken = (withSubject: boolean) => {
      let token = new SignJWT({})
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(APPLE_IDENTITY_ISSUER)
        .setAudience('com.example.web')
        .setIssuedAt()
        .setExpirationTime('2m');
      if (withSubject) {
        token = token.setSubject('apple-sub');
      }
      return token.sign(privateKey);
    };

    await expect(
      verifyAppleIdentityToken(await createToken(true), 'com.example.web', async () => publicKey),
    ).resolves.toBe('apple-sub');
    await expect(
      verifyAppleIdentityToken(await createToken(false), 'com.example.web', async () => publicKey),
    ).rejects.toThrow('Apple identity token has no subject');
  });

  it('creates a short-lived Apple client secret for the selected client ID', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const token = await createAppleClientSecret(
      { privateKey: await exportPKCS8(privateKey), keyId: 'KEY', teamId: 'TEAM' },
      'com.example.web',
      1000,
    );
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      issuer: 'TEAM',
      audience: 'https://appleid.apple.com',
      subject: 'com.example.web',
      currentDate: new Date(1000 * 1000),
    });
    expect(protectedHeader.kid).toBe('KEY');
    expect(payload.iat).toBe(1000);
    expect(payload.exp).toBe(1120);
  });
});
