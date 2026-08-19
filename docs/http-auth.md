## Validation

`validate(target, schema, options?)` adapts a Zod schema to Hono and returns a NestJS `ValidationPipe`-shaped `400` response. Use `createValidate({ sentry })` to bind optional reporting once.

```ts
import { createValidate, zNumOptional } from '@rdlabo/workers-hono-kit';
import { z } from 'zod';

const validate = createValidate({ sentry });
const querySchema = z.object({ page: zNumOptional() });

app.get('/items', validate('query', querySchema), async (c) => {
  const query = c.req.valid('query');
  return c.json(await listItems(query.page));
});
```

## Authentication

`createAuthMiddleware()` reads a token header, verifies a Firebase ID token, optionally resolves the application user ID, and stores the result on the Hono context. Use `createRemoteFirebaseVerifier(projectId)` for cached remote JWKS verification or `createServiceAccountVerifier()` when Identity Toolkit `getUser` and `deleteUser` operations are required.

Keep identity, reauthentication, and feature credential failures distinct with the stable auth-failure body helpers.

## Error and routing contracts

- `createAppErrorHandler()` composes query failure classification, generic mysql2 classification, and optional reporting.
- `createHttpErrorHandler()` maps `HTTPException` to the shared JSON error body.
- `notFoundHandler()` returns `Cannot METHOD path` with a 404 status.
- `normalizeTrailingSlash()` removes trailing slashes without redirecting, preserving request bodies.
- `finalizeResponse()` adds weak ETags and handles matching `If-None-Match` requests.

Mount `createMaintenanceMiddleware()` after CORS and before container or database middleware so maintenance responses do not initialize expensive infrastructure.

## Deferred work and observability

`createWaitUntilDefer(ctx)` registers background work through `waitUntil` and logs rejected work. `perfLog()` emits per-request application latency, colo, cold/warm state, route, and status to Workers Logs and optionally Analytics Engine.
