import { useState, useEffect, useCallback } from 'react';
import { SafeStorage } from '../utils/storageUtils';

/**
 * A hook to use LocalStorage with React state, using SafeStorage for error handling.
 *
 * @param key The key to store the data under in LocalStorage
 * @param initialValue The initial value to use if no value is found in storage
 * @returns [storedValue, setValue]
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = SafeStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.warn(`useLocalStorage: Error reading/parsing ${key}`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to local storage
      if (typeof window !== 'undefined') {
        SafeStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(`useLocalStorage: Error setting ${key}`, error);
    }
  }, [key, storedValue]);

  // Optional: Listen for changes to this key from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setStoredValue(JSON.parse(event.newValue));
        } catch (error) {
            console.warn(`useLocalStorage: Error parsing external update for ${key}`, error);
        }
      } else if (event.key === key && event.newValue === null) {
          // If the key was removed, reset to initial value?
          // Or just leave it as is?
          // Usually better to leave as is or reset. Let's reset to initial.
          setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
