import { describe, expect, it, vi } from 'vitest';
import { assertOfflineJournalCoverage, runOfflineJournalMutation } from './journal-mutation.js';

describe('offline journal mutation contract', () => {
  it('appends the complete deduplicated footprint before the transaction returns', async () => {
    const order: string[] = [];
    const append = vi.fn(async (change: { scope: number; sourceKey: string; serverId: string | number }) => {
      order.push(`journal:${change.scope}:${change.sourceKey}:${change.serverId}`);
    });
    const result = await runOfflineJournalMutation({
      store: {
        transaction: async (operation) => {
          order.push('begin');
          const value = await operation({ append });
          order.push('commit');
          return value;
        },
      },
      mutate: async () => {
        order.push('domain');
        return {
          result: 42,
          changes: [
            { scope: 10, sourceKey: 'threads', serverId: 1 },
            { scope: 10, sourceKey: 'threads', serverId: 1 },
            { scope: 20, sourceKey: 'threads', serverId: 1 },
          ],
        };
      },
      scopeKey: String,
    });

    expect(result).toBe(42);
    expect(order).toEqual(['begin', 'domain', 'journal:10:threads:1', 'journal:20:threads:1', 'commit']);
  });

  it('does not commit when a journal append fails', async () => {
    let committed = false;
    await expect(
      runOfflineJournalMutation({
        store: {
          transaction: async (operation) => {
            const result = await operation({ append: async () => Promise.reject(new Error('journal failed')) });
            committed = true;
            return result;
          },
        },
        mutate: async () => ({ result: true, changes: [{ scope: 10, sourceKey: 'threads', serverId: 1 }] }),
        scopeKey: String,
      }),
    ).rejects.toThrow('journal failed');
    expect(committed).toBe(false);
  });

  it('preserves command acknowledgement metadata while deduplicating one physical target', async () => {
    const append = vi.fn(async () => undefined);
    await runOfflineJournalMutation({
      store: { transaction: async (operation) => operation({ append }) },
      mutate: async () => ({
        result: undefined,
        changes: [
          { scope: 10, sourceKey: 'threads' as const, serverId: 1, command: { userId: 2, commandId: 'A' } },
          { scope: 10, sourceKey: 'threads' as const, serverId: 1 },
        ],
      }),
      scopeKey: String,
    });

    expect(append).toHaveBeenCalledOnce();
    expect(append).toHaveBeenCalledWith({
      scope: 10,
      sourceKey: 'threads',
      serverId: 1,
      command: { userId: 2, commandId: 'A' },
    });
  });

  it('rejects ambiguous command metadata before the transaction commits', async () => {
    let committed = false;
    await expect(
      runOfflineJournalMutation({
        store: {
          transaction: async (operation) => {
            const value = await operation({ append: async () => undefined });
            committed = true;
            return value;
          },
        },
        mutate: async () => ({
          result: undefined,
          changes: [
            { scope: 10, sourceKey: 'threads' as const, serverId: 1, command: { userId: 2, commandId: 'A' } },
            { scope: 10, sourceKey: 'threads' as const, serverId: 1, command: { userId: 2, commandId: 'B' } },
          ],
        }),
        scopeKey: String,
      }),
    ).rejects.toThrow('has conflicting command metadata');
    expect(committed).toBe(false);
  });

  it('keeps identical server identities in different replica scopes distinct', async () => {
    const append = vi.fn(async () => undefined);
    await runOfflineJournalMutation({
      store: { transaction: async (operation) => operation({ append }) },
      mutate: async () => ({
        result: undefined,
        changes: [
          { scope: 10, sourceKey: 'threads' as const, serverId: 1 },
          { scope: 20, sourceKey: 'threads' as const, serverId: 1 },
        ],
      }),
      scopeKey: String,
    });

    expect(append).toHaveBeenCalledTimes(2);
  });

  it('requires an explicit coverage decision for every write operation', () => {
    expect(() => {
      assertOfflineJournalCoverage(['thread.edit', 'auth.login'] as const, {
        'thread.edit': ['threads'],
        'auth.login': 'not-replicated',
      });
    }).not.toThrow();
    expect(() => {
      assertOfflineJournalCoverage(
        ['thread.edit', 'auth.login'] as const,
        {
          'thread.edit': ['threads'],
        } as never,
      );
    }).toThrow('missing=[auth.login]');
    expect(() => {
      assertOfflineJournalCoverage(['thread.edit'] as const, { 'thread.edit': [] });
    }).toThrow("coverage for 'thread.edit' must contain unique, non-empty source keys");
    expect(() => {
      assertOfflineJournalCoverage(['thread.edit'] as const, { 'thread.edit': ['threads', 'threads'] });
    }).toThrow("coverage for 'thread.edit' must contain unique, non-empty source keys");
  });
});
