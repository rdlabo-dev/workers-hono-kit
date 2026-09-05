---
title: Runtime
---

# Runtime

Enable `nodejs_compat` in your Worker and install the dependencies described in the
[README](../README.md). `mysql2` is included; the package does not depend on Hono.
The application supplies its Hyperdrive bindings, schema, and ORM factory.

## Invocation lifetime

Create `createHyperdriveDatabase` inside each invocation, not in module-global state. Connections
open lazily and are reused by that database instance. The runtime cleans up invocation connections;
its compatibility `dispose()` method is a no-op.

This complete Worker example uses one Hyperdrive binding for both roles. Applications with a
replica can supply a separate binding for `replicaHyperdrive`:

```ts
import { createHyperdriveDatabase, type HyperdriveLike } from '@rdlabo/workers-mysql';
import { DRIZZLE_ORM_OPTIONS } from '@rdlabo/workers-mysql/drizzle';
import { drizzle } from 'drizzle-orm/mysql2';

interface Env {
  DB: HyperdriveLike;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const db = createHyperdriveDatabase({
      primaryHyperdrive: env.DB,
      replicaHyperdrive: env.DB,
      createOrm: (connection) => drizzle(connection, DRIZZLE_ORM_OPTIONS),
    });
    const rows = await db.query<Array<{ value: number }>>('SELECT ? AS value', [1]);
    return Response.json(rows);
  },
};
```

## Read and write paths

| Operation                   | Destination                 | Result type parameter             |
| --------------------------- | --------------------------- | --------------------------------- |
| `read<Row>(sql, params?)`   | Replica                     | One row; returns `Row[]`          |
| `query<Rows>(sql, params?)` | Primary SELECT              | Whole result, for example `Row[]` |
| `readTransaction(fn)`       | Primary consistent snapshot | Callback result                   |
| `write(fn)`                 | Primary ORM                 | Awaited callback result           |
| `transaction(fn)`           | Primary transaction         | Awaited callback result           |

Use `query` for reads that cannot tolerate replica lag. Query caching, if enabled on a Hyperdrive
binding, is a separate configuration concern. Use parameter placeholders, not interpolated SQL.

`readTransaction` passes `{ orm, query }` on one read-only snapshot. Its calls are serialized on a
dedicated connection; do not call it recursively inside its callback.

## Retry boundaries

Database operations retry deadlocks. Return/await the write builder or promise from callbacks.
The whole transaction callback can run again: keep email, payments, and other external side effects
outside it. Do not add another `retryWhenDeadlock` wrapper around an already-retrying operation.

Hyperdrive SELECTs and read-only transactions can additionally repeat once on a fresh connection
after a fatal connection error. Writes and write transactions are not replayed for connection loss:
the outcome may be unknown. Handle application idempotency before retrying such a request.

`createMysqlDatabase({ orm, replica })` and `databaseFrom(orm, replica)` wrap existing handles;
their caller owns connection cleanup. They expose `Database`, not the extra Hyperdrive primary-read
methods. For Hono containers, use `@rdlabo/workers-hono-kit/mysql` (kit `0.12.0` or later).

See [Drizzle and dates](./drizzle.md) for connection defaults and [API](./api.md) for exports.
