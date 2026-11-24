import { describe, expect, it } from 'vitest';
import { Habit } from '@/types/habit';
import { isHabitScheduledOn, markDone, markUnlimitedDone, toggleCompletion, undoCompletion } from './habitCompletion';

const base: Habit = { id: 'h', name: 'x', color: '#FFFFFF', createdAt: '2026-01-01', completedDates: [], activeDays: [true, true, true, true, true, true, true] };
const day = '2026-11-24';

describe('habit completion', () => {
  it('toggles a plain habit on and off', () => {
    const on = toggleCompletion([base], 'h', day);
    expect(on[0].completedDates).toEqual([day]);
    expect(toggleCompletion(on, 'h', day)[0].completedDates).toEqual([]);
  });

  it('keeps the counter in step for a "times per day" habit', () => {
    const habit = { ...base, useTimesPerDay: true, timesPerDay: 3 };
    const on = toggleCompletion([habit], 'h', day)[0];
    expect(on.completionCounts?.[day]).toBe(3);
    expect(toggleCompletion([on], 'h', day)[0].completionCounts?.[day]).toBeUndefined();
  });

  it('counts up to the target and then ticks the day', () => {
    let list: Habit[] = [{ ...base, useTimesPerDay: true, timesPerDay: 2 }];
    list = markDone(list, 'h', day);
    expect(list[0].completedDates).toEqual([]);
    list = markDone(list, 'h', day);
    expect(list[0].completedDates).toEqual([day]);
    list = undoCompletion(list, 'h', day);
    expect(list[0].completedDates).toEqual([]);
    expect(list[0].completionCounts?.[day]).toBe(1);
  });

  it('adds one for an unlimited habit and undoes it', () => {
    let list: Habit[] = [{ ...base, useUnlimitedTimes: true }];
    list = markUnlimitedDone(markUnlimitedDone(list, 'h', day), 'h', day);
    expect(list[0].completionCounts?.[day]).toBe(2);
    expect(undoCompletion(list, 'h', day)[0].completionCounts?.[day]).toBe(1);
  });

  it('reads the schedule Monday to Sunday', () => {
    const mondayOnly = { ...base, activeDays: [true, false, false, false, false, false, false] };
    expect(isHabitScheduledOn(mondayOnly, new Date('2026-11-23T12:00:00'))).toBe(true); // Monday
    expect(isHabitScheduledOn(mondayOnly, new Date('2026-11-29T12:00:00'))).toBe(false); // Sunday
    expect(isHabitScheduledOn({ ...mondayOnly, useUnlimitedTimes: true }, new Date('2026-11-29T12:00:00'))).toBe(true);
  });
});
