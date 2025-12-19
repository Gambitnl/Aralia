import { useState, useCallback } from 'react';
import { SafeStorage } from '../utils/storageUtils';
import { safeJSONParse } from '../utils/securityUtils';
import { z } from 'zod';

export interface UseLocalStorageOptions<T> {
  schema?: z.Schema<T>;
  onError?: (error: unknown) => void;
}

/**
 * A custom hook to manage state synchronized with localStorage.
 * Handles JSON parsing/stringification, schema validation, and errors safely.
 *
 * @param key The key to store the data under in localStorage
 * @param initialValue The initial value to use if no data exists or validation fails
 * @param options Configuration options including Zod schema and error handler
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const { schema, onError } = options;

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = SafeStorage.getItem(key);
    if (item) {
      try {
        const parsed = safeJSONParse(item);
        if (parsed === null) {
          console.warn(`Error parsing localStorage key "${key}": JSON invalid`);
          if (onError) onError(new Error("JSON invalid"));
          return initialValue;
        }

        if (schema) {
          const validationResult = schema.safeParse(parsed);
          if (!validationResult.success) {
            console.warn(`Schema validation failed for localStorage key "${key}":`, validationResult.error);
            // If validation fails, we treat it as if the data is corrupted/invalid and return initialValue.
            // We do NOT automatically clear storage here to avoid data loss if it's just a schema mismatch that might be recoverable manually,
            // but effectively for the app it acts as a reset.
            // Optional: We could call onError here too.
            if (onError) onError(validationResult.error);
            return initialValue;
          }
          return validationResult.data;
        }

        return parsed;
      } catch (error) {
        // Should not be reached due to safeJSONParse but kept for safety
        console.warn(`Error in useLocalStorage for key "${key}":`, error);
        if (onError) onError(error);
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
         if (onError) onError(writeError);
      }
    } catch (error) {
      console.warn(`Error setting value for key "${key}":`, error);
      if (onError) onError(error);
    }
  }, [key, storedValue, onError]);

  const removeValue = useCallback(() => {
      SafeStorage.removeItem(key);
      setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
