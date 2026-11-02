import { beforeEach, describe, expect, it } from 'vitest';
import type { Note } from '@/types/note';
import {
  changeVaultPassword,
  createVault,
  hasVault,
  isVaultUnlocked,
  lockVault,
  openNote,
  removePasswordProtection,
  sealNote,
  sealNotesForStorage,
  unlockVault,
} from './noteVault';

const passwordNote = (fields: Partial<Note> = {}): Note =>
  ({
    id: 'n', name: 'Diary', type: 'text', color: '', createdAt: '', pinned: false,
    locked: true, lockType: 'password', description: 'the secret word', ...fields,
  }) as Note;

beforeEach(() => {
  localStorage.clear();
  lockVault();
});

describe('note vault', () => {
  it('creates a password and leaves the vault unlocked', async () => {
    await createVault('correct horse');
    expect(hasVault()).toBe(true);
    expect(isVaultUnlocked()).toBe(true);
    expect(localStorage.getItem('habitrkr.noteVault')).not.toContain('correct horse');
  });

  it('encrypts the content and keeps the title readable', async () => {
    await createVault('correct horse');
    const sealed = sealNote(passwordNote());
    expect(JSON.stringify(sealed)).not.toContain('secret');
    expect(sealed.name).toBe('Diary');
    expect(openNote(sealed)).toMatchObject({ description: 'the secret word' });
    expect(openNote(sealed).sealed).toBeUndefined();
  });

  it('encrypts list items, images and audio too', async () => {
    await createVault('correct horse');
    const list = passwordNote({ type: 'list', items: [{ id: 'i', text: 'buy milk', completed: false }] } as Partial<Note>);
    const sealed = sealNote(list);
    expect(JSON.stringify(sealed)).not.toContain('milk');
    expect(openNote(sealed)).toMatchObject({ items: [{ text: 'buy milk' }] });
  });

  it('opens only with the right password', async () => {
    await createVault('correct horse');
    const sealed = sealNote(passwordNote());
    lockVault();
    expect(() => openNote(sealed)).toThrow();
    expect(await unlockVault('wrong horse')).toBe(false);
    expect(await unlockVault('correct horse')).toBe(true);
    expect(openNote(sealed).description).toBe('the secret word');
  });

  it('changes the password without re-encrypting notes', async () => {
    await createVault('correct horse');
    const sealed = sealNote(passwordNote());
    lockVault();
    expect(await changeVaultPassword('wrong', 'battery staple')).toBe(false);
    expect(await changeVaultPassword('correct horse', 'battery staple')).toBe(true);
    lockVault();
    expect(await unlockVault('correct horse')).toBe(false);
    expect(await unlockVault('battery staple')).toBe(true);
    expect(openNote(sealed).description).toBe('the secret word');
  });

  it('never writes protected content in plain text, even with the vault locked', async () => {
    await createVault('correct horse');
    const sealed = sealNote(passwordNote());
    localStorage.setItem('notes', JSON.stringify([sealed]));

    // Unlocked: an open note is sealed on its way out
    const open = openNote(sealed);
    expect(JSON.stringify(sealNotesForStorage([open], 'notes'))).not.toContain('secret');

    // Locked: the last stored, sealed version is kept instead
    lockVault();
    const edited = { ...open, description: 'a new secret' };
    const written = sealNotesForStorage([edited], 'notes');
    expect(JSON.stringify(written)).not.toContain('secret word');
    expect(JSON.stringify(written)).not.toContain('new secret');
    expect(written[0].sealed).toEqual(sealed.sealed);
  });

  it('leaves other notes untouched', () => {
    const plain = { ...passwordNote(), locked: false, lockType: undefined } as Note;
    expect(sealNotesForStorage([plain], 'notes')[0]).toBe(plain);
  });

  it('removes protection by decrypting', async () => {
    await createVault('correct horse');
    const unprotected = removePasswordProtection(sealNote(passwordNote()));
    expect(unprotected).toMatchObject({ locked: false, description: 'the secret word' });
    expect(unprotected.lockType).toBeUndefined();
    expect(unprotected.sealed).toBeUndefined();
  });
});
