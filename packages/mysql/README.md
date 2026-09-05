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

See [Development](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/development) when testing
the complete three-package candidate graph.

## Migrating from workers-hono-kit

This boundary is a breaking change in version `0.12.0` of the kit:

| Current import                                          | Replacement                                       |
| ------------------------------------------------------- | ------------------------------------------------- |
| `createContainerRuntime` from the kit root              | `@rdlabo/workers-hono-kit/mysql`                  |
| `retryWhenDeadlock` from the kit root                   | `@rdlabo/workers-mysql`                           |
| DB helpers from `@rdlabo/workers-hono-kit/db`           | This package's root, `/drizzle`, or `/migrations` |
| DB test helpers from `@rdlabo/workers-hono-kit/testing` | `@rdlabo/workers-mysql/testing`                   |

The old `/db` and DB-related `/testing` exports remain temporarily as deprecated compatibility
paths. See the [data-layer guide](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
for details.
