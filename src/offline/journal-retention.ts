/** One retained product journal row considered for bounded cleanup. */
export interface OfflineJournalRetentionCandidate<TScope> {
  readonly cursor: number;
  readonly scope: TScope;
}

/** Storage operations that must share one database transaction. */
export interface OfflineJournalRetentionTransaction<TScope> {
  listCandidates(cutoff: Date, limit: number): Promise<readonly OfflineJournalRetentionCandidate<TScope>[]>;
  /** Locks existing scopes against concurrent pull floor validation. */
  lockScopes(scopes: readonly TScope[]): Promise<readonly TScope[]>;
  /** Monotonically advances each scope's retained-history floor. */
  advanceFloors(floors: readonly { scope: TScope; cursor: number }[]): Promise<void>;
  /** Deletes the complete candidate set, including rows for scopes that no longer exist. */
  deleteCandidates(cursors: readonly number[]): Promise<void>;
}

/** Product adapter that owns schema-specific persistence and transaction creation. */
export interface OfflineJournalRetentionStore<TScope> {
  transaction<T>(operation: (tx: OfflineJournalRetentionTransaction<TScope>) => Promise<T>): Promise<T>;
}

export interface CompactOfflineJournalOptions<TScope> {
  readonly store: OfflineJournalRetentionStore<TScope>;
  readonly cutoff: Date;
  readonly limit: number;
  /** Canonical identity used to deduplicate and compare product scopes. */
  readonly scopeKey: (scope: TScope) => string;
}

/** Raised when a delta cursor predates the retained journal and must restart from a snapshot. */
export class OfflineJournalRebaselineRequiredError extends Error {}

/** Fail closed before reading deltas whose tombstones may already have been compacted. */
export function assertOfflineJournalCursorRetained(cursor: number, floor: number): void {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(floor) || floor < 0) {
    throw new RangeError('Offline journal cursor and retention floor must be non-negative safe integers.');
  }
  if (cursor < floor) {
    throw new OfflineJournalRebaselineRequiredError('Offline journal cursor predates retained history.');
  }
}

/**
 * Advances retention floors and deletes one bounded journal batch atomically.
 *
 * Product adapters provide schema-specific queries. This state machine owns the
 * safety order: candidates -> ordered opposing locks -> floors -> deletion.
 */
export function compactOfflineJournal<TScope>(options: CompactOfflineJournalOptions<TScope>): Promise<number> {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    throw new RangeError('Offline journal retention limit must be a positive safe integer.');
  }
  if (Number.isNaN(options.cutoff.getTime())) {
    throw new RangeError('Offline journal retention cutoff must be a valid date.');
  }
  return options.store.transaction(async (tx) => {
    const candidates = await tx.listCandidates(options.cutoff, options.limit);
    if (candidates.length === 0) {
      return 0;
    }
    assertCandidates(candidates);

    const scopeByKey = new Map(candidates.map((candidate) => [options.scopeKey(candidate.scope), candidate.scope]));
    const scopes = [...scopeByKey.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, scope]) => scope);
    const lockedKeys = new Set((await tx.lockScopes(scopes)).map(options.scopeKey));
    const floorByKey = new Map<string, { scope: TScope; cursor: number }>();
    for (const candidate of candidates) {
      const key = options.scopeKey(candidate.scope);
      if (!lockedKeys.has(key)) {
        continue;
      }
      const current = floorByKey.get(key);
      if (!current || candidate.cursor > current.cursor) {
        floorByKey.set(key, { scope: candidate.scope, cursor: candidate.cursor });
      }
    }
    if (floorByKey.size > 0) {
      await tx.advanceFloors(
        [...floorByKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, floor]) => floor),
      );
    }
    await tx.deleteCandidates(candidates.map((candidate) => candidate.cursor));
    return candidates.length;
  });
}

function assertCandidates<TScope>(candidates: readonly OfflineJournalRetentionCandidate<TScope>[]): void {
  const cursors = new Set<number>();
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.cursor) || candidate.cursor <= 0 || cursors.has(candidate.cursor)) {
      throw new Error('Offline journal retention candidates must have unique positive safe-integer cursors.');
    }
    cursors.add(candidate.cursor);
  }
}
