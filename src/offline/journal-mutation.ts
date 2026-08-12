/** One product-owned replica target affected by a domain mutation. */
export interface OfflineJournalMutationChange<TScope, TSourceKey extends string = string> {
  /** Product-defined authorization and replica partition. */
  readonly scope: TScope;
  /** Replica source whose hydrated value is invalidated by the mutation. */
  readonly sourceKey: TSourceKey;
  /** Stable server identity within the source. */
  readonly serverId: string | number;
  /** Optional Outbox acknowledgement metadata committed with the journal row. */
  readonly command?: { readonly userId: string | number; readonly commandId?: string };
}

/** Transaction-bound adapter that persists journal changes beside the domain write. */
export interface OfflineJournalMutationTransaction<TScope, TSourceKey extends string = string> {
  /** Appends one journal entry using the product transaction. */
  append(change: OfflineJournalMutationChange<TScope, TSourceKey>): Promise<void>;
}

/** Product adapter that owns the database transaction and journal schema. */
export interface OfflineJournalMutationStore<
  TScope,
  TSourceKey extends string = string,
  TTransaction extends OfflineJournalMutationTransaction<TScope, TSourceKey> = OfflineJournalMutationTransaction<
    TScope,
    TSourceKey
  >,
> {
  /**
   * Runs the domain write and every journal append in one database transaction.
   * A throw from either the domain mutation or `append` must roll back all writes.
   */
  transaction<TResult>(operation: (transaction: TTransaction) => Promise<TResult>): Promise<TResult>;
}

/**
 * Commits one domain mutation and its complete replica journal footprint atomically.
 *
 * `mutate` returns both the business result and every affected replica target. The shared
 * state machine appends all targets before the product transaction may commit.
 */
export function runOfflineJournalMutation<
  TScope,
  TSourceKey extends string,
  TResult,
  TTransaction extends OfflineJournalMutationTransaction<TScope, TSourceKey>,
>(options: {
  readonly store: OfflineJournalMutationStore<TScope, TSourceKey, TTransaction>;
  readonly mutate: (transaction: TTransaction) => Promise<{
    readonly result: TResult;
    readonly changes: readonly OfflineJournalMutationChange<TScope, TSourceKey>[];
  }>;
  /** Returns the canonical authorization/partition key for one product scope. */
  readonly scopeKey: (scope: TScope) => string;
}): Promise<TResult> {
  return options.store.transaction(async (transaction) => {
    const { result, changes } = await options.mutate(transaction);
    const unique = new Map<string, OfflineJournalMutationChange<TScope, TSourceKey>>();
    for (const change of changes) {
      const scopeKey = options.scopeKey(change.scope);
      if (!scopeKey || !change.sourceKey || String(change.serverId).length === 0) {
        throw new Error('Offline journal mutation scope, source, and server keys must be non-empty.');
      }
      const serverKey = typeof change.serverId === 'number' ? `number:${change.serverId}` : `string:${change.serverId}`;
      const key = `${scopeKey}\u0000${change.sourceKey}\u0000${serverKey}`;
      const existing = unique.get(key);
      if (existing === undefined) {
        unique.set(key, change);
        continue;
      }
      if (existing.command === undefined && change.command !== undefined) {
        unique.set(key, { ...existing, command: change.command });
        continue;
      }
      if (
        existing.command !== undefined &&
        change.command !== undefined &&
        (String(existing.command.userId) !== String(change.command.userId) ||
          existing.command.commandId !== change.command.commandId)
      ) {
        throw new Error(`Offline journal mutation key '${key}' has conflicting command metadata.`);
      }
    }
    for (const change of unique.values()) {
      await transaction.append(change);
    }
    return result;
  });
}

/** Fails CI when a product write route has no declared journal coverage decision. */
export function assertOfflineJournalCoverage<TWriteId extends string>(
  writeIds: readonly TWriteId[],
  coverage: Readonly<Record<TWriteId, readonly string[] | 'not-replicated'>>,
): void {
  const declared = Object.keys(coverage);
  const missing = writeIds.filter((writeId) => !Object.hasOwn(coverage, writeId));
  const unknown = declared.filter((writeId) => !writeIds.includes(writeId as TWriteId));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Offline journal coverage mismatch: missing=[${missing.join(',')}], unknown=[${unknown.join(',')}].`,
    );
  }
  for (const writeId of writeIds) {
    const decision = coverage[writeId];
    if (decision === 'not-replicated') {
      continue;
    }
    if (
      decision.length === 0 ||
      decision.some((sourceKey) => sourceKey.trim().length === 0) ||
      new Set(decision).size !== decision.length
    ) {
      throw new Error(
        `Offline journal coverage for '${writeId}' must contain unique, non-empty source keys or 'not-replicated'.`,
      );
    }
  }
}
