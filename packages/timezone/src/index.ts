import { BUSINESS_TIMEZONE, TIME_ZONES } from './types.js';
import type {
  BusinessDate,
  BusinessDateTime,
  BusinessTimeConfig,
  BusinessTimeZone,
  TimeZone,
  TimezoneConfig,
} from './types.js';

export {
  BUSINESS_TIMEZONE,
  TIME_ZONES,
  type BusinessDate,
  type BusinessDateTime,
  type BusinessTimeConfig,
  type BusinessTimeZone,
  type TimeZone,
  type TimezoneConfig,
};

interface DateTimeFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface OffsetPeriod {
  start: number;
  end: number;
  offset: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
let configuredTimeZone: TimeZone | undefined;

function formatter(timeZone: TimeZone): Intl.DateTimeFormat {
  const cacheKey = timeZone.toLowerCase();
  let result = formatters.get(cacheKey);
  if (!result) {
    result = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(cacheKey, result);
  }
  return result;
}

function activeTimeZone(timeZone?: TimeZone): TimeZone {
  return timeZone ?? configuredTimeZone ?? TIME_ZONES.TOKYO;
}

function utcMillis(fields: DateTimeFields): number {
  const result = new Date(0);
  result.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  result.setUTCHours(fields.hour, fields.minute, fields.second, 0);
  return result.getTime();
}

function offsetAt(epochMilliseconds: number, timeZone: TimeZone): number {
  const instant = new Date(epochMilliseconds);
  return utcMillis(fieldsAt(instant, timeZone)) - epochMilliseconds;
}

function fieldsAt(instant: Date, timeZone: TimeZone): DateTimeFields {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Invalid instant');
  }
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function sameFields(left: DateTimeFields, right: DateTimeFields): boolean {
  return Object.keys(left).every((key) => left[key as keyof DateTimeFields] === right[key as keyof DateTimeFields]);
}

function instantAt(fields: DateTimeFields, timeZone: TimeZone): Date {
  const naive = utcMillis(fields);
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const probe = new Date(naive + hours * 3_600_000);
    const local = fieldsAt(probe, timeZone);
    offsets.add(utcMillis(local) - probe.getTime());
  }
  const match = [...offsets]
    .map((offset) => new Date(naive - offset))
    .filter((candidate) => sameFields(fieldsAt(candidate, timeZone), fields))
    .sort((a, b) => a.getTime() - b.getTime())
    .at(0);
  if (!match) {
    throw new RangeError(`Local date-time does not exist in ${timeZone}`);
  }
  return match;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');
const padYear = (value: number): string => String(value).padStart(4, '0');

function parseDate(date: BusinessDate): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError(`Invalid BusinessDate: ${date}`);
  }
  const fields: DateTimeFields = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
  };
  if (!sameFields(fields, fieldsAt(new Date(utcMillis(fields)), TIME_ZONES.UTC))) {
    throw new RangeError(`Invalid BusinessDate: ${date}`);
  }
  return [fields.year, fields.month, fields.day];
}

function parseTime(time: string): [number, number, number] {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) {
    throw new RangeError(`Invalid local time: ${time}`);
  }
  const [, hour, minute, seconds = '0'] = match;
  return [Number(hour), Number(minute), Number(seconds)];
}

const HOUR_MILLISECONDS = 3_600_000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const OFFSET_PROBE_INTERVAL = 6 * HOUR_MILLISECONDS;
const BOUNDARY_WINDOW = 36 * HOUR_MILLISECONDS;

function findOffsetTransition(start: number, end: number, startOffset: number, timeZone: TimeZone): number {
  let lower = start;
  let upper = end;
  while (upper - lower > 1_000) {
    const middle = Math.floor((lower + upper) / 2_000) * 1_000;
    if (offsetAt(middle, timeZone) === startOffset) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return upper;
}

function offsetPeriodsForLocalDay(naiveStart: number, timeZone: TimeZone): OffsetPeriod[] {
  const windowStart = naiveStart - BOUNDARY_WINDOW;
  const windowEnd = naiveStart + DAY_MILLISECONDS + BOUNDARY_WINDOW;
  const periods: OffsetPeriod[] = [];
  let periodStart = windowStart;
  let cursor = windowStart;
  let currentOffset = offsetAt(cursor, timeZone);

  while (cursor < windowEnd) {
    const next = Math.min(cursor + OFFSET_PROBE_INTERVAL, windowEnd);
    const nextOffset = offsetAt(next, timeZone);
    if (nextOffset !== currentOffset) {
      const transition = findOffsetTransition(cursor, next, currentOffset, timeZone);
      periods.push({ start: periodStart, end: transition, offset: currentOffset });
      periodStart = transition;
      currentOffset = nextOffset;
    }
    cursor = next;
  }
  periods.push({ start: periodStart, end: windowEnd, offset: currentOffset });
  return periods;
}

function localDayBoundaries(date: BusinessDate, timeZone: TimeZone): { start: Date; end: Date } {
  const [year, month, day] = parseDate(date);
  const naiveStart = utcMillis({ year, month, day, hour: 0, minute: 0, second: 0 });
  const naiveEnd = naiveStart + DAY_MILLISECONDS;
  let first = Number.POSITIVE_INFINITY;
  let endExclusive = Number.NEGATIVE_INFINITY;

  for (const period of offsetPeriodsForLocalDay(naiveStart, timeZone)) {
    const overlapStart = Math.max(period.start, naiveStart - period.offset);
    const overlapEnd = Math.min(period.end, naiveEnd - period.offset);
    if (overlapStart < overlapEnd) {
      first = Math.min(first, overlapStart);
      endExclusive = Math.max(endExclusive, overlapEnd);
    }
  }

  if (!Number.isFinite(first) || !Number.isFinite(endExclusive)) {
    throw new RangeError(`Local date does not exist in ${timeZone}`);
  }
  return { start: new Date(first), end: new Date(endExclusive - 1_000) };
}

/** Set the default timezone once for the lifetime of this module instance. */
export function initializeTimezone(config: TimezoneConfig): Readonly<TimezoneConfig> {
  const canonicalTimeZone = formatter(config.timeZone).resolvedOptions().timeZone;
  if (configuredTimeZone && configuredTimeZone !== canonicalTimeZone) {
    throw new Error(`Timezone is already initialized with ${configuredTimeZone}`);
  }
  configuredTimeZone = canonicalTimeZone;
  return Object.freeze({ timeZone: configuredTimeZone });
}

/** Return this module instance's active timezone configuration. */
export function getTimezoneConfig(): Readonly<TimezoneConfig> {
  return Object.freeze({ timeZone: activeTimeZone() });
}

/** Return an instant as a calendar date in the selected timezone. */
export function toLocalDate(instant: Date, timeZone?: TimeZone): BusinessDate {
  const fields = fieldsAt(instant, activeTimeZone(timeZone));
  return `${padYear(fields.year)}-${pad2(fields.month)}-${pad2(fields.day)}`;
}

/** Return an instant as `YYYY-MM-DD HH:mm:ss` in the selected timezone. */
export function toLocalDateTime(instant: Date, timeZone?: TimeZone): BusinessDateTime {
  const fields = fieldsAt(instant, activeTimeZone(timeZone));
  return `${padYear(fields.year)}-${pad2(fields.month)}-${pad2(fields.day)} ${pad2(fields.hour)}:${pad2(fields.minute)}:${pad2(fields.second)}`;
}

/** Resolve a timezone-local calendar date and wall-clock time to a UTC instant. */
export function localDateTimeToInstant(date: BusinessDate, time: string, timeZone?: TimeZone): Date {
  const [year, month, day] = parseDate(date);
  const [hour, minute, second] = parseTime(time);
  return instantAt({ year, month, day, hour, minute, second }, activeTimeZone(timeZone));
}

/** Return the instant at the start of a timezone-local calendar day. */
export function startOfDay(date: BusinessDate, timeZone?: TimeZone): Date {
  return localDayBoundaries(date, activeTimeZone(timeZone)).start;
}

/** Return the instant at the final whole second of a timezone-local calendar day. */
export function endOfDay(date: BusinessDate, timeZone?: TimeZone): Date {
  return localDayBoundaries(date, activeTimeZone(timeZone)).end;
}

/** Add calendar days without assuming that every local day contains 24 hours. */
export function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new RangeError(`Invalid day count: ${days}`);
  }
  const [year, month, day] = parseDate(date);
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day + days);
  result.setUTCHours(0, 0, 0, 0);
  const resultYear = result.getUTCFullYear();
  if (!Number.isFinite(result.getTime()) || resultYear < 1 || resultYear > 9999) {
    throw new RangeError('Calendar result is outside 0001-01-01..9999-12-31');
  }
  return `${padYear(resultYear)}-${pad2(result.getUTCMonth() + 1)}-${pad2(result.getUTCDate())}`;
}

/** Compatibility alias for `toLocalDate`. */
export const toBusinessDate = toLocalDate;
/** Compatibility alias for `toLocalDateTime`. */
export const toBusinessDateTime = toLocalDateTime;
/** Compatibility alias for `localDateTimeToInstant`. */
export const businessDateTimeInstant = localDateTimeToInstant;
/** Compatibility alias for `startOfDay`. */
export const startOfBusinessDay = startOfDay;
/** Compatibility alias for `endOfDay`. */
export const endOfBusinessDay = endOfDay;
/** Compatibility alias for `addDays`. */
export const addBusinessDays = addDays;

/** Return today's calendar date in the active or explicitly selected timezone. */
export function today(reference: Date = new Date(), timeZone?: TimeZone): BusinessDate {
  return toLocalDate(reference, timeZone);
}

/** Normalize a date-only value or instant-like input to a timezone-local calendar date. */
export function normalizeBusinessDate(
  value: string | Date | null | undefined,
  timeZone?: TimeZone,
): BusinessDate | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toLocalDate(value, timeZone);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    try {
      parseDate(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }
  const instant = new Date(trimmed);
  return Number.isNaN(instant.getTime()) ? null : toLocalDate(instant, timeZone);
}

/** Default token pattern used by `formatBusinessDateTime`. */
export const DEFAULT_BUSINESS_DATETIME_PATTERN = 'YYYY-MM-DDThh:mm:ss' as const;

/** Format an instant with `YYYY`, `MM`, `DD`, `hh`, `mm`, `ss`, and `S` tokens. */
export function formatBusinessDateTime(
  instant: Date,
  pattern: string = DEFAULT_BUSINESS_DATETIME_PATTERN,
  timeZone?: TimeZone,
): string {
  const [date, time] = toLocalDateTime(instant, timeZone).split(' ');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split(':');
  let output = pattern
    .replace(/YYYY/g, year)
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/hh/g, hour)
    .replace(/mm/g, minute)
    .replace(/ss/g, second);
  const milliseconds = String(instant.getUTCMilliseconds()).padStart(3, '0');
  let index = 0;
  output = output.replace(/S/g, () => milliseconds[index++] ?? '');
  return output;
}

/** Parse a timezone-local `YYYY-MM-DD HH:mm:ss` value into a UTC instant. */
export function parseBusinessDateTime(value: BusinessDateTime, timeZone?: TimeZone): Date {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid BusinessDateTime: ${value}`);
  }
  return localDateTimeToInstant(match[1], match[2], timeZone);
}

/** Calculate completed years of age on a calendar date. */
export function ageOnBusinessDate(birthDate: BusinessDate, asOfDate: BusinessDate = today()): number {
  const [birthYear, birthMonth, birthDay] = parseDate(birthDate);
  const [year, month, day] = parseDate(asOfDate);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

/** Compatibility alias for `TIME_ZONES`. */
export const BUSINESS_TIME_ZONES = TIME_ZONES;
/** Compatibility alias for `initializeTimezone`. */
export const initializeBusinessTime = initializeTimezone;
/** Compatibility alias for `getTimezoneConfig`. */
export const getBusinessTimeConfig = getTimezoneConfig;
