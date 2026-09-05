# @rdlabo/workers-timezone

Timezone-aware calendar and wall-clock utilities for Cloudflare Workers. Workers execute with UTC
instants; this package lets an application select an IANA timezone once per isolate and handles DST
when converting between instants and local dates.

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

`initializeTimezone` is idempotent for the same timezone and rejects attempts to switch the same
module instance to another timezone. Call it during module evaluation with deployment-wide static
configuration—not with request-, tenant-, or user-specific data. Every conversion function also
accepts an explicit timezone override without changing the configured default. For compatibility
with `@rdlabo/workers-hono-kit/business-time`, the uninitialized default is `Asia/Tokyo`.

At a DST overlap, conversion selects the earlier occurrence. Local wall clocks skipped by a DST
transition are rejected with `RangeError`. `startOfDay` and `endOfDay` are boundary operations: they
return the first and final representable whole seconds of the local calendar day, including days
whose midnight is skipped or whose final wall clock is repeated. A fully skipped calendar date is
rejected with `RangeError`.

`TIME_ZONES` is a typed constant containing common choices for editor autocomplete. Any IANA ID
supported by the Workers `Intl` runtime can also be supplied as a string and is validated at runtime.

The package also exports the existing `workers-hono-kit/business-time` function names as
compatibility aliases, including `toBusinessDateTime`, `businessDateTimeInstant`, `today`,
`normalizeBusinessDate`, `formatBusinessDateTime`, and `ageOnBusinessDate`.

Compatibility covers API names and keeps `Asia/Tokyo` as the default. Results now follow IANA
historical offsets instead of the legacy fixed `+09:00`, so historical dates can change when
Tokyo's offset was not `+09:00`. Invalid calendar values are also handled strictly:
`normalizeBusinessDate` returns `null`, and date-time construction or parsing throws `RangeError`
rather than accepting JavaScript `Date` rollover. Treat both behavior changes as breaking during
migration.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
