# AGENTS.md — @rdlabo/workers-hono-kit

## What this package is

Shared infrastructure toolkit for Hono + Cloudflare Workers APIs. Published to npm as `@rdlabo/workers-hono-kit`. All rdlabo/proschool/odss Hono services import from this package rather than duplicating infrastructure code.

## Entry points

| Subpath | Import path | Scope |
|---------|-------------|-------|
| `.` | `@rdlabo/workers-hono-kit` | Workers-compatible middleware and infrastructure, including the mysql2-backed container runtime |
| `./db` | `@rdlabo/workers-hono-kit/db` | MySQL data layer (requires `mysql2` + `drizzle-orm` peers) |
| `./business-time` | `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility re-export (requires the optional `@rdlabo/workers-timezone` peer) |
| `./offline` | `@rdlabo/workers-hono-kit/offline` | テーブル非依存のREST/DB method converter・replica wire・clock helpers |
| `./testing` | `@rdlabo/workers-hono-kit/testing` | Test helpers (requires `mysql2` + `drizzle-orm` peers) |

The repository is an npm workspace. `packages/timezone` is the canonical implementation published
as `@rdlabo/workers-timezone`; the legacy `./business-time` subpath must remain a thin re-export.

The root entry point must remain compatible with `workerd`. It requires the `mysql2` and
`ai-gateway-provider` peers because it statically exports the Hyperdrive container lifecycle and AI
Gateway factory; `drizzle-orm` remains confined to the `./db` and `./testing` subpaths.

## Consuming projects

This package is used by the `hono/` directory of these projects:

- `winecode` — full usage (auth, validation, errors, DB, KVCache, Stripe, AWS, Firebase, AI Gateway, testing)
- `receptray` — full usage (auth, validation, errors, DB, Stripe, AWS, Firebase, testing)
- `proschool-team/airlec2` — full usage (auth, validation, errors, DB, Stripe, AWS, CloudFront, Firebase, testing)
- `odss-team/odss-mobile` — DB, auth, validation, errors
- `tipsys` — adoption in progress
- `foodlabel` — adoption in progress

## Typical file layout in consuming projects

```
hono/
  src/
    app.ts          → finalizeResponse(), createAppErrorHandler(), notFoundHandler()
    worker.ts       → createServiceAccountVerifier(), withMysqlConnections()
    container.ts    → KVCache, isProductionEnv()
    middleware/
      auth.ts       → createAuthMiddleware()
      validation.ts → createSentryValidate()
    db/
      database.ts   → DRIZZLE_ORM_OPTIONS, hyperdriveConnectionOptions(), insertIdOf() etc.
    utils/
      firebase.ts   → createRemoteFirebaseVerifier()
      stripe.ts     → createStripeClient(), verifyStripeWebhook()
      secrets-manager.ts → getAuthenticationSecret()
    api/
      *.ts          → zNum, zNumOptional, zNumWithDefault (route params/query)
  testing/
    fakes.ts        → configurableFake(), FakeFirebaseVerifier, createNoopDatabase()
    db.ts           → createTestDb()
  drizzle.config.ts → honoDrizzleConfig()
```

## Development commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build       # tsc -p tsconfig.build.json → dist/
```

## Design principles

- **Configuration-injected, not opinionated**: the kit provides building blocks that accept configuration (verifier instances, Drizzle instances, Sentry clients) rather than hard-coding policy. Domain logic, database schemas, and application-specific behavior belong in the consuming project.
- **Workers-compatible root**: the root export runs on `workerd` and statically exports the mysql2-backed `createContainerRuntime` and `createAiGatewayProvider`; therefore `mysql2` and `ai-gateway-provider` are required peers. Only `drizzle-orm` is confined to the `./db` and `./testing` subpaths.
- **NestJS parity (error/validation bodies only)**: error handlers and validation responses still match NestJS byte-for-byte so existing API consumers see no change (their `message` shape is depended on by the fleet frontends). Parity is *not* maintained for ETag (`finalizeResponse` now uses `hono/etag`, not the Express `etag` format) or `HttpStatus` (standard IANA codes, NestJS-only members dropped).
- **No ORM type identity coupling**: the `./db` subpath never depends on drizzle-orm's type identity — the ORM instance is always supplied by the consumer.

## When modifying this package

1. Run `npm run typecheck && npm run lint && npm test` before committing.
2. New exports must be added to `src/index.ts`, `src/db/index.ts`, or `src/testing/index.ts` with JSDoc.
3. Every public function and type must have a JSDoc comment.
4. When adding a new feature, add tests in the same directory with `.spec.ts` extension.
5. If a new peer dependency is introduced, add it to `peerDependencies` (and `peerDependenciesMeta` if optional) in `package.json`.
