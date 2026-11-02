import { useRef, useState } from 'react';
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/localStorageUtils';
import { registerUndo } from '@/lib/undoManager';

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
  const [storedValue, setStoredValue] = useState<T>(() => {
    return getLocalStorageItem(key, initialValue);
  });
  const storedValueRef = useRef(storedValue);
  const persist = (value: T) => setLocalStorageItem(key, toStorage ? toStorage(value) : value);

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
