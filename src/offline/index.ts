/**
 * Table-agnostic helpers for offline replica converters.
 *
 * Product table projections, Zod object schemas, allowlists, and domain
 * validation intentionally remain in each consuming Hono application.
 *
 * @packageDocumentation
 */

export { fromTinyIntFlag, replicaTimestampMs, toReplicaDateOnly, toReplicaIsoDatetime, toTinyIntFlag } from './wire.js';
export { replicaNowIso } from './clock.js';
export { defineRestDbMethodConverter } from './rest-db-method-converter.js';
export type { CompleteRestDbTableScheme, RestDbMethodConverter } from './rest-db-method-converter.js';
export { decodeOfflineSnapshotCursor, encodeOfflineSnapshotCursor } from './snapshot-cursor.js';
export type { OfflineSnapshotCursor } from './snapshot-cursor.js';
export {
  assertOfflineJournalCursorRetained,
  compactOfflineJournal,
  OfflineJournalRebaselineRequiredError,
} from './journal-retention.js';
export type {
  CompactOfflineJournalOptions,
  OfflineJournalRetentionCandidate,
  OfflineJournalRetentionStore,
  OfflineJournalRetentionTransaction,
} from './journal-retention.js';
