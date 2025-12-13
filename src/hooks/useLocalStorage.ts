import { useState, useCallback } from 'react';
import { SafeStorage } from '../utils/storageUtils';

/**
 * A custom hook to manage state synchronized with localStorage.
 * Handles JSON parsing/stringification and errors safely.
 *
 * @param key The key to store the data under in localStorage
 * @param initialValue The initial value to use if no data exists
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = SafeStorage.getItem(key);
    if (item) {
      try {
        return JSON.parse(item);
      } catch (error) {
        console.warn(`Error parsing localStorage key "${key}":`, error);
        return initialValue;
      }
    }
    return initialValue;
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? (value as (val: T) => T)(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to local storage
      // Note: SafeStorage.setItem throws on error (like quota exceeded) so we catch it here
      try {
        SafeStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (writeError) {
         console.warn(`Error writing to localStorage key "${key}":`, writeError);
      }
    } catch (error) {
      console.warn(`Error setting value for key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
      SafeStorage.removeItem(key);
      setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
