## Durable Object realtime

The root and `/realtime` entry points expose the same focused realtime primitives:

- `configureHibernationAutoResponse()` configures runtime ping/pong without waking JavaScript.
- `upgradeHibernationWebSocket()` attaches state before accepting the socket.
- `broadcastHibernationWebSockets()` broadcasts through sockets restored by `getWebSockets()`.
- `acknowledgeHibernationWebSocketClose()` and `closeHibernationWebSocket()` normalize close handling.
- `retryDurableObjectOperation()` retries only errors marked `retryable` and not `overloaded`. Create a fresh stub inside the operation for every attempt.
- `invokeDurableObjectFetch()` preserves the structured response/error contract for DO calls.

WebSocket protocol parsers validate offered subprotocols before upgrade.

## Offline replica contracts

`@rdlabo/workers-hono-kit/offline` is table-agnostic. Product schemas, Zod objects, public-column allowlists, schema hashes, and domain policy stay in the application.

`defineRestDbMethodConverter()` types a pure REST method ↔ table converter. Every represented table and column is required, including nullable/default columns. Omit an auto-increment `id` from the product-owned table scheme when a create method intentionally does not own it.

Wire helpers canonicalize values:

- `toReplicaIsoDatetime()` → UTC ISO-8601
- `toReplicaDateOnly()` → `YYYY-MM-DD` or `null`
- `toTinyIntFlag()` / `fromTinyIntFlag()` → boolean/tinyint conversion
- `replicaNowIso(clock?)` → injectable current time

Journal helpers enforce cursor coverage, retention, mutation transactions, and rebaseline behavior. Wire compatibility helpers let an application accept explicit previous fingerprints while maintaining a canonical current fingerprint.
