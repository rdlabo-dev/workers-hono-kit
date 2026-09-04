/**
 * JST wire conversion and DATE-column normalization for MySQL / Drizzle.
 *
 * @remarks
 * This module owns the MySQL fixed `+09:00` contract independently of any business-time
 * package, plus the DATE column's `toDriver` and the column `customType` params.
 */

/** Default mysql2 connection `timezone` (for the existing JST DB deployment). */
export const MYSQL_TIMEZONE = '+09:00';

const JST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const pad2 = (value: number): string => String(value).padStart(2, '0');

function fixedJstDate(instant: Date): string {
  const wallClock = new Date(instant.getTime() + JST_OFFSET_MILLISECONDS);
  return `${String(wallClock.getUTCFullYear()).padStart(4, '0')}-${pad2(wallClock.getUTCMonth() + 1)}-${pad2(wallClock.getUTCDate())}`;
}

/**
 * Normalize a client input to `YYYY-MM-DD` (a JST business calendar date) for a MySQL `DATE` column.
 * Accepts ISO 8601 / `YYYY-MM-DD` / empty strings. A `YYYY-MM-DD` value is passed through without
 * constructing a `Date`.
 *
 * @param value - the string or nullish input to normalize.
 * @returns the business date as `YYYY-MM-DD`, or `null` when the input cannot be resolved.
 */
export function toJstDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const instant = new Date(trimmed);
  return Number.isNaN(instant.getTime()) ? null : fixedJstDate(instant);
}

/**
 * Build the params for a `customType` backing a MySQL `timestamp` column with `Date` pass-through.
 *
 * @param fsp - optional fractional-seconds precision; when provided, emits `timestamp(fsp)`.
 */
export const jstTimestampParams = (fsp?: number): { dataType: () => string } => ({
  dataType: () => (fsp != null ? `timestamp(${fsp})` : 'timestamp'),
});

/**
 * Build the params for a `customType` backing a MySQL `datetime` column with `Date` pass-through.
 *
 * @param fsp - optional fractional-seconds precision; when provided, emits `datetime(fsp)`.
 */
export const jstDatetimeParams = (fsp?: number): { dataType: () => string } => ({
  dataType: () => (fsp != null ? `datetime(${fsp})` : 'datetime'),
});

/**
 * Build the params for a `customType` backing a MySQL `date` column with JST normalization.
 *
 * @returns params with `toDriver` running {@link toJstDate}.
 */
export const jstDateParams = (): {
  dataType: () => string;
  toDriver: (value: string | null) => string | null;
} => ({
  dataType: () => 'date',
  toDriver: (value: string | null) => toJstDate(value),
});
