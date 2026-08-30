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

- [HTTP and Authentication](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/http-auth)
- [Data Layer](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/data-layer)
- [Realtime and Offline](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/realtime-offline)
- [Testing and Operations](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/testing-operations)
- [API Reference](https://docs.rdlabo.dev/projects/workers-hono-kit/docs/api)

<!-- rdlabo-docs-omit -->
**Full documentation:** [https://docs.rdlabo.dev/projects/workers-hono-kit](https://docs.rdlabo.dev/projects/workers-hono-kit)

## Prerelease channels

An open, non-draft pull request can be published to the npm `beta` dist-tag after its `Validation` and `Package Candidate` workflows pass. A repository owner or maintainer must add a comment whose entire body is:

```text
/beta
```

The request authorizes only the pull request head SHA that existed when the comment was added. The workflow revalidates the owner or maintainer permission and head SHA immediately before publishing. Any new commit requires CI to pass again and a fresh owner or maintainer `/beta` comment. Fork pull requests are supported. Pull requests that change a release-gating workflow cannot be beta-published until those workflow changes land on `main`.

Beta versions use `<base>-beta.pr<PR number>.sha<12-character SHA>`. The candidate is built in a read-only workflow without npm publishing credentials. The privileged release workflow publishes only the validated immutable package artifact with lifecycle scripts disabled. A notification failure cannot invalidate a successful npm publish.

When a pull request is merged into `main`, it is automatically published to `beta` only after the required CI and `Package Candidate` succeed for that exact merge commit. Direct pushes to `main` do not publish a candidate.

Only `npm run release` creates a release tag. Stable `vX.Y.Z` tags publish to npm `latest`; revision/prerelease tags publish to `next`. Neither `beta` nor `next` publishing changes the npm `latest` dist-tag.

## Maintainers

- [rdlabo](https://rdlabo.dev/)

## License

[MIT](./LICENSE) © rdlabo-dev
<!-- /rdlabo-docs-omit -->
