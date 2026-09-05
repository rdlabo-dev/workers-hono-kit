# AGENTS.md — @rdlabo/workers-hono-kit

## What this package is

Shared infrastructure toolkit for Hono + Cloudflare Workers APIs. Published to npm as `@rdlabo/workers-hono-kit`. All rdlabo/proschool/odss Hono services import from this package rather than duplicating infrastructure code.

## Entry points

| Subpath | Import path | Scope |
|---------|-------------|-------|
| `.` | `@rdlabo/workers-hono-kit` | Workers-compatible Hono middleware and infrastructure; no MySQL runtime dependency |
| `./mysql` | `@rdlabo/workers-hono-kit/mysql` | Hono container adapter for `@rdlabo/workers-mysql` |
| `./db` | `@rdlabo/workers-hono-kit/db` | Deprecated compatibility re-export of the standalone MySQL package |
| `./business-time` | `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility re-export (requires the optional `@rdlabo/workers-timezone` peer) |
| `./offline` | `@rdlabo/workers-hono-kit/offline` | テーブル非依存のREST/DB method converter・replica wire・clock helpers |
| `./testing` | `@rdlabo/workers-hono-kit/testing` | Hono/application test helpers plus deprecated DB compatibility exports |

The repository is an npm workspace. `packages/timezone` and `packages/mysql` are the canonical
standalone implementations published as `@rdlabo/workers-timezone` and `@rdlabo/workers-mysql`.
Legacy kit subpaths must remain thin compatibility re-exports.

The root entry point must remain compatible with `workerd` and must not load MySQL, Drizzle, or
Node-only migration modules. `@rdlabo/workers-mysql` owns its direct `mysql2` dependency. Drizzle is
an optional peer isolated to its `/drizzle` and `/testing` entry points.

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
    worker.ts       → createServiceAccountVerifier(), @rdlabo/workers-hono-kit/mysql
    container.ts    → KVCache, isProductionEnv()
    middleware/
      auth.ts       → createAuthMiddleware()
      validation.ts → createSentryValidate()
    db/
      database.ts   → @rdlabo/workers-mysql and @rdlabo/workers-mysql/drizzle
    utils/
      firebase.ts   → createRemoteFirebaseVerifier()
      stripe.ts     → createStripeClient(), verifyStripeWebhook()
      secrets-manager.ts → getAuthenticationSecret()
    api/
      *.ts          → zNum, zNumOptional, zNumWithDefault (route params/query)
  testing/
    fakes.ts        → configurableFake(), FakeFirebaseVerifier, createNoopDatabase()
    db.ts           → createTestDb()
  drizzle.config.ts → workersDrizzleConfig()
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
- **Workers-compatible root**: the root export does not transitively load MySQL, Drizzle, or Node-only migration code. Hono↔MySQL wiring is an explicit `/mysql` adapter.
- **Driver ownership**: `@rdlabo/workers-mysql` owns `mysql2` as a direct dependency; consumers should not have to assemble an internal driver set manually.
- **NestJS parity (error/validation bodies only)**: error handlers and validation responses still match NestJS byte-for-byte so existing API consumers see no change (their `message` shape is depended on by the fleet frontends). Parity is *not* maintained for ETag (`finalizeResponse` now uses `hono/etag`, not the Express `etag` format) or `HttpStatus` (standard IANA codes, NestJS-only members dropped).
- **No ORM type identity coupling**: the MySQL package accepts the consumer's ORM instance and keeps `drizzle-orm` as a peer.

## When modifying this package

1. Run `npm run typecheck && npm run lint && npm test` before committing.
2. Add MySQL exports to `packages/mysql`; kit `/db` and `/testing` contain compatibility exports only.
3. Every public function and type must have a JSDoc comment.
4. When adding a new feature, add tests in the same directory with `.spec.ts` extension.
5. If a new peer dependency is introduced, add it to `peerDependencies` (and `peerDependenciesMeta` if optional) in `package.json`.
