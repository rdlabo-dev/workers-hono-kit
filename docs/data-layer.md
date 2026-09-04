Import database helpers from `@rdlabo/workers-hono-kit/db`. This entry point requires `drizzle-orm` and `mysql2`.

## Hyperdrive database

`createHyperdriveDatabase()` lazily opens primary and replica connections from Hyperdrive bindings. `read()` uses the replica query runner; `query()` provides an explicit raw primary SELECT for read-after-write consistency; writes and transactions use the primary Drizzle instance. `readTransaction()` runs Drizzle and raw reads against one primary repeatable-read snapshot. Read transactions are serialized on one separately cached connection so their boundaries cannot mix with each other or with ordinary primary operations. After a fatal mysql2 connection error, a single read or the complete read-only transaction opens a fresh connection and repeats at most once. Writes and write transactions are not repeated because their commit state may be ambiguous. Workers owns connection cleanup at invocation end.

```ts
import { createHyperdriveDatabase } from '@rdlabo/workers-hono-kit/db';
import { drizzle } from 'drizzle-orm/mysql2';

const db = createHyperdriveDatabase({
  primaryHyperdrive: env.DB_PRIMARY,
  replicaHyperdrive: env.DB_REPLICA,
  createOrm: (primary) => drizzle(primary, { schema }),
});

const rows = await db.read<Item>('SELECT * FROM items WHERE id = ?', [id]);
const freshRows = await db.query<Item[]>('SELECT * FROM items WHERE id = ?', [id]);
await db.write((dz) => dz.insert(items).values(input));
await db.transaction((tx) => tx.insert(items).values(input));

const snapshot = await db.readTransaction(async ({ orm, query }) => ({
  items: await orm.select().from(items),
  count: await query<{ count: number }[]>('SELECT COUNT(*) count FROM items'),
}));
```

MySQL enforces `READ ONLY` for every transaction attempt. Drizzle does not provide a distinct read-only transaction type, so applications can wrap `orm` in a SELECT-only facade when they also want compile-time enforcement.

Do not call `readTransaction()` recursively from inside its callback. Calls share one serialized snapshot lane, so a nested call would wait for its own outer transaction to finish. Consumers that expose nested snapshot helpers should reuse the outer reader instead.

Use `hyperdriveConnectionOptions()` when constructing lower-level mysql2 connections. The default JavaScript date conversion timezone is `+09:00`; it does not change the MySQL session timezone.

## Writes and retries

- `retryWhenDeadlock()` retries `ER_LOCK_DEADLOCK` with exponential backoff.
- `insertIdOf()`, `affectedRowsOf()`, and `insertedIdsOf()` normalize mysql2 write results.
- `withMysqlConnections()` opens primary and replica connections in parallel for a scoped operation.

## Drizzle and JST helpers

Use `jstTimestamp`, `jstDatetime`, and `jstDate` for shared date behavior. Pair update timestamps with `jstOnUpdateNow()` because custom timestamp types do not expose Drizzle's `.onUpdateNow()`. For decimal columns, use Drizzle's `decimal(name, { precision, scale, mode: 'number' })` directly.

Generic business-time conversion is separate from the DB's fixed `+09:00` wire contract.
`@rdlabo/workers-timezone` is still unpublished; the currently published kit retains its existing
`/business-time` API. When the timezone package is published, install it directly and migrate to its
canonical entry point. To exercise the workspace candidate before then, install both tarballs as
described in the repository README.

```sh
npm install @rdlabo/workers-timezone
```

```ts
import { addBusinessDays, toBusinessDateTime } from '@rdlabo/workers-timezone';

toBusinessDateTime(new Date('2026-07-05T21:00:00Z'));
// '2026-07-06 06:00:00'

addBusinessDays('2026-07-06', 3);
// '2026-07-09'
```
