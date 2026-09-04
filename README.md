# @rdlabo/workers-hono-kit

Infrastructure helpers for Hono APIs on Cloudflare Workers. The kit provides HTTP, authentication,
AWS, AI, Stripe, KV, queue, realtime, and offline building blocks; domain logic and database schemas
stay in the consuming application.

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

| Capability              | Install                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AI SDK model wrappers   | `ai`                                                                                                                                   |
| MySQL and Hyperdrive    | [`@rdlabo/workers-mysql`](https://github.com/rdlabo-dev/workers-hono-kit/tree/main/packages/mysql#readme) and optionally `drizzle-orm` |
| IANA timezone utilities | [`@rdlabo/workers-timezone`](https://github.com/rdlabo-dev/workers-hono-kit/tree/main/packages/timezone#readme)                        |

The two standalone workspace packages are not published yet. Their READMEs distinguish current npm
usage, candidate tarballs, and post-publication installation.

## Kit entry points

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

In the workspace candidate and upcoming release, `/testing` retains static DB compatibility exports. Every `/testing` consumer,
including applications using only Firebase or KV fakes, must install `@rdlabo/workers-mysql` and
`drizzle-orm`. Use matching candidate tarballs while the standalone package is unpublished.
The current npm release instead uses `mysql2` and `drizzle-orm` directly and does not require
`@rdlabo/workers-mysql`.

The next `0.x` minor moves the root MySQL exports to the standalone package and `/mysql` adapter.
Existing users should follow the [MySQL migration guide](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
before upgrading.

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
