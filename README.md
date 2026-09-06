# workers-hono-kit

Private npm workspace that publishes the public OSS packages under `packages/`.

Everything under `packages/` is public open-source software.

## Public packages

| Package | Path | Description |
| --- | --- | --- |
| [`@rdlabo/workers-timezone`](./packages/timezone) | `packages/timezone` | IANA timezone and business-time utilities for Cloudflare Workers |
| [`@rdlabo/workers-mysql`](./packages/mysql) | `packages/mysql` | MySQL / Hyperdrive utilities for Cloudflare Workers |
| [`@rdlabo/workers-hono-kit`](./packages/hono-kit) | `packages/hono-kit` | Hono middleware and infrastructure toolkit for Cloudflare Workers |

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

See each package README for install and API details. Release and candidate publication notes live in
[`packages/hono-kit/docs/development.md`](./packages/hono-kit/docs/development.md).

## License

[MIT](./LICENSE) © rdlabo-dev
