import { describe, expect, it } from 'vitest';
import { defineOfflineWireCompatibility, resolveOfflineWireCompatibility } from './wire-compatibility.js';

const CURRENT = { version: 2, hash: 'hash-current' } as const;
const PREVIOUS = { version: 1, hash: 'hash-n1', adapterId: 'projection-v1' } as const;

describe('offline wire compatibility', () => {
  it('resolves the current fingerprint without requiring an adapter', () => {
    const compatibility = defineOfflineWireCompatibility({ current: CURRENT });
    const clock = () => new Date('2026-08-13T00:00:00.000Z');

    expect(resolveOfflineWireCompatibility(compatibility, CURRENT, clock)).toEqual({
      kind: 'current',
      fingerprint: CURRENT,
    });
  });

  it('resolves an unexpired N-1 fingerprint to its product adapter', () => {
    const expiresAt = new Date('2026-09-01T00:00:00.000Z');
    const compatibility = defineOfflineWireCompatibility({
      current: CURRENT,
      accepted: [{ ...PREVIOUS, expiresAt }],
    });
    const clock = () => new Date('2026-08-13T00:00:00.000Z');

    expect(
      resolveOfflineWireCompatibility(compatibility, { version: PREVIOUS.version, hash: PREVIOUS.hash }, clock),
    ).toEqual({
      kind: 'accepted',
      fingerprint: { version: PREVIOUS.version, hash: PREVIOUS.hash },
      adapterId: PREVIOUS.adapterId,
      expiresAt,
    });
  });

  it('rejects an exact N-1 fingerprint after its explicit expiry', () => {
    const expiresAt = new Date('2026-08-01T00:00:00.000Z');
    const compatibility = defineOfflineWireCompatibility({
      current: CURRENT,
      accepted: [{ ...PREVIOUS, expiresAt }],
    });

    expect(
      resolveOfflineWireCompatibility(
        compatibility,
        { version: PREVIOUS.version, hash: PREVIOUS.hash },
        () => new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBeUndefined();
    expect(
      resolveOfflineWireCompatibility(
        compatibility,
        { version: PREVIOUS.version, hash: PREVIOUS.hash },
        () => new Date('2026-08-01T00:00:00.001Z'),
      ),
    ).toBeUndefined();
  });

  it('rejects duplicate version and hash entries when defining compatibility', () => {
    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [{ version: CURRENT.version, hash: 'other', expiresAt: new Date('2026-09-01Z'), adapterId: 'a' }],
      }),
    ).toThrow('duplicate version 2');

    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [{ version: 1, hash: CURRENT.hash, expiresAt: new Date('2026-09-01Z'), adapterId: 'a' }],
      }),
    ).toThrow(`duplicate hash '${CURRENT.hash}'`);

    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [
          { version: 1, hash: 'hash-a', expiresAt: new Date('2026-09-01Z'), adapterId: 'a' },
          { version: 1, hash: 'hash-b', expiresAt: new Date('2026-09-01Z'), adapterId: 'b' },
        ],
      }),
    ).toThrow('duplicate version 1');
  });

  it('rejects the same version when the hash does not match exactly', () => {
    const compatibility = defineOfflineWireCompatibility({
      current: CURRENT,
      accepted: [{ ...PREVIOUS, expiresAt: new Date('2026-09-01T00:00:00.000Z') }],
    });
    const clock = () => new Date('2026-08-13T00:00:00.000Z');

    expect(resolveOfflineWireCompatibility(compatibility, { version: 2, hash: 'hash-other' }, clock)).toBeUndefined();
    expect(resolveOfflineWireCompatibility(compatibility, { version: 1, hash: 'hash-other' }, clock)).toBeUndefined();
  });

  it('rejects accepted fingerprints that omit a product adapter/projection identifier', () => {
    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [
          {
            version: 1,
            hash: 'hash-n1',
            expiresAt: new Date('2026-09-01T00:00:00.000Z'),
            adapterId: '   ',
          },
        ],
      }),
    ).toThrow('requires a non-empty product adapter/projection identifier');

    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [
          {
            version: 1,
            hash: 'hash-n1',
            expiresAt: new Date('2026-09-01T00:00:00.000Z'),
            adapterId: undefined as never,
          },
        ],
      }),
    ).toThrow('requires a non-empty product adapter/projection identifier');
  });

  it('rejects invalid fingerprints and expiry instants when defining compatibility', () => {
    expect(() => defineOfflineWireCompatibility({ current: { version: -1, hash: 'h' } })).toThrow(
      'current.version must be a non-negative safe integer',
    );
    expect(() => defineOfflineWireCompatibility({ current: { version: 1, hash: '  ' } })).toThrow(
      'current.hash must be a non-empty string',
    );
    expect(() =>
      defineOfflineWireCompatibility({
        current: CURRENT,
        accepted: [
          {
            version: 1,
            hash: 'hash-n1',
            expiresAt: new Date('not-a-date'),
            adapterId: 'projection-v1',
          },
        ],
      }),
    ).toThrow('accepted[0].expiresAt must be a valid Date');
  });

  it('returns undefined for unknown exact fingerprints', () => {
    const compatibility = defineOfflineWireCompatibility({ current: CURRENT });
    expect(
      resolveOfflineWireCompatibility(compatibility, { version: 9, hash: 'missing' }, () => new Date('2026-08-13Z')),
    ).toBeUndefined();
  });

  it('uses the injected clock deterministically when deciding expiry', () => {
    const expiresAt = new Date('2026-08-13T12:00:00.000Z');
    const compatibility = defineOfflineWireCompatibility({
      current: CURRENT,
      accepted: [{ ...PREVIOUS, expiresAt }],
    });
    const fingerprint = { version: PREVIOUS.version, hash: PREVIOUS.hash };

    expect(
      resolveOfflineWireCompatibility(compatibility, fingerprint, () => new Date('2026-08-13T11:59:59.999Z')),
    ).toMatchObject({ kind: 'accepted', adapterId: PREVIOUS.adapterId });
    expect(
      resolveOfflineWireCompatibility(compatibility, fingerprint, () => new Date('2026-08-13T12:00:00.000Z')),
    ).toBeUndefined();
  });
});
