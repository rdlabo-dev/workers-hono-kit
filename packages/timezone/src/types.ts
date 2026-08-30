/** Common IANA timezone identifiers with editor autocomplete. */
export const TIME_ZONES = {
  UTC: 'UTC',
  TOKYO: 'Asia/Tokyo',
  SEOUL: 'Asia/Seoul',
  SHANGHAI: 'Asia/Shanghai',
  HONG_KONG: 'Asia/Hong_Kong',
  SINGAPORE: 'Asia/Singapore',
  KOLKATA: 'Asia/Kolkata',
  DUBAI: 'Asia/Dubai',
  LONDON: 'Europe/London',
  PARIS: 'Europe/Paris',
  BERLIN: 'Europe/Berlin',
  NEW_YORK: 'America/New_York',
  CHICAGO: 'America/Chicago',
  DENVER: 'America/Denver',
  LOS_ANGELES: 'America/Los_Angeles',
  SAO_PAULO: 'America/Sao_Paulo',
  SYDNEY: 'Australia/Sydney',
  AUCKLAND: 'Pacific/Auckland',
} as const;

/** Legacy default timezone descriptor retained for workers-hono-kit compatibility. */
export const BUSINESS_TIMEZONE = {
  iana: TIME_ZONES.TOKYO,
  offsetMinutes: 540,
} as const;

/** An IANA timezone supported by the Workers `Intl` runtime. */
export type TimeZone = (typeof TIME_ZONES)[keyof typeof TIME_ZONES] | (string & { readonly __timeZone?: never });

/** Isolate-wide default timezone configuration. */
export interface TimezoneConfig {
  /** IANA timezone identifier, for example `America/New_York`. */
  timeZone: TimeZone;
}

/** Compatibility name for `TimeZone`. */
export type BusinessTimeZone = TimeZone;

/** Compatibility name for `TimezoneConfig`. */
export type BusinessTimeConfig = TimezoneConfig;

/** A calendar date in `YYYY-MM-DD` form. */
export type BusinessDate = string;

/** A timezone-local wall clock in MySQL-compatible `YYYY-MM-DD HH:mm:ss` form. */
export type BusinessDateTime = string;
