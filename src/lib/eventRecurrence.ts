/**
 * When does an event happen?
 *
 * This used to be answered in five places (Calendar, the Events sort, auto-archive,
 * unarchive and reminders), each slightly differently: the Calendar ignored the start
 * date and the interval, so a daily event starting next month showed up today and
 * "every 2 weeks" showed every week; a multi-day event only appeared on its first day;
 * and reminders only ever fired for the first occurrence. Everything now asks here.
 *
 * Dates are `yyyy-MM-dd` keys read as LOCAL days (see dateUtils). `new Date('2026-11-09')`
 * would read them as UTC midnight, which is the previous day anywhere west of Greenwich.
 */

import { addDays, differenceInCalendarDays, differenceInCalendarMonths, startOfDay, startOfWeek } from 'date-fns';
import type { Event } from '@/types/event';
import { fromDateKey } from './dateUtils';

/** Longest span an occurrence is checked across; guards against a mistyped end year. */
const MAX_SPAN_DAYS = 366;
/** How far ahead nextOccurrence looks before giving up (e.g. Feb 29 rules). */
const SEARCH_LIMIT_DAYS = 366 * 8 + 2;

/** The event's first day, at local midnight. */
export function getEventStart(event: Event): Date | null {
  const key = event.startDate || event.date;
  return key ? fromDateKey(key.slice(0, 10)) : null;
}

/** Days from an occurrence's first day to its last (0 for a one-day event). */
export function getEventSpanDays(event: Event): number {
  const start = getEventStart(event);
  const end = event.endDate ? fromDateKey(event.endDate.slice(0, 10)) : null;
  if (!start || !end) return 0;
  return Math.min(Math.max(differenceInCalendarDays(end, start), 0), MAX_SPAN_DAYS);
}

/** True when an occurrence of the event STARTS on `day`. */
function startsOn(event: Event, start: Date, day: Date): boolean {
  const offset = differenceInCalendarDays(day, start);
  if (offset < 0) return false;
  if (!event.isRecurrent) return offset === 0;

  const interval = Math.max(1, Math.floor(event.recurrenceInterval || 1));

  switch (event.recurrenceType) {
    case 'daily':
      return offset % interval === 0;
    case 'weekly': {
      const days = event.recurrenceDays?.length ? event.recurrenceDays : [start.getDay()];
      if (!days.includes(day.getDay())) return false;
      const weeks = differenceInCalendarDays(startOfWeek(day), startOfWeek(start)) / 7;
      return weeks % interval === 0;
    }
    case 'monthly':
      // A month without that day (the 31st in April) is skipped rather than moved.
      return day.getDate() === start.getDate() && differenceInCalendarMonths(day, start) % interval === 0;
    case 'yearly':
    default:
      return (
        day.getMonth() === start.getMonth() &&
        day.getDate() === start.getDate() &&
        (day.getFullYear() - start.getFullYear()) % interval === 0
      );
  }
}

/** True when an occurrence of the event STARTS on `date` (a multi-day event counts once). */
export function occurrenceStartsOn(event: Event, date: Date): boolean {
  const start = getEventStart(event);
  return start ? startsOn(event, start, startOfDay(date)) : false;
}

/** True when the event is happening on `date`, including the later days of a multi-day event. */
export function occursOn(event: Event, date: Date): boolean {
  const start = getEventStart(event);
  if (!start) return false;
  const day = startOfDay(date);
  const span = getEventSpanDays(event);
  for (let back = 0; back <= span; back++) {
    if (startsOn(event, start, addDays(day, -back))) return true;
  }
  return false;
}

/**
 * The first day of the next occurrence that has not finished by `from` (an ongoing
 * multi-day occurrence counts), or null when there is none.
 */
export function getNextOccurrenceStart(event: Event, from: Date = new Date()): Date | null {
  const start = getEventStart(event);
  if (!start) return null;
  const span = getEventSpanDays(event);
  const today = startOfDay(from);

  if (!event.isRecurrent) {
    return addDays(start, span) >= today ? start : null;
  }

  // Walk forward from the earliest day an occurrence could still be running. A day test
  // is a few comparisons, so even eight years of days is cheap.
  let cursor = addDays(today, -span);
  if (cursor < start) cursor = start;

  for (let i = 0; i <= SEARCH_LIMIT_DAYS; i++) {
    const day = addDays(cursor, i);
    if (startsOn(event, start, day)) return day;
  }
  return null;
}

/** Sort key for undated events; finite so `a - b` in a comparator never yields NaN. */
const NO_DATE = 999999;

/**
 * Whole days until the next occurrence (0 while one is ongoing). For a one-off event
 * that has ended, the negative number of days since it started, so past events still
 * sort by how recent they are.
 */
export function daysUntilEvent(event: Event, from: Date = new Date()): number {
  const today = startOfDay(from);
  const next = getNextOccurrenceStart(event, from);
  if (next) return Math.max(0, differenceInCalendarDays(next, today));
  const start = getEventStart(event);
  return start ? differenceInCalendarDays(start, today) : NO_DATE;
}

/** A one-off event whose last day is before today. Recurring events never end. */
export function hasEventEnded(event: Event, from: Date = new Date()): boolean {
  if (event.isRecurrent) return false;
  const start = getEventStart(event);
  if (!start) return false;
  return addDays(start, getEventSpanDays(event)) < startOfDay(from);
}
