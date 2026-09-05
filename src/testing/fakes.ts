import type { DecodedIdToken, FirebaseVerifier } from '../firebase/firebase-verifier.js';

export { createPoolDatabase, createNoopDatabase } from '@rdlabo/workers-mysql/testing';
export type { CreatePoolDatabaseOptions } from '@rdlabo/workers-mysql/testing';

/** In-memory Firebase verifier for route tests. */
export class FakeFirebaseVerifier implements FirebaseVerifier {
  private readonly tokens = new Map<string, DecodedIdToken>();
  /** UIDs passed to {@link deleteUser}, in call order. */
  readonly deleted: string[] = [];

  /** Register a decoded token for later verification. */
  register(token: string, record: DecodedIdToken): void {
    this.tokens.set(token, record);
  }

  /** Resolve a registered token. */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    const record = this.tokens.get(idToken);
    if (!record) {
      throw new Error('invalid firebase id token');
    }
    return record;
  }

  /** Return a minimal fake user. */
  async getUser(uid: string): Promise<{ uid: string; email?: string } | null> {
    return { uid };
  }

  /** Return one minimal fake user per UID. */
  async getUsers(uids: string[]): Promise<{ uid: string; email?: string }[]> {
    return uids.map((uid) => ({ uid }));
  }

  /** Record a fake user deletion. */
  async deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
  }
}
