# @rdlabo/workers-hono-kit

Shared Hono building blocks for Cloudflare Workers APIs: weak ETags, NestJS-shaped validation and
error bodies, Firebase auth middleware, AWS helpers, AI Gateway wiring, Stripe, KV, queues,
realtime, and offline contracts.

[Try a Hono API locally](./docs/quickstart.md): send a health request, inspect its weak ETag, and see the missing-route JSON response. No Cloudflare account or open port is needed for the first exercise.

## Install

```sh
npm install @rdlabo/workers-hono-kit
```

The package is ESM with TypeScript declarations and requires Node.js 20 or later for tooling.
Stripe is included directly. npm installs the required Hono, validation, authentication, AWS, and
AI Gateway peers; package managers configured not to install peers automatically must add them
explicitly:

```sh
npm install hono zod @hono/zod-validator jose aws4fetch ai-gateway-provider
```

Additional optional peers and packages stay separate:

| Capability              | Install                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| AI SDK model wrappers   | `ai`                                                                                                               |
| MySQL and Hyperdrive    | [`@rdlabo/workers-mysql`](https://docs.rdlabo.dev/projects/workers-mysql/docs/readme) and optionally `drizzle-orm` |
| IANA timezone utilities | [`@rdlabo/workers-timezone`](https://docs.rdlabo.dev/projects/workers-timezone/docs/readme)                        |

From `0.12.0`, `/testing` retains static DB compatibility exports. Every `/testing` consumer,
including applications using only Firebase or KV fakes, must install `@rdlabo/workers-mysql` and
`drizzle-orm`.

Version `0.12.0` moves the root MySQL exports to the standalone package and `/mysql` adapter.
Existing users should follow the [MySQL migration guide](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
before upgrading.

## Quick start

A minimal Hono app with weak ETags, the shared error body, and 404 JSON
`{ message: 'Cannot METHOD path', error: 'Not Found', statusCode: 404 }`:

```ts
import { Hono } from 'hono';
import { createAppErrorHandler, finalizeResponse, notFoundHandler } from '@rdlabo/workers-hono-kit';

const app = new Hono();

app.use('*', finalizeResponse());
app.onError(createAppErrorHandler());
app.notFound(notFoundHandler);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
```

## Choose an entry point

| Import                                   | Responsibility                                                       |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `@rdlabo/workers-hono-kit`               | HTTP, auth, Firebase, AWS, AI, Stripe, KV, and queue primitives      |
| `@rdlabo/workers-hono-kit/mysql`         | Hono container adapter for `@rdlabo/workers-mysql`                   |
| `@rdlabo/workers-hono-kit/offline`       | Offline replica wire, cursor, journal, and compatibility contracts   |
| `@rdlabo/workers-hono-kit/realtime`      | Durable Object WebSocket and retry helpers                           |
| `@rdlabo/workers-hono-kit/testing`       | Auth helpers, fakes, Stripe fixtures, and compatibility test exports |
| `@rdlabo/workers-hono-kit/db`            | Deprecated compatibility path for `@rdlabo/workers-mysql`            |
| `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility path for `@rdlabo/workers-timezone`         |

The root entry point does not load MySQL, Drizzle, or Node-only migration modules. MySQL consumers
install the standalone package, which owns `mysql2`; Hono-specific wiring stays in the `/mysql`
adapter.

### Compatibility import deprecations

Kit `/db`, `/business-time`, and the DB-related `/testing` exports (`createTestDb`, pool/noop
database fakes, and shared `Database` types) carry symbol-level `@deprecated` tags that point at
`@rdlabo/workers-mysql` / `@rdlabo/workers-timezone`. Prefer those packages for new code. The
compatibility aliases keep the same runtime identity and signatures; there is no planned removal.
Kit-owned helpers such as `reopenGuardedPaymentFailedSet`, `/mysql` `createContainerRuntime`, and
Firebase/auth/KV/Stripe test helpers are not deprecated by this migration.

## Documentation

- [HTTP and Authentication](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/http-auth)
- [Data Layer and MySQL migration](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
- [Realtime and Offline](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/realtime-offline)
- [Testing and Operations](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/testing-operations)
- [Packages and API Reference](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/api)

<!-- rdlabo-docs-omit -->

**Full documentation:** [https://docs.rdlabo.dev/projects/workers-hono-kit](https://docs.rdlabo.dev/projects/workers-hono-kit)

Candidate artifacts and publication controls are documented in
[Development](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/development).

## Maintainers

- [rdlabo](https://rdlabo.dev/)

## License

[MIT](./LICENSE) © rdlabo-dev

<!-- /rdlabo-docs-omit -->
