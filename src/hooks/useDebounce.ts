// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 26/08/2026, 16:40:57
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * This file provides React hooks to delay updating values or running functions
 * until a certain amount of time has passed without any new changes.
 *
 * In an interactive RPG, players frequently type in search boxes, resize windows,
 * or trigger rapid events. Running heavy game logic or database queries on every
 * single keystroke causes lag. Debouncing waits until the player pauses before
 * triggering the expensive operation.
 *
 * Called by: Search bars, glossary filters, auto-save timers, and UI modals.
 * Depends on: Standard React hooks (useState, useEffect, useRef, useCallback).
 */

// ============================================================================
// Types
// ============================================================================
// Definitions for the debounced callback return object, allowing callers to
// cancel pending calls or immediately flush them.
// ============================================================================

export interface DebouncedFunction<TArgs extends unknown[]> {
  /** Invokes the debounced function, restarting the delay timer. */
  (...args: TArgs): void;
  /** Cancels any scheduled timer without executing the function. */
  cancel: () => void;
  /** Immediately executes the latest scheduled call if a timer is active. */
  flush: () => void;
}

// ============================================================================
// Value Debounce Hook
// ============================================================================
// Takes a fast-changing value and returns a delayed copy that only updates
// when the input has remained steady for the specified duration.
// ============================================================================

/**
 * Delays updating a state value until a set delay has elapsed without new changes.
 *
 * @param value - The input value to debounce (e.g. search text or coordinate).
 * @param delayMs - Delay in milliseconds before updating the debounced value (default: 300ms).
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  // Store the debounced value in local state
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // If the delay is zero or negative, update immediately without a timer
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }

    // Set a timer to update the debounced value once the pause duration passes
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // If the input value changes before the timer completes, clear the old timer
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

// ============================================================================
// Callback Debounce Hook
// ============================================================================
// Wraps a function so that rapid repeated invocations only execute once after
// the delay timer expires.
// ============================================================================

/**
 * Creates a debounced version of a callback function with cancel and flush controls.
 *
 * @param callback - The function to execute after the delay.
 * @param delayMs - Delay in milliseconds before executing the function.
 * @returns A callable function that includes .cancel() and .flush() helpers.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number = 300
): DebouncedFunction<TArgs> {
  // Keep a reference to the latest callback to avoid stale closure issues
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Track the active timer and the latest arguments passed to the function
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestArgsRef = useRef<TArgs | null>(null);

  // Cancel any active timer and discard pending arguments
  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    latestArgsRef.current = null;
  }, []);

  // Immediately execute the pending callback if one is waiting
  const flush = useCallback(() => {
    if (timerRef.current !== null && latestArgsRef.current !== null) {
      const args = latestArgsRef.current;
      cancel();
      callbackRef.current(...args);
    }
  }, [cancel]);

  // Main debounced invoker
  const debouncedFn = useCallback(
    (...args: TArgs) => {
      latestArgsRef.current = args;

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      if (delayMs <= 0) {
        timerRef.current = null;
        latestArgsRef.current = null;
        callbackRef.current(...args);
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const currentArgs = latestArgsRef.current;
        latestArgsRef.current = null;
        if (currentArgs !== null) {
          callbackRef.current(...currentArgs);
        }
      }, delayMs);
    },
    [delayMs]
  );

  // Cleanup pending timers when the component unmounts
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  // Attach helper methods to the debounced function
  return Object.assign(debouncedFn, { cancel, flush });
}
