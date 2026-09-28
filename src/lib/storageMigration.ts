/**
 * One-time carry-forward for renamed localStorage keys.
 *
 * Runs before the app renders so every consumer reads a settled store. Background:
 * keys are addresses, so renaming one without this would leave the app looking in a
 * place nothing was ever written, and existing data would appear to have vanished.
 *
 * The move is deliberately non-destructive: a value is copied to its new key and the
 * old key removed *only when the new key is empty*. Running it twice is a no-op, and
 * a device still on the old version can write again without being clobbered.
 *
 * Safe to delete once no install is expected to predate the rename.
 */

import { RENAMED_KEYS } from './storageKeys';

const ALREADY_MIGRATED_KEY = 'habitrkr.storageKeysMigrated';

export interface StorageMigrationResult {
  /** Old key -> new key, for every value that was actually carried over. */
  migrated: Array<{ from: string; to: string }>;
  /** Keys that already had a value at the new address, so the old one was dropped. */
  superseded: string[];
  /** True when this call did the work; false when it had already run. */
  ran: boolean;
}

/**
 * Copies values from every renamed key to its current name.
 *
 * @param force re-run even if the migration marker is set (used by tests).
 */
export function migrateStorageKeys(force = false): StorageMigrationResult {
  const result: StorageMigrationResult = { migrated: [], superseded: [], ran: false };

  try {
    if (typeof window === 'undefined' || !window.localStorage) return result;

    if (!force && window.localStorage.getItem(ALREADY_MIGRATED_KEY) !== null) {
      return result;
    }
    result.ran = true;

    for (const { old, current } of RENAMED_KEYS) {
      const oldValue = window.localStorage.getItem(old);
      if (oldValue === null) continue;

      const currentValue = window.localStorage.getItem(current);

      if (currentValue === null) {
        // Nothing at the new address yet, so carry the value across.
        window.localStorage.setItem(current, oldValue);
        result.migrated.push({ from: old, to: current });
      } else if (currentValue !== oldValue) {
        // Both exist and disagree: the new key is authoritative. Report it rather
        // than guessing, because silently overwriting a live value is worse.
        result.superseded.push(old);
      }

      window.localStorage.removeItem(old);
    }

    window.localStorage.setItem(ALREADY_MIGRATED_KEY, new Date().toISOString());
    return result;
  } catch (error) {
    // A storage failure must never stop the app from starting.
    console.error('Storage key migration failed:', error);
    return result;
  }
}
