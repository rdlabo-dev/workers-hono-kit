import { describe, expect, it, vi } from 'vitest';
import {
  assertOfflineJournalCursorRetained,
  compactOfflineJournal,
  OfflineJournalRebaselineRequiredError,
} from './journal-retention.js';
import type { OfflineJournalRetentionTransaction } from './journal-retention.js';

describe('offline journal retention', () => {
  it('locks scopes in canonical order, advances floors, then deletes the complete bounded batch', async () => {
    const calls: string[] = [];
    const tx: OfflineJournalRetentionTransaction<number> = {
      listCandidates: vi.fn(async () => [
        { cursor: 7, scope: 20 },
        { cursor: 5, scope: 10 },
        { cursor: 9, scope: 20 },
        { cursor: 11, scope: 30 },
      ]),
      lockScopes: vi.fn(async (scopes: readonly number[]) => {
        calls.push(`lock:${scopes.join(',')}`);
        return [10, 20];
      }),
      advanceFloors: vi.fn(async (floors: readonly { scope: number; cursor: number }[]) => {
        calls.push(`floor:${floors.map(({ scope, cursor }) => `${scope}=${cursor}`).join(',')}`);
      }),
      deleteCandidates: vi.fn(async (cursors: readonly number[]) => {
        calls.push(`delete:${cursors.join(',')}`);
      }),
    };
    const count = await compactOfflineJournal({
      store: { transaction: (operation) => operation(tx) },
      cutoff: new Date('2026-01-01T00:00:00.000Z'),
      limit: 100,
      scopeKey: String,
    });

    expect(count).toBe(4);
    expect(calls).toEqual(['lock:10,20,30', 'floor:20=9,10=5', 'delete:7,5,9,11']);
  });

  it('does no locking or deletion for an empty batch', async () => {
    const lockScopes = vi.fn();
    const deleteCandidates = vi.fn();
    await expect(
      compactOfflineJournal({
        store: {
          transaction: (operation) =>
            operation({
              listCandidates: async () => [],
              lockScopes,
              advanceFloors: vi.fn(),
              deleteCandidates,
            }),
        },
        cutoff: new Date(),
        limit: 1,
        scopeKey: String,
      }),
    ).resolves.toBe(0);
    expect(lockScopes).not.toHaveBeenCalled();
    expect(deleteCandidates).not.toHaveBeenCalled();
  });

  it('rejects expired cursors and malformed boundaries before a delta read', () => {
    expect(() => {
      assertOfflineJournalCursorRetained(4, 5);
    }).toThrow(OfflineJournalRebaselineRequiredError);
    expect(() => {
      assertOfflineJournalCursorRetained(5, 5);
    }).not.toThrow();
    expect(() => {
      assertOfflineJournalCursorRetained(-1, 0);
    }).toThrow(RangeError);
  });
});
