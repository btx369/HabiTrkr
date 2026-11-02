/**
 * Shared utilities for localStorage operations.
 * Centralizes error handling and JSON parsing logic.
 */

/**
 * Safely retrieves a value from localStorage with JSON parsing.
 * Returns the parsed value or the fallback if the key doesn't exist or parsing fails.
 */
export function getLocalStorageItem<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * Safely retrieves a raw string value from localStorage.
 * Returns the value or the fallback if the key doesn't exist.
 */
export function getLocalStorageString(key: string, fallback: string): string {
  try {
    const item = window.localStorage.getItem(key);
    return item ?? fallback;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * Fired on `window` when a write fails, almost always because storage is full.
 *
 * Callers update their in-memory state either way, so without this the screen would show
 * a change that is gone the next time the app opens. ToastContext listens and tells the
 * user, which is the one thing a failed write must never be: silent.
 */
export const STORAGE_WRITE_FAILED_EVENT = 'habitrkr:storage-write-failed';

function reportWriteFailure(key: string, error: unknown): void {
  console.error(`Error setting localStorage key "${key}":`, error);
  window.dispatchEvent(new CustomEvent(STORAGE_WRITE_FAILED_EVENT, { detail: { key } }));
}

/**
 * Safely sets a value in localStorage with JSON serialization.
 */
export function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    reportWriteFailure(key, error);
  }
}

/**
 * Safely sets a raw string value in localStorage.
 */
export function setLocalStorageString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    reportWriteFailure(key, error);
  }
}
