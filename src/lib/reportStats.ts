/**
 * Numbers for the Reports page, computed from what the app already stores.
 *
 * Pure functions of (data, now): no storage, no React, so they are easy to test. Dates are
 * local-day keys (see dateUtils). Everything takes `weekStartsOn` so a week means what the
 * user's week-start setting says.
 */
import { addDays, addMonths, differenceInCalendarDays, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { Habit } from '@/types/habit';
import type { Event } from '@/types/event';
import type { Note } from '@/types/note';
import { toDateKey } from './dateUtils';
import { getEventStart, occurrenceStartsOn, occursOn } from './eventRecurrence';

export type WeekStart = 0 | 1 | 6;
const MAX_LOOKBACK_DAYS = 366 * 3;

/* ------------------------------------------------------------------ habits */

/**
 * How a habit is judged:
 *  - days: done on the weekdays it is active on
 *  - weekly: done on N days of each week, any days
 *  - open: no goal (unlimited counter); only streaks and totals make sense
 */
export type HabitKind = 'days' | 'weekly' | 'open';

export const habitKind = (habit: Habit): HabitKind =>
  habit.useUnlimitedTimes ? 'open' : habit.useNumberOfDays ? 'weekly' : 'days';

export function isDoneOn(habit: Habit, key: string): boolean {
  if (habit.useUnlimitedTimes) return (habit.completionCounts?.[key] ?? 0) > 0;
  return habit.completedDates.includes(key);
}

/** Habit weekday flags run Monday..Sunday. */
const isActiveOn = (habit: Habit, date: Date) => habit.activeDays?.[(date.getDay() + 6) % 7] ?? true;

const weeklyTarget = (habit: Habit) => Math.min(7, Math.max(1, habit.numberOfDaysPerWeek ?? 1));

/** First day that can count for the habit: the day it was created. */
function habitStart(habit: Habit, now: Date): Date {
  const created = new Date(habit.createdAt);
  const day = Number.isNaN(created.getTime()) ? addDays(now, -MAX_LOOKBACK_DAYS) : startOfDay(created);
  const limit = addDays(startOfDay(now), -MAX_LOOKBACK_DAYS);
  return day < limit ? limit : day;
}

export interface Completion {
  /** What was achieved and what was expected over the window; rate = done / expected. */
  done: number;
  expected: number;
}

/**
 * Completion over [from, to] (inclusive, clipped to when the habit was created).
 * Habits without a goal return zero expected, so they never drag a rate down.
 */
export function completionBetween(habit: Habit, from: Date, to: Date, now: Date, weekStartsOn: WeekStart): Completion {
  const first = new Date(Math.max(startOfDay(from).getTime(), habitStart(habit, now).getTime()));
  const last = new Date(Math.min(startOfDay(to).getTime(), startOfDay(now).getTime()));
  if (first > last) return { done: 0, expected: 0 };
  const kind = habitKind(habit);

  if (kind === 'open') return { done: 0, expected: 0 };

  if (kind === 'days') {
    let done = 0;
    let expected = 0;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (!isActiveOn(habit, d)) continue;
      expected++;
      if (isDoneOn(habit, toDateKey(d))) done++;
    }
    return { done, expected };
  }

  // weekly: judge each week touched by the window against its target
  const target = weeklyTarget(habit);
  let done = 0;
  let expected = 0;
  for (let ws = startOfWeek(first, { weekStartsOn }); ws <= last; ws = addDays(ws, 7)) {
    const from_ = ws < first ? first : ws;
    const weekEnd = addDays(ws, 6);
    const to_ = weekEnd > last ? last : weekEnd;
    let count = 0;
    for (let d = from_; d <= to_; d = addDays(d, 1)) if (isDoneOn(habit, toDateKey(d))) count++;
    // A week cut short (the current one, or the week the habit began) can only ask for the
    // days it had.
    const days = differenceInCalendarDays(to_, from_) + 1;
    const weekTarget = days < 7 ? Math.min(target, days) : target;
    done += Math.min(count, weekTarget);
    expected += weekTarget;
  }
  return { done, expected };
}

export const rateOf = (c: Completion): number | null => (c.expected > 0 ? c.done / c.expected : null);

export interface Streak {
  current: number;
  best: number;
  unit: 'days' | 'weeks';
}

/**
 * Streaks. For "days" habits, days the habit is not active on neither extend nor break the
 * run. Today not yet being done does not break it either, it just has not counted yet.
 * Weekly habits count weeks in a row that reached the target.
 */
export function streakOf(habit: Habit, now: Date, weekStartsOn: WeekStart): Streak {
  const today = startOfDay(now);
  const start = habitStart(habit, now);
  const kind = habitKind(habit);

  if (kind === 'weekly') {
    const target = weeklyTarget(habit);
    const weeks: boolean[] = [];
    for (let ws = startOfWeek(start, { weekStartsOn }); ws <= today; ws = addDays(ws, 7)) {
      let count = 0;
      for (let i = 0; i < 7; i++) if (isDoneOn(habit, toDateKey(addDays(ws, i)))) count++;
      weeks.push(count >= target);
    }
    let best = 0;
    let run = 0;
    for (const ok of weeks) {
      run = ok ? run + 1 : 0;
      best = Math.max(best, run);
    }
    // The running week may still reach its target, so it only extends a streak, never ends it.
    let current = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i]) current++;
      else if (i === weeks.length - 1) continue;
      else break;
    }
    return { current, best, unit: 'weeks' };
  }

  let best = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const required = kind === 'open' ? true : isActiveOn(habit, d);
    const done = isDoneOn(habit, toDateKey(d));
    if (done) {
      run++;
      best = Math.max(best, run);
    } else if (required && d < today) {
      run = 0;
    }
  }
  // `run` at the end is the current streak: today unfinished leaves it untouched.
  return { current: run, best, unit: 'days' };
}

export type DayState = 'done' | 'missed' | 'off' | 'future';

/** One state per day over [from, to], for mini calendars. */
export function dayStates(habit: Habit, from: Date, to: Date, now: Date): Array<{ key: string; date: Date; state: DayState }> {
  const today = startOfDay(now);
  const start = habitStart(habit, now);
  const kind = habitKind(habit);
  const out: Array<{ key: string; date: Date; state: DayState }> = [];
  for (let d = startOfDay(from); d <= startOfDay(to); d = addDays(d, 1)) {
    const key = toDateKey(d);
    let state: DayState;
    if (d > today) state = 'future';
    else if (isDoneOn(habit, key)) state = 'done';
    else if (d < start || kind !== 'days' || !isActiveOn(habit, d)) state = 'off';
    else state = d.getTime() === today.getTime() ? 'off' : 'missed';
    out.push({ key, date: d, state });
  }
  return out;
}

/** Share of goal-bearing habits completed per week, oldest first, ending with the current week. */
export function weeklyRates(habits: Habit[], weeks: number, now: Date, weekStartsOn: WeekStart): Array<{ weekStart: Date; rate: number | null }> {
  const thisWeek = startOfWeek(now, { weekStartsOn });
  const out: Array<{ weekStart: Date; rate: number | null }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    let done = 0;
    let expected = 0;
    for (const habit of habits) {
      const c = completionBetween(habit, ws, addDays(ws, 6), now, weekStartsOn);
      done += c.done;
      expected += c.expected;
    }
    out.push({ weekStart: ws, rate: expected > 0 ? done / expected : null });
  }
  return out;
}

/** How many habits were completed on each of the last `days` days (for the heat map). */
export function dailyActivity(habits: Habit[], days: number, now: Date): Array<{ key: string; date: Date; count: number }> {
  const today = startOfDay(now);
  const out: Array<{ key: string; date: Date; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const key = toDateKey(date);
    out.push({ key, date, count: habits.filter((h) => isDoneOn(h, key)).length });
  }
  return out;
}

export interface HabitReport {
  habit: Habit;
  kind: HabitKind;
  streak: Streak;
  rate30: number | null;
  doneToday: boolean;
  dueToday: boolean;
  last7: ReturnType<typeof dayStates>;
  totalDone: number;
}

export function habitReports(habits: Habit[], now: Date, weekStartsOn: WeekStart): HabitReport[] {
  const today = startOfDay(now);
  const todayKey = toDateKey(today);
  return habits.map((habit) => {
    const kind = habitKind(habit);
    return {
      habit,
      kind,
      streak: streakOf(habit, now, weekStartsOn),
      rate30: rateOf(completionBetween(habit, addDays(today, -29), today, now, weekStartsOn)),
      doneToday: isDoneOn(habit, todayKey),
      dueToday: kind === 'days' ? isActiveOn(habit, today) : kind === 'open',
      last7: dayStates(habit, addDays(today, -6), today, now),
      totalDone: kind === 'open'
        ? Object.values(habit.completionCounts ?? {}).reduce((sum, n) => sum + n, 0)
        : habit.completedDates.length,
    };
  });
}

/** Overall completion this week across habits that have a goal, or null with none. */
export function weekSummary(habits: Habit[], now: Date, weekStartsOn: WeekStart): number | null {
  const ws = startOfWeek(now, { weekStartsOn });
  let done = 0;
  let expected = 0;
  for (const habit of habits) {
    const c = completionBetween(habit, ws, addDays(ws, 6), now, weekStartsOn);
    done += c.done;
    expected += c.expected;
  }
  return expected > 0 ? done / expected : null;
}

/* ------------------------------------------------- habits by week / month / year */

export type ReportPeriod = 'week' | 'month' | 'year';

/** The week, month or year containing `now`, moved back by `offset` periods (0 = current). */
export function periodBounds(period: ReportPeriod, now: Date, offset: number, weekStartsOn: WeekStart): { from: Date; to: Date } {
  if (period === 'week') {
    const from = addDays(startOfWeek(now, { weekStartsOn }), -7 * offset);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const from = addMonths(startOfMonth(now), -offset);
    return { from, to: addDays(addMonths(from, 1), -1) };
  }
  const from = new Date(now.getFullYear() - offset, 0, 1);
  return { from, to: new Date(now.getFullYear() - offset, 11, 31) };
}

export interface PeriodBucket {
  start: Date;
  end: Date;
  /** Completion of goal-bearing habits in the bucket; null before anything was due. */
  rate: number | null;
  /** Check-ins in the bucket: one per habit per day it was done. */
  count: number;
}

export interface PeriodHabit {
  habit: Habit;
  kind: HabitKind;
  done: number;
  expected: number;
  rate: number | null;
  /** Days it was done in the period. */
  count: number;
}

export interface PeriodReport {
  from: Date;
  to: Date;
  rate: number | null;
  count: number;
  /** Days of a week, weeks of a month, months of a year. */
  buckets: PeriodBucket[];
  habits: PeriodHabit[];
}

const countDone = (habits: Habit[], from: Date, to: Date, now: Date) => {
  const last = new Date(Math.min(startOfDay(to).getTime(), startOfDay(now).getTime()));
  let count = 0;
  for (let d = startOfDay(from); d <= last; d = addDays(d, 1)) {
    const key = toDateKey(d);
    for (const habit of habits) if (isDoneOn(habit, key)) count++;
  }
  return count;
};

const completionOf = (habits: Habit[], from: Date, to: Date, now: Date, weekStartsOn: WeekStart) => {
  let done = 0;
  let expected = 0;
  for (const habit of habits) {
    const c = completionBetween(habit, from, to, now, weekStartsOn);
    done += c.done;
    expected += c.expected;
  }
  return expected > 0 ? done / expected : null;
};

/** Everything the habits tab shows for one week, month or year. */
export function periodReport(habits: Habit[], period: ReportPeriod, now: Date, offset: number, weekStartsOn: WeekStart): PeriodReport {
  const { from, to } = periodBounds(period, now, offset, weekStartsOn);
  const ranges: Array<[Date, Date]> = [];
  if (period === 'week') {
    for (let i = 0; i < 7; i++) ranges.push([addDays(from, i), addDays(from, i)]);
  } else if (period === 'month') {
    for (let ws = startOfWeek(from, { weekStartsOn }); ws <= to; ws = addDays(ws, 7)) {
      const we = addDays(ws, 6);
      ranges.push([ws < from ? from : ws, we > to ? to : we]);
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const start = addMonths(from, m);
      ranges.push([start, addDays(addMonths(start, 1), -1)]);
    }
  }
  return {
    from,
    to,
    rate: completionOf(habits, from, to, now, weekStartsOn),
    count: countDone(habits, from, to, now),
    buckets: ranges.map(([start, end]) => ({
      start,
      end,
      rate: completionOf(habits, start, end, now, weekStartsOn),
      count: countDone(habits, start, end, now),
    })),
    habits: habits.map((habit) => {
      const c = completionBetween(habit, from, to, now, weekStartsOn);
      return { habit, kind: habitKind(habit), ...c, rate: rateOf(c), count: countDone([habit], from, to, now) };
    }),
  };
}

/* ------------------------------------------------------------------ events */

export interface Occurrence {
  event: Event;
  date: Date;
}

/** Occurrences STARTING in [from, to], earliest first (all-day first, then by time). */
export function occurrencesBetween(events: Event[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (let d = startOfDay(from); d <= startOfDay(to); d = addDays(d, 1)) {
    for (const event of events) if (occurrenceStartsOn(event, d)) out.push({ event, date: d });
  }
  return out.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.event.startTime || a.event.time || '').localeCompare(b.event.startTime || b.event.time || ''),
  );
}

/** Next occurrences from now on, within `days`, at most `limit`. */
export function upcomingEvents(events: Event[], now: Date, days = 30, limit = 5): Occurrence[] {
  const today = startOfDay(now);
  const found = occurrencesBetween(events, today, addDays(today, days));
  // An ongoing multi-day event is listed from today, not from its start.
  const ongoing = events
    .filter((e) => {
      const start = getEventStart(e);
      return start && start < today && occursOn(e, today) && !occurrenceStartsOn(e, today);
    })
    .map((event) => ({ event, date: today }));
  return [...ongoing, ...found].slice(0, limit);
}

/** Number of event occurrences starting in each of the last `months` months, ending this month. */
export function eventsPerMonth(events: Event[], months: number, now: Date): Array<{ month: Date; count: number }> {
  const thisMonth = startOfMonth(now);
  const out: Array<{ month: Date; count: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(thisMonth, -i);
    const end = addDays(addMonths(month, 1), -1);
    out.push({ month, count: occurrencesBetween(events, month, end).length });
  }
  return out;
}

/** Occurrences per weekday (index = JS day, 0 = Sunday) over the surrounding weeks. */
export function weekdayLoad(events: Event[], now: Date, weeksBack = 8, weeksAhead = 4): number[] {
  const today = startOfDay(now);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const { date } of occurrencesBetween(events, addDays(today, -7 * weeksBack), addDays(today, 7 * weeksAhead))) {
    counts[date.getDay()]++;
  }
  return counts;
}

export interface EventSummary {
  total: number;
  /** Starting this week (week start setting). */
  thisWeek: number;
  /** Of those, how many have already happened. */
  thisWeekPast: number;
  recurring: number;
  oneOff: number;
}

export function eventSummary(events: Event[], archived: Event[], now: Date, weekStartsOn: WeekStart): EventSummary {
  const ws = startOfWeek(now, { weekStartsOn });
  const week = occurrencesBetween(events, ws, addDays(ws, 6));
  const today = startOfDay(now);
  const all = [...events, ...archived];
  return {
    total: all.length,
    thisWeek: week.length,
    thisWeekPast: week.filter((o) => o.date < today).length,
    recurring: all.filter((e) => e.isRecurrent).length,
    oneOff: all.filter((e) => !e.isRecurrent).length,
  };
}

/* ------------------------------------------------------------------- notes */

export interface NoteSummary {
  total: number;
  newThisWeek: number;
  pinned: number;
  locked: number;
  byType: Record<Note['type'], number>;
  topTags: Array<{ tag: string; count: number }>;
}

export function noteSummary(notes: Note[], archived: Note[], now: Date, weekStartsOn: WeekStart): NoteSummary {
  const ws = startOfWeek(now, { weekStartsOn });
  const all = [...notes, ...archived];
  const byType: Record<Note['type'], number> = { text: 0, list: 0, audio: 0, image: 0 };
  const tags = new Map<string, number>();
  for (const note of all) {
    byType[note.type] = (byType[note.type] ?? 0) + 1;
    for (const tag of new Set((note.tags ?? []).map((t) => t.toLowerCase()))) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  return {
    total: all.length,
    newThisWeek: all.filter((n) => new Date(n.createdAt) >= ws).length,
    pinned: notes.filter((n) => n.pinned).length,
    locked: all.filter((n) => n.locked).length,
    byType,
    topTags: [...tags].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 5),
  };
}

/* ---------------------------------------------------------------- insights */

export type Insight =
  | { kind: 'missedYesterday'; habit: Habit }
  | { kind: 'dueToday'; habit: Habit }
  | { kind: 'streakAtRisk'; habit: Habit; days: number }
  | { kind: 'eventToday'; event: Event }
  | { kind: 'weekBehind'; habit: Habit; remaining: number };

/**
 * Short, rule-based nudges for today. Nothing is guessed: each comes from a fact in the
 * data (a due habit not done, a streak that today's check-in would keep, an event today).
 */
export function insights(habits: Habit[], events: Event[], now: Date, weekStartsOn: WeekStart, limit = 4): Insight[] {
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(yesterday);
  const out: Insight[] = [];

  for (const habit of habits) {
    if (habitKind(habit) === 'days' && habitStart(habit, now) <= yesterday && isActiveOn(habit, yesterday) && !isDoneOn(habit, yesterdayKey)) {
      out.push({ kind: 'missedYesterday', habit });
    }
  }
  for (const habit of habits) {
    const streak = streakOf(habit, now, weekStartsOn);
    if (streak.unit === 'days' && streak.current >= 3 && !isDoneOn(habit, todayKey) && (habitKind(habit) === 'open' || isActiveOn(habit, today))) {
      out.push({ kind: 'streakAtRisk', habit, days: streak.current });
    }
  }
  for (const habit of habits) {
    if (habitKind(habit) === 'weekly') {
      const ws = startOfWeek(today, { weekStartsOn });
      const left = differenceInCalendarDays(addDays(ws, 6), today) + 1;
      const c = completionBetween(habit, ws, addDays(ws, 6), addDays(ws, 6), weekStartsOn);
      const remaining = weeklyTarget(habit) - c.done;
      if (remaining > 0 && remaining >= left) out.push({ kind: 'weekBehind', habit, remaining });
    }
  }
  for (const habit of habits) {
    if (habitKind(habit) === 'days' && isActiveOn(habit, today) && !isDoneOn(habit, todayKey) && !out.some((i) => 'habit' in i && i.habit.id === habit.id)) {
      out.push({ kind: 'dueToday', habit });
    }
  }
  for (const event of events) if (occursOn(event, today)) out.push({ kind: 'eventToday', event });

  return out.slice(0, limit);
}

