import { Note } from '@/types/note';
import { Event } from '@/types/event';
import { Habit } from '@/types/habit';
import { NoteFolder } from '@/types/noteFolder';
import { EventFolder } from '@/types/eventFolder';
import { HabitFolder } from '@/types/habitFolder';

/**
 * Folders that collect items by tag ("auto-import").
 *
 * A folder with the rule on takes every item carrying one of its tags. An item lives in one
 * folder at most, the same as Move enforces, so an item already filed elsewhere is left where
 * it is, and when two folders match, the first one takes it. Tags compare case-insensitively.
 *
 * It runs when an item is saved with tags and when a folder's rule is saved, so items that
 * already had the tag are collected too, not only the ones tagged afterwards.
 */

interface AutoImportFolder {
  id: string;
  autoImportEnabled?: boolean;
  autoImportTags?: string[];
}

interface Tagged {
  id: string;
  tags?: string[];
}

interface FolderIds<F> {
  idsOf: (folder: F) => string[];
  withIds: (folder: F, ids: string[]) => F;
}

const normalise = (tag: string) => tag.replace(/^#/, '').toLowerCase();

function matches(folder: AutoImportFolder, item: Tagged): boolean {
  if (!folder.autoImportEnabled || !folder.autoImportTags?.length || !item.tags?.length) return false;
  const wanted = new Set(folder.autoImportTags.map(normalise));
  return item.tags.some((tag) => wanted.has(normalise(tag)));
}

/** Files one item into the first folder whose rule it matches, unless it is already filed. */
export function autoImportItem<F extends AutoImportFolder>(item: Tagged, folders: F[], { idsOf, withIds }: FolderIds<F>): F[] {
  if (folders.some((folder) => idsOf(folder).includes(item.id))) return folders;
  const target = folders.find((folder) => matches(folder, item));
  if (!target) return folders;
  return folders.map((folder) => (folder.id === target.id ? withIds(folder, [...idsOf(folder), item.id]) : folder));
}

/** Collects into one folder every unfiled item that matches its rule. */
export function autoImportExisting<F extends AutoImportFolder>(folderId: string, items: Tagged[], folders: F[], { idsOf, withIds }: FolderIds<F>): F[] {
  const folder = folders.find((entry) => entry.id === folderId);
  if (!folder) return folders;
  const filed = new Set(folders.flatMap(idsOf));
  const incoming = items.filter((item) => !filed.has(item.id) && matches(folder, item)).map((item) => item.id);
  if (incoming.length === 0) return folders;
  return folders.map((entry) => (entry.id === folderId ? withIds(entry, [...idsOf(entry), ...incoming]) : entry));
}

const now = () => new Date().toISOString();

export const NOTE_FOLDER_IDS: FolderIds<NoteFolder> = {
  idsOf: (folder) => folder.noteIds,
  withIds: (folder, noteIds) => ({ ...folder, noteIds, lastNoteAddedAt: now() }),
};
export const EVENT_FOLDER_IDS: FolderIds<EventFolder> = {
  idsOf: (folder) => folder.eventIds,
  withIds: (folder, eventIds) => ({ ...folder, eventIds, lastEventAddedAt: now() }),
};
export const HABIT_FOLDER_IDS: FolderIds<HabitFolder> = {
  idsOf: (folder) => folder.habitIds,
  withIds: (folder, habitIds) => ({ ...folder, habitIds, lastHabitAddedAt: now() }),
};

export const autoImportNoteToFolders = (note: Note, folders: NoteFolder[]) => autoImportItem(note, folders, NOTE_FOLDER_IDS);
export const autoImportEventToFolders = (event: Event, folders: EventFolder[]) => autoImportItem(event, folders, EVENT_FOLDER_IDS);
export const autoImportHabitToFolders = (habit: Habit, folders: HabitFolder[]) => autoImportItem(habit, folders, HABIT_FOLDER_IDS);
