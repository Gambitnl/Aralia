import { useState, useEffect, useRef } from 'react';
import { SafeStorage } from '../utils/storageUtils';

/**
 * A hook to manage state that persists in localStorage.
 * Uses SafeStorage to handle privacy mode and quota errors safely.
 *
 * @param key The key to store the data under.
 * @param initialValue The initial value if no data exists in storage.
 * @returns A tuple containing the stored value and a setter function.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = SafeStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`useLocalStorage: Error parsing stored value for key "${key}"`, error);
      return initialValue;
    }
  });

  // Use a ref to track if it's the first render to avoid re-saving initial value
  // (though saving it ensures consistency if default changed)
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    try {
      SafeStorage.setItem(key, JSON.stringify(storedValue));
    } catch (writeError) {
      console.warn(`useLocalStorage: Failed to write to storage for key "${key}"`, writeError);
    }
  }, [key, storedValue]);

  // Return a wrapped version of useState's setter function
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      setStoredValue((oldValue) => {
          const valueToStore = value instanceof Function ? value(oldValue) : value;
          return valueToStore;
      });
    } catch (error) {
      console.error(`useLocalStorage: Error setting value for key "${key}"`, error);
    }
  };

  return [storedValue, setValue];
}
