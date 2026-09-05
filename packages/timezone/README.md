# @rdlabo/workers-timezone

Timezone-aware calendar and wall-clock utilities for Cloudflare Workers. Workers execute with UTC
instants; this package lets an application select an IANA timezone once per isolate and handles DST
when converting between instants and local dates.

No Hono, database, or Node.js compatibility dependency is required.

## Install

```sh
npm install @rdlabo/workers-timezone
```

## Usage

```ts
import { TIME_ZONES, initializeTimezone, localDateTimeToInstant, toLocalDateTime } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: TIME_ZONES.NEW_YORK });

toLocalDateTime(new Date('2026-07-01T13:00:00Z'));
// '2026-07-01 09:00:00'

localDateTimeToInstant('2026-07-01', '09:00:00');
// 2026-07-01T13:00:00.000Z
```

Initialize once during module evaluation, never per request or tenant. The uninitialized default
is `Asia/Tokyo`; pass an explicit timezone to conversions for user-specific behavior.

## Documentation

- [Timezones and calendar dates](docs/timezones.md) — configuration, DST, and database boundaries.
- [API](docs/api.md) — conversions, calendar operations, types, and compatibility names.
- [Migration](docs/migration.md) — moving from the kit and behavior changes.

These guides describe this source revision. Use the matching release tag for an installed version.

<!-- rdlabo-docs-omit -->

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT

<!-- /rdlabo-docs-omit -->
