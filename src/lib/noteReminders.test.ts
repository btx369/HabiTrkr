import { describe, expect, it } from 'vitest';
import { enUS } from 'date-fns/locale';
import type { Note } from '@/types/note';
import { formatReminder, isReminderOverdue, nextReminderTime, notesWithReminders, reminderPresets, toReminderString } from './noteReminders';

const NOW = new Date(2026, 10, 4, 10, 0); // Wed 4 Nov 2026, 10:00

describe('note reminders', () => {
  it('offers later today, tomorrow morning and next week', () => {
    const presets = reminderPresets(NOW, 1);
    expect(presets.map((p) => [p.preset, toReminderString(p.date)])).toEqual([
      ['laterToday', '2026-11-04T18:00'],
      ['tomorrow', '2026-11-05T08:00'],
      ['nextWeek', '2026-11-09T08:00'],
    ]);
  });

  it('moves "later today" to 20:00 in the evening and drops it at night', () => {
    expect(reminderPresets(new Date(2026, 10, 4, 18, 30), 1)[0]).toMatchObject({ preset: 'laterToday' });
    expect(toReminderString(reminderPresets(new Date(2026, 10, 4, 18, 30), 1)[0].date)).toBe('2026-11-04T20:00');
    expect(reminderPresets(new Date(2026, 10, 4, 21, 0), 1)[0].preset).toBe('tomorrow');
  });

  it('returns the time of a future one-off reminder and nothing once it has passed', () => {
    expect(toReminderString(nextReminderTime({ at: '2026-11-04T18:00' }, NOW)!)).toBe('2026-11-04T18:00');
    expect(nextReminderTime({ at: '2026-11-03T18:00' }, NOW)).toBeNull();
    expect(isReminderOverdue({ at: '2026-11-03T18:00' }, NOW)).toBe(true);
  });

  it('rolls a repeating reminder forward', () => {
    expect(toReminderString(nextReminderTime({ at: '2026-11-01T09:00', repeat: 'daily' }, NOW)!)).toBe('2026-11-05T09:00');
    expect(toReminderString(nextReminderTime({ at: '2026-10-20T09:00', repeat: 'weekly', interval: 2 }, NOW)!)).toBe('2026-11-17T09:00');
    expect(toReminderString(nextReminderTime({ at: '2026-01-31T09:00', repeat: 'monthly' }, NOW)!)).toBe('2026-11-30T09:00');
    expect(isReminderOverdue({ at: '2026-11-01T09:00', repeat: 'daily' }, NOW)).toBe(false);
  });

  it('formats relative days', () => {
    const words = { today: 'Today', tomorrow: 'Tomorrow' };
    expect(formatReminder(new Date(2026, 10, 4, 18, 0), enUS, words, NOW)).toBe('Today, 6:00 PM');
    expect(formatReminder(new Date(2026, 10, 5, 8, 0), enUS, words, NOW)).toBe('Tomorrow, 8:00 AM');
    expect(formatReminder(new Date(2026, 10, 9, 8, 0), enUS, words, NOW)).toBe('Mon 9 Nov, 8:00 AM');
  });

  it('lists overdue reminders first, then the soonest', () => {
    const note = (id: string, at: string) => ({ id, name: id, type: 'text', description: '', color: '', createdAt: '', pinned: false, reminder: { at } }) as Note;
    const order = notesWithReminders([note('later', '2026-11-10T09:00'), note('past', '2026-11-01T09:00'), note('soon', '2026-11-04T18:00'), { ...note('none', ''), reminder: undefined }], NOW);
    expect(order.map((r) => r.note.id)).toEqual(['past', 'soon', 'later']);
  });
});
