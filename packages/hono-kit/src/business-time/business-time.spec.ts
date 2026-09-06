import * as canonicalExports from '@rdlabo/workers-timezone';
import { describe, it, expect } from 'vitest';
import * as legacyExports from './index.js';
import {
  addBusinessDays,
  ageOnBusinessDate,
  businessDateTimeInstant,
  endOfBusinessDay,
  formatBusinessDateTime,
  getBusinessTimeConfig,
  initializeBusinessTime,
  normalizeBusinessDate,
  parseBusinessDateTime,
  startOfBusinessDay,
  today,
  toBusinessDate,
  toBusinessDateTime,
} from './index.js';

describe('legacy export parity', () => {
  it('canonical packageの全runtime exportを同一参照でre-exportする', () => {
    expect(Object.keys(legacyExports).sort()).toEqual(Object.keys(canonicalExports).sort());
    for (const name of Object.keys(canonicalExports)) {
      expect(legacyExports[name as keyof typeof legacyExports]).toBe(
        canonicalExports[name as keyof typeof canonicalExports],
      );
    }
  });
});

describe('normalizeBusinessDate', () => {
  it('YYYY-MM-DD 文字列は Date 化せずそのまま返す', () => {
    expect(normalizeBusinessDate('1990-07-05')).toBe('1990-07-05');
  });

  it('ISO 8601 Z は JST 暦日へ変換する', () => {
    expect(normalizeBusinessDate('1990-07-05T00:00:00Z')).toBe('1990-07-05');
    expect(normalizeBusinessDate('1990-07-05T15:00:00Z')).toBe('1990-07-06');
  });

  it('Date instant は JST 暦日へ変換する', () => {
    expect(normalizeBusinessDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('nullish / 空 / 不正は null', () => {
    expect(normalizeBusinessDate(null)).toBeNull();
    expect(normalizeBusinessDate('')).toBeNull();
    expect(normalizeBusinessDate('not-a-date')).toBeNull();
    expect(normalizeBusinessDate('2026-02-30')).toBeNull();
  });
});

describe('toBusinessDate / today', () => {
  it('UTC を JST 業務暦日に変換する', () => {
    expect(toBusinessDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('UTC 15:00 跨ぎは翌業務日', () => {
    expect(toBusinessDate(new Date('2026-06-26T15:00:00Z'))).toBe('2026-06-27');
  });

  it('today は ref の業務暦日', () => {
    expect(today(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});

describe('toBusinessDateTime / formatBusinessDateTime', () => {
  it('業務日時を MySQL 互換形式で返す', () => {
    expect(toBusinessDateTime(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01 09:00:00');
  });

  it('カスタムパターン（foodlabel 既定）', () => {
    expect(formatBusinessDateTime(new Date('2026-01-01T00:00:00Z'), 'YYYY-MM-DDThh:mm:ss')).toBe('2026-01-01T09:00:00');
  });

  it('S トークンはミリ秒を3桁で埋める', () => {
    const instant = new Date('2026-01-01T00:00:00.005Z');
    expect(formatBusinessDateTime(instant, 'YYYY-MM-DDThh:mm:ss.SSS')).toBe('2026-01-01T09:00:00.005');
  });
});

describe('businessDateTimeInstant / parseBusinessDateTime', () => {
  it('JST 6:00 → UTC instant（talk 境界）', () => {
    expect(businessDateTimeInstant('2026-06-15', '06:00:00').toISOString()).toBe('2026-06-14T21:00:00.000Z');
  });

  it('parse ↔ to が往復一致する', () => {
    const instant = new Date('2026-03-05T10:30:45Z');
    const s = toBusinessDateTime(instant);
    expect(parseBusinessDateTime(s).getTime()).toBe(
      businessDateTimeInstant(toBusinessDate(instant), '19:30:45').getTime(),
    );
  });

  it('不正な暦日をDate rolloverせず拒否する', () => {
    expect(() => businessDateTimeInstant('2026-02-30', '09:00:00')).toThrow('Invalid BusinessDate');
    expect(() => parseBusinessDateTime('2026-02-30 09:00:00')).toThrow('Invalid BusinessDate');
  });

  it('startOfBusinessDay / endOfBusinessDay', () => {
    expect(startOfBusinessDay('2026-07-05').toISOString()).toBe('2026-07-04T15:00:00.000Z');
    expect(endOfBusinessDay('2026-07-05').toISOString()).toBe('2026-07-05T14:59:59.000Z');
  });
});

describe('addBusinessDays', () => {
  it('暦日を加算する', () => {
    expect(addBusinessDays('2026-01-01', 1)).toBe('2026-01-02');
    expect(addBusinessDays(today(new Date('2026-01-01T00:00:00Z')), 1)).toBe('2026-01-02');
  });
});

describe('ageOnBusinessDate', () => {
  it('業務暦日で満年齢を計算する', () => {
    expect(ageOnBusinessDate('2000-06-14', '2026-06-15')).toBe(26);
    expect(ageOnBusinessDate('2000-06-16', '2026-06-15')).toBe(25);
  });

  it('asOf 省略時は today(ref) 相当の暦日を使う', () => {
    expect(ageOnBusinessDate('2000-01-01', today(new Date('2026-06-15T00:00:00Z')))).toBe(26);
  });
});

describe('IANA timezone support', () => {
  it('同じinstantを利用者のタイムゾーンで変換する', () => {
    const instant = new Date('2026-01-01T00:30:00Z');
    expect(toBusinessDateTime(instant, 'America/Los_Angeles')).toBe('2025-12-31 16:30:00');
    expect(toBusinessDateTime(instant, 'Europe/London')).toBe('2026-01-01 00:30:00');
    expect(toBusinessDateTime(instant, 'Asia/Kolkata')).toBe('2026-01-01 06:00:00');
  });

  it('DSTの夏時間と冬時間をIANAルールで解決する', () => {
    expect(businessDateTimeInstant('2026-07-01', '09:00:00', 'America/New_York').toISOString()).toBe(
      '2026-07-01T13:00:00.000Z',
    );
    expect(businessDateTimeInstant('2026-01-01', '09:00:00', 'America/New_York').toISOString()).toBe(
      '2026-01-01T14:00:00.000Z',
    );
  });

  it('DST開始で存在しないwall clockは拒否する', () => {
    expect(() => businessDateTimeInstant('2026-03-08', '02:30:00', 'America/New_York')).toThrow(
      'Local date-time does not exist',
    );
  });

  it('DST終了で重複するwall clockは早い方を選ぶ', () => {
    expect(businessDateTimeInstant('2026-11-01', '01:30:00', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('日境界は23時間または25時間になり得る', () => {
    const start = startOfBusinessDay('2026-03-08', 'America/New_York');
    const next = startOfBusinessDay('2026-03-09', 'America/New_York');
    expect(next.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('不正なIANA timezoneを拒否する', () => {
    expect(() => toBusinessDate(new Date(), 'Mars/Olympus_Mons')).toThrow(RangeError);
  });
});

describe('initializeBusinessTime', () => {
  it('isolate全体のtimezoneを一度設定し、以後の省略時に利用する', () => {
    expect(initializeBusinessTime({ timeZone: 'America/New_York' })).toEqual({ timeZone: 'America/New_York' });
    expect(getBusinessTimeConfig()).toEqual({ timeZone: 'America/New_York' });
    expect(toBusinessDateTime(new Date('2026-07-01T13:00:00Z'))).toBe('2026-07-01 09:00:00');
    expect(initializeBusinessTime({ timeZone: 'America/New_York' })).toEqual({ timeZone: 'America/New_York' });
    expect(() => initializeBusinessTime({ timeZone: 'Europe/London' })).toThrow(
      'Timezone is already initialized with America/New_York',
    );
  });
});
