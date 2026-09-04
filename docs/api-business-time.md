# API: `@rdlabo/workers-timezone`

> This package is under development and is not published to npm yet. The API below describes the
> workspace candidate. Until publication, use the currently published
> `@rdlabo/workers-hono-kit/business-time`; candidate artifacts and installation are described in
> [Development](./development.md).

Timezone-aware calendar and wall-clock conversion for Cloudflare Workers, with no database or Node
runtime dependency. The uninitialized default remains `Asia/Tokyo` for compatibility.

```ts
import { TIME_ZONES, initializeTimezone, toLocalDateTime } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: TIME_ZONES.NEW_YORK });
toLocalDateTime(new Date('2026-07-01T13:00:00Z')); // '2026-07-01 09:00:00'
```

Initialize once during module evaluation using deployment-wide static configuration. Do not mutate
the default per request, user, or tenant. Every conversion function accepts an explicit IANA
timezone override without changing the module-instance default.

| Export                                          | Description                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `initializeTimezone(config)`                    | Set the module-instance default once; repeated identical initialization is safe. |
| `getTimezoneConfig()`                           | Return the active configuration.                                                 |
| `toLocalDate(instant, timeZone?)`               | Instant to local `YYYY-MM-DD`.                                                   |
| `toLocalDateTime(instant, timeZone?)`           | Instant to local `YYYY-MM-DD HH:mm:ss`.                                          |
| `localDateTimeToInstant(date, time, timeZone?)` | Local calendar date and wall clock to an instant.                                |
| `startOfDay` / `endOfDay`                       | First or final representable whole second of a local calendar day.               |
| `addDays(date, days)`                           | Add calendar days without assuming a 24-hour day.                                |
| `TIME_ZONES` / `TimeZone`                       | Common typed constants and the open IANA timezone type.                          |

IANA rules determine daylight-saving and historical offsets. A skipped local clock throws
`RangeError`; when a clock occurs twice during a DST overlap, the earlier instant is selected.

## Legacy compatibility

`@rdlabo/workers-hono-kit/business-time` is deprecated and re-exports the same module instance from
`@rdlabo/workers-timezone`. Existing names such as `today`, `normalizeBusinessDate`,
`toBusinessDateTime`, `businessDateTimeInstant`, `formatBusinessDateTime`, and
`ageOnBusinessDate` remain available during migration.

This is source compatibility for API names, not full output compatibility. Results now follow IANA
historical offsets instead of the legacy fixed `+09:00`, so historical dates can change when
Tokyo's offset was not `+09:00`. Impossible `YYYY-MM-DD` values now normalize to `null`; invalid
date-time construction and parsing throw `RangeError` instead of using JavaScript `Date` rollover.
Treat both behavior changes as breaking when planning the migration.

```ts
// Deprecated; migrate the import path when practical.
import { toBusinessDateTime } from '@rdlabo/workers-hono-kit/business-time';
```
