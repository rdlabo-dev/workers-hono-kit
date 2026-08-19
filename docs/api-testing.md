# API: `@rdlabo/workers-hono-kit/testing`

Requires the `drizzle-orm` and `mysql2` peers. Consolidates duplicated test boilerplate.

| Export | Description |
| --- | --- |
| `createTestDb(options)` / `TestDb` / `CreateTestDbOptions` / `TestDbConnection` | Test database built from committed Drizzle migrations as the single source of truth: `resetSchema` / `createTestPool` / `truncateAll` / `seed` / `mysqlReachable`. |
| `FakeFirebaseVerifier` | In-memory `FirebaseVerifier` for offline route tests (`register` / `verifyIdToken` / `getUser` / `deleteUser`). |
| `createPoolDatabase(options)` / `CreatePoolDatabaseOptions` | A `Database` backed by a single pool used as both primary and replica. |
| `createNoopDatabase()` | A `Database` stub that throws on `write` / `transaction` to catch accidental DB use in DB-less routes. |
| `authHeaders(token, opts?)` | Build interceptor-compatible auth headers for requests. |
| `registerFirebaseToken(firebase, uid, record?, token?)` | Register a token in a `FakeFirebaseVerifier` (no DB). |
| `provisionUser(pool, firebase, opts)` | Register a token and provision a conventional `users(id, firebase_uid, agree)` row; returns the user id (idempotent). |
| `configurableFake(impl, name?)` | Build a test double from a partial implementation; un-stubbed members throw `"${name}.${method} not configured"`. |
| `fakeApiList` / `fakePaymentIntent` / `fakeStripeEvent` / `fakeCheckoutSession` / `fakeCustomer` / `fakePrice` / `fakeSubscription` | Stripe object fixtures with sensible defaults, overridable per test. |
| `fakeKv()` / `fakeQueue()` / `FakeQueue` | In-memory Workers KV / Queues producer doubles (`sent` + `batchCount` on queues for subrequest-bound assertions). |
