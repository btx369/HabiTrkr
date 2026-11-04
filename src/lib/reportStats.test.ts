import { describe, expect, it } from 'vitest';
import type { Habit } from '@/types/habit';
import type { Event } from '@/types/event';
import {
  completionBetween,
  eventsPerMonth,
  eventSummary,
  insights,
  noteSummary,
  periodBounds,
  periodReport,
  rateOf,
  streakOf,
  upcomingEvents,
  weekSummary,
  weeklyRates,
} from './reportStats';

// Tuesday 3 Nov 2026, week starting Monday
const NOW = new Date(2026, 10, 3, 12, 0);
const MON = 1;
const day = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const habit = (fields: Partial<Habit>): Habit => ({
  id: 'h',
  name: 'h',
  color: '#FFFFFF',
  createdAt: new Date(2026, 9, 1).toISOString(),
  completedDates: [],
  activeDays: [true, true, true, true, true, true, true],
  ...fields,
});
const event = (fields: Partial<Event>): Event => ({ id: 'e', name: 'e', color: '#FFFFFF', createdAt: '', isRecurrent: false, ...fields });

describe('habit completion', () => {
  it('counts only the weekdays a habit is active on', () => {
    const weekdays = habit({ activeDays: [true, true, true, true, true, false, false], completedDates: ['2026-11-02'] });
    // Mon 2 and Tue 3 are due; Monday done, Tuesday not yet
    expect(completionBetween(weekdays, day('2026-11-02'), day('2026-11-08'), NOW, MON)).toEqual({ done: 1, expected: 2 });
  });

  it('does not count days before the habit existed', () => {
    const fresh = habit({ createdAt: new Date(2026, 10, 2).toISOString() });
    expect(completionBetween(fresh, day('2026-10-01'), day('2026-11-03'), NOW, MON).expected).toBe(2);
  });

  it('judges weekly habits against their target, capped, and cuts the running week short', () => {
    const weekly = habit({ useNumberOfDays: true, numberOfDaysPerWeek: 3, completedDates: ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02'] });
    // last week: 4 done, capped at target 3; this week has only 2 days so far: target min(3, 2)
    expect(completionBetween(weekly, day('2026-10-26'), day('2026-11-08'), NOW, MON)).toEqual({ done: 4, expected: 5 });
  });

  it('gives habits without a goal no rate', () => {
    const open = habit({ useUnlimitedTimes: true, completionCounts: { '2026-11-03': 5 } });
    expect(rateOf(completionBetween(open, day('2026-10-01'), NOW, NOW, MON))).toBeNull();
  });

  it('summarises the week across habits', () => {
    const a = habit({ id: 'a', completedDates: ['2026-11-02', '2026-11-03'] });
    const b = habit({ id: 'b', completedDates: ['2026-11-02'] });
    expect(weekSummary([a, b], NOW, MON)).toBe(3 / 4);
    expect(weekSummary([], NOW, MON)).toBeNull();
  });

  it('gives a rate per week, oldest first', () => {
    const h = habit({ completedDates: ['2026-10-26', '2026-10-27'] });
    const rates = weeklyRates([h], 2, NOW, MON);
    expect(rates).toHaveLength(2);
    expect(rates[0].rate).toBe(2 / 7);
  });
});

describe('streaks', () => {
  it('runs through today without being broken by it', () => {
    const h = habit({ completedDates: ['2026-11-01', '2026-11-02'] });
    expect(streakOf(h, NOW, MON)).toEqual({ current: 2, best: 2, unit: 'days' });
  });

  it('breaks on a missed active day but skips inactive days', () => {
    const weekdays = habit({ activeDays: [true, true, true, true, true, false, false], completedDates: ['2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03'] });
    // Thu, Fri, (weekend skipped), Mon, Tue
    expect(streakOf(weekdays, NOW, MON).current).toBe(4);
    const missed = habit({ completedDates: ['2026-10-29', '2026-11-02'] });
    expect(streakOf(missed, NOW, MON)).toEqual({ current: 1, best: 1, unit: 'days' });
  });

  it('keeps the best run after a break', () => {
    const h = habit({ completedDates: ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-11-02'] });
    expect(streakOf(h, NOW, MON)).toMatchObject({ current: 1, best: 4 });
  });

  it('counts weeks for weekly habits', () => {
    const h = habit({ useNumberOfDays: true, numberOfDaysPerWeek: 2, completedDates: ['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-28'] });
    expect(streakOf(h, NOW, MON)).toEqual({ current: 2, best: 2, unit: 'weeks' });
  });
});

describe('events', () => {
  const trip = event({ id: 't', startDate: '2026-11-04', endDate: '2026-11-06' });
  const gym = event({ id: 'g', isRecurrent: true, recurrenceType: 'weekly', recurrenceDays: [1, 3], startDate: '2026-10-01' });

  it('counts a multi-day event once, at its start', () => {
    const summary = eventSummary([trip], [], NOW, MON);
    expect(summary.thisWeek).toBe(1);
  });

  it('counts recurring occurrences in the week and which have passed', () => {
    const summary = eventSummary([gym], [], NOW, MON); // Mon 2 (past) and Wed 4
    expect(summary).toMatchObject({ thisWeek: 2, thisWeekPast: 1, recurring: 1 });
  });

  it('lists upcoming events with an ongoing one first', () => {
    const ongoing = event({ id: 'o', startDate: '2026-11-02', endDate: '2026-11-04' });
    const list = upcomingEvents([gym, ongoing], NOW, 14, 3);
    expect(list[0].event.id).toBe('o');
    expect(list.length).toBe(3);
  });

  it('counts events per month', () => {
    const months = eventsPerMonth([event({ startDate: '2026-10-05' }), event({ startDate: '2026-11-10' })], 3, NOW);
    expect(months.map((m) => m.count)).toEqual([0, 1, 1]);
  });
});

describe('notes', () => {
  it('summarises types, tags and recent notes', () => {
    const base = { color: '', pinned: false, name: 'n' } as const;
    const notes = [
      { ...base, id: '1', type: 'text', createdAt: new Date(2026, 10, 2).toISOString(), description: '', tags: ['Work'] },
      { ...base, id: '2', type: 'list', createdAt: new Date(2026, 9, 2).toISOString(), items: [], tags: ['work', 'home'], pinned: true },
    ] as never;
    const s = noteSummary(notes, [], NOW, MON);
    expect(s).toMatchObject({ total: 2, newThisWeek: 1, pinned: 1 });
    expect(s.topTags[0]).toEqual({ tag: 'work', count: 2 });
  });
});

describe('insights', () => {
  it('flags a missed yesterday, a streak at risk and an event today', () => {
    const missed = habit({ id: 'm', name: 'Run', completedDates: [] });
    const streak = habit({ id: 's', name: 'Read', completedDates: ['2026-10-31', '2026-11-01', '2026-11-02'] });
    const today = event({ id: 'e1', startDate: '2026-11-03' });
    const kinds = insights([missed, streak], [today], NOW, MON, 10).map((i) => i.kind);
    expect(kinds).toContain('missedYesterday');
    expect(kinds).toContain('streakAtRisk');
    expect(kinds).toContain('eventToday');
  });
});

describe('habits by week, month and year', () => {
  it('finds the bounds of the current and earlier periods', () => {
    expect(periodBounds('week', NOW, 0, MON)).toEqual({ from: day('2026-11-02'), to: day('2026-11-08') });
    expect(periodBounds('week', NOW, 1, MON).from).toEqual(day('2026-10-26'));
    expect(periodBounds('month', NOW, 0, MON)).toEqual({ from: day('2026-11-01'), to: day('2026-11-30') });
    expect(periodBounds('month', NOW, 11, MON).from).toEqual(day('2025-12-01'));
    expect(periodBounds('year', NOW, 1, MON)).toEqual({ from: day('2025-01-01'), to: day('2025-12-31') });
  });

  it('splits a week into days, a month into weeks and a year into months', () => {
    const daily = habit({ completedDates: ['2026-11-02', '2026-10-05', '2026-10-06'] });
    const week = periodReport([daily], 'week', NOW, 0, MON);
    expect(week.buckets).toHaveLength(7);
    expect(week.buckets.map((b) => b.count)).toEqual([1, 0, 0, 0, 0, 0, 0]);
    // Monday done, Tuesday (today) not yet: 1 of 2 so far
    expect(week.rate).toBe(0.5);

    const month = periodReport([daily], 'month', NOW, 0, MON);
    // November 2026 starts on a Sunday: weeks of 1, 7, 7, 7, 7 and 1 days
    expect(month.buckets.map((b) => b.start.getDate())).toEqual([1, 2, 9, 16, 23, 30]);
    expect(month.buckets[3].rate).toBeNull(); // still ahead

    const year = periodReport([daily], 'year', NOW, 0, MON);
    expect(year.buckets).toHaveLength(12);
    expect(year.buckets[9].count).toBe(2); // October
    expect(year.habits[0]).toMatchObject({ count: 3 });
  });
});
