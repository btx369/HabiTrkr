/**
 * Backup export and import.
 *
 * Version 1 exported a hand-written list of keys, which silently fell behind the app:
 * archived habits, habit folders, tags and several settings were never in the file, so
 * restoring a backup lost them. It also parsed every value as JSON and wrote it back with
 * JSON.stringify, which wrapped raw-string settings (theme, language) in quotes and made
 * the app reset them to their defaults on import.
 *
 * Version 2 therefore stores EVERY key the app has written, as the exact string that is in
 * localStorage. Nothing has to be listed, and nothing is re-encoded on the way back.
 *
 * Import is all-or-nothing: the file is validated in full before anything is written, and
 * if a write fails part-way (usually a full storage quota) every key is put back as it was.
 */

import {
  isAppKey,
  LANGUAGE_KEY,
  PROFILE_AVATAR_KEY,
  PROFILE_NAME_KEY,
  THEME_KEY,
  WEEK_START_KEY,
} from './storageKeys';
import { clearMedia, dehydrateText, hydrateText, MEDIA_KEYS } from './mediaStore';

export const BACKUP_VERSION = 2;

/** Bookkeeping that describes this install, not the user's data. */
const NOT_BACKED_UP = new Set(['habitrkr.storageKeysMigrated']);

/** Collections the app cannot open if they hold something other than a list of items. */
const COLLECTION_KEYS = [
  'notes', 'archivedNotes', 'folders', 'archivedFolders',
  'habits', 'archivedHabits', 'habitFolders', 'archivedHabitFolders',
  'events', 'archivedEvents', 'eventFolders', 'archivedEventFolders',
] as const;

/**
 * Settings stored as a bare string rather than JSON. A version 1 backup holds their value
 * unquoted, so it must be written back as-is.
 */
const RAW_STRING_KEYS = new Set([THEME_KEY, LANGUAGE_KEY, WEEK_START_KEY, PROFILE_NAME_KEY, PROFILE_AVATAR_KEY]);

/** Keys a backup may write: plain identifiers only, so a crafted file cannot smuggle odd names in. */
const VALID_KEY = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export interface BackupFileV2 {
  app: 'habitrkr';
  version: 2;
  exportedAt: string;
  data: Record<string, string>;
}

export class BackupError extends Error {
  constructor(public readonly reason: 'invalid' | 'storage') {
    super(reason);
  }
}

/** Every app key in localStorage, as stored. */
export function createBackup(): BackupFileV2 {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Only HabiTrkr's keys: the published origin can hold other sites' data too.
    if (key === null || NOT_BACKED_UP.has(key) || !isAppKey(key)) continue;
    const value = localStorage.getItem(key);
    // Media lives in IndexedDB; the file must carry it so a backup is complete on its own.
    if (value !== null) data[key] = (MEDIA_KEYS as readonly string[]).includes(key) ? hydrateText(value) : value;
  }
  return { app: 'habitrkr', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A collection must be a list of objects that each carry a string id. */
function isValidCollection(raw: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  return Array.isArray(parsed) && parsed.every((item) => isRecord(item) && typeof item.id === 'string');
}

/**
 * Turns a parsed backup file of either version into the exact strings to store.
 * Throws BackupError('invalid') when the file is not a usable backup.
 */
export function readBackup(file: unknown): Record<string, string> {
  if (!isRecord(file)) throw new BackupError('invalid');

  let entries: Record<string, string>;

  if (file.version === BACKUP_VERSION) {
    if (file.app !== 'habitrkr' || !isRecord(file.data)) throw new BackupError('invalid');
    entries = {};
    for (const [key, value] of Object.entries(file.data)) {
      if (typeof value !== 'string') throw new BackupError('invalid');
      entries[key] = value;
    }
  } else if (file.version === 1 || file.version === undefined) {
    // Version 1 put each key at the top level, already parsed from JSON.
    entries = {};
    for (const [key, value] of Object.entries(file)) {
      if (key === 'version' || key === 'exportedAt' || value === undefined) continue;
      entries[key] = RAW_STRING_KEYS.has(key) && typeof value === 'string' ? value : JSON.stringify(value);
    }
  } else {
    throw new BackupError('invalid');
  }

  for (const key of Object.keys(entries)) {
    if (!VALID_KEY.test(key) || NOT_BACKED_UP.has(key) || !isAppKey(key)) delete entries[key];
  }

  for (const key of COLLECTION_KEYS) {
    if (key in entries && !isValidCollection(entries[key])) throw new BackupError('invalid');
  }

  // A file with none of the app's data is almost certainly the wrong file.
  if (!COLLECTION_KEYS.some((key) => key in entries)) throw new BackupError('invalid');

  return entries;
}

/**
 * Writes every entry, or none. Keys the backup does not mention are left alone, so an
 * older backup never wipes data it did not know about.
 */
export function applyBackup(entries: Record<string, string>): void {
  // Move the backup's photos and recordings into IndexedDB so they do not fill localStorage.
  for (const key of MEDIA_KEYS) if (key in entries) entries[key] = dehydrateText(entries[key]);
  const previous = new Map<string, string | null>();
  for (const key of Object.keys(entries)) previous.set(key, localStorage.getItem(key));

  try {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  } catch (error) {
    console.error('Backup import failed, restoring previous data:', error);
    for (const [key, value] of previous) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Best effort: keep restoring the remaining keys.
      }
    }
    throw new BackupError('storage');
  }
}

/**
 * "Delete all data": removes every HabiTrkr key on this device (and nothing else on the
 * origin), plus the session's reminder timers. Passkeys made for fingerprint unlock live
 * in the device's password manager and are removed there.
 */
export function clearAllAppData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && isAppKey(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  void clearMedia();
  sessionStorage.removeItem('notificationTimeouts');
}
