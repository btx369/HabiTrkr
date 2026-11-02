import { describe, expect, it } from 'vitest';
import { fromDateKey, parseStoredDate, toDateKey } from './dateUtils';

describe('date keys', () => {
  it('round-trips a local day', () => {
    const date = new Date(2026, 10, 9, 23, 30);
    expect(toDateKey(date)).toBe('2026-11-09');
    expect(fromDateKey('2026-11-09')!.getDate()).toBe(9);
  });

  it('rejects malformed keys', () => {
    expect(fromDateKey('2026-11-9')).toBeNull();
    expect(fromDateKey('not a date')).toBeNull();
  });

  it('reads a bare key as the local day, not UTC midnight', () => {
    const date = parseStoredDate('2026-11-09')!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 9, 0]);
  });

  it('still reads full timestamps', () => {
    expect(parseStoredDate('2026-11-09T12:00:00.000Z')!.getTime()).toBe(Date.UTC(2026, 10, 9, 12));
    expect(parseStoredDate('garbage')).toBeNull();
  });
});
