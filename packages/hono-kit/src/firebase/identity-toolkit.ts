import { SignJWT, importPKCS8 } from 'jose';
import { z } from 'zod';
import type { FirebaseUserRecord } from './firebase-verifier.js';

/**
 * Minimal service-account credential consumed by {@link IdentityToolkit}.
 *
 * @remarks
 * Corresponds to the relevant fields of a Google service-account JSON key file.
 */
export interface ServiceAccount {
  /** The service account's email, used as the JWT assertion issuer and subject. */
  client_email: string;
  /** The PEM-encoded PKCS#8 RSA private key used to sign the OAuth2 assertion. */
  private_key: string;
  /** The Google/Firebase project id the Identity Toolkit calls target. */
  project_id: string;
}

/** Google OAuth2 token endpoint used to exchange a signed JWT assertion for an access token. */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Base URL of the Google Identity Toolkit v1 REST API. */
const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1';
/** OAuth2 scopes required for Identity Toolkit account lookup and deletion. */
const SCOPE = 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase';
/** Maximum number of `localId`s the `accounts:lookup` endpoint accepts in a single request. */
const LOOKUP_CHUNK_SIZE = 100;

/**
 * Minimal Google Identity Toolkit REST client for the user-management operations that token
 * verification does not cover: `accounts:lookup` (getUser) and `accounts:delete` (deleteUser).
 *
 * This is a focused REST alternative for projects that only need a small subset of Firebase Auth
 * administration and do not want to bundle the broader `firebase-admin` SDK.
 *
 * @remarks
 * Authentication follows the JWT-bearer flow: a JWT assertion is signed with the service
 * account's private key (via `jose`), exchanged at the OAuth2 token endpoint for an access
 * token, and that token is then used to call the REST API. Access tokens are cached in-process
 * and reused until shortly before they expire.
 */
export class IdentityToolkit {
  /** Cached OAuth2 access token and its absolute expiry (Unix seconds), or `null` when none. */
  private accessToken: { value: string; expiresAt: number } | null = null;

  /**
   * Create a client bound to a single service account.
   *
   * @param sa - The service-account credential used to authenticate REST calls.
   */
  constructor(private readonly sa: ServiceAccount) {}

  /**
   * Return a valid OAuth2 access token, minting a new one when the cache is empty or expiring.
   *
   * Signs a short-lived JWT assertion with the service-account key and exchanges it at the
   * Google OAuth2 token endpoint. The result is cached and reused while it remains valid
   * (with a 60-second safety margin).
   *
   * @param nowSeconds - The current Unix time in seconds, used for cache validity and JWT timestamps.
   * @returns A bearer access token for the Identity Toolkit API.
   * @throws If the token exchange request fails.
   * @internal
   */
  private async getAccessToken(nowSeconds: number): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > nowSeconds + 60) {
      return this.accessToken.value;
    }
    const key = await importPKCS8(this.sa.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.sa.client_email)
      .setSubject(this.sa.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 3600)
      .sign(key);

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      throw new Error(`Identity Toolkit token exchange failed: ${res.status}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: json.access_token, expiresAt: nowSeconds + json.expires_in };
    return json.access_token;
  }

  /** Fetch account attributes; provider failures are distinct from absent users. */
  private async lookupAccounts(
    criteria: { localId: string[] } | { email: string[] },
    nowSeconds: number,
  ): Promise<FirebaseUserRecord[]> {
    const token = await this.getAccessToken(nowSeconds);
    const res = await fetch(`${IDENTITY_TOOLKIT}/projects/${this.sa.project_id}/accounts:lookup`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(criteria),
    });
    if (!res.ok) {
      if (res.status === 400 && 'email' in criteria) {
        const error = z
          .object({ error: z.object({ message: z.string() }) })
          .safeParse(await res.json().catch(() => undefined));
        if (error.success && error.data.error.message === 'INVALID_EMAIL') {
          return [];
        }
      }
      throw new Error(`Identity Toolkit lookup failed: ${res.status}`);
    }
    const parsed = z
      .object({
        users: z
          .array(
            z.object({
              localId: z.string().min(1).max(128),
              email: z.string().optional(),
              disabled: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) {
      throw new Error('Invalid Identity Toolkit lookup response');
    }
    return (parsed.data.users ?? []).map(({ localId, ...attributes }) => ({ uid: localId, ...attributes }));
  }

  /**
   * Look up a primary email (case-insensitive). Missing/invalid emails return null.
   * @param email - Primary email; surrounding whitespace is ignored.
   * @param nowSeconds - Current Unix time used for the shared OAuth token cache.
   * @returns Account attributes, including disabled; provider failures throw.
   */
  async lookupByEmail(email: string, nowSeconds: number): Promise<FirebaseUserRecord | null> {
    const normalized = email.trim();
    if (!normalized) {
      return null;
    }
    const users = await this.lookupAccounts({ email: [normalized] }, nowSeconds);
    return users.find((user) => user.email?.toLowerCase() === normalized.toLowerCase()) ?? null;
  }

  /**
   * Look up a user record by uid via the `accounts:lookup` endpoint.
   *
   * @param uid - The user's unique id (`localId`).
   * @param nowSeconds - The current Unix time in seconds, used for access-token caching.
   * @returns The user's `uid` and optional `email`, or `null` when no matching user is returned.
   * @throws If acquiring an access token or looking up accounts fails.
   */
  async lookup(uid: string, nowSeconds: number): Promise<FirebaseUserRecord | null> {
    return (await this.lookupMany([uid], nowSeconds))[0] ?? null;
  }

  /**
   * Look up multiple user records by uid via the `accounts:lookup` endpoint.
   *
   * `uids` are chunked into groups of at most {@link LOOKUP_CHUNK_SIZE} (the maximum `localId`
   * array size the endpoint accepts), issuing one `accounts:lookup` request per chunk. This lets
   * callers replace N single-uid lookups with `ceil(N / LOOKUP_CHUNK_SIZE)` requests.
   *
   * @param uids - The users' unique ids (`localId`s) to look up.
   * @param nowSeconds - The current Unix time in seconds, used for access-token caching.
   * @returns The `uid`/`email` of every matching user. Uids Firebase does not recognize are
   *   simply absent from the result (never `null` entries), so callers can treat "missing from
   *   the result" as "not found/invalid".
   * @throws If acquiring an access token or looking up accounts fails.
   */
  async lookupMany(uids: string[], nowSeconds: number): Promise<FirebaseUserRecord[]> {
    if (uids.length === 0) {
      return [];
    }
    const results: FirebaseUserRecord[] = [];
    const unique = [...new Set(uids)];
    for (let i = 0; i < unique.length; i += LOOKUP_CHUNK_SIZE) {
      const chunk = unique.slice(i, i + LOOKUP_CHUNK_SIZE);
      const users = await this.lookupAccounts({ localId: chunk }, nowSeconds);
      results.push(...users.filter((user) => chunk.includes(user.uid)));
    }
    return results;
  }

  /**
   * Delete a user by uid via the `accounts:delete` endpoint.
   *
   * @param uid - The user's unique id (`localId`).
   * @param nowSeconds - The current Unix time in seconds, used for access-token caching.
   * @returns A promise that resolves once the user has been deleted.
   * @throws If acquiring an access token fails or the delete request is unsuccessful.
   */
  async remove(uid: string, nowSeconds: number): Promise<void> {
    const token = await this.getAccessToken(nowSeconds);
    const res = await fetch(`${IDENTITY_TOOLKIT}/projects/${this.sa.project_id}/accounts:delete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
      // Account deletion is an idempotent operation for callers. A retry after a lost response may
      // legitimately find that the preceding request already removed the Firebase user.
      if (body?.error?.message === 'USER_NOT_FOUND') {
        return;
      }
      throw new Error(`Identity Toolkit delete failed: ${res.status}`);
    }
  }
}
