import { useMemo } from 'react';
import { format, isAfter, isSameDay, startOfDay } from 'date-fns';
import { BellRing, Check, Lock, Minus, Plus } from 'lucide-react';
import { Event } from '@/types/event';
import { Habit } from '@/types/habit';
import { Note } from '@/types/note';
import { CalendarEventItem } from '@/components/calendar/CalendarEventItem';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { isHabitScheduledOn } from '@/lib/habitCompletion';
import { nextReminderTime } from '@/lib/noteReminders';
import { toDateKey } from '@/lib/dateUtils';
import { highlightText } from '@/lib/textHighlight';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDateLocale } from '@/lib/dateLocale';
import { cn } from '@/lib/utils';

interface CalendarTodayViewProps {
  date: Date;
  events: Event[];
  habits: Habit[];
  notes: Note[];
  searchQuery?: string;
  onViewEvent: (event: Event) => void;
  onToggleHabit: (habitId: string, date: Date) => void;
  onMarkDone: (habitId: string) => void;
  onMarkUnlimitedDone: (habitId: string) => void;
  onUndo: (habitId: string) => void;
}

const startTimeOf = (event: Event) => event.startTime || event.time || '';

/** A small heading above each group, in the same quiet style as the settings sections. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pb-1.5 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

/**
 * "Today": everything that belongs to one day in a single list — its events, the notes
 * whose reminder falls on it, and the habits to do. It replaces the hour-by-hour grid,
 * which showed only events and left most of the screen empty.
 */
export function CalendarTodayView({
  date,
  events,
  habits,
  notes,
  searchQuery = '',
  onViewEvent,
  onToggleHabit,
  onMarkDone,
  onMarkUnlimitedDone,
  onUndo,
}: CalendarTodayViewProps) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  const today = startOfDay(new Date());
  const isToday = isSameDay(date, today);
  const isFuture = isAfter(startOfDay(date), today);
  const dateKey = toDateKey(date);
  const query = searchQuery.trim().toLowerCase();

  // All-day events first, then by start time.
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => {
      const aAll = a.isAllDay || !startTimeOf(a);
      const bAll = b.isAllDay || !startTimeOf(b);
      if (aAll !== bAll) return aAll ? -1 : 1;
      return startTimeOf(a).localeCompare(startTimeOf(b));
    }),
    [events],
  );

  // Notes whose reminder rings on this day, in time order. A repeating reminder is rolled
  // forward from the start of the day, so it shows on every day it rings, not just the next.
  const dayReminders = useMemo(() => {
    const dayStart = startOfDay(date);
    return notes
      .filter((note) => note.reminder && !note.archived)
      .map((note) => ({ note, at: nextReminderTime(note.reminder!, dayStart) }))
      .filter((entry): entry is { note: Note; at: Date } => !!entry.at && isSameDay(entry.at, date))
      .filter(({ note }) => !query || note.locked || note.name.toLowerCase().includes(query))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [notes, date, query]);

  const dayHabits = useMemo(
    () => habits
      .filter((habit) => !habit.archived && isHabitScheduledOn(habit, date) && startOfDay(new Date(habit.createdAt)) <= startOfDay(date))
      .filter((habit) => !query || habit.name.toLowerCase().includes(query)),
    [habits, date, query],
  );

  if (sortedEvents.length === 0 && dayReminders.length === 0 && dayHabits.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('nothingPlanned')}</p>;
  }

  return (
    <div className="space-y-5 mt-2">
      {sortedEvents.length > 0 && (
        <section aria-label={t('events')}>
          <SectionTitle>{t('events')}</SectionTitle>
          <div className="space-y-2">
            {sortedEvents.map((event) => (
              <CalendarEventItem key={event.id} event={event} searchQuery={searchQuery} onClick={() => onViewEvent(event)} />
            ))}
          </div>
        </section>
      )}

      {dayReminders.length > 0 && (
        <section aria-label={t('reminders')}>
          <SectionTitle>{t('reminders')}</SectionTitle>
          <div className="space-y-2">
            {dayReminders.map(({ note, at }) => (
              <ColoredCard key={note.id} color={note.color} className="flex items-center gap-3 px-3 py-2.5">
                <BellRing size={20} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {note.locked ? t('reminder') : (note.name ? highlightText(note.name, searchQuery) : t('untitledItem'))}
                </span>
                {note.locked && <Lock size={20} className="shrink-0" aria-hidden="true" />}
                <span className="shrink-0 text-sm tabular-nums">{format(at, 'p', { locale: dateLocale })}</span>
              </ColoredCard>
            ))}
          </div>
        </section>
      )}

      {dayHabits.length > 0 && (
        <section aria-label={t('habits')}>
          <SectionTitle>{t('habits')}</SectionTitle>
          <div className="space-y-2">
            {dayHabits.map((habit) => {
              const count = habit.completionCounts?.[dateKey] || 0;
              const done = habit.completedDates.includes(dateKey);
              const target = habit.timesPerDay || 1;
              const hasColor = !isDefaultColor(habit.color);
              // Counters only move on the current day, as on the Habits page; any other
              // past day is a plain tick, and the future cannot be ticked yet.
              const counted = (habit.useTimesPerDay || habit.useUnlimitedTimes) && isToday;
              const full = habit.useTimesPerDay && count >= target;
              const unlimitedHit = habit.useUnlimitedTimes && count > 0;
              const ticked = habit.useUnlimitedTimes ? unlimitedHit : done;
              const pill = 'flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-medium transition-colors';
              return (
                <ColoredCard key={habit.id} color={habit.color} className="flex items-center gap-3 px-3 py-2.5">
                  <div className={cn('min-w-0 flex-1', hasColor ? 'text-cocoa' : 'text-foreground')}>
                    <p className="truncate text-sm font-medium">{highlightText(habit.name, searchQuery)}</p>
                    {habit.description && (
                      <p className={cn('truncate text-xs', hasColor ? 'text-cocoa/90' : 'text-muted-foreground')}>{habit.description}</p>
                    )}
                  </div>

                  {counted && count > 0 && (
                    <button
                      type="button"
                      aria-label={t('undo')}
                      onClick={() => onUndo(habit.id)}
                      className={cn(pill, 'w-8 border-foreground/40 hover:bg-foreground/10', hasColor && 'border-black/40 text-cocoa')}
                    >
                      <Minus size={14} />
                    </button>
                  )}

                  {counted ? (
                    <button
                      type="button"
                      disabled={!!full}
                      aria-label={habit.useUnlimitedTimes ? '+1' : t('timesTodayOf').replace('{done}', String(count)).replace('{total}', String(target))}
                      onClick={() => (habit.useUnlimitedTimes ? onMarkUnlimitedDone(habit.id) : onMarkDone(habit.id))}
                      className={cn(
                        pill, 'gap-1',
                        ticked || full ? 'border-leaf bg-leaf text-leaf-foreground' : hasColor ? 'border-black/40 text-cocoa hover:bg-black/10' : 'border-foreground/40 hover:bg-foreground/10',
                        full && 'cursor-default',
                      )}
                    >
                      {habit.useUnlimitedTimes ? `${count}x` : `${count}/${target}`}
                      {!full && <Plus size={14} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isFuture}
                      aria-pressed={done}
                      aria-label={`${habit.name}${done ? `, ${t('done')}` : ''}`}
                      onClick={() => onToggleHabit(habit.id, date)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        done ? 'border-leaf bg-leaf text-leaf-foreground' : hasColor ? 'border-black/40 hover:bg-black/10' : 'border-foreground/40 hover:bg-foreground/10',
                      )}
                    >
                      {done && <Check size={16} />}
                    </button>
                  )}
                </ColoredCard>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
