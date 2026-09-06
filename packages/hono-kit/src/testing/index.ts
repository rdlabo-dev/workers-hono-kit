/**
 * Shared test infrastructure for Hono on Cloudflare Workers projects.
 * Every import requires `@rdlabo/workers-mysql` and `drizzle-orm` because DB compatibility exports
 * are loaded statically, including when only non-DB helpers are used. Prefer
 * `@rdlabo/workers-mysql/testing` for database helpers; kit-owned Firebase/auth/KV/Stripe fakes remain
 * the supported testing surface here.
 *
 * Test-only helpers that are never loaded at runtime. This subpath consolidates the duplicated
 * test boilerplate (test DB setup, in-memory fakes, auth header builders, Stripe fixtures) that
 * tends to be copy-pasted across projects into a single, importable surface.
 */
/* eslint-disable @typescript-eslint/no-deprecated -- compatibility barrel re-exports DB helpers */

export { createTestDb } from './db.js';
export type { TestDb, CreateTestDbOptions, TestDbConnection } from './db.js';
export type { Database, DisposableDatabase, QueryRunner, TxOf } from './db.js';

export { FakeFirebaseVerifier } from './fakes.js';
export { createPoolDatabase, createNoopDatabase } from './fakes.js';
export type { CreatePoolDatabaseOptions } from './fakes.js';

// Authentication test helpers (route-spec header builders and user provisioning).
export { authHeaders, registerFirebaseToken, provisionUser } from './auth.js';

// Test double helper (partial-implementation fake that throws explicitly on unconfigured members).
export { configurableFake } from './configurable-fake.js';

// Test fixture factories for Stripe objects.
export {
  fakeApiList,
  fakePaymentIntent,
  fakeStripeEvent,
  fakeCheckoutSession,
  fakeCustomer,
  fakePrice,
  fakeSubscription,
} from './stripe-fixtures.js';

// In-memory Workers binding fakes (KV / Queues producer).
export { fakeKv, fakeQueue } from './workers-bindings.js';
export type { FakeQueue } from './workers-bindings.js';
