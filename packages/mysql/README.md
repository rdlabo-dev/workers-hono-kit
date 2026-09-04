# @rdlabo/workers-mysql

MySQL, Hyperdrive, and Drizzle infrastructure for Cloudflare Workers.

> This workspace is under development and is not published yet.

The Worker must enable Node.js compatibility because `mysql2` uses Node.js networking APIs:

```toml
# wrangler.toml
compatibility_flags = ["nodejs_compat"]
```

## Install after publication

```bash
npm install @rdlabo/workers-mysql drizzle-orm
```

Before publication, install the candidate tarball together with `drizzle-orm`:

```bash
npm install drizzle-orm ./rdlabo-workers-mysql-*.tgz
```

`mysql2` is a direct dependency because this package owns the driver integration. `drizzle-orm` is
a peer dependency so the application and its schemas use one type identity.

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

With `nodejs_compat` enabled, the root is Workers-runtime-safe and does not load Drizzle or
Node-only migration code. Use
`@rdlabo/workers-mysql/drizzle`, `@rdlabo/workers-mysql/migrations`, and
`@rdlabo/workers-mysql/testing` only where those dependencies are needed.

Hono middleware remains an adapter in `@rdlabo/workers-hono-kit/mysql`; the database package itself
does not depend on Hono.
