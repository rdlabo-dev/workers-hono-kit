# API: `@rdlabo/workers-hono-kit/db`

Requires the `drizzle-orm` and `mysql2` peers. Reads use raw SQL against the replica by default, with an explicit primary read path for freshness; writes/transactions run against the primary through the Drizzle ORM with deadlock retry. The kit deliberately does not depend on the ORM's type identity — you pass the Drizzle instance in.

| Export | Description |
| --- | --- |
| `createHyperdriveDatabase(options)` | `HyperdriveDatabase` that lazily opens primary/replica connections from Hyperdrive bindings per request. `read()` targets the replica, `query()` targets the primary, and `readTransaction()` pins raw and Drizzle reads to one primary consistent snapshot. Read transactions are serialized on a separately cached connection. A SELECT or complete read-only transaction is repeated at most once on a fresh connection after a fatal mysql2 connection error. Writes and write transactions are not repeated. Workers cleans connections up at invocation end; the legacy `dispose()` is a no-op. |
| `createMysqlDatabase(options)` | Assemble a `Database` from an already-connected Drizzle ORM + replica `QueryRunner`. |
| `databaseFrom(orm, replica)` | Build a `Database` from an existing Drizzle instance + replica handle. |
| `Database` / `DisposableDatabase` / `HyperdriveDatabase` / `ReadTransaction` / `QueryRunner` / `TxOf` | The `read` / `query` / `readTransaction` / `write` / `transaction` API and its supporting types. |
| `hyperdriveConnectionOptions(hyperdrive, overrides?)` / `HyperdriveLike` / `ExecutionContextLike` | Build mysql2 `createConnection` options from a Hyperdrive binding (`disableEval`, `decimalNumbers`, `timezone '+09:00'` by default). `timezone` controls mysql2's JavaScript `Date` conversion; it does not change the MySQL session timezone. |
| `withMysqlConnections(...)` | Open primary/replica connections in parallel and run a function. Workers cleans them up at invocation end. |
| `retryWhenDeadlock(fn, retries?, delay?)` | Same deadlock-retry helper as the root export. |
| `insertIdOf` / `affectedRowsOf` / `insertedIdsOf` / `DzWriteResult` | Extract `insertId` / `affectedRows` (and derive contiguous bulk-insert ids) from a mysql2 write result. |
| `toJstDate` / `jstTimestampParams` / `jstDatetimeParams` / `jstDateParams` | JST date/time normalization params (advanced use). |
| `MYSQL_TIMEZONE` | Default mysql2 connection `timezone` (`'+09:00'`) for the JST DB deployment. |
| `jstTimestamp` / `jstDatetime` / `jstDate` | Drizzle column helpers (no repo-side wrapper needed). |
| `jstOnUpdateNow` | SQL expression for `ON UPDATE CURRENT_TIMESTAMP`. The `jstTimestamp` customType (and friends) do not support `.onUpdateNow()`, so pair it with `.$onUpdateFn(() => jstOnUpdateNow(fsp))`. |
| `DRIZZLE_ORM_OPTIONS` / `honoDrizzleConfig(options)` / `HonoDrizzleConfigOptions` | Shared Drizzle casing (`snake_case`) for both the runtime `drizzle()` call and `drizzle.config.ts`, keeping config ↔ runtime in sync. |
| `resolveDbSecret()` / `ResolvedDbSecret` | Resolve DB connection info from the `DB_SECRET` env var (an AWS RDS managed-secret JSON string) for CI migrate / local tooling. Returns `undefined` when `DB_SECRET` is unset; throws on invalid JSON or a missing required key. |
| `baselineMigrations(options)` / `readBaselineEntry(migrationsFolder)` / `BaselineMigrationsOptions` / `BaselineResult` / `BaselineEntry` | Brownfield first-deploy helper: mark an existing `0000_*` migration as applied without re-running DDL. |

## Drizzle column helpers (`jstTimestamp`, etc.)

- `drizzle-orm` is a **peer** only. The kit does not include `drizzle-orm` as a dependency (even after publishing, it uses the consumer's single copy).
- The consumer just keeps `drizzle-orm` in its `dependencies` as usual. **No `overrides` in `package.json` are needed.**
- The npm-published artifact contains no `devDependencies`, so installing it does not add a kit-specific `drizzle-orm` (there is only the one peer copy).
- The column helpers `import` the consumer's `drizzle-orm` at runtime, and the types are the `customType` inference as-is (`MySqlCustomColumnBuilder<…>`). No `any` is used, so the column's semantic type propagates to the consumer table's `$inferSelect`.
- **Precondition: resolve drizzle to a single copy.** Drizzle's `SQL` is a **nominal** type carrying a private field `shouldInlineParams`, so if the kit and the consumer resolve different copies, `jstTimestamp(…).default(sql\`…\`)` fails the whole schema with `TS2345 separate declarations of a private property 'shouldInlineParams'`. Under `file:`-link development, `drizzle-orm` nests under the kit and becomes a second copy, so **pin `drizzle-orm` to the consumer's own single copy in `tsconfig.json`**:

  ```jsonc
  // tsconfig.json compilerOptions (merge with existing paths if any)
  "paths": {
    "drizzle-orm": ["./node_modules/drizzle-orm"],
    "drizzle-orm/*": ["./node_modules/drizzle-orm/*"]
  }
  ```

  With `moduleResolution: "Bundler"`, `baseUrl` is not required (if `baseUrl` is already set, drop the leading `./`). On the published package (a single copy) these `paths` are harmless. **No `overrides` needed.**
- When developing against the kit via a direct `file:` link, run `npm install` in the kit repo itself to satisfy its peers (do not add `overrides` on the consumer side).

## `CURRENT_TIMESTAMP` vs the connection `timezone:'+09:00'`

| Path | Who decides the time | Relationship to JST |
| --- | --- | --- |
| The app binds a `Date` (INSERT/UPDATE) | mysql2 + connection `timezone:'+09:00'` | Treated as JST on the wire (`datetime-wire` test) |
| `DEFAULT CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP` | The MySQL server (session `time_zone`) | A **separate path** from the connection option. JST if the RDS `time_zone` is `+09:00`, UTC if UTC |

`jstTimestamp` / `jstDatetime` only handle read/write pass-through and DATE normalization; they do not change the timezone of server-side defaults. For columns that need `ON UPDATE`, keep the DDL intent with `.$onUpdateFn(() => jstOnUpdateNow(6))`.
