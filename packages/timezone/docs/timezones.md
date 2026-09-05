---
title: Timezones and calendar dates
---

# Timezones and calendar dates

A JavaScript `Date` represents an instant. A `BusinessDate` is a calendar string such as
`2026-07-01`; a `BusinessDateTime` is a local wall clock such as `2026-07-01 09:00:00`.
Neither string carries a timezone. Use an explicit IANA timezone when converting back to an instant.

## Configuration

`initializeTimezone({ timeZone })` sets the default for one module instance. Repeating the same
canonical timezone is safe; switching to another throws. Configure it at module evaluation using
deployment-wide static settings. Without initialization the default is `Asia/Tokyo`.

For request-, tenant-, or user-specific settings, pass a timezone without mutating the default:

```ts
import { toLocalDateTime, localDateTimeToInstant } from '@rdlabo/workers-timezone';

const wallClock = toLocalDateTime(new Date('2026-07-01T13:00:00Z'), 'America/New_York');
// '2026-07-01 09:00:00'
const instant = localDateTimeToInstant('2026-07-01', '09:00:00', 'America/New_York');
// 2026-07-01T13:00:00.000Z
```

`TIME_ZONES` provides common values for autocomplete, not an exhaustive allowlist. Other IANA IDs
supported by the Workers `Intl` runtime are accepted and validated at runtime.

## Daylight-saving transitions

- A duplicated wall clock selects the earlier instant.
- A skipped wall clock throws `RangeError`.
- `startOfDay` and `endOfDay` return the first and final representable whole seconds, including
  days with skipped midnight or a repeated final wall clock. A fully skipped date throws.
- `addDays` changes the calendar date, not an instant by a fixed number of milliseconds. A local
  day is not necessarily 24 hours. `endOfDay` is not a millisecond-precision inclusive upper bound.

Invalid calendar construction throws rather than accepting JavaScript date rollover.
`normalizeBusinessDate` returns `null` for invalid date-only inputs.

## Database boundary

This package does not configure MySQL. `@rdlabo/workers-mysql` has independent fixed `+09:00`
wire helpers; changing the business timezone here does not change those helpers, mysql2 options,
or the MySQL session timezone. Keep instant storage and user-facing calendar conversion separate.

See [API](./api.md) and [Migration](./migration.md).
