/**
 * Every localStorage key the app uses, in one place.
 *
 * Keys are per-origin, per-browser-profile, so each device and browser keeps its own
 * copy — and a key that is renamed without a migration is an address the app will
 * simply never look at again. That is why they are centralised here, and why
 * `storageMigration.ts` carries old names forward.
 *
 * Two naming rules:
 *   - App-owned settings use the `habitrkr.` prefix.
 *   - Data collections keep their plain names (`habits`, `notes`, ...). These are
 *     addressable by users through Profile → Export/Import and by `tagStorage.ts`,
 *     so a bare name is the clearer contract.
 */

/** The one key that is easy to forget when rebranding. */
const PREFIX = 'habitrkr';

const prefixed = (name: string) => `${PREFIX}.${name}`;

/** Theme preference: `'light'` | `'dark'`. */
export const THEME_KEY = prefixed('theme');

/** UI language code, e.g. `'en'`. */
export const LANGUAGE_KEY = prefixed('language');

/** Week start preference: `'monday'` | `'saturday'` | `'sunday'`. */
export const WEEK_START_KEY = prefixed('weekStartDay');

/** Record of which date ranges have already been repaired. */
export const REPAIRED_DATE_RANGES_KEY = prefixed('repairedDateRanges');

/** Profile display name. */
export const PROFILE_NAME_KEY = prefixed('profileName');

/** Profile avatar (base64 data URL). */
export const PROFILE_AVATAR_KEY = prefixed('profileAvatar');

/**
 * Keys whose names changed. `storageMigration.ts` copies any value found under an
 * old name to the new one, so nothing is lost on an existing install.
 *
 * Add to this map (never remove) whenever a key is renamed.
 */
export const RENAMED_KEYS: ReadonlyArray<{ old: string; current: string }> = [
  { old: 'habit-vault-theme', current: THEME_KEY },
  { old: 'app-language', current: LANGUAGE_KEY },
  { old: 'week-start-day', current: WEEK_START_KEY },
  { old: 'user-profile-name', current: PROFILE_NAME_KEY },
  { old: 'user-profile-avatar', current: PROFILE_AVATAR_KEY },
  { old: 'habitVault.repairedDateRanges', current: REPAIRED_DATE_RANGES_KEY },
];

/** The four places a Notes/Events view mode is stored. */
export const VIEW_TYPE_KEYS: readonly string[] = [
  'notesAllViewType',
  'notesArchivedViewType',
  'eventsAllViewType',
  'eventsArchivedViewType',
];

/**
 * Keys that kept their name but whose stored VALUES were renamed, so the old value has
 * to be rewritten in place.
 *
 * The view modes were `medium`/`large`, which described card size; they are now `x3`/`x2`,
 * which describe the cards per row and match the labels in the UI. A stored `medium`
 * would otherwise match no known mode and the page would fall back to `list`.
 *
 * Add to this map (never remove) whenever a stored value is renamed.
 */
export const RETIRED_VALUES: ReadonlyArray<{ key: string; values: Record<string, string> }> =
  VIEW_TYPE_KEYS.map((key) => ({ key, values: { medium: 'x3', large: 'x2' } }));
