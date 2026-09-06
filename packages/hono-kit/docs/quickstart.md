---
title: Try a Hono API locally
---

Give a Hono API consistent HTTP behavior: a health response with a weak ETag and a predictable JSON response for missing routes. You will see both without opening a port or creating a Cloudflare account.

## 1. Create a small project

Use Node.js 24 and npm for this exercise. The commands pin the documented kit release. npm installs its required peers; package managers configured to omit peers must follow the [installation requirements](../README.md).

```sh
mkdir hono-kit-demo
cd hono-kit-demo
npm init -y
npm pkg set type=module
npm install @rdlabo/workers-hono-kit@0.12.2 hono@4
npm install --save-dev tsx@4
```

## 2. Send two requests

Save this as `demo.ts`. `app.request()` exercises the Hono app in the current process.

```ts
import { Hono } from 'hono';
import { createAppErrorHandler, finalizeResponse, notFoundHandler } from '@rdlabo/workers-hono-kit';

const app = new Hono();
app.use('*', finalizeResponse());
app.onError(createAppErrorHandler());
app.notFound(notFoundHandler);
app.get('/health', (c) => c.json({ ok: true }));

const healthy = await app.request('/health');
console.log(healthy.status, await healthy.text());
console.log('weak etag:', healthy.headers.get('etag')?.startsWith('W/'));

const missing = await app.request('/missing');
console.log(missing.status, await missing.text());
```

```sh
npx tsx demo.ts
```

Expected output (JSON property order does not matter):

```text
200 {"ok":true}
weak etag: true
404 {"message":"Cannot GET /missing","error":"Not Found","statusCode":404}
```

You have checked the HTTP behavior added by the kit. This exercise does not provision Workers bindings, authenticate users, or test a deployed service.

## 3. Move into your application

Keep the middleware and route registrations, remove the demonstration requests, and export `app` as your Worker handler. Continue with [HTTP and authentication](./http-auth.md). Add the [MySQL adapter](./data-layer.md) only when the application needs a database.

Existing kit users should check [the 0.12 import migration](./data-layer.md) before upgrading. The old `/db` and `/business-time` paths are compatibility exports; new integrations use the standalone packages.

## Next steps

| You need                                    | Start with                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Shared Hono HTTP, auth, or queue behavior   | `@rdlabo/workers-hono-kit`                                                                     |
| MySQL access, with or without Hono          | [Workers MySQL](https://docs.rdlabo.dev/projects/workers-mysql/docs/quickstart)                |
| Timezone conversions and checks on new code | [Workers Timezone + ESLint](https://docs.rdlabo.dev/projects/workers-timezone/docs/quickstart) |
| Code conventions during development         | [ESLint Plugin Rules](https://docs.rdlabo.dev/projects/eslint-plugin-rules/docs/quickstart)    |

The kit supplies reusable infrastructure. Your routes, domain rules, credentials, and database schema remain in your application. Adopt one helper first; you do not need to adopt every entry point.
