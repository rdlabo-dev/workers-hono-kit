---
title: Drizzle and dates
---

# Drizzle and dates

Install `drizzle-orm` when importing `/drizzle` or `/testing`. It is an optional peer so the
application and its schemas use the same Drizzle type identity. Keep it resolved to a single copy,
especially when using local package links. The root import does not load Drizzle.

The application owns schema definitions and creates the ORM. `DRIZZLE_ORM_OPTIONS` supplies
`casing: 'snake_case'`; `workersDrizzleConfig` applies the matching setting to Drizzle Kit configuration.
Do not change casing on an existing schema without reviewing the generated SQL.

## Connection defaults

`hyperdriveConnectionOptions` sets `disableEval: true`, `decimalNumbers: true`, and
`timezone: '+09:00'`. `createHyperdriveDatabase` accepts `connectionOptions` overrides.
Keep eval disabled for Workers. Numeric DECIMAL conversion can lose precision; use
`decimalNumbers: false` and handle strings when exact decimal values are required.

## Fixed JST is a storage contract

`MYSQL_TIMEZONE` is fixed `+09:00`, independent of `@rdlabo/workers-timezone` configuration and
IANA historical offsets. It controls mysql2's conversion of JavaScript `Date` values, not the
MySQL session `time_zone`. Server-generated `CURRENT_TIMESTAMP` values follow the session's
timezone, so verify that separately against your storage convention.

`jstTimestamp` and `jstDatetime` provide Date pass-through column types. `jstDate` normalizes
DATE inputs through `toJstDate`. These do not configure the server or make arbitrary timezone
storage automatic. Non-JST deployments should choose matching column and connection behavior
rather than assuming these helpers follow the business timezone.

`toJstDate` passes an already-shaped `YYYY-MM-DD` string through without validating the calendar
date. Validate user input separately; it is not equivalent to timezone's stricter
`normalizeBusinessDate`.

For update timestamps, `jstOnUpdateNow(fsp?)` supplies the SQL expression used with
`.$onUpdateFn(() => jstOnUpdateNow(6))`. Review both generated migrations and server timezone.

See [Runtime](./runtime.md), [Tooling](./tooling.md), and [API](./api.md).
