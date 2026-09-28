/**
 * Optional repair for habit completions written under the old UTC date-key bug.
 *
 * ## Background
 *
 * The old code keyed completions with `new Date().toISOString().split('T')[0]` — the
 * **UTC** calendar day — while the weekly grid looked them up by the **local** day.
 * For taps inside the "divergence window" the two disagree, so those completions were
 * filed one day off (always *earlier* than the local day the user actually tapped).
 *
 * The divergence window depends on the zone:
 *   - UTC+0 (Lisbon in winter): none
 *   - UTC+1 (Lisbon in summer): 00:00-01:00 local, ~4% of hours
 *   - UTC+9 (Tokyo):            00:00-09:00 local, ~38% of hours
 *
 * ## Why this is NOT an automatic migration
 *
 * A stored UTC key and a stored local key are indistinguishable by value — `2026-01-09`
 * could legitimately be either. Any blanket rewrite therefore has to guess a shift
 * direction, and it would guess wrong for half the world's timezones (it fixes New
 * York but corrupts Tokyo). Silently rewriting historical data on a guess is worse
 * than leaving it alone, so nothing here runs automatically.
 *
 * ## Using it
 *
 * Inspect first, then repair a specific range. Every entry in the window shifts
 * forward by one day; nothing outside the window is touched.
 *
 * ```js
 * // In the browser console:
 * import('/src/lib/dateMigration.ts').then((m) => {
 *   console.table(m.inspectHabitDateKeys());
 *   // Trust the count, then apply for the season your data covers:
 *   m.repairHabitDateKeys('2026-04-01', '2026-10-31');
 * });
 * ```
 */

import { getLocalStorageItem, setLocalStorageItem, getLocalStorageString, setLocalStorageString } from './localStorageUtils';
import { fromDateKey, getTodayKey, toDateKey } from './dateUtils';
import { REPAIRED_DATE_RANGES_KEY } from './storageKeys';

const HABIT_KEYS = ['habits', 'archivedHabits'] as const;

interface RepairedRange {
  start: string;
  end: string;
  /** ISO timestamp of when the repair ran. */
  at: string;
}

interface HasCompletionData {
  completedDates?: string[];
  completionCounts?: Record<string, number>;
}

function readRepairedRanges(): RepairedRange[] {
  const raw = getLocalStorageString(REPAIRED_DATE_RANGES_KEY, '[]');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRepairedRanges(ranges: RepairedRange[]): void {
  setLocalStorageString(REPAIRED_DATE_RANGES_KEY, JSON.stringify(ranges));
}

/** True when `[start, end]` overlaps any range already repaired. */
function overlapsRepairedRange(start: string, end: string): RepairedRange | null {
  return (
    readRepairedRanges().find((r) => start <= r.end && r.start <= end) ?? null
  );
}

/** Shifts a `yyyy-MM-dd` key forward by one calendar day. */
function nextDayKey(key: string): string {
  const date = fromDateKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + 1);
  return toDateKey(date);
}

export interface DateKeyReport {
  storageKey: string;
  habitName: string;
  /** Entries that fall inside the supplied window (candidates for repair). */
  entriesInWindow: number;
  /** Distinct keys inside the window, for eyeballing. */
  sampleKeys: string[];
}

/**
 * Reports habit completions that fall inside `[startKey, endKey]` inclusive.
 * Read-only — safe to call at any time.
 */
export function inspectHabitDateKeys(startKey: string, endKey: string): DateKeyReport[] {
  const report: DateKeyReport[] = [];

  for (const storageKey of HABIT_KEYS) {
    const habits = getLocalStorageItem<Array<HasCompletionData & { name?: string }> | null>(storageKey, null);
    if (!Array.isArray(habits)) continue;

    for (const habit of habits) {
      const inWindow = (key: string) => key >= startKey && key <= endKey;
      const dates = (habit.completedDates ?? []).filter(inWindow);
      const counts = Object.keys(habit.completionCounts ?? {}).filter(inWindow);
      const all = Array.from(new Set([...dates, ...counts]));

      if (all.length > 0) {
        report.push({
          storageKey,
          habitName: habit.name ?? '(unnamed)',
          entriesInWindow: all.length,
          sampleKeys: all.slice(0, 5),
        });
      }
    }
  }

  return report;
}

/**
 * Rewrites habit completions inside `[startKey, endKey]` inclusive, shifting each key
 * forward one day to correct the old UTC filing.
 *
 * Only call this for a range you have confirmed is affected — see `inspectHabitDateKeys`
 * and the divergence-window notes above. The repair is idempotent: a key is shifted only
 * when the habit has no completion already on the following day, so re-running it over
 * the same window will not push dates forward twice.
 *
 * @returns the number of habits changed.
 */
export function repairHabitDateKeys(
  startKey: string,
  endKey: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): number {
  const today = getTodayKey();
  if (endKey > today) {
    throw new Error(
      `Refusing to repair into the future (endKey ${endKey} is after today ${today}). ` +
        `Pass an explicit end date that is not in the future.`,
    );
  }
  if (startKey > endKey) {
    throw new Error(`startKey (${startKey}) must not be after endKey (${endKey}).`);
  }

  // Refuse to shift the same days twice. A repaired date cannot be told apart from a
  // genuine one, so this record is the only thing preventing slow drift.
  const alreadyRepaired = overlapsRepairedRange(startKey, endKey);
  if (alreadyRepaired && !dryRun) {
    throw new Error(
      `Range ${startKey}..${endKey} overlaps a range already repaired on ` +
        `${alreadyRepaired.at} (${alreadyRepaired.start}..${alreadyRepaired.end}). ` +
        `Re-running would shift those completions a second time.`,
    );
  }

  let changedHabits = 0;

  for (const storageKey of HABIT_KEYS) {
    const habits = getLocalStorageItem<Array<HasCompletionData> | null>(storageKey, null);
    if (!Array.isArray(habits) || habits.length === 0) continue;

    let storageChanged = false;

    const repaired = habits.map((habit) => {
      const inWindow = (key: string) => key >= startKey && key <= endKey;
      // A key is only shifted if this habit has no completion already sitting on the
      // following day. That makes the repair idempotent: re-running it over the same
      // window cannot push a date forward twice.
      const hasEntryOn = (key: string) =>
        (habit.completedDates ?? []).includes(key) ||
        Object.prototype.hasOwnProperty.call(habit.completionCounts ?? {}, key);
      const shouldShift = (key: string) => inWindow(key) && !hasEntryOn(nextDayKey(key));

      let changed = false;

      const completedDates = habit.completedDates ?? [];
      const nextDates = completedDates.map((key) => {
        if (!shouldShift(key)) return key;
        changed = true;
        return nextDayKey(key);
      });

      const counts = habit.completionCounts;
      let nextCounts = counts;
      if (counts) {
        nextCounts = {};
        for (const [key, count] of Object.entries(counts)) {
          if (!shouldShift(key)) {
            nextCounts[key] = count;
            continue;
          }
          changed = true;
          const shifted = nextDayKey(key);
          const existing = nextCounts[shifted];
          nextCounts[shifted] = typeof existing === 'number' ? Math.max(existing, count) : count;
        }
      }

      if (!changed) return habit;
      storageChanged = true;
      changedHabits++;
      return {
        ...habit,
        completedDates: Array.from(new Set(nextDates)),
        completionCounts: nextCounts,
      };
    });

    if (storageChanged && !dryRun) {
      setLocalStorageItem(storageKey, repaired);
    }
  }

  if (!dryRun && changedHabits > 0) {
    writeRepairedRanges([
      ...readRepairedRanges(),
      { start: startKey, end: endKey, at: new Date().toISOString() },
    ]);
  }

  return changedHabits;
}

/**
 * Clears the record of repaired ranges, allowing a range to be repaired again.
 * Intended for recovering from an accidental repair — use with care, since the whole
 * point of the record is to stop a range being shifted twice.
 */
export function forgetRepairedRanges(): void {
  writeRepairedRanges([]);
}

/** Lists the ranges already repaired, for display/debugging. */
export function listRepairedRanges(): RepairedRange[] {
  return readRepairedRanges();
}
