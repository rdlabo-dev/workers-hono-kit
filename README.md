# @rdlabo/workers-hono-kit

`@rdlabo/workers-hono-kit` provides infrastructure-layer helpers for Hono on Cloudflare Workers. Domain logic, database schemas, and application-specific policy stay in the consuming application.

```sh
npm install @rdlabo/workers-hono-kit ai-gateway-provider
```

`ai-gateway-provider` remains a required peer because the root exports `createAiGatewayProvider`.
MySQL infrastructure is an independent package and is not loaded by this entry point.

Install only the peer dependencies required by the features you use:

```sh
# Core HTTP, validation, Firebase, and AWS helpers
npm install hono zod @hono/zod-validator jose aws4fetch

# MySQL, Hyperdrive, and Drizzle
npm install @rdlabo/workers-mysql drizzle-orm

# AI Gateway
npm install ai
```

Stripe is a direct dependency of the kit. The package is compiled ESM with declarations, uses Web-standard APIs such as `fetch`, `crypto.subtle`, and `Response`, and requires Node.js 20 or later for tooling.

## Entry points

| Import                                   | Responsibility                                                     |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `@rdlabo/workers-hono-kit`               | HTTP, auth, Firebase, AWS, AI, Stripe, KV, queue primitives        |
| `@rdlabo/workers-mysql`                  | Workers-safe MySQL and Hyperdrive runtime                          |
| `@rdlabo/workers-mysql/drizzle`          | Drizzle configuration and JST column helpers                       |
| `@rdlabo/workers-mysql/migrations`       | Node.js migration and brownfield baseline helpers                  |
| `@rdlabo/workers-mysql/testing`          | Local MySQL and Drizzle test infrastructure                        |
| `@rdlabo/workers-hono-kit/mysql`         | Hono container adapter for `@rdlabo/workers-mysql`                 |
| `@rdlabo/workers-hono-kit/db`            | Deprecated compatibility re-export of the MySQL package            |
| `@rdlabo/workers-timezone`               | IANA-timezone-aware dates and date-times (Asia/Tokyo by default)   |
| `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility re-export of `@rdlabo/workers-timezone`   |
| `@rdlabo/workers-hono-kit/offline`       | Offline replica wire, cursor, journal, and compatibility contracts |
| `@rdlabo/workers-hono-kit/realtime`      | Durable Object WebSocket and retry helpers                         |
| `@rdlabo/workers-hono-kit/testing`       | Test databases, auth helpers, fakes, and Stripe fixtures           |

`mysql2` is a direct dependency of `@rdlabo/workers-mysql`; consumers do not install it separately.
`drizzle-orm` is an optional peer used only by the `/drizzle` and `/testing` entry points. The Hono
kit treats both standalone workspace packages as optional peers for compatibility subpaths.

The standalone MySQL package is still unpublished. Existing users of the current npm release keep
using `@rdlabo/workers-hono-kit/db` with their existing `mysql2` dependency. To test this PR's
candidate boundary, install the downloaded MySQL and kit tarballs together; after publication, use
the canonical `@rdlabo/workers-mysql` imports shown above.

### MySQL migration

This boundary is a breaking change for the next `0.x` minor. Update imports before upgrading:

| Current import                                          | Canonical import                                      |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `createContainerRuntime` from the kit root              | `@rdlabo/workers-hono-kit/mysql`                      |
| `retryWhenDeadlock` from the kit root                   | `@rdlabo/workers-mysql`                               |
| DB helpers from `@rdlabo/workers-hono-kit/db`           | `@rdlabo/workers-mysql`, `/drizzle`, or `/migrations` |
| DB test helpers from `@rdlabo/workers-hono-kit/testing` | `@rdlabo/workers-mysql/testing`                       |

The `/db` and DB-related `/testing` exports remain as deprecated migration aids. The two root
exports move rather than re-export so importing the kit root remains independent of MySQL types and
runtime modules.

`@rdlabo/workers-timezone` and `@rdlabo/workers-mysql` are not published yet. After publication,
install the timezone package when using the timezone API or the deprecated compatibility subpath:

```sh
npm install @rdlabo/workers-hono-kit ai-gateway-provider @rdlabo/workers-timezone
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

While either standalone workspace is private and unpublished, npm publication is disabled. Pull
requests and merges still produce separate immutable candidate artifacts for
`@rdlabo/workers-hono-kit`, `@rdlabo/workers-timezone`, and `@rdlabo/workers-mysql`, but `/beta`,
automatic beta, `next`, and stable publication are blocked.

Publication may be enabled only after both packages become public, versions and dependency ranges
are synchronized, and release automation publishes dependencies before hono-kit. Candidate
publication additionally requires the repository variable `WORKSPACE_NPM_PUBLISH_ENABLED=true` and
revalidates both workspace manifests as non-private immediately before publishing.

Until then, install all three downloaded candidate tarballs together when testing the package boundary:

```sh
npm install drizzle-orm ai-gateway-provider ./rdlabo-workers-mysql-*.tgz ./rdlabo-workers-timezone-*.tgz ./rdlabo-workers-hono-kit-*.tgz
```

## Maintainers

- [rdlabo](https://rdlabo.dev/)

## License

[MIT](./LICENSE) © rdlabo-dev

<!-- /rdlabo-docs-omit -->
