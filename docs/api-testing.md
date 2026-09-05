# Testing APIs

From kit `0.12.0`, DB test helpers are owned by `@rdlabo/workers-mysql`. Install that package and
`drizzle-orm` when using either package's `/testing` entry point.

## `@rdlabo/workers-mysql/testing`

This is the canonical home of the local MySQL/Drizzle test database and database fakes. Install
`drizzle-orm` when using this entry point; `mysql2` is included by the MySQL package.

| Export                                                                          | Description                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createTestDb(options)` / `TestDb` / `CreateTestDbOptions` / `TestDbConnection` | Test database built from committed Drizzle migrations as the single source of truth: `resetSchema` / `createTestPool` / `truncateAll` / `seed` / `mysqlReachable`. |
| `createPoolDatabase(options)` / `CreatePoolDatabaseOptions`                     | A `Database` backed by a single pool used as both primary and replica.                                                                                             |
| `createNoopDatabase()`                                                          | A `Database` stub that throws on `write` / `transaction` to catch accidental DB use in DB-less routes.                                                             |

## `@rdlabo/workers-hono-kit/testing`

Hono, Firebase, Stripe, KV, and Queue test helpers remain owned by the kit. Its DB exports are
deprecated compatibility re-exports of `@rdlabo/workers-mysql/testing`.

These compatibility exports are loaded statically. Importing **any** helper from this entry point
requires `@rdlabo/workers-mysql` and `drizzle-orm`, even when the test does not use a database.
For candidate tarball installation, see [Development](./development.md).

| Export                                                                                                                              | Description                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `FakeFirebaseVerifier`                                                                                                              | In-memory `FirebaseVerifier` for offline route tests (`register` / `verifyIdToken` / `getUser` / `deleteUser`).       |
| `authHeaders(token, opts?)`                                                                                                         | Build interceptor-compatible auth headers for requests.                                                               |
| `registerFirebaseToken(firebase, uid, record?, token?)`                                                                             | Register a token in a `FakeFirebaseVerifier` (no DB).                                                                 |
| `provisionUser(pool, firebase, opts)`                                                                                               | Register a token and provision a conventional `users(id, firebase_uid, agree)` row; returns the user id (idempotent). |
| `configurableFake(impl, name?)`                                                                                                     | Build a test double from a partial implementation; un-stubbed members throw `"${name}.${method} not configured"`.     |
| `fakeApiList` / `fakePaymentIntent` / `fakeStripeEvent` / `fakeCheckoutSession` / `fakeCustomer` / `fakePrice` / `fakeSubscription` | Stripe object fixtures with sensible defaults, overridable per test.                                                  |
| `fakeKv()` / `fakeQueue()` / `FakeQueue`                                                                                            | In-memory Workers KV / Queues producer doubles (`sent` + `batchCount` on queues for subrequest-bound assertions).     |
