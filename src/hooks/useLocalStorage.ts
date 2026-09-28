import { useState } from 'react';
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/localStorageUtils';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return getLocalStorageItem(key, initialValue);
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      setLocalStorageItem(key, valueToStore);
      return valueToStore;
    });
  };

  return [storedValue, setValue];
}