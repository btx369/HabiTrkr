/**
 * Password protection for notes: the content of a password-locked note is encrypted.
 *
 * Unlike the PIN (which only hides a note in the interface), this keeps the content
 * unreadable to anyone who copies the app's storage or a backup file.
 *
 * How the keys fit together:
 *   - One random 256-bit DATA KEY encrypts every protected note (AES-GCM).
 *   - The data key is stored WRAPPED (encrypted) by a key derived from the master
 *     password with PBKDF2. Changing the password re-wraps the data key; the notes
 *     themselves are not touched.
 *   - The data key lives in memory only while a protected note is open, and is
 *     forgotten when it closes (see Notes.tsx).
 *
 * Encryption is synchronous (@noble/ciphers) on purpose: notes are written to storage
 * through a synchronous setter, and sealing has to happen right there so that no code
 * path can write a protected note's content in plain text. Only the password step
 * (PBKDF2, deliberately slow) is asynchronous.
 *
 * There is no recovery: a forgotten password means the protected notes are lost.
 */

import { gcm } from '@noble/ciphers/aes';
import type { Note } from '@/types/note';
import { getLocalStorageItem, setLocalStorageItem } from './localStorageUtils';

export const VAULT_KEY = 'habitrkr.noteVault';
export const MIN_PASSWORD_LENGTH = 8;
/** Wrong-password counter id (lib/notePin lockout), shared by every place that asks for it. */
export const VAULT_ATTEMPTS_ID = 'noteVault';
const ITERATIONS = 310_000;

interface VaultRecord {
  v: 1;
  salt: string;
  iterations: number;
  iv: string;
  wrappedKey: string;
}

export interface SealedContent {
  iv: string;
  data: string;
}

/** The note fields that hold what a reader sees; everything else stays readable. */
const CONTENT_FIELDS = ['description', 'items', 'imageUrl', 'audioUrl', 'duration'] as const;

let dataKey: Uint8Array | null = null;

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

async function deriveWrappingKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
  return new Uint8Array(bits);
}

const readVault = () => getLocalStorageItem<VaultRecord | null>(VAULT_KEY, null);

async function wrap(key: Uint8Array, password: string): Promise<VaultRecord> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveWrappingKey(password, salt, ITERATIONS);
  return {
    v: 1,
    salt: toBase64(salt),
    iterations: ITERATIONS,
    iv: toBase64(iv),
    wrappedKey: toBase64(gcm(wrappingKey, iv).encrypt(key)),
  };
}

/** The data key for `password`, or null when the password is wrong. */
async function unwrap(record: VaultRecord, password: string): Promise<Uint8Array | null> {
  const wrappingKey = await deriveWrappingKey(password, fromBase64(record.salt), record.iterations);
  try {
    return gcm(wrappingKey, fromBase64(record.iv)).decrypt(fromBase64(record.wrappedKey));
  } catch {
    return null; // the authentication tag does not match: wrong password
  }
}

export const hasVault = () => readVault() !== null;
export const isVaultUnlocked = () => dataKey !== null;

/** Sets up the master password for the first time and leaves the vault unlocked. */
export async function createVault(password: string): Promise<void> {
  if (hasVault()) throw new Error('A note password already exists');
  const key = randomBytes(32);
  setLocalStorageItem(VAULT_KEY, await wrap(key, password));
  dataKey = key;
}

/** True when the password is right; the vault then stays unlocked until lockVault(). */
export async function unlockVault(password: string): Promise<boolean> {
  const record = readVault();
  if (!record) return false;
  const key = await unwrap(record, password);
  if (!key) return false;
  dataKey = key;
  return true;
}

/** Re-wraps the data key under a new password. Protected notes need no change. */
export async function changeVaultPassword(currentPassword: string, newPassword: string): Promise<boolean> {
  const record = readVault();
  if (!record) return false;
  const key = await unwrap(record, currentPassword);
  if (!key) return false;
  setLocalStorageItem(VAULT_KEY, await wrap(key, newPassword));
  return true;
}

export function lockVault(): void {
  dataKey = null;
}

/** A note whose content must only ever be stored encrypted. */
export const isPasswordNote = (note: Note) => note.locked === true && note.lockType === 'password';

/** Content readable right now: either not protected, or decrypted in this session. */
export const isNoteOpen = (note: Note) => !isPasswordNote(note) || !note.sealed;

/**
 * Encrypts a password note's content and blanks the readable fields. A note that is
 * already sealed is returned as it is. Throws when the vault is locked.
 */
export function sealNote<T extends Note>(note: T): T {
  if (!isPasswordNote(note) || note.sealed) return note;
  if (!dataKey) throw new Error('Note vault is locked');

  const content: Record<string, unknown> = {};
  const blanked: Record<string, unknown> = { ...note };
  for (const field of CONTENT_FIELDS) {
    if (field in note) {
      content[field] = (note as unknown as Record<string, unknown>)[field];
      const value = content[field];
      blanked[field] = Array.isArray(value) ? [] : typeof value === 'number' ? 0 : '';
    }
  }

  const iv = randomBytes(12);
  const data = gcm(dataKey, iv).encrypt(new TextEncoder().encode(JSON.stringify(content)));
  return { ...blanked, sealed: { iv: toBase64(iv), data: toBase64(data) } } as T;
}

/** Decrypts a sealed note. Throws when the vault is locked or the data was tampered with. */
export function openNote<T extends Note>(note: T): T {
  if (!note.sealed) return note;
  if (!dataKey) throw new Error('Note vault is locked');
  const plain = gcm(dataKey, fromBase64(note.sealed.iv)).decrypt(fromBase64(note.sealed.data));
  const content = JSON.parse(new TextDecoder().decode(plain));
  const { sealed: _sealed, ...rest } = note;
  return { ...rest, ...content } as T;
}

/**
 * Prepares a list of notes for storage: every password note is written sealed.
 *
 * If the vault is locked and a note is still open (which the UI is built to prevent),
 * its last stored, sealed version is kept instead. Losing an unsaved edit is better
 * than writing protected content in plain text.
 */
export function sealNotesForStorage(notes: Note[], storageKey: string): Note[] {
  if (!notes.some((note) => isPasswordNote(note) && !note.sealed)) return notes;

  let stored: Note[] | null = null;
  return notes.map((note) => {
    if (!isPasswordNote(note) || note.sealed) return note;
    if (dataKey) return sealNote(note);
    stored ??= getLocalStorageItem<Note[]>(storageKey, []);
    // Whatever is stored for this note stays as it is; writing it back changes nothing.
    const previous = stored.find((candidate) => candidate.id === note.id);
    console.error('Note vault locked while a protected note was open; keeping its last saved version.');
    return previous ?? ({ ...note, description: '', items: [], imageUrl: '', audioUrl: '', sealed: { iv: '', data: '' } } as unknown as Note);
  });
}

/** Removes password protection: the note is decrypted and stored readable again. */
export function removePasswordProtection<T extends Note>(note: T): T {
  const { lockType: _lockType, ...open } = openNote(note);
  return { ...open, locked: false } as T;
}
