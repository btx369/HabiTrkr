import { describe, expect, it } from 'vitest';
import type { Event } from '@/types/event';
import { daysUntilEvent, getNextOccurrenceStart, hasEventEnded, occursOn } from './eventRecurrence';
import { toDateKey } from './dateUtils';

const day = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const event = (fields: Partial<Event>): Event => ({
  id: 'e',
  name: 'e',
  color: '#FFFFFF',
  createdAt: '2026-01-01T00:00:00.000Z',
  isRecurrent: false,
  ...fields,
});

describe('occursOn', () => {
  it('never shows a recurring event before its start date', () => {
    const daily = event({ isRecurrent: true, recurrenceType: 'daily', startDate: '2026-12-01' });
    expect(occursOn(daily, day('2026-11-30'))).toBe(false);
    expect(occursOn(daily, day('2026-12-01'))).toBe(true);
    expect(occursOn(daily, day('2026-12-15'))).toBe(true);
  });

  it('respects the interval', () => {
    const every3Days = event({ isRecurrent: true, recurrenceType: 'daily', recurrenceInterval: 3, startDate: '2026-11-01' });
    expect(['2026-11-01', '2026-11-02', '2026-11-04'].map((k) => occursOn(every3Days, day(k)))).toEqual([true, false, true]);

    const biweekly = event({ isRecurrent: true, recurrenceType: 'weekly', recurrenceInterval: 2, recurrenceDays: [1], startDate: '2026-11-09' });
    expect(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'].map((k) => occursOn(biweekly, day(k))))
      .toEqual([false, true, false, true]);
  });

  it('repeats a weekly event on its start weekday when no days were chosen', () => {
    const weekly = event({ isRecurrent: true, recurrenceType: 'weekly', startDate: '2026-10-28' }); // a Wednesday
    expect(occursOn(weekly, day('2026-11-04'))).toBe(true);
    expect(occursOn(weekly, day('2026-11-05'))).toBe(false);
  });

  it('skips months that lack the day instead of moving it', () => {
    const monthly = event({ isRecurrent: true, recurrenceType: 'monthly', startDate: '2026-01-31' });
    expect(occursOn(monthly, day('2026-04-30'))).toBe(false);
    expect(occursOn(monthly, day('2026-05-31'))).toBe(true);
  });

  it('covers every day of a multi-day event', () => {
    const trip = event({ startDate: '2026-11-02', endDate: '2026-11-04' });
    expect(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((k) => occursOn(trip, day(k))))
      .toEqual([false, true, true, true, false]);
  });

  it('reads the legacy `date` field', () => {
    expect(occursOn(event({ date: '2026-11-02' }), day('2026-11-02'))).toBe(true);
  });
});

describe('next occurrence and ending', () => {
  it('finds the next yearly occurrence on Feb 29 only in leap years', () => {
    const leap = event({ isRecurrent: true, recurrenceType: 'yearly', startDate: '2024-02-29' });
    expect(toDateKey(getNextOccurrenceStart(leap, day('2026-11-02'))!)).toBe('2028-02-29');
  });

  it('keeps a multi-day event current until its last day', () => {
    const trip = event({ startDate: '2026-11-02', endDate: '2026-11-04' });
    expect(hasEventEnded(trip, day('2026-11-04'))).toBe(false);
    expect(hasEventEnded(trip, day('2026-11-05'))).toBe(true);
    expect(daysUntilEvent(trip, day('2026-11-03'))).toBe(0);
  });

  it('sorts ended one-off events by how long ago they started, and undated ones last', () => {
    expect(daysUntilEvent(event({ startDate: '2026-11-02' }), day('2026-11-12'))).toBe(-10);
    expect(daysUntilEvent(event({}))).toBe(999999);
  });

  it('never ends a recurring event', () => {
    expect(hasEventEnded(event({ isRecurrent: true, recurrenceType: 'daily', startDate: '2020-01-01' }))).toBe(false);
  });
});
