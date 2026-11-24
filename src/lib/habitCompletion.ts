import { Habit } from '@/types/habit';

/**
 * How a habit's completions change when it is ticked, counted or undone.
 *
 * Each function takes the whole list and returns the next one, so a page can hand them
 * straight to its `setHabits(prev => ...)`. They were written inside the Habits page; the
 * Calendar's "Today" view needs the same rules, and two copies would drift apart.
 */

/** Tick or untick one day. A "times per day" habit keeps its counter in step: done means the full target. */
export function toggleCompletion(habits: Habit[], habitId: string, dateKey: string): Habit[] {
  return habits.map((habit) => {
    if (habit.id !== habitId) return habit;
    const isCompleted = habit.completedDates.includes(dateKey);
    const completedDates = isCompleted
      ? habit.completedDates.filter((d) => d !== dateKey)
      : [...habit.completedDates, dateKey];
    if (!habit.useTimesPerDay) return { ...habit, completedDates };

    const { [dateKey]: _previous, ...otherCounts } = habit.completionCounts ?? {};
    return {
      ...habit,
      completedDates,
      completionCounts: isCompleted ? otherCounts : { ...otherCounts, [dateKey]: habit.timesPerDay || 1 },
    };
  });
}

/** One more time today for a "times per day" habit, or a plain tick for any other. */
export function markDone(habits: Habit[], habitId: string, dateKey: string): Habit[] {
  return habits.map((habit) => {
    if (habit.id !== habitId) return habit;
    if (habit.useTimesPerDay) {
      const newCount = (habit.completionCounts?.[dateKey] || 0) + 1;
      const reached = newCount >= (habit.timesPerDay || 1) && !habit.completedDates.includes(dateKey);
      return {
        ...habit,
        completionCounts: { ...habit.completionCounts, [dateKey]: newCount },
        completedDates: reached ? [...habit.completedDates, dateKey] : habit.completedDates,
      };
    }
    if (!habit.completedDates.includes(dateKey)) {
      return { ...habit, completedDates: [...habit.completedDates, dateKey] };
    }
    return habit;
  });
}

/** +1 for a habit that can be done any number of times a day. */
export function markUnlimitedDone(habits: Habit[], habitId: string, dateKey: string): Habit[] {
  return habits.map((habit) =>
    habit.id === habitId
      ? { ...habit, completionCounts: { ...habit.completionCounts, [dateKey]: (habit.completionCounts?.[dateKey] || 0) + 1 } }
      : habit,
  );
}

/** Take one back: a count down by one, or the tick removed for a plain habit. */
export function undoCompletion(habits: Habit[], habitId: string, dateKey: string): Habit[] {
  return habits.map((habit) => {
    if (habit.id !== habitId) return habit;
    const currentCount = habit.completionCounts?.[dateKey] || 0;
    if (currentCount > 0) {
      const newCount = currentCount - 1;
      const dropTick = habit.useTimesPerDay && newCount < (habit.timesPerDay || 1) && habit.completedDates.includes(dateKey);
      return {
        ...habit,
        completionCounts: { ...habit.completionCounts, [dateKey]: newCount },
        completedDates: dropTick ? habit.completedDates.filter((d) => d !== dateKey) : habit.completedDates,
      };
    }
    if (!habit.useTimesPerDay && !habit.useUnlimitedTimes && habit.completedDates.includes(dateKey)) {
      return { ...habit, completedDates: habit.completedDates.filter((d) => d !== dateKey) };
    }
    return habit;
  });
}

/**
 * Whether a habit is on the schedule for a day. `activeDays` runs Monday to Sunday; habits
 * counted per week, per day or without limit are open every day.
 */
export function isHabitScheduledOn(habit: Habit, date: Date): boolean {
  if (habit.useNumberOfDays || habit.useTimesPerDay || habit.useUnlimitedTimes) return true;
  return habit.activeDays?.[(date.getDay() + 6) % 7] ?? true;
}
