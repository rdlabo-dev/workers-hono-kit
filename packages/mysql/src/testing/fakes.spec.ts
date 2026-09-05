import { describe, expect, it } from 'vitest';
import { createNoopDatabase } from './fakes.js';

describe('createNoopDatabase', () => {
  it('returns no rows and fails fast on writes', async () => {
    const db = createNoopDatabase();
    await expect(db.read('SELECT 1')).resolves.toEqual([]);
    expect(() => db.write(async () => 1)).toThrow('noopDatabase.write');
    expect(() => db.transaction(async () => 1)).toThrow('noopDatabase.transaction');
  });
});
