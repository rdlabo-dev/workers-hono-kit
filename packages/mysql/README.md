# @rdlabo/workers-mysql

MySQL, Hyperdrive, and Drizzle infrastructure for Cloudflare Workers.

The Worker must enable Node.js compatibility because `mysql2` uses Node.js networking APIs:

```toml
# wrangler.toml
compatibility_flags = ["nodejs_compat"]
```

## Install

```bash
npm install @rdlabo/workers-mysql
```

`mysql2` is included as a direct dependency. Add `drizzle-orm` when using `/drizzle` or `/testing`:

```bash
npm install drizzle-orm
```

Keeping Drizzle as a peer gives the application and its schemas one type identity.

The public connection types use Node.js declarations. `@types/node@>=20.19.43` is a required peer
(also when deploying to Workers). TypeScript applications should add it directly so its global
declarations are visible with strict package layouts, including pnpm:

```sh
npm install -D @types/node@20
# pnpm users:
pnpm add -D @types/node@20
```

Use the matching supported major for your tooling. Automatic peer installation alone may not expose
these global declarations to the application's TypeScript compiler under pnpm.

## Entry points

| Import                             | Responsibility                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `@rdlabo/workers-mysql`            | Workers MySQL and Hyperdrive runtime, retry, write-result, and JST wire helpers |
| `@rdlabo/workers-mysql/drizzle`    | Drizzle configuration and JST column helpers                                    |
| `@rdlabo/workers-mysql/migrations` | Node.js migration and brownfield baseline helpers                               |
| `@rdlabo/workers-mysql/testing`    | Local MySQL/Drizzle test database and fakes                                     |

## Runtime

Create the database inside each Worker invocation. In this fragment, `env` contains the application's
Hyperdrive bindings and `schema` is its own Drizzle schema:

```ts
import { createHyperdriveDatabase } from '@rdlabo/workers-mysql';
import { DRIZZLE_ORM_OPTIONS } from '@rdlabo/workers-mysql/drizzle';
import { drizzle } from 'drizzle-orm/mysql2';

const db = createHyperdriveDatabase({
  primaryHyperdrive: env.PRIMARY,
  replicaHyperdrive: env.REPLICA,
  createOrm: (connection) => drizzle(connection, { schema, ...DRIZZLE_ORM_OPTIONS }),
});
```

With `nodejs_compat` enabled, the package root is Workers-runtime-safe and does not load Drizzle or
Node-only migration code.

## Hono integration

Hono middleware remains an adapter in `@rdlabo/workers-hono-kit/mysql`; the database package itself
does not depend on Hono.

```ts
import { createContainerRuntime } from '@rdlabo/workers-hono-kit/mysql';
```

This adapter is available from Hono kit `0.12.0`. Install both packages:

```sh
npm install @rdlabo/workers-mysql @rdlabo/workers-hono-kit
```

## Documentation

- [Runtime](docs/runtime.md) — request lifetime, primary/replica reads, and retry safety.
- [Drizzle and dates](docs/drizzle.md) — schema ownership, optional peer, and fixed-JST storage.
- [Migrations and testing](docs/tooling.md) — Node.js tooling and destructive test helpers.
- [API](docs/api.md) — public exports by entry point.
- [Migration](docs/migration.md) — kit compatibility imports.

These guides describe this source revision. Use the matching release tag for an installed version.

## Migrating from workers-hono-kit

Kit `0.12.0` changes the import boundaries. Its old `/db` and DB-related `/testing` exports remain
temporarily as deprecated compatibility paths. See [Migration](docs/migration.md) for the import map.
