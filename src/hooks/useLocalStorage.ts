import { useRef, useState } from 'react';
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/localStorageUtils';
import { registerUndo } from '@/lib/undoManager';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return getLocalStorageItem(key, initialValue);
  });
  const storedValueRef = useRef(storedValue);

  const setValue = (value: T | ((prev: T) => T)) => {
    const previousValue = storedValueRef.current;
    const valueToStore = value instanceof Function ? value(previousValue) : value;

    if (!Object.is(previousValue, valueToStore)) {
      registerUndo(key, () => {
        storedValueRef.current = previousValue;
        setLocalStorageItem(key, previousValue);
        setStoredValue(previousValue);
      });
    }

    storedValueRef.current = valueToStore;
    setLocalStorageItem(key, valueToStore);
    setStoredValue(valueToStore);
  };

  return [storedValue, setValue];
}
