/**
 * Photos and voice recordings live in IndexedDB, not in localStorage.
 *
 * localStorage holds roughly 5 MB for the whole app, and notes used to carry their media
 * as base64 data URLs inside that budget, so a few photos or one recording could fill it
 * and make every later save fail. IndexedDB has no such ceiling.
 *
 * The rest of the app is unchanged on purpose: notes keep working with data URLs in memory.
 * The swap happens only at the storage boundary:
 *   - on write, every data URL inside a collection is replaced by a short reference
 *     (`idb-media:<id>`) and the data is saved to IndexedDB;
 *   - on read, references are swapped back for the data URLs, which are all loaded into
 *     memory once at startup (`initMediaStore`) so reads stay synchronous.
 *
 * If IndexedDB is unavailable (some private windows) the store stays disabled and notes
 * keep their data URLs in localStorage exactly as before.
 *
 * Password-protected notes are untouched: their content is ciphertext when written, so it
 * holds no data URLs, and their media never reaches IndexedDB in readable form.
 */

import { STORAGE_WRITE_FAILED_EVENT } from './localStorageUtils';

const DB_NAME = 'habitrkr-media';
const STORE = 'media';
const REF_PREFIX = 'idb-media:';

/** A base64 data URL for images and audio, as found inside serialized JSON. */
const DATA_URL = /data:(?:image|audio|video)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
const REF = /idb-media:[a-z0-9]+-\d+/g;

/** Collections whose items may carry media. Anything else is left alone. */
export const MEDIA_KEYS = ['notes', 'archivedNotes'] as const;

const cache = new Map<string, string>();
let db: IDBDatabase | null = null;
let enabled = false;
const pending = new Set<Promise<unknown>>();

/** cyrb53: a fast, non-cryptographic hash (crypto.subtle is missing on insecure origins). */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const idFor = (dataUrl: string) => `${hash(dataUrl)}-${dataUrl.length}`;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  const done = () => pending.delete(promise);
  promise.then(done, done);
  return promise;
}

/** Called when a media write fails, so ToastContext can tell the user (see localStorageUtils). */
function reportFailure(error: unknown) {
  console.error('Saving media to IndexedDB failed:', error);
  window.dispatchEvent(new CustomEvent(STORAGE_WRITE_FAILED_EVENT, { detail: { key: 'media' } }));
}

function put(id: string, dataUrl: string) {
  if (!db) return;
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  track(request(store.put(dataUrl, id))).catch(reportFailure);
}

/** Replaces every data URL in `text` with a reference, storing what is new. */
export function dehydrateText(text: string): string {
  if (!enabled || !text.includes('data:')) return text;
  return text.replace(DATA_URL, (dataUrl) => {
    const id = idFor(dataUrl);
    if (!cache.has(id)) {
      cache.set(id, dataUrl);
      put(id, dataUrl);
    }
    return REF_PREFIX + id;
  });
}

/** Replaces every known reference in `text` with its data URL. Unknown ones stay as they are. */
export function hydrateText(text: string): string {
  if (!text.includes(REF_PREFIX)) return text;
  return text.replace(REF, (ref) => cache.get(ref.slice(REF_PREFIX.length)) ?? ref);
}

/** Same as dehydrateText, for a value about to be stored as JSON. */
export function dehydrateValue<T>(value: T): T {
  if (!enabled) return value;
  const json = JSON.stringify(value);
  if (!json || !json.includes('data:')) return value;
  return JSON.parse(dehydrateText(json)) as T;
}

/** Same as hydrateText, for a value just read from storage. */
export function hydrateValue<T>(value: T): T {
  if (!cache.size) return value;
  const json = JSON.stringify(value);
  if (!json || !json.includes(REF_PREFIX)) return value;
  return JSON.parse(hydrateText(json)) as T;
}

/** Wait for every media write started so far; use before reloading the page. */
export async function flushMedia(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}

export const isMediaStoreEnabled = () => enabled;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

async function loadAll(): Promise<void> {
  if (!db) return;
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  await new Promise<void>((resolve, reject) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return resolve();
      cache.set(String(c.key), String(c.value));
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

/**
 * Moves media that older versions left inside localStorage into IndexedDB, and removes
 * stored media nothing refers to any more. Runs once per launch, before the app reads.
 */
async function migrateAndCollect(): Promise<void> {
  const used = new Set<string>();
  for (const key of MEDIA_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let next = raw;
    if (raw.includes('data:')) {
      next = dehydrateText(raw);
      await flushMedia();
      // Only replace the stored copy once the media is safely in IndexedDB.
      try {
        localStorage.setItem(key, next);
      } catch (error) {
        console.error('Could not rewrite migrated notes:', error);
        continue;
      }
    }
    for (const ref of next.match(REF) ?? []) used.add(ref.slice(REF_PREFIX.length));
  }
  if (!db) return;
  for (const id of [...cache.keys()]) {
    if (used.has(id)) continue;
    cache.delete(id);
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    track(request(store.delete(id))).catch(() => undefined);
  }
  await flushMedia();
}

/** Opens the database and loads media into memory. Never throws: failure leaves it disabled. */
export async function initMediaStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    db = await openDb();
    await loadAll();
    enabled = true;
    await migrateAndCollect();
  } catch (error) {
    console.error('Media store unavailable, keeping media in localStorage:', error);
    enabled = false;
  }
}

/** Removes every stored photo and recording ("Delete all data"). */
export async function clearMedia(): Promise<void> {
  cache.clear();
  if (!db) return;
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await track(request(store.clear())).catch(() => undefined);
}

/** For tests: switch the store on without IndexedDB. */
export function __enableForTests(on: boolean) {
  enabled = on;
  cache.clear();
}
