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
| `@rdlabo/workers-timezone`               | IANA-timezone-aware dates and date-times (Asia/Tokyo by default)               |
| `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility re-export of `@rdlabo/workers-timezone`               |
| `@rdlabo/workers-hono-kit/offline`       | Offline replica wire, cursor, journal, and compatibility contracts             |
| `@rdlabo/workers-hono-kit/realtime`      | Durable Object WebSocket and retry helpers                                     |
| `@rdlabo/workers-hono-kit/testing`       | Test databases, auth helpers, fakes, and Stripe fixtures                       |

Subpath imports keep optional database and testing dependencies out of the root runtime surface.

`@rdlabo/workers-timezone` is not published yet. After publication, install both packages when
using the timezone API or the deprecated compatibility subpath:

```sh
npm install @rdlabo/workers-hono-kit @rdlabo/workers-timezone
```

Set a deployment-wide timezone once when the Worker module starts. Helpers then use it whenever
their optional timezone argument is omitted:

```ts
import { TIME_ZONES, initializeTimezone } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: TIME_ZONES.NEW_YORK });
```

Install `@rdlabo/workers-timezone` as a direct dependency before importing it. Keeping one version
in the application dependency graph also ensures that the canonical import and the deprecated
`@rdlabo/workers-hono-kit/business-time` subpath share the same module-level configuration.

The compatibility subpath preserves the existing API names and keeps `Asia/Tokyo` as its default.
Its results now follow IANA historical offsets instead of the legacy fixed `+09:00`, so historical
dates can change when Tokyo's offset was not `+09:00`. It also validates calendar and wall-clock
inputs strictly: impossible date-only values normalize to `null`, while invalid date-time
construction and parsing throw `RangeError` instead of relying on JavaScript `Date` rollover. Treat
both behavior changes as breaking when planning an upgrade.

## Documentation

- [HTTP and Authentication](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/http-auth)
- [Data Layer](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
- [Realtime and Offline](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/realtime-offline)
- [Testing and Operations](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/testing-operations)
- [API Reference](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/api)

<!-- rdlabo-docs-omit -->

**Full documentation:** [https://docs.rdlabo.dev/projects/workers-hono-kit](https://docs.rdlabo.dev/projects/workers-hono-kit)

## Prerelease channels

While `@rdlabo/workers-timezone` is private and unpublished, npm publication of both workspace
packages is disabled. Pull requests and merges still produce separate immutable candidate artifacts
for `@rdlabo/workers-hono-kit` and `@rdlabo/workers-timezone`, but `/beta`, automatic beta, `next`,
and stable publication are blocked.

Publication may be enabled only after the timezone package becomes public, versions and dependency
ranges are synchronized, and release automation publishes timezone before hono-kit. Candidate
publication additionally requires the repository variable `WORKSPACE_NPM_PUBLISH_ENABLED=true` and
revalidates `packages/timezone/package.json` as non-private immediately before publishing.

Until then, install both downloaded candidate tarballs together when testing the package boundary:

```sh
npm install ./rdlabo-workers-timezone-*.tgz ./rdlabo-workers-hono-kit-*.tgz
```

## Maintainers

- [rdlabo](https://rdlabo.dev/)

## License

[MIT](./LICENSE) © rdlabo-dev

<!-- /rdlabo-docs-omit -->
