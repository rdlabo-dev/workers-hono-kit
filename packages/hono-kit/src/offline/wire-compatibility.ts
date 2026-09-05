/**
 * Exact offline wire protocol identity: integer version plus content hash.
 *
 * Products own how the hash is computed; this kit never materializes schema
 * projections or storage. Resolution always requires an exact `{version,hash}` pair.
 */
export interface OfflineWireFingerprint {
  /** Monotonic published protocol version. */
  readonly version: number;
  /** Content fingerprint for that published version. */
  readonly hash: string;
}

/**
 * A previously published fingerprint that remains accepted until an explicit expiry.
 *
 * Non-current entries must name the product adapter/projection that serves that wire
 * shape. Silently allowlisting a hash alone is forbidden.
 */
export interface OfflineWireAcceptedFingerprint extends OfflineWireFingerprint {
  /** Instant at which acceptance ends (exclusive); later clocks reject the fingerprint. */
  readonly expiresAt: Date;
  /** Product-owned adapter or projection identifier for this prior wire shape. */
  readonly adapterId: string;
}

/**
 * Validated current fingerprint plus optional accepted prior fingerprints.
 *
 * Produced only by {@link defineOfflineWireCompatibility}.
 */
export interface OfflineWireCompatibility {
  /** The currently published protocol fingerprint. */
  readonly current: OfflineWireFingerprint;
  /** Prior fingerprints accepted until their explicit expiry. */
  readonly accepted: readonly OfflineWireAcceptedFingerprint[];
}

/**
 * Successful resolution of an incoming fingerprint against a compatibility table.
 *
 * Unmatched, expired, or inexact fingerprints resolve to `undefined` so products can map
 * the miss to their own conflict response (for example HTTP 409).
 */
export type OfflineWireCompatibilityResolution =
  | { readonly kind: 'current'; readonly fingerprint: OfflineWireFingerprint }
  | {
      readonly kind: 'accepted';
      readonly fingerprint: OfflineWireFingerprint;
      readonly adapterId: string;
      readonly expiresAt: Date;
    };

/**
 * Validates a current fingerprint plus optional accepted prior fingerprints.
 *
 * Rejects duplicate versions, duplicate hashes, invalid fingerprints, invalid expiry
 * instants, and accepted entries that omit a product adapter/projection identifier.
 *
 * @param options - Current fingerprint and optional accepted prior fingerprints.
 * @returns A validated compatibility table safe to pass to {@link resolveOfflineWireCompatibility}.
 */
export function defineOfflineWireCompatibility(options: {
  readonly current: OfflineWireFingerprint;
  readonly accepted?: readonly OfflineWireAcceptedFingerprint[];
}): OfflineWireCompatibility {
  const current = normalizeFingerprint(options.current, 'current');
  const acceptedInput = options.accepted ?? [];
  const versions = new Set<number>([current.version]);
  const hashes = new Set<string>([current.hash]);
  const accepted: OfflineWireAcceptedFingerprint[] = [];

  for (const [index, entry] of acceptedInput.entries()) {
    const label = `accepted[${index}]`;
    const fingerprint = normalizeFingerprint(entry, label);
    if (versions.has(fingerprint.version)) {
      throw new Error(`Offline wire compatibility rejects duplicate version ${fingerprint.version}.`);
    }
    if (hashes.has(fingerprint.hash)) {
      throw new Error(`Offline wire compatibility rejects duplicate hash '${fingerprint.hash}'.`);
    }
    if (!(entry.expiresAt instanceof Date) || Number.isNaN(entry.expiresAt.getTime())) {
      throw new RangeError(`Offline wire compatibility ${label}.expiresAt must be a valid Date.`);
    }
    const adapterId = entry.adapterId;
    if (typeof adapterId !== 'string' || adapterId.trim().length === 0) {
      throw new Error(
        `Offline wire compatibility ${label} requires a non-empty product adapter/projection identifier.`,
      );
    }
    versions.add(fingerprint.version);
    hashes.add(fingerprint.hash);
    accepted.push({
      version: fingerprint.version,
      hash: fingerprint.hash,
      expiresAt: entry.expiresAt,
      adapterId,
    });
  }

  return { current, accepted };
}

/**
 * Resolves an incoming `{version,hash}` against a validated compatibility table.
 *
 * Matches only exact fingerprints. Current always wins; accepted prior fingerprints match
 * only while the injectable clock is strictly before their `expiresAt`.
 *
 * @param compatibility - Table from {@link defineOfflineWireCompatibility}.
 * @param fingerprint - Incoming client fingerprint.
 * @param clock - Injectable wall clock; defaults to the system wall clock.
 * @returns The match, or `undefined` when the fingerprint is unknown, inexact, or expired.
 */
export function resolveOfflineWireCompatibility(
  compatibility: OfflineWireCompatibility,
  fingerprint: OfflineWireFingerprint,
  clock: () => Date = () => new Date(),
): OfflineWireCompatibilityResolution | undefined {
  const incoming = normalizeFingerprint(fingerprint, 'incoming');
  if (incoming.version === compatibility.current.version) {
    if (incoming.hash !== compatibility.current.hash) {
      return undefined;
    }
    return { kind: 'current', fingerprint: compatibility.current };
  }

  const now = clock();
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('Offline wire compatibility clock must return a valid Date.');
  }
  const nowMs = now.getTime();

  for (const entry of compatibility.accepted) {
    if (entry.version !== incoming.version) {
      continue;
    }
    if (entry.hash !== incoming.hash) {
      return undefined;
    }
    if (nowMs >= entry.expiresAt.getTime()) {
      return undefined;
    }
    return {
      kind: 'accepted',
      fingerprint: { version: entry.version, hash: entry.hash },
      adapterId: entry.adapterId,
      expiresAt: entry.expiresAt,
    };
  }

  return undefined;
}

function normalizeFingerprint(fingerprint: OfflineWireFingerprint, label: string): OfflineWireFingerprint {
  if (!Number.isSafeInteger(fingerprint.version) || fingerprint.version < 0) {
    throw new RangeError(`Offline wire compatibility ${label}.version must be a non-negative safe integer.`);
  }
  if (typeof fingerprint.hash !== 'string' || fingerprint.hash.trim().length === 0) {
    throw new Error(`Offline wire compatibility ${label}.hash must be a non-empty string.`);
  }
  return { version: fingerprint.version, hash: fingerprint.hash };
}
