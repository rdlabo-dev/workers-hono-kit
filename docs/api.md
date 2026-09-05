# Packages and API entry points

This repository contains the Hono kit and two standalone packages. For feature-level examples, see
[HTTP and Authentication](./http-auth.md), [Data Layer](./data-layer.md),
[Realtime and Offline](./realtime-offline.md), and [Testing and Operations](./testing-operations.md).

## Standalone packages

| Entry point                        | Description                                                                      | Reference                               |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| `@rdlabo/workers-hono-kit`         | Workers-compatible Hono and infrastructure helpers; no MySQL runtime dependency. | [Root](./api-root.md)                   |
| `@rdlabo/workers-mysql`            | Canonical Workers MySQL and Hyperdrive data layer.                               | [DB](./api-db.md)                       |
| `@rdlabo/workers-mysql/drizzle`    | Optional Drizzle configuration and JST columns.                                  | [DB](./api-db.md)                       |
| `@rdlabo/workers-mysql/migrations` | Node.js migration and brownfield baseline helpers.                               | [DB](./api-db.md)                       |
| `@rdlabo/workers-mysql/testing`    | Local MySQL/Drizzle test database and fakes.                                     | [Testing](./api-testing.md)             |
| `@rdlabo/workers-timezone`         | Canonical IANA calendar and date-time conversions.                               | [Business time](./api-business-time.md) |

## Hono kit subpaths

| Entry point                              | Description                                                              | Reference                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `@rdlabo/workers-hono-kit/mysql`         | Hono container adapter for the MySQL package.                            | [DB](./api-db.md)                             |
| `@rdlabo/workers-hono-kit/db`            | Deprecated compatibility re-export of the MySQL package.                 | [DB](./api-db.md)                             |
| `@rdlabo/workers-hono-kit/business-time` | Deprecated compatibility re-export; requires `@rdlabo/workers-timezone`. | [Business time](./api-business-time.md)       |
| `@rdlabo/workers-hono-kit/offline`       | Table-agnostic REST/DB method converters and replica wire helpers.       | [Offline](./api-offline.md)                   |
| `@rdlabo/workers-hono-kit/realtime`      | Durable Object WebSocket and retry helpers.                              | [Realtime and Offline](./realtime-offline.md) |
| `@rdlabo/workers-hono-kit/testing`       | Drizzle-backed test DB, fakes, fixtures, and binding doubles.            | [Testing](./api-testing.md)                   |
