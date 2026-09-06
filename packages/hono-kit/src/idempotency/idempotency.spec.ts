import { describe, expect, it, vi } from 'vitest';
import {
  canonicalJson,
  completeLeasedIdempotency,
  createIdempotencyInput,
  IdempotencyConflictError,
  IdempotencyInFlightError,
  IdempotencyKeyValidationError,
  IdempotencyPayloadValidationError,
  runIdempotentMutation,
  reserveLeasedIdempotency,
  sha256CanonicalJson,
  withIdempotencyHttpErrors,
} from './idempotency.js';

describe('idempotency standard', () => {
  it('canonicalizes object keys by locale-independent UTF-16 code-unit order', async () => {
    const left = { あ: 3, z: [2, { b: true, a: 'x' }], ä: 2, a: 1 };
    const right = { a: 1, z: [2, { a: 'x', b: true }], ä: 2, あ: 3 };
    expect(canonicalJson(left)).toBe('{"a":1,"z":[2,{"a":"x","b":true}],"ä":2,"あ":3}');
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    await expect(sha256CanonicalJson(left)).resolves.toBe(await sha256CanonicalJson(right));
  });

  it.each([NaN, Infinity, 1n, { value: undefined }, new Date('2026-01-01'), Array(1)] as unknown[])(
    'rejects non-JSON payload value %s instead of producing a colliding hash',
    async (payload) => {
      await expect(sha256CanonicalJson(payload)).rejects.toBeInstanceOf(IdempotencyPayloadValidationError);
    },
  );

  it('does not collide a sparse array with an empty JSON array', () => {
    expect(canonicalJson([])).toBe('[]');
    expect(() => canonicalJson(Array(1))).toThrow(IdempotencyPayloadValidationError);
  });

  it('normalizes cyclic and throwing payloads to a validation error', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const throwing = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => {
        throw new Error('getter failed');
      },
    });
    expect(() => canonicalJson(cyclic)).toThrow(IdempotencyPayloadValidationError);
    expect(() => canonicalJson(throwing)).toThrow(IdempotencyPayloadValidationError);
  });

  it('rejects own properties that JSON would silently omit', () => {
    const objectWithSymbol = { [Symbol('hidden')]: 1 };
    const arrayWithSymbol = Object.assign([], { [Symbol('hidden')]: 1 });
    const objectWithNonEnumerable = Object.defineProperty({}, 'hidden', { value: 1 });
    const arrayWithNonEnumerable = Object.defineProperty([], 'hidden', { value: 1 });

    for (const value of [objectWithSymbol, arrayWithSymbol, objectWithNonEnumerable, arrayWithNonEnumerable]) {
      expect(() => canonicalJson(value)).toThrow(IdempotencyPayloadValidationError);
    }
  });

  it('keeps missing keys backward compatible and validates supplied keys', async () => {
    await expect(
      createIdempotencyInput({ key: undefined, payload: {}, scope: { userId: 1 } }),
    ).resolves.toBeUndefined();
    await expect(createIdempotencyInput({ key: '', payload: {}, scope: { userId: 1 } })).rejects.toBeInstanceOf(
      IdempotencyKeyValidationError,
    );
    await expect(
      createIdempotencyInput({ key: 'x'.repeat(256), payload: {}, scope: { userId: 1 } }),
    ).rejects.toBeInstanceOf(IdempotencyKeyValidationError);
  });

  it('replays completed responses without executing the mutation', async () => {
    const mutate = vi.fn(async () => ({ id: 99 }));
    const complete = vi.fn(async () => undefined);
    const result = await runIdempotentMutation({
      input: { key: 'create-1', payloadHash: 'hash', scope: { userId: 1, groupId: 2 } },
      store: { reserve: async () => ({ kind: 'replay', response: { id: 7 } }), complete },
      mutate,
    });
    expect(result).toEqual({ id: 7 });
    expect(mutate).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('completes an acquired key after the domain mutation', async () => {
    const calls: string[] = [];
    const input = { key: 'create-1', payloadHash: 'hash', scope: { tenantId: 2 } };
    await expect(
      runIdempotentMutation({
        input,
        store: {
          reserve: async () => {
            calls.push('reserve');
            return { kind: 'acquired' };
          },
          complete: async (completedInput, response) => {
            expect(completedInput).toBe(input);
            expect(response).toEqual({ id: 8 });
            calls.push('complete');
          },
        },
        mutate: async () => {
          calls.push('mutate');
          return { id: 8 };
        },
      }),
    ).resolves.toEqual({ id: 8 });
    expect(calls).toEqual(['reserve', 'mutate', 'complete']);
  });

  it('acquires a newly inserted leased idempotency key', async () => {
    const input = { key: 'create-1', payloadHash: 'hash', scope: { userId: 1 } };
    let insertedToken = '';
    const reservation = await reserveLeasedIdempotency(
      {
        insertProcessing: async (_input, token) => {
          insertedToken = token;
        },
        lock: async () => ({
          state: 'processing',
          payloadHash: 'hash',
          processingToken: insertedToken,
          leaseExpired: false,
        }),
        reclaim: vi.fn(),
        complete: vi.fn(),
        release: vi.fn(),
      },
      input,
    );

    expect(reservation).toEqual({ kind: 'acquired', processingToken: insertedToken });
  });

  it('replays completed leased idempotency responses', async () => {
    await expect(
      reserveLeasedIdempotency(
        {
          insertProcessing: vi.fn(),
          lock: async () => ({ state: 'completed', payloadHash: 'hash', response: { id: 7 } }),
          reclaim: vi.fn(),
          complete: vi.fn(),
          release: vi.fn(),
        },
        { key: 'create-1', payloadHash: 'hash', scope: { userId: 1 } },
      ),
    ).resolves.toEqual({ kind: 'replay', response: { id: 7 } });
  });

  it('reclaims only expired leased idempotency owners', async () => {
    const reclaim = vi.fn(async () => true);
    const reservation = await reserveLeasedIdempotency(
      {
        insertProcessing: vi.fn(),
        lock: async () => ({ state: 'processing', payloadHash: 'hash', processingToken: 'old', leaseExpired: true }),
        reclaim,
        complete: vi.fn(),
        release: vi.fn(),
      },
      { key: 'create-1', payloadHash: 'hash', scope: { userId: 1 } },
    );

    expect(reservation.kind).toBe('acquired');
    expect(reclaim).toHaveBeenCalledWith(
      { key: 'create-1', payloadHash: 'hash', scope: { userId: 1 } },
      'old',
      reservation.kind === 'acquired' ? reservation.processingToken : '',
    );
  });

  it('rejects payload conflicts, active owners, lost reclaims, and lost completion ownership', async () => {
    const input = { key: 'create-1', payloadHash: 'hash', scope: { userId: 1 } };
    const base = {
      insertProcessing: vi.fn(),
      lock: async () => ({
        state: 'processing' as const,
        payloadHash: 'hash',
        processingToken: 'old',
        leaseExpired: false,
      }),
      reclaim: vi.fn(async () => false),
      complete: vi.fn(async () => false),
      release: vi.fn(),
    };
    await expect(
      reserveLeasedIdempotency(
        {
          ...base,
          lock: async () => ({ state: 'processing', payloadHash: 'other', processingToken: 'old', leaseExpired: true }),
        },
        input,
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(
      reserveLeasedIdempotency(
        {
          ...base,
          lock: async () => ({ state: 'processing', payloadHash: 'hash', processingToken: 'old', leaseExpired: false }),
        },
        input,
      ),
    ).rejects.toBeInstanceOf(IdempotencyInFlightError);
    await expect(
      reserveLeasedIdempotency(
        {
          ...base,
          lock: async () => ({ state: 'processing', payloadHash: 'hash', processingToken: 'old', leaseExpired: true }),
        },
        input,
      ),
    ).rejects.toThrow('ownership changed during lease reclaim');
    await expect(completeLeasedIdempotency(base, input, 'old', { id: 7 })).rejects.toThrow(
      'ownership was lost before completion',
    );
  });

  it.each([
    [new IdempotencyKeyValidationError(), 400],
    [new IdempotencyPayloadValidationError(), 400],
    [new IdempotencyConflictError(), 409],
    [new IdempotencyInFlightError(), 503],
  ])('maps %s to HTTP %s', async (error, status) => {
    await expect(withIdempotencyHttpErrors(async () => Promise.reject(error))).rejects.toMatchObject({ status });
  });

  it('does not hide unrelated errors', async () => {
    const error = new Error('database unavailable');
    await expect(withIdempotencyHttpErrors(async () => Promise.reject(error))).rejects.toBe(error);
  });
});
