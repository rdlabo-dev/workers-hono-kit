# API

`@rdlabo/workers-hono-kit` exposes these entry points. This page maps each entry point to its dedicated reference page. For feature-level examples, see [HTTP and Authentication](./http-auth.md), [Data Layer](./data-layer.md), [Realtime and Offline](./realtime-offline.md), and [Testing and Operations](./testing-operations.md).

| Entry point | Description | Reference |
| --- | --- | --- |
| `@rdlabo/workers-hono-kit` | Web-standard helpers (middleware, HTTP, Firebase, AWS, AI, Stripe, KV, queues, idempotency). | [Root](./api-root.md) |
| `@rdlabo/workers-hono-kit/db` | MySQL data layer (mysql2 + Drizzle), JST column helpers, baseline migrations. | [DB](./api-db.md) |
| `@rdlabo/workers-hono-kit/business-time` | JST business calendar and date-time conversions. | [Business time](./api-business-time.md) |
| `@rdlabo/workers-hono-kit/offline` | Table-agnostic REST/DB method converters and replica wire helpers. | [Offline](./api-offline.md) |
| `@rdlabo/workers-hono-kit/realtime` | Durable Object WebSocket and retry helpers. | [Realtime and Offline](./realtime-offline.md) |
| `@rdlabo/workers-hono-kit/testing` | Drizzle-backed test DB, fakes, fixtures, and binding doubles. | [Testing](./api-testing.md) |
