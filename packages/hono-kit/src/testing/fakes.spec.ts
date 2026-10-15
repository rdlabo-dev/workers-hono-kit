/* eslint-disable @typescript-eslint/no-deprecated -- compatibility surface under test */
import { describe, expect, it } from 'vitest';
import { createNoopDatabase, FakeFirebaseVerifier } from './fakes.js';
describe('FakeFirebaseVerifier', () => {
  it('register したトークンは verifyIdToken で復元できる', async () => {
    const fb = new FakeFirebaseVerifier();
    fb.register('tok', { uid: 'u1', email: 'a@example.com' });
    await expect(fb.verifyIdToken('tok')).resolves.toMatchObject({ uid: 'u1' });
  });

  it('未登録トークンは throw する', async () => {
    const fb = new FakeFirebaseVerifier();
    await expect(fb.verifyIdToken('nope')).rejects.toThrow('invalid firebase id token');
  });

  it('looks up current email and disabled status independently of stale token claims', async () => {
    const fb = new FakeFirebaseVerifier();
    fb.register('old-token', { uid: 'u1', email: 'old@example.com' });
    await expect(fb.getUserByEmail('old@example.com')).resolves.toMatchObject({ uid: 'u1' });
    const current = { uid: 'u1', email: 'new@example.com', disabled: true };
    fb.users.set('u1', current);
    fb.register('another-old-token', { uid: 'u1', email: 'old@example.com' });

    await expect(fb.verifyIdToken('old-token')).resolves.toMatchObject({ email: 'old@example.com' });
    await expect(fb.getUserByEmail('old@example.com')).resolves.toBeNull();
    await expect(fb.getUserByEmail(' NEW@example.com ')).resolves.toEqual(current);
    await expect(fb.getUser('u1')).resolves.toEqual(current);
    await expect(fb.getUsers(['u1'])).resolves.toEqual([current]);
  });

  it('supports account lookup without registering a token', async () => {
    const fb = new FakeFirebaseVerifier();
    fb.users.set('u1', { uid: 'u1', email: 'current@example.com' });
    await expect(fb.getUserByEmail('current@example.com')).resolves.toMatchObject({ uid: 'u1' });
    await expect(fb.getUserByEmail('missing@example.com')).resolves.toBeNull();
    await expect(fb.getUser('unconfigured')).resolves.toEqual({ uid: 'unconfigured' });
  });

  it('deleteUser は deleted に記録する', async () => {
    const fb = new FakeFirebaseVerifier();
    await fb.deleteUser('u1');
    expect(fb.deleted).toEqual(['u1']);
  });
});

describe('createNoopDatabase', () => {
  it('read は空配列、write/transaction は誤用検知で throw', async () => {
    const db = createNoopDatabase();
    await expect(db.read('SELECT 1')).resolves.toEqual([]);
    expect(() => db.write(async () => 1)).toThrow('noopDatabase.write');
    expect(() => db.transaction(async () => 1)).toThrow('noopDatabase.transaction');
  });
});
