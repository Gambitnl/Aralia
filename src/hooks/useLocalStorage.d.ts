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
export declare function useLocalStorage<T>(key: string, initialValue: T, options?: UseLocalStorageOptions<T>): [T, (value: T | ((val: T) => T)) => void, () => void];
