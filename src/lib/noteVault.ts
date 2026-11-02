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
  /** A second copy of the data key, wrapped by the fingerprint (see enableBiometric). */
  biometric?: BiometricRecord;
}

interface BiometricRecord {
  credentialId: string;
  /** Input to the passkey's PRF: same salt in, same secret out, only after the fingerprint. */
  prfSalt: string;
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
  // Keep the fingerprint copy: it wraps the same data key, which has not changed.
  setLocalStorageItem(VAULT_KEY, { ...(await wrap(key, newPassword)), biometric: record.biometric });
  return true;
}

/*
 * Fingerprint / face unlock, through WebAuthn (passkeys) with the PRF extension.
 *
 * A passkey is created on this device for this site. Its PRF extension returns a secret
 * only after the device has verified the user (fingerprint, face or screen lock), and
 * always the same secret for the same salt. That secret wraps a second copy of the data
 * key, so the fingerprint opens protected notes without the password. The password
 * still works, and is the only way in on another device or after removing the passkey.
 *
 * Requires a secure context and a browser/authenticator with PRF support (recent Chrome
 * on Android, recent Safari). When either is missing the option is simply not offered.
 */

const BIOMETRIC_INFO = new TextEncoder().encode('habitrkr-note-vault-biometric');

/** AES key from the PRF output, via HKDF so the raw PRF secret is never used directly. */
async function keyFromPrf(prfOutput: ArrayBuffer): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: BIOMETRIC_INFO },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/** Asks for the fingerprint and returns the PRF secret, or null if refused/unsupported. */
async function evaluatePrf(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<ArrayBuffer | null> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const results = assertion?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined;
  return results?.prf?.results?.first ?? null;
}

/** Whether this device can verify the user (fingerprint, face, screen lock) for passkeys. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (
      window.isSecureContext &&
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export const hasBiometric = () => !!readVault()?.biometric;

export type EnableBiometricResult = 'enabled' | 'cancelled' | 'unsupported';

/**
 * Registers a passkey and stores a fingerprint-wrapped copy of the data key.
 * The vault must be unlocked (the caller asks for the password first).
 */
export async function enableBiometric(): Promise<EnableBiometricResult> {
  const record = readVault();
  if (!record || !dataKey) throw new Error('Note vault is locked');
  const key = dataKey;
  const prfSalt = randomBytes(32);

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'HabiTrkr' },
        user: { id: randomBytes(16), name: 'HabiTrkr', displayName: 'HabiTrkr' },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    console.warn('Passkey creation failed:', error);
    return 'cancelled';
  }
  if (!credential) return 'cancelled';

  const created = credential.getClientExtensionResults() as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
  if (created.prf?.enabled === false) return 'unsupported';
  const credentialId = new Uint8Array(credential.rawId);

  // Some authenticators return the secret at creation; others only on the first use.
  let secret = created.prf?.results?.first ?? null;
  if (!secret) {
    try {
      secret = await evaluatePrf(credentialId, prfSalt);
    } catch (error) {
      console.warn('Passkey check failed:', error);
      return 'cancelled';
    }
  }
  if (!secret) return 'unsupported';

  const iv = randomBytes(12);
  const wrappingKey = await keyFromPrf(secret);
  const biometric: BiometricRecord = {
    credentialId: toBase64(credentialId),
    prfSalt: toBase64(prfSalt),
    iv: toBase64(iv),
    wrappedKey: toBase64(gcm(wrappingKey, iv).encrypt(key)),
  };
  setLocalStorageItem(VAULT_KEY, { ...record, biometric });
  return 'enabled';
}

/** Unlocks the vault with the fingerprint. False when cancelled or it did not match. */
export async function unlockVaultWithBiometric(): Promise<boolean> {
  const biometric = readVault()?.biometric;
  if (!biometric) return false;
  try {
    const secret = await evaluatePrf(fromBase64(biometric.credentialId), fromBase64(biometric.prfSalt));
    if (!secret) return false;
    const wrappingKey = await keyFromPrf(secret);
    dataKey = gcm(wrappingKey, fromBase64(biometric.iv)).decrypt(fromBase64(biometric.wrappedKey));
    return true;
  } catch (error) {
    console.warn('Fingerprint unlock failed:', error);
    return false;
  }
}

/** Forgets the fingerprint copy of the key. The password keeps working. */
export function disableBiometric(): void {
  const record = readVault();
  if (!record?.biometric) return;
  const { biometric: _biometric, ...rest } = record;
  setLocalStorageItem(VAULT_KEY, rest);
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
