/**
 * PIN protection for locked notes.
 *
 * The PIN used to be stored next to the note in plain text, so anyone who could read
 * the app's storage or a backup file could read every PIN. It is now stored as a salted
 * PBKDF2 hash, and wrong guesses are rate-limited.
 *
 * What this is and is not: a 4-digit PIN has 10,000 possibilities, so it stops someone
 * picking up an unlocked phone, not someone who copies the storage and tries every PIN
 * offline. The note's content is not encrypted.
 */

import type { Note } from '@/types/note';
import { getLocalStorageItem, setLocalStorageItem } from './localStorageUtils';

const ITERATIONS = 150_000;
const ATTEMPTS_KEY = 'habitrkr.pinAttempts';
/** Wrong guesses allowed before the first lockout. */
const FREE_ATTEMPTS = 5;
const FIRST_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toBase64(bits);
}

/** The fields to store on a note to lock it with `pin`. */
export async function createPinFields(pin: string): Promise<Pick<Note, 'pinHash' | 'pinSalt'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pinHash: await derive(pin, salt), pinSalt: toBase64(salt) };
}

/** True when `pin` opens the note. Accepts notes locked before hashing existed. */
export async function verifyNotePin(note: Note, pin: string): Promise<boolean> {
  if (note.pinHash && note.pinSalt) {
    return (await derive(pin, fromBase64(note.pinSalt))) === note.pinHash;
  }
  return note.pin !== undefined && note.pin === pin;
}

/**
 * A copy of the note with every lock field removed (PIN and lock type). Never pass a
 * sealed password note: its content is still encrypted and would stay unreadable.
 */
export function withoutPin<T extends Note>(note: T, locked = false): T {
  const { pin: _pin, pinHash: _hash, pinSalt: _salt, lockType: _lockType, ...rest } = note;
  return { ...rest, locked } as T;
}

/** Replaces a legacy plain-text PIN with its hash; returns the note unchanged otherwise. */
export async function upgradeLegacyPin<T extends Note>(note: T): Promise<T> {
  if (note.pin === undefined || note.pinHash) return note;
  const fields = await createPinFields(note.pin);
  return { ...withoutPin(note, note.locked ?? true), ...fields };
}

interface AttemptState {
  failures: number;
  lockedUntil: number;
}

const readAttempts = () => getLocalStorageItem<Record<string, AttemptState>>(ATTEMPTS_KEY, {});

/** Milliseconds until the note accepts another guess; 0 when it does now. */
export function getPinLockoutRemaining(noteId: string, now = Date.now()): number {
  const state = readAttempts()[noteId];
  return state ? Math.max(0, state.lockedUntil - now) : 0;
}

/**
 * Records a wrong guess. After FREE_ATTEMPTS, each further one locks the note for twice
 * as long as the last, up to MAX_LOCKOUT_MS. Kept in storage so reloading does not reset it.
 */
export function recordPinFailure(noteId: string, now = Date.now()): void {
  const all = readAttempts();
  const failures = (all[noteId]?.failures ?? 0) + 1;
  const over = failures - FREE_ATTEMPTS;
  const lockedUntil = over > 0 ? now + Math.min(FIRST_LOCKOUT_MS * 2 ** (over - 1), MAX_LOCKOUT_MS) : 0;
  setLocalStorageItem(ATTEMPTS_KEY, { ...all, [noteId]: { failures, lockedUntil } });
}

export function clearPinFailures(noteId: string): void {
  const all = readAttempts();
  if (!(noteId in all)) return;
  delete all[noteId];
  setLocalStorageItem(ATTEMPTS_KEY, all);
}
