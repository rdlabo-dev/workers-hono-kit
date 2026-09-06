# workers-hono-kit

Public monorepo that publishes Cloudflare Workers infrastructure as independent npm packages.
Choose the layer you need; nothing here forces a single application stack.

| Layer           | Package                                                                                                  | Use when                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Hono API        | [`@rdlabo/workers-hono-kit`](https://docs.rdlabo.dev/projects/workers-hono-kit)                          | Shared Hono middleware for auth, validation, errors, queues, realtime, offline, and test helpers |
| MySQL           | [`@rdlabo/workers-mysql`](https://docs.rdlabo.dev/projects/workers-mysql/docs/readme)                    | Hyperdrive / MySQL runtime, optional Drizzle, and Node tooling without requiring Hono            |
| Timezone        | [`@rdlabo/workers-timezone`](https://docs.rdlabo.dev/projects/workers-timezone/docs/readme)              | IANA calendar and wall-clock conversion without Hono or MySQL                                    |
| Optional ESLint | [`@rdlabo/eslint-plugin-rules`](https://docs.rdlabo.dev/projects/eslint-plugin-rules/docs/configuration) | Companion `workers-timezone/recommended` policy for timezone-safe `Date` / `Intl` usage          |

The workspace root npm package (`workers-hono-kit`) is private and is not published to the registry.

## Public packages

| Package                                           | Path                | Description                                                       |
| ------------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| [`@rdlabo/workers-timezone`](./packages/timezone) | `packages/timezone` | IANA timezone and calendar utilities for Cloudflare Workers       |
| [`@rdlabo/workers-mysql`](./packages/mysql)       | `packages/mysql`    | MySQL / Hyperdrive utilities for Cloudflare Workers               |
| [`@rdlabo/workers-hono-kit`](./packages/hono-kit) | `packages/hono-kit` | Hono middleware and infrastructure toolkit for Cloudflare Workers |

MySQL storage helpers use a fixed `+09:00` wire contract. Display and business calendars use IANA
timezones from `@rdlabo/workers-timezone`; the two contracts are independent.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

See each package README for install and API details. Maintainer release procedures live in
[`packages/hono-kit/docs/development.md`](./packages/hono-kit/docs/development.md).

## License

[MIT](./LICENSE) © rdlabo-dev
