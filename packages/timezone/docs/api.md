---
title: API
---

# API

All exports below come from `@rdlabo/workers-timezone`. `timeZone?` uses the initialized default,
or `Asia/Tokyo` before initialization. See [Timezones](./timezones.md) for error and DST behavior.

## Configuration

#### `function` initializeTimezone

`initializeTimezone(config: TimezoneConfig): Readonly<TimezoneConfig>` sets the default once.

#### `function` getTimezoneConfig

`getTimezoneConfig(): Readonly<TimezoneConfig>` returns the active configuration.

## Conversions

#### `function` toLocalDate

`toLocalDate(instant: Date, timeZone?: TimeZone): BusinessDate` returns `YYYY-MM-DD`.

#### `function` toLocalDateTime

`toLocalDateTime(instant: Date, timeZone?: TimeZone): BusinessDateTime` returns `YYYY-MM-DD HH:mm:ss`.

#### `function` localDateTimeToInstant

`localDateTimeToInstant(date: BusinessDate, time: string, timeZone?: TimeZone): Date`
resolves a local wall clock. The time accepts `H:mm` or `HH:mm`, optionally with seconds.

#### `function` startOfDay

`startOfDay(date: BusinessDate, timeZone?: TimeZone): Date` returns the first instant of the day.

#### `function` endOfDay

`endOfDay(date: BusinessDate, timeZone?: TimeZone): Date` returns its final whole second.

#### `function` addDays

`addDays(date: BusinessDate, days: number): BusinessDate` adds an integer number of calendar days.

## Additional calendar helpers

`today(reference?: Date, timeZone?: TimeZone)` returns a calendar date.
`normalizeBusinessDate(value: string | Date | null | undefined, timeZone?: TimeZone)` returns a
calendar date or `null`. Prefer ISO strings with an explicit offset for instant-like inputs.
`formatBusinessDateTime(instant, pattern?, timeZone?)` supports `YYYY`, `MM`, `DD`, `hh`, `mm`,
`ss`, and `S` tokens; `DEFAULT_BUSINESS_DATETIME_PATTERN` is `YYYY-MM-DDThh:mm:ss`.
`parseBusinessDateTime(value: BusinessDateTime, timeZone?: TimeZone): Date` parses a local
`YYYY-MM-DD HH:mm:ss` value (a `T` separator is also accepted).
`ageOnBusinessDate(birthDate: BusinessDate, asOfDate?: BusinessDate): number` calculates completed
years of age; the reference defaults to `today()`.

## Types and constants

`TIME_ZONES` contains common IANA IDs. `TimeZone` also accepts other supported IANA strings.
`TimezoneConfig` contains `timeZone`. `BusinessDate` and `BusinessDateTime` are string aliases,
not runtime validators. `BusinessTimeZone` and `BusinessTimeConfig` are compatibility type aliases.
`BUSINESS_TIMEZONE` is the legacy Tokyo descriptor, not the current configured timezone.

Compatibility exports: `toBusinessDate`, `toBusinessDateTime`, `businessDateTimeInstant`,
`startOfBusinessDay`, `endOfBusinessDay`, and `addBusinessDays` alias the corresponding functions above.
`BUSINESS_TIME_ZONES`, `initializeBusinessTime`, and `getBusinessTimeConfig` alias the timezone
constants and configuration functions.
