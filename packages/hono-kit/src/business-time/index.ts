/**
 * Compatibility re-export of `@rdlabo/workers-timezone`. Prefer importing the standalone package
 * directly. Symbol-level `@deprecated` tags mark each promoted export. Historical offsets and
 * invalid calendar or wall-clock inputs follow the migration behavior documented in
 * `docs/api-business-time.md`.
 *
 * @packageDocumentation
 */

import {
  BUSINESS_TIMEZONE as businessTimezoneCanonical,
  BUSINESS_TIME_ZONES as businessTimeZonesCanonical,
  DEFAULT_BUSINESS_DATETIME_PATTERN as defaultBusinessDatetimePatternCanonical,
  TIME_ZONES as timeZonesCanonical,
  addBusinessDays as addBusinessDaysCanonical,
  addDays as addDaysCanonical,
  ageOnBusinessDate as ageOnBusinessDateCanonical,
  businessDateTimeInstant as businessDateTimeInstantCanonical,
  endOfBusinessDay as endOfBusinessDayCanonical,
  endOfDay as endOfDayCanonical,
  formatBusinessDateTime as formatBusinessDateTimeCanonical,
  getBusinessTimeConfig as getBusinessTimeConfigCanonical,
  getTimezoneConfig as getTimezoneConfigCanonical,
  initializeBusinessTime as initializeBusinessTimeCanonical,
  initializeTimezone as initializeTimezoneCanonical,
  localDateTimeToInstant as localDateTimeToInstantCanonical,
  normalizeBusinessDate as normalizeBusinessDateCanonical,
  parseBusinessDateTime as parseBusinessDateTimeCanonical,
  startOfBusinessDay as startOfBusinessDayCanonical,
  startOfDay as startOfDayCanonical,
  toBusinessDate as toBusinessDateCanonical,
  toBusinessDateTime as toBusinessDateTimeCanonical,
  toLocalDate as toLocalDateCanonical,
  toLocalDateTime as toLocalDateTimeCanonical,
  today as todayCanonical,
} from '@rdlabo/workers-timezone';
import type {
  BusinessDate as BusinessDateCanonical,
  BusinessDateTime as BusinessDateTimeCanonical,
  BusinessTimeConfig as BusinessTimeConfigCanonical,
  BusinessTimeZone as BusinessTimeZoneCanonical,
  TimeZone as TimeZoneCanonical,
  TimezoneConfig as TimezoneConfigCanonical,
} from '@rdlabo/workers-timezone';

/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const TIME_ZONES: typeof timeZonesCanonical = timeZonesCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const BUSINESS_TIMEZONE: typeof businessTimezoneCanonical = businessTimezoneCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const BUSINESS_TIME_ZONES: typeof businessTimeZonesCanonical = businessTimeZonesCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const DEFAULT_BUSINESS_DATETIME_PATTERN: typeof defaultBusinessDatetimePatternCanonical =
  defaultBusinessDatetimePatternCanonical;

/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const initializeTimezone: typeof initializeTimezoneCanonical = initializeTimezoneCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const getTimezoneConfig: typeof getTimezoneConfigCanonical = getTimezoneConfigCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const toLocalDate: typeof toLocalDateCanonical = toLocalDateCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const toLocalDateTime: typeof toLocalDateTimeCanonical = toLocalDateTimeCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const localDateTimeToInstant: typeof localDateTimeToInstantCanonical = localDateTimeToInstantCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const startOfDay: typeof startOfDayCanonical = startOfDayCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const endOfDay: typeof endOfDayCanonical = endOfDayCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const addDays: typeof addDaysCanonical = addDaysCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const toBusinessDate: typeof toBusinessDateCanonical = toBusinessDateCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const toBusinessDateTime: typeof toBusinessDateTimeCanonical = toBusinessDateTimeCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const businessDateTimeInstant: typeof businessDateTimeInstantCanonical = businessDateTimeInstantCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const startOfBusinessDay: typeof startOfBusinessDayCanonical = startOfBusinessDayCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const endOfBusinessDay: typeof endOfBusinessDayCanonical = endOfBusinessDayCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const addBusinessDays: typeof addBusinessDaysCanonical = addBusinessDaysCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const today: typeof todayCanonical = todayCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const normalizeBusinessDate: typeof normalizeBusinessDateCanonical = normalizeBusinessDateCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const formatBusinessDateTime: typeof formatBusinessDateTimeCanonical = formatBusinessDateTimeCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const parseBusinessDateTime: typeof parseBusinessDateTimeCanonical = parseBusinessDateTimeCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const ageOnBusinessDate: typeof ageOnBusinessDateCanonical = ageOnBusinessDateCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const initializeBusinessTime: typeof initializeBusinessTimeCanonical = initializeBusinessTimeCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export const getBusinessTimeConfig: typeof getBusinessTimeConfigCanonical = getBusinessTimeConfigCanonical;

/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type TimeZone = TimeZoneCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type TimezoneConfig = TimezoneConfigCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type BusinessTimeZone = BusinessTimeZoneCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type BusinessTimeConfig = BusinessTimeConfigCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type BusinessDate = BusinessDateCanonical;
/** @deprecated Import from `@rdlabo/workers-timezone` instead. */
export type BusinessDateTime = BusinessDateTimeCanonical;
