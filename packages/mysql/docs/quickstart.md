---
title: Run your first MySQL query
---

Read an actual MySQL result through the package without creating tables or an application schema. Then see exactly what changes when moving from a local Node.js connection to a Workers Hyperdrive binding.

Workers MySQL owns database access and retry behavior. Hono is optional; the application owns its schema and query policy. IANA display dates belong to [Workers Timezone + ESLint](https://docs.rdlabo.dev/projects/workers-timezone/docs/quickstart), independently of the database fixed `+09:00` storage helpers.

## 1. Prepare the local exercise

You need Node.js 24, npm, Docker, and an unused local port 3307. These commands create a disposable local database. The password below is only for this localhost demonstration.

```sh
mkdir workers-mysql-demo
cd workers-mysql-demo
npm init -y
npm pkg set type=module
npm install @rdlabo/workers-mysql@0.12.2 mysql2@3 drizzle-orm@0.45
npm install --save-dev tsx@4 @types/node@24
```

The package includes mysql2 internally. This example also imports mysql2 and Drizzle directly to create an application-owned pool, so it declares them as direct dependencies.

```sh
docker run --name workers-mysql-docs-demo --rm -d \
  -p 127.0.0.1:3307:3306 \
  -e MYSQL_ROOT_PASSWORD=local-demo \
  -e MYSQL_DATABASE=demo \
  mysql:8.4
```

Wait for startup. Run this until it reports `mysqld is alive`:

```sh
docker exec workers-mysql-docs-demo mysqladmin ping -h 127.0.0.1 -uroot -plocal-demo
```

## 2. Query and close the connection

Save this as `demo.ts`. Both roles use the same local pool in this exercise; it does not demonstrate replica routing.

```ts
import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { createMysqlDatabase } from '@rdlabo/workers-mysql';

const pool = createPool({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'local-demo',
  database: 'demo',
});
const db = createMysqlDatabase({ orm: drizzle(pool), replica: pool });

try {
  const rows = await db.read<{ value: number }>('SELECT ? AS value', [42]);
  console.log(rows[0]?.value);
} finally {
  await pool.end();
}
```

```sh
npx tsx demo.ts
```

Expected output:

```text
42
```

The value came from a parameterized `SELECT` through `db.read()`. No tables were created or changed. If you get a connection error, confirm the container is ready and port 3307 is available.

Stop the disposable database when finished. Because it was started with `--rm`, stopping removes the container and its demonstration data:

```sh
docker stop workers-mysql-docs-demo
```

## 3. Move to Workers and Hyperdrive

In Node.js, the application owns the pool and closes it. In Workers, enable `nodejs_compat`, configure a Hyperdrive binding named `DB` that connects to your database, and create the database inside each invocation. An account and a configured binding are required for this next stage; installing the npm package does not create either.

Once the binding exists, the complete Worker below returns `[{"value":42}]`. It uses one binding for both roles; it needs no schema because the example uses raw SQL:

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
    const rows = await db.query<Array<{ value: number }>>('SELECT ? AS value', [42]);
    return Response.json(rows);
  },
};
```

Use `query()` for primary SELECTs and `read()` for replica reads. Add an ORM schema only when you need typed table queries. [Runtime](./runtime.md) explains invocation lifetime, snapshot reads, and retries; [Drizzle and dates](./drizzle.md) covers column and storage behavior.

For Hono request containers, add the [kit `/mysql` adapter](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer). Do not wrap already-retrying database methods in another retry loop. A transaction callback may run again, so keep email, payments, and other external side effects outside it.
