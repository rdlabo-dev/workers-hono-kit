import { describe, expect, it } from 'vitest';
import {
  TIME_ZONES,
  addDays,
  ageOnBusinessDate,
  endOfDay,
  formatBusinessDateTime,
  getTimezoneConfig,
  initializeTimezone,
  localDateTimeToInstant,
  normalizeBusinessDate,
  parseBusinessDateTime,
  startOfDay,
  toLocalDate,
  toLocalDateTime,
} from './index.js';

describe('instant to local time', () => {
  it('supports IANA zones across the world', () => {
    const instant = new Date('2026-01-01T00:30:00Z');
    expect(toLocalDateTime(instant, TIME_ZONES.LOS_ANGELES)).toBe('2025-12-31 16:30:00');
    expect(toLocalDateTime(instant, TIME_ZONES.LONDON)).toBe('2026-01-01 00:30:00');
    expect(toLocalDateTime(instant, TIME_ZONES.KOLKATA)).toBe('2026-01-01 06:00:00');
    expect(toLocalDate(instant, TIME_ZONES.TOKYO)).toBe('2026-01-01');
  });

  it('keeps Asia/Tokyo as the migration-safe default', () => {
    expect(getTimezoneConfig()).toEqual({ timeZone: 'Asia/Tokyo' });
    expect(toLocalDateTime(new Date('2026-01-01T00:30:00Z'))).toBe('2026-01-01 09:30:00');
  });

  it('rejects invalid instants and timezone identifiers', () => {
    expect(() => toLocalDateTime(new Date('invalid'))).toThrow('Invalid instant');
    expect(() => toLocalDateTime(new Date(), 'Mars/Olympus_Mons')).toThrow(RangeError);
  });
});

describe('local time to instant', () => {
  it('applies summer and winter DST offsets', () => {
    expect(localDateTimeToInstant('2026-07-01', '09:00', TIME_ZONES.NEW_YORK).toISOString()).toBe(
      '2026-07-01T13:00:00.000Z',
    );
    expect(localDateTimeToInstant('2026-01-01', '09:00', TIME_ZONES.NEW_YORK).toISOString()).toBe(
      '2026-01-01T14:00:00.000Z',
    );
  });

  it('rejects skipped clocks and selects the earlier repeated clock', () => {
    expect(() => localDateTimeToInstant('2026-03-08', '02:30', TIME_ZONES.NEW_YORK)).toThrow(
      'Local date-time does not exist',
    );
    expect(localDateTimeToInstant('2026-11-01', '01:30', TIME_ZONES.NEW_YORK).toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('handles DST day boundaries and calendar arithmetic', () => {
    const start = startOfDay('2026-03-08', TIME_ZONES.NEW_YORK);
    const next = startOfDay('2026-03-09', TIME_ZONES.NEW_YORK);
    expect(next.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(endOfDay('2026-03-08', TIME_ZONES.NEW_YORK).toISOString()).toBe('2026-03-09T03:59:59.000Z');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('returns the actual first and final instants when midnight or the final clock is shifted', () => {
    const saoPauloStart = startOfDay('2018-11-04', 'America/Sao_Paulo');
    expect(saoPauloStart.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(toLocalDateTime(saoPauloStart, 'America/Sao_Paulo')).toBe('2018-11-04 01:00:00');
    expect(toLocalDate(new Date(saoPauloStart.getTime() - 1_000), 'America/Sao_Paulo')).toBe('2018-11-03');

    const santiagoEnd = endOfDay('2019-04-06', 'America/Santiago');
    expect(santiagoEnd.toISOString()).toBe('2019-04-07T03:59:59.000Z');
    expect(toLocalDateTime(santiagoEnd, 'America/Santiago')).toBe('2019-04-06 23:59:59');
    expect(toLocalDate(new Date(santiagoEnd.getTime() + 1_000), 'America/Santiago')).toBe('2019-04-07');
  });

  it('supports non-hour offsets, half-hour DST, +14, and skipped dates', () => {
    expect(toLocalDateTime(new Date('2026-01-01T00:00:00Z'), 'Asia/Kathmandu')).toBe('2026-01-01 05:45:00');
    expect(toLocalDateTime(new Date('2026-01-01T00:00:00Z'), 'Pacific/Kiritimati')).toBe('2026-01-01 14:00:00');
    expect(() => localDateTimeToInstant('2026-10-04', '02:15', 'Australia/Lord_Howe')).toThrow('does not exist');
    expect(() => startOfDay('2011-12-30', 'Pacific/Apia')).toThrow('does not exist');
  });

  it('rejects malformed or impossible calendar values', () => {
    expect(() => localDateTimeToInstant('2026/01/01', '09:00', 'UTC')).toThrow('Invalid BusinessDate');
    expect(() => localDateTimeToInstant('2026-02-30', '09:00', 'UTC')).toThrow('Invalid BusinessDate');
    expect(() => localDateTimeToInstant('2026-01-01', '25:00', 'UTC')).toThrow('does not exist');
    expect(() => addDays('2026-02-30', 0)).toThrow('Invalid BusinessDate');
    expect(() => addDays('2026-01-01', 1.5)).toThrow('Invalid day count');
    expect(() => addDays('2026-01-01', Number.NaN)).toThrow('Invalid day count');
    expect(addDays('0099-01-01', 1)).toBe('0099-01-02');
    expect(() => addDays('9999-12-31', 1)).toThrow('outside 0001-01-01..9999-12-31');
    expect(() => addDays('2026-01-01', Number.MAX_SAFE_INTEGER)).toThrow('outside 0001-01-01..9999-12-31');
  });
});

describe('workers-hono-kit compatibility', () => {
  it('preserves normalization, formatting, parsing, and age helpers', () => {
    expect(normalizeBusinessDate('2026-02-30')).toBeNull();
    expect(normalizeBusinessDate('2026-07-05T20:00:00Z')).toBe('2026-07-06');
    const instant = new Date('2026-01-01T00:00:00.005Z');
    expect(formatBusinessDateTime(instant, 'YYYY-MM-DDThh:mm:ss.SSS')).toBe('2026-01-01T09:00:00.005');
    expect(parseBusinessDateTime('2026-01-01 09:00:00').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(ageOnBusinessDate('2000-06-16', '2026-06-15')).toBe(25);
  });
});

describe('initializeTimezone', () => {
  it('configures the isolate once and permits only idempotent initialization', () => {
    expect(initializeTimezone({ timeZone: 'america/new_york' })).toEqual({
      timeZone: TIME_ZONES.NEW_YORK,
    });
    expect(toLocalDateTime(new Date('2026-07-01T13:00:00Z'))).toBe('2026-07-01 09:00:00');
    expect(toLocalDateTime(new Date('2026-07-01T13:00:00Z'), TIME_ZONES.LONDON)).toBe('2026-07-01 14:00:00');
    expect(initializeTimezone({ timeZone: TIME_ZONES.NEW_YORK })).toEqual({
      timeZone: TIME_ZONES.NEW_YORK,
    });
    expect(() => initializeTimezone({ timeZone: TIME_ZONES.LONDON })).toThrow(
      'Timezone is already initialized with America/New_York',
    );
  });
});
