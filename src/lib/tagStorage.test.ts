import { beforeEach, describe, expect, it } from 'vitest';
import { deleteTagGlobally, renameTagGlobally, updateTagUsage } from './tagStorage';
import { takePendingUndo } from './undoManager';

const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

beforeEach(() => localStorage.clear());

describe('tags', () => {
  it('renames tags on items and in folder auto-import rules', () => {
    localStorage.setItem('notes', JSON.stringify([{ id: 'n', tags: ['work'] }]));
    localStorage.setItem('folders', JSON.stringify([{ id: 'f', autoImportTags: ['work'] }]));
    localStorage.setItem('eventFolders', JSON.stringify([{ id: 'e', autoImportTags: ['work', 'home'] }]));

    renameTagGlobally('work', 'job');
    expect(read('notes')[0].tags).toEqual(['job']);
    expect(read('folders')[0].autoImportTags).toEqual(['job']);
    expect(read('eventFolders')[0].autoImportTags).toEqual(['job', 'home']);
  });

  it('deletes tags from items and folder rules', () => {
    localStorage.setItem('events', JSON.stringify([{ id: 'e', tags: ['work', 'home'] }]));
    localStorage.setItem('archivedFolders', JSON.stringify([{ id: 'f', autoImportTags: ['work'] }]));

    deleteTagGlobally('WORK');
    expect(read('events')[0].tags).toEqual(['home']);
    expect(read('archivedFolders')[0].autoImportTags).toEqual([]);
  });

  it('lets Undo restore the usage counts', async () => {
    localStorage.setItem('allTags', JSON.stringify({ work: 2, home: 1 }));
    await Promise.resolve(); // start a fresh undo batch

    updateTagUsage(['work', 'home'], []);
    expect(read('allTags')).toEqual({ work: 1 });

    takePendingUndo()?.();
    expect(read('allTags')).toEqual({ work: 2, home: 1 });
  });
});
