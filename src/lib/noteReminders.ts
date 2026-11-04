/**
 * Note reminders, in the spirit of Google Keep: quick choices (later today, tomorrow
 * morning, next week), any date and time, and repeating reminders.
 *
 * A reminder is stored as a LOCAL date-time string (`yyyy-MM-ddTHH:mm`), not an instant:
 * "remind me at 9:00" should still mean 9:00 after a trip across time zones.
 */
import { addDays, addMonths, addWeeks, addYears, format, isSameDay, parse, startOfWeek } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Note, NoteReminder } from '@/types/note';

const FORMAT = "yyyy-MM-dd'T'HH:mm";

export const toReminderString = (date: Date) => format(date, FORMAT);

export function parseReminder(at: string): Date | null {
  const date = parse(at, FORMAT, new Date());
  return Number.isNaN(date.getTime()) ? null : date;
}

const at = (day: Date, hours: number, minutes = 0) => {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

export type ReminderPreset = 'laterToday' | 'tomorrow' | 'nextWeek';

/**
 * The quick choices, as Keep offers them. "Later today" is 18:00, or 20:00 once that has
 * gone by, and is not offered late in the evening. "Next week" is the first day of the
 * user's week at 08:00.
 */
export function reminderPresets(now: Date, weekStartsOn: 0 | 1 | 6): Array<{ preset: ReminderPreset; date: Date }> {
  const out: Array<{ preset: ReminderPreset; date: Date }> = [];
  const evening = at(now, 18);
  const night = at(now, 20);
  if (now < evening) out.push({ preset: 'laterToday', date: evening });
  else if (now < night) out.push({ preset: 'laterToday', date: night });
  out.push({ preset: 'tomorrow', date: at(addDays(now, 1), 8) });
  out.push({ preset: 'nextWeek', date: at(addWeeks(startOfWeek(now, { weekStartsOn }), 1), 8) });
  return out;
}

function step(date: Date, reminder: NoteReminder, times: number): Date {
  const n = Math.max(1, Math.floor(reminder.interval ?? 1)) * times;
  switch (reminder.repeat) {
    case 'daily': return addDays(date, n);
    case 'weekly': return addWeeks(date, n);
    case 'monthly': return addMonths(date, n);
    case 'yearly': return addYears(date, n);
    default: return date;
  }
}

/**
 * When the reminder fires next, at or after `now`. A one-off reminder that has passed
 * returns null (it is "overdue", see isReminderOverdue); a repeating one rolls forward.
 */
export function nextReminderTime(reminder: NoteReminder, now: Date = new Date()): Date | null {
  const first = parseReminder(reminder.at);
  if (!first) return null;
  if (first >= now) return first;
  if (!reminder.repeat) return null;
  // Jump close, then walk: a daily reminder set years ago should not loop thousands of times.
  let times = 0;
  let next = first;
  while (next < now && times < 100000) {
    times++;
    next = step(first, reminder, times);
  }
  return next >= now ? next : null;
}

/** A one-off reminder whose time has passed (Keep shows these struck through). */
export const isReminderOverdue = (reminder: NoteReminder, now: Date = new Date()) =>
  !reminder.repeat && (parseReminder(reminder.at)?.getTime() ?? Infinity) < now.getTime();

/** Notes with a reminder, the next ones first and overdue ones before those. */
export function notesWithReminders(notes: Note[], now: Date = new Date()): Array<{ note: Note; next: Date | null; overdue: boolean }> {
  return notes
    .filter((n) => n.reminder)
    .map((note) => ({ note, next: nextReminderTime(note.reminder!, now), overdue: isReminderOverdue(note.reminder!, now) }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const ta = a.next?.getTime() ?? parseReminder(a.note.reminder!.at)?.getTime() ?? 0;
      const tb = b.next?.getTime() ?? parseReminder(b.note.reminder!.at)?.getTime() ?? 0;
      return ta - tb;
    });
}

/**
 * "Today, 18:00", "Tomorrow, 08:00", "Mon 9 Nov, 08:00" in the user's language.
 * `today`/`tomorrow` are the translated words.
 */
export function formatReminder(date: Date, locale: Locale, words: { today: string; tomorrow: string }, now: Date = new Date()): string {
  const time = format(date, 'p', { locale });
  if (isSameDay(date, now)) return `${words.today}, ${time}`;
  if (isSameDay(date, addDays(now, 1))) return `${words.tomorrow}, ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return `${format(date, sameYear ? 'EEE d MMM' : 'd MMM yyyy', { locale })}, ${time}`;
}
