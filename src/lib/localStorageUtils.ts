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
 * Safely sets a value in localStorage with JSON serialization.
 */
export function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Safely sets a raw string value in localStorage.
 */
export function setLocalStorageString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
}
