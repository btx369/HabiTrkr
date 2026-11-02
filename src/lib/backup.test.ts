import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBackup, BackupError, createBackup, readBackup } from './backup';

const reason = (fn: () => unknown) => {
  try {
    fn();
    return 'accepted';
  } catch (error) {
    return error instanceof BackupError ? error.reason : String(error);
  }
};

beforeEach(() => localStorage.clear());

describe('backup', () => {
  it('exports every app key exactly as stored, and restores it', () => {
    localStorage.setItem('archivedHabits', JSON.stringify([{ id: 'h1' }]));
    localStorage.setItem('habitFolders', JSON.stringify([{ id: 'f1' }]));
    localStorage.setItem('habitrkr.theme', 'dark');
    localStorage.setItem('habitrkr.storageKeysMigrated', '2');

    const file = JSON.parse(JSON.stringify(createBackup()));
    expect(Object.keys(file.data).sort()).toEqual(['archivedHabits', 'habitFolders', 'habitrkr.theme']);

    localStorage.clear();
    applyBackup(readBackup(file));
    expect(localStorage.getItem('archivedHabits')).toBe('[{"id":"h1"}]');
    expect(localStorage.getItem('habitrkr.theme')).toBe('dark');
  });

  it('reads version 1 files without quoting plain-string settings', () => {
    const entries = readBackup({ version: 1, habits: [{ id: 'x' }], 'habitrkr.theme': 'dark', 'habitrkr.language': 'pt' });
    expect(entries['habitrkr.theme']).toBe('dark');
    expect(entries['habitrkr.language']).toBe('pt');
    expect(entries.habits).toBe('[{"id":"x"}]');
  });

  it('rejects files that are not a usable backup', () => {
    expect(reason(() => readBackup('text'))).toBe('invalid');
    expect(reason(() => readBackup({ version: 9 }))).toBe('invalid');
    expect(reason(() => readBackup({ version: 2, app: 'habitrkr', data: { foo: '1' } }))).toBe('invalid');
    expect(reason(() => readBackup({ version: 2, app: 'habitrkr', data: { notes: '"abc"' } }))).toBe('invalid');
    expect(reason(() => readBackup({ version: 1, habits: [{ name: 'no id' }] }))).toBe('invalid');
  });

  it('ignores keys with unusual names', () => {
    const entries = readBackup({ version: 2, app: 'habitrkr', data: { notes: '[]', '../evil': 'x' } });
    expect(Object.keys(entries)).toEqual(['notes']);
  });

  it('puts everything back when a write fails part-way', () => {
    localStorage.setItem('habits', '[{"id":"keep"}]');
    const realSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'events') throw new DOMException('full', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });

    expect(reason(() => applyBackup({ habits: '[{"id":"new"}]', events: '[]' }))).toBe('storage');
    spy.mockRestore();
    expect(localStorage.getItem('habits')).toBe('[{"id":"keep"}]');
  });
});
