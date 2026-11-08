import { useRef, useState } from 'react';
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/localStorageUtils';
import { registerUndo } from '@/lib/undoManager';
import { isAppKey } from '@/lib/storageKeys';
import { dehydrateValue, hydrateValue, MEDIA_KEYS } from '@/lib/mediaStore';

const carriesMedia = (key: string) => (MEDIA_KEYS as readonly string[]).includes(key);

interface UseLocalStorageOptions<T> {
  /**
   * Applied to every value on its way to storage (never to the in-memory state).
   * Notes use it to encrypt password-protected content, so that no code path that
   * calls the setter can write that content in plain text.
   */
  toStorage?: (value: T) => T;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  { toStorage }: UseLocalStorageOptions<T> = {},
): [T, (value: T | ((prev: T) => T)) => void] {
  if (import.meta.env.DEV && !isAppKey(key)) {
    console.warn(`useLocalStorage: "${key}" is not registered in storageKeys.ts; backups and "Delete all data" will skip it.`);
  }
  const [storedValue, setStoredValue] = useState<T>(() => {
    const stored = getLocalStorageItem(key, initialValue);
    return carriesMedia(key) ? hydrateValue(stored) : stored;
  });
  const storedValueRef = useRef(storedValue);
  const persist = (value: T) => {
    const prepared = toStorage ? toStorage(value) : value;
    // Photos and recordings go to IndexedDB; the stored collection keeps only references.
    setLocalStorageItem(key, carriesMedia(key) ? dehydrateValue(prepared) : prepared);
  };

  const setValue = (value: T | ((prev: T) => T)) => {
    const previousValue = storedValueRef.current;
    const valueToStore = value instanceof Function ? value(previousValue) : value;

    if (!Object.is(previousValue, valueToStore)) {
      registerUndo(key, () => {
        storedValueRef.current = previousValue;
        persist(previousValue);
        setStoredValue(previousValue);
      });
    }

    storedValueRef.current = valueToStore;
    persist(valueToStore);
    setStoredValue(valueToStore);
  };

  return [storedValue, setValue];
}
