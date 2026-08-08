import { CompactSign, SignJWT, generateKeyPair } from 'jose';
import { describe, it, expect, vi } from 'vitest';
import type { IdentityToolkit } from './identity-toolkit.js';
import { JoseFirebaseVerifier } from './jose-firebase-verifier.js';

// jose v6: generateKeyPair yields CryptoKey; derive the type instead of the removed KeyLike.
type SignKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const PROJECT = 'rdlabo-proj';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;

async function makeVerifier(identity?: IdentityToolkit) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const verifier = new JoseFirebaseVerifier({ projectId: PROJECT, keyResolver: publicKey, identity });
  return { verifier, privateKey };
}

function sign(
  privateKey: SignKey,
  claims: {
    iss?: string;
    aud?: string;
    sub?: string;
    expOffset?: number;
    omitExpiration?: boolean;
    issuedAt?: number;
    omitIssuedAt?: boolean;
    authTime?: number;
    omitAuthTime?: boolean;
  },
) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(claims.omitAuthTime ? {} : { auth_time: claims.authTime ?? now })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(claims.iss ?? ISSUER)
    .setAudience(claims.aud ?? PROJECT)
    .setSubject(claims.sub ?? 'uid-123');
  if (!claims.omitIssuedAt) {
    jwt.setIssuedAt(claims.issuedAt ?? now);
  }
  if (!claims.omitExpiration) {
    jwt.setExpirationTime(now + (claims.expOffset ?? 3600));
  }
  return jwt.sign(privateKey);
}

function signRaw(privateKey: SignKey, payload: string) {
  return new CompactSign(new TextEncoder().encode(payload)).setProtectedHeader({ alg: 'RS256' }).sign(privateKey);
}

describe('JoseFirebaseVerifier (Firebase ID-token validation requirements)', () => {
  it('accepts a valid RS256 token and returns uid = sub', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { sub: 'uid-abc' });
    const decoded = await verifier.verifyIdToken(token);
    expect(decoded.uid).toBe('uid-abc');
  });

  it('rejects a wrong audience (project mismatch)', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { aud: 'other-project' });
    await expect(verifier.verifyIdToken(token)).rejects.toBeDefined();
  });

  it('rejects a wrong issuer', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { iss: 'https://evil.example.com/x' });
    await expect(verifier.verifyIdToken(token)).rejects.toBeDefined();
  });

  it('rejects an expired token', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { expOffset: -10 });
    await expect(verifier.verifyIdToken(token)).rejects.toBeDefined();
  });

  it('rejects a missing exp', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { omitExpiration: true });
    await expect(verifier.verifyIdToken(token)).rejects.toBeDefined();
  });

  it('rejects a token signed by a different key', async () => {
    const { verifier } = await makeVerifier();
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const token = await sign(otherKey, {});
    await expect(verifier.verifyIdToken(token)).rejects.toBeDefined();
  });

  it('rejects a subject longer than 128 chars (firebase-admin parity)', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { sub: 'x'.repeat(129) });
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid subject');
  });

  it('rejects an auth_time in the future', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { authTime: Math.floor(Date.now() / 1000) + 9999 });
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid auth_time');
  });

  it('rejects a missing auth_time', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { omitAuthTime: true });
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid auth_time');
  });

  it('rejects a missing iat', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { omitIssuedAt: true });
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid iat');
  });

  it('rejects an iat in the future', async () => {
    const { verifier, privateKey } = await makeVerifier();
    const token = await sign(privateKey, { issuedAt: Math.floor(Date.now() / 1000) + 9999 });
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid iat');
  });

  it('rejects non-finite iat and auth_time values decoded from valid JSON number syntax', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { verifier, privateKey } = await makeVerifier();
    const infiniteIssuedAt = await signRaw(
      privateKey,
      `{"iss":"${ISSUER}","aud":"${PROJECT}","sub":"uid-123","iat":-1e400,"auth_time":${now},"exp":${now + 3600}}`,
    );
    const infiniteAuthTime = await signRaw(
      privateKey,
      `{"iss":"${ISSUER}","aud":"${PROJECT}","sub":"uid-123","iat":${now},"auth_time":-1e400,"exp":${now + 3600}}`,
    );
    await expect(verifier.verifyIdToken(infiniteIssuedAt)).rejects.toThrow('invalid iat');
    await expect(verifier.verifyIdToken(infiniteAuthTime)).rejects.toThrow('invalid auth_time');
  });

  it('rejects a non-finite exp decoded from valid JSON number syntax', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { verifier, privateKey } = await makeVerifier();
    const token = await signRaw(
      privateKey,
      `{"iss":"${ISSUER}","aud":"${PROJECT}","sub":"uid-123","iat":${now},"auth_time":${now},"exp":1e400}`,
    );
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('invalid exp');
  });

  it('honours an injected now() for iat and auth_time checks', async () => {
    const future = Math.floor(Date.now() / 1000) + 10_000;
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const verifier = new JoseFirebaseVerifier({ projectId: PROJECT, keyResolver: publicKey, now: () => future });
    const token = await sign(privateKey, { expOffset: 20_000, issuedAt: future - 10, authTime: future - 5 });
    await expect(verifier.verifyIdToken(token)).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('uses the injected now() for exp checks', async () => {
    const realNow = Math.floor(Date.now() / 1000);
    const past = realNow - 10_000;
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const verifier = new JoseFirebaseVerifier({ projectId: PROJECT, keyResolver: publicKey, now: () => past });
    const token = await sign(privateKey, { expOffset: -100, issuedAt: past - 10, authTime: past - 5 });
    await expect(verifier.verifyIdToken(token)).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('rejects a non-finite injected clock', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const verifier = new JoseFirebaseVerifier({ projectId: PROJECT, keyResolver: publicKey, now: () => Infinity });
    const token = await sign(privateKey, {});
    await expect(verifier.verifyIdToken(token)).rejects.toThrow('clock returned an invalid time');
  });

  describe('getUser / deleteUser', () => {
    it('throws when no Identity Toolkit is configured', async () => {
      const { verifier } = await makeVerifier();
      await expect(verifier.getUser('uid1')).rejects.toThrow('Identity Toolkit not configured');
      await expect(verifier.deleteUser('uid1')).rejects.toThrow('Identity Toolkit not configured');
    });

    it('delegates to the Identity Toolkit when configured', async () => {
      const lookup = vi.fn(async () => ({ uid: 'uid1', email: 'a@b.c' }));
      const remove = vi.fn(async () => undefined);
      const identity = { lookup, remove } as unknown as IdentityToolkit;
      const { verifier } = await makeVerifier(identity);

      await expect(verifier.getUser('uid1')).resolves.toEqual({ uid: 'uid1', email: 'a@b.c' });
      await verifier.deleteUser('uid1');
      expect(lookup).toHaveBeenCalledWith('uid1', expect.any(Number));
      expect(remove).toHaveBeenCalledWith('uid1', expect.any(Number));
    });
  });

  describe('getUsers', () => {
    it('throws when no Identity Toolkit is configured', async () => {
      const { verifier } = await makeVerifier();
      await expect(verifier.getUsers(['uid1', 'uid2'])).rejects.toThrow('Identity Toolkit not configured');
    });

    it('delegates to the Identity Toolkit lookupMany with the requested uids', async () => {
      const lookupMany = vi.fn(async () => [{ uid: 'uid1', email: 'a@b.c' }, { uid: 'uid2' }]);
      const identity = { lookupMany } as unknown as IdentityToolkit;
      const { verifier } = await makeVerifier(identity);

      await expect(verifier.getUsers(['uid1', 'uid2'])).resolves.toEqual([
        { uid: 'uid1', email: 'a@b.c' },
        { uid: 'uid2' },
      ]);
      expect(lookupMany).toHaveBeenCalledWith(['uid1', 'uid2'], expect.any(Number));
    });
  });
});
