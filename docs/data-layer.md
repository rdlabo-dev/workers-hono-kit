Import database helpers from `@rdlabo/workers-hono-kit/db`. This entry point requires `drizzle-orm` and `mysql2`.

## Hyperdrive database

`createHyperdriveDatabase()` lazily opens primary and replica connections from Hyperdrive bindings. Reads use the replica query runner; writes and transactions use the primary Drizzle instance. After a fatal mysql2 connection error, a replica read opens a fresh connection and repeats the SELECT at most once. Writes and transactions are not repeated because their commit state may be ambiguous. Workers owns connection cleanup at invocation end.

```ts
import { createHyperdriveDatabase } from '@rdlabo/workers-hono-kit/db';
import { drizzle } from 'drizzle-orm/mysql2';

const db = createHyperdriveDatabase({
  primaryHyperdrive: env.DB_PRIMARY,
  replicaHyperdrive: env.DB_REPLICA,
  createOrm: (primary) => drizzle(primary, { schema }),
});

const rows = await db.read<Item>('SELECT * FROM items WHERE id = ?', [id]);
await db.write((dz) => dz.insert(items).values(input));
await db.transaction((tx) => tx.insert(items).values(input));
```

Use `hyperdriveConnectionOptions()` when constructing lower-level mysql2 connections. The default JavaScript date conversion timezone is `+09:00`; it does not change the MySQL session timezone.

## Writes and retries

- `retryWhenDeadlock()` retries `ER_LOCK_DEADLOCK` with exponential backoff.
- `insertIdOf()`, `affectedRowsOf()`, and `insertedIdsOf()` normalize mysql2 write results.
- `withMysqlConnections()` opens primary and replica connections in parallel for a scoped operation.

## Drizzle and JST helpers

Use `jstTimestamp`, `jstDatetime`, `jstDate`, and `decimalNumber` for shared column behavior. Pair update timestamps with `jstOnUpdateNow()` because custom timestamp types do not expose Drizzle's `.onUpdateNow()`.

The `/business-time` entry point converts instants and business dates in the JST business timezone:

```ts
import { addBusinessDays, toBusinessDateTime } from '@rdlabo/workers-hono-kit/business-time';

toBusinessDateTime(new Date('2026-07-05T21:00:00Z'));
// '2026-07-06 06:00:00'

addBusinessDays('2026-07-06', 3);
// '2026-07-09'
```
