import {
  createNoopDatabase as createNoopDatabaseCanonical,
  createPoolDatabase as createPoolDatabaseCanonical,
} from '@rdlabo/workers-mysql/testing';
import type { CreatePoolDatabaseOptions as CreatePoolDatabaseOptionsCanonical } from '@rdlabo/workers-mysql/testing';
import type { DecodedIdToken, FirebaseUserRecord, FirebaseVerifier } from '../firebase/firebase-verifier.js';

/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export const createPoolDatabase: typeof createPoolDatabaseCanonical = createPoolDatabaseCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export const createNoopDatabase: typeof createNoopDatabaseCanonical = createNoopDatabaseCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export type CreatePoolDatabaseOptions<TDrizzle> = CreatePoolDatabaseOptionsCanonical<TDrizzle>;

/** In-memory Firebase verifier for route tests. */
export class FakeFirebaseVerifier implements FirebaseVerifier {
  private readonly tokens = new Map<string, DecodedIdToken>();
  /** Current account attributes; update independently of registered token claims. */
  readonly users = new Map<string, FirebaseUserRecord>();
  /** UIDs passed to {@link deleteUser}, in call order. */
  readonly deleted: string[] = [];

  /** Register a decoded token, seeding the account only if it is not already configured. */
  register(token: string, record: DecodedIdToken): void {
    this.tokens.set(token, record);
    if (!this.users.has(record.uid)) {
      this.users.set(record.uid, { uid: record.uid, email: record.email });
    }
  }

  /** Resolve a registered token. */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    const record = this.tokens.get(idToken);
    if (!record) {
      throw new Error('invalid firebase id token');
    }
    return record;
  }

  /** Find a current fake account by its primary email, including disabled metadata. */
  async getUserByEmail(email: string): Promise<FirebaseUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.email?.toLowerCase() === normalized) ?? null;
  }

  /** Return current attributes, falling back to a minimal user for legacy route tests. */
  async getUser(uid: string): Promise<FirebaseUserRecord | null> {
    return this.users.get(uid) ?? { uid };
  }

  /** Return current attributes or a minimal fake user for each UID. */
  async getUsers(uids: string[]): Promise<FirebaseUserRecord[]> {
    return uids.map((uid) => this.users.get(uid) ?? { uid });
  }

  /** Record a fake user deletion. */
  async deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
  }
}
