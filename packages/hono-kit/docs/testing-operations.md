## Testing entry point

`@rdlabo/workers-hono-kit/testing` is never loaded by production code. Its DB helpers are deprecated
compatibility exports from `@rdlabo/workers-mysql/testing`, while Firebase, HTTP, Stripe, KV, and
Queue fakes remain in the Hono kit.

| Helper                                                          | Use                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `createTestDb()`                                                | Build a Drizzle-migration-backed test database.                       |
| `FakeFirebaseVerifier`                                          | Verify registered in-memory Firebase tokens.                          |
| `createPoolDatabase()` / `createNoopDatabase()`                 | Provide database implementations for tests.                           |
| `authHeaders()` / `registerFirebaseToken()` / `provisionUser()` | Prepare authenticated route tests.                                    |
| `configurableFake()`                                            | Create a partial fake that fails explicitly for unconfigured members. |
| `fakeKv()` / `fakeQueue()`                                      | Use in-memory Workers binding fakes.                                  |
| Stripe fixture factories                                        | Create typed events, sessions, subscriptions, prices, and intents.    |

## Queues

`sendInChunks()` bounds queue sends under Workers subrequest limits. `processBatch()` handles a message batch sequentially, bounding concurrent subrequests to one; errors explicitly marked with `queueDisposition: 'discard'` are acknowledged, while other failures retry. `createQueueErrorHandler()` adds logging and optional final-attempt reporting.

## Operational CLI

The Hono kit publishes commands for synchronizing development AWS credentials, checking subrequest
fanout, checking realtime bundles, and querying Durable Object metrics. Database baselining is owned
by `workers-mysql-db-baseline`; the old `workers-hono-kit-db-baseline` command delegates to it during
the compatibility period. Run the exact CLI shipped with the installed version before changing
infrastructure.

## Trust boundaries

AWS, Firebase, AI Gateway, Stripe, and database clients are configured by the consuming application. Do not place domain-specific credentials, schemas, or authorization policy inside the shared kit. Use `createRolePolicy()` only for storage-agnostic role and relation mapping; the application still owns its roles and permissions.
