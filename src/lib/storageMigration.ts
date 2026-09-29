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

import { RENAMED_KEYS, RETIRED_VALUES } from './storageKeys';

const ALREADY_MIGRATED_KEY = 'habitrkr.storageKeysMigrated';

/**
 * Bump when the migration gains work that existing installs still need. An earlier
 * version of this migration rewrote the view values without keeping their JSON
 * encoding, leaving the key unreadable; bumping makes the corrected pass run again.
 */
const MIGRATION_VERSION = 2;

export interface StorageMigrationResult {
  /** Old key -> new key, for every value that was actually carried over. */
  migrated: Array<{ from: string; to: string }>;
  /** Keys that already had a value at the new address, so the old one was dropped. */
  superseded: string[];
  /** Stored values rewritten in place, e.g. a view mode renamed from `medium` to `x3`. */
  valuesRewritten: Array<{ key: string; from: string; to: string }>;
  /** True when this call did the work; false when it had already run. */
  ran: boolean;
}

/**
 * Copies values from every renamed key to its current name, and rewrites stored values
 * whose meaning was renamed.
 *
 * @param force re-run even if the migration marker is set (used by tests).
 */
export function migrateStorageKeys(force = false): StorageMigrationResult {
  const result: StorageMigrationResult = { migrated: [], superseded: [], valuesRewritten: [], ran: false };

  try {
    if (typeof window === 'undefined' || !window.localStorage) return result;

    if (!force && window.localStorage.getItem(ALREADY_MIGRATED_KEY) === String(MIGRATION_VERSION)) {
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

    // Values that kept their key but whose meaning was renamed. Without this the stored
    // preference matches no known mode and the page silently falls back to its default.
    //
    // The value must be written back in the SAME encoding it was read in. These keys are
    // written by useLocalStorage, so they hold JSON (`"medium"`, quotes included); writing
    // a bare `x3` would make JSON.parse throw, the read would fall back to the default,
    // and the user's saved view would silently reset. Raw values are handled too, since
    // nothing guarantees every writer used JSON.
    for (const { key, values } of RETIRED_VALUES) {
      const stored = window.localStorage.getItem(key);
      if (stored === null) continue;

      let decoded = stored;
      let wasJson = false;
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'string') {
          decoded = parsed;
          wasJson = true;
        }
      } catch {
        // Not JSON: treat the raw string as the value.
      }

      const replacement = values[decoded];
      if (replacement === undefined) continue;

      window.localStorage.setItem(key, wasJson ? JSON.stringify(replacement) : replacement);
      result.valuesRewritten.push({ key, from: decoded, to: replacement });
    }

    window.localStorage.setItem(ALREADY_MIGRATED_KEY, String(MIGRATION_VERSION));
    return result;
  } catch (error) {
    // A storage failure must never stop the app from starting.
    console.error('Storage key migration failed:', error);
    return result;
  }
}
