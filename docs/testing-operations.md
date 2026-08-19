## Testing entry point

`@rdlabo/workers-hono-kit/testing` requires the database peers and is never loaded by production code.

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

The package publishes commands for synchronizing development AWS credentials, checking subrequest fanout, creating database baselines, checking realtime bundles, and querying Durable Object metrics. Run the exact CLI shipped with the installed package version and review its `--help` before changing infrastructure.

## Trust boundaries

AWS, Firebase, AI Gateway, Stripe, and database clients are configured by the consuming application. Do not place domain-specific credentials, schemas, or authorization policy inside the shared kit. Use `createRolePolicy()` only for storage-agnostic role and relation mapping; the application still owns its roles and permissions.
