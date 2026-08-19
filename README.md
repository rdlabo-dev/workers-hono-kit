# @rdlabo/workers-hono-kit

`@rdlabo/workers-hono-kit` provides infrastructure-layer helpers for Hono on Cloudflare Workers. Domain logic, database schemas, and application-specific policy stay in the consuming application.

```sh
npm install @rdlabo/workers-hono-kit
```

Install only the peer dependencies required by the features you use:

```sh
# Core HTTP, validation, Firebase, and AWS helpers
npm install hono zod @hono/zod-validator jose aws4fetch

# Data and testing entry points
npm install drizzle-orm mysql2

# AI Gateway
npm install ai ai-gateway-provider
```

Stripe is a direct dependency of the kit. The package is compiled ESM with declarations, uses Web-standard APIs such as `fetch`, `crypto.subtle`, and `Response`, and requires Node.js 20 or later for tooling.

## Entry points

| Import                                   | Responsibility                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `@rdlabo/workers-hono-kit`               | HTTP, auth, errors, Firebase, AWS, AI, Stripe, KV, queues, realtime primitives |
| `@rdlabo/workers-hono-kit/db`            | Hyperdrive, MySQL, Drizzle, migrations, JST columns                            |
| `@rdlabo/workers-hono-kit/business-time` | JST business dates and date-times                                              |
| `@rdlabo/workers-hono-kit/offline`       | Offline replica wire, cursor, journal, and compatibility contracts             |
| `@rdlabo/workers-hono-kit/realtime`      | Durable Object WebSocket and retry helpers                                     |
| `@rdlabo/workers-hono-kit/testing`       | Test databases, auth helpers, fakes, and Stripe fixtures                       |

Subpath imports keep optional database and testing dependencies out of the root runtime surface.

## Documentation

- [HTTP and Authentication](./docs/http-auth.md)
- [Data Layer](./docs/data-layer.md)
- [Realtime and Offline](./docs/realtime-offline.md)
- [Testing and Operations](./docs/testing-operations.md)

<!-- rdlabo-docs-omit -->
**Full documentation:** [https://docs.rdlabo.dev/projects/workers-hono-kit](https://docs.rdlabo.dev/projects/workers-hono-kit)

## Additional GitHub docs

- [CLI](./docs/cli.md)
- [Role Policies](./docs/role-policies.md)
- [Development](./docs/development.md)
- [API Reference](./docs/api.md)

## License

[MIT](./LICENSE) © rdlabo-dev
<!-- /rdlabo-docs-omit -->
