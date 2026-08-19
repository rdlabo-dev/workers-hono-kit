---
title: 'API: Business Time'
---

# API: `@rdlabo/workers-hono-kit/business-time`

String-level JST business-time conversions (Workers UTC instant ↔ business calendar date / date-time), with **no `mysql2` / `drizzle-orm` dependency**. This is a different layer from the `./db` column helpers (which handle the MySQL wire format): the DB stays on JST, and the app handles JST explicitly through this module instead of relying implicitly on the connection `timezone`.

| Export | Description |
| --- | --- |
| `today(ref?)` | The JST business calendar date (`YYYY-MM-DD`) of `ref` (defaults to now). |
| `toBusinessDate(instant)` | UTC instant → JST business calendar date (`YYYY-MM-DD`). |
| `normalizeBusinessDate(value)` | Normalize a `string` / `Date` / nullish to `YYYY-MM-DD`; a `YYYY-MM-DD` string passes through unchanged, nullish/empty/invalid → `null`. |
| `toBusinessDateTime(instant)` | UTC instant → JST business date-time (`YYYY-MM-DD HH:mm:ss`). |
| `parseBusinessDateTime(value)` | JST business date-time string → UTC instant (accepts a space or `T` separator). |
| `formatBusinessDateTime(instant, pattern?)` | Format an instant in the business TZ (Nest `helper.formatDate`-compatible tokens). |
| `startOfBusinessDay(date)` / `endOfBusinessDay(date)` | UTC instant of `00:00:00` / `23:59:59` on a JST business date. |
| `businessDateTimeInstant(date, time)` | JST business date + wall-clock time → UTC instant. |
| `addBusinessDays(date, days)` | Add calendar days to a JST business date. |
| `ageOnBusinessDate(birthDate, asOfDate?)` | Full years of age on a business date (`asOfDate` defaults to `today()`). |
| `DEFAULT_BUSINESS_DATETIME_PATTERN` | Default `formatBusinessDateTime` pattern (`YYYY-MM-DDThh:mm:ss`). |
| `BUSINESS_TIMEZONE` / `BusinessDate` / `BusinessDateTime` | JST timezone constant and the business-date / date-time string types. |

```ts
import {
  toBusinessDate,
  toBusinessDateTime,
  formatBusinessDateTime,
  addBusinessDays,
} from '@rdlabo/workers-hono-kit/business-time';

const now = new Date('2026-07-05T21:00:00Z');
toBusinessDate(now); // '2026-07-06' (JST)
toBusinessDateTime(now); // '2026-07-06 06:00:00'
formatBusinessDateTime(now); // '2026-07-06T06:00:00'
addBusinessDays('2026-07-06', 3); // '2026-07-09'
```
