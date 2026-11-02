/**
 * Local-calendar date helpers.
 *
 * The app previously derived date keys with `new Date().toISOString().split('T')[0]`,
 * which yields the **UTC** calendar day. Those keys were then compared against keys
 * built with date-fns `format(date, 'yyyy-MM-dd')`, which is the **local** calendar
 * day. The two disagree for part of every day in any non-UTC timezone, so completions
 * landed on the wrong day (and the weekly grid looked them up under the wrong key).
 *
 * Every "which day is this?" decision must go through this module so the convention
 * is local time everywhere. Never use `toISOString()` to produce a date key.
 */

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Formats a Date as a `yyyy-MM-dd` local-calendar key.
 * This is the single source of truth for date keys across the app.
 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's local-calendar key, e.g. `2026-09-21`. */
export function getTodayKey(): string {
  return toDateKey(new Date());
}

/**
 * The UTC-calendar key for a date. Only used to *detect* keys written by the old
 * buggy code during migration — never as a storage key.
 */
export function toUtcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Parses a `yyyy-MM-dd` key into a Date at local midnight.
 * Returns null for malformed input so callers can skip rather than corrupt data.
 */
export function fromDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Reads a stored date for display or comparison. A bare `yyyy-MM-dd` key is a local day:
 * `new Date('2026-11-09')` would read it as UTC midnight, which is Nov 8 anywhere west of
 * Greenwich. Anything else (a full ISO timestamp) is passed to `new Date` as before.
 */
export function parseStoredDate(value: string): Date | null {
  const date = fromDateKey(value) ?? new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses a `yyyy-MM-dd` key as a UTC instant.
 * Used only by the migration, which has to reinterpret legacy UTC-written keys.
 * Returns null for malformed input.
 */
export function fromUtcDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Detects whether a stored key looks like it was produced by the old UTC-based code.
 *
 * A key is "UTC-written" when reinterpreting it as a UTC instant yields a different
 * local calendar day — i.e. the local offset pushed it across midnight.
 */
export function isUtcStyleKey(key: string): boolean {
  const utcDate = fromUtcDateKey(key);
  if (!utcDate) return false;
  return toDateKey(utcDate) !== key;
}

/**
 * Rewrites a single stored date key from the old UTC convention to the local one.
 *
 * The old code wrote a UTC calendar day as the key, so the number stored under
 * `2026-07-14` was really the local day `2026-07-15` (in UTC+1). We therefore
 * reinterpret the key as a UTC instant and re-derive its local calendar day.
 *
 * Returns the original key unchanged when it is unparseable, and when no shift is
 * needed (which is why a shift must never be applied twice — see `dateMigration.ts`).
 */
export function migrateDateKey(key: string): string {
  const utcDate = fromUtcDateKey(key);
  if (!utcDate) return key;
  return toDateKey(utcDate);
}
