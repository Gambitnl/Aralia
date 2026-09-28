import { useRef, useEffect } from 'react';

/**
 * This file provides a React hook to remember what a value was on the previous render.
 *
 * In game UI and animations, systems often need to know if something changed from
 * last frame — such as whether a character just took damage (current HP < previous HP),
 * whether a modal just opened, or whether the active tab switched.
 *
 * Called by: Combat health bars, turn transition trackers, inventory diff inspectors.
 * Depends on: Standard React hooks (useRef, useEffect).
 */

// ============================================================================
// Previous Value Hook
// ============================================================================
// Stores the prior value in a React ref, updating it only after the component
// has finished rendering the current frame.
// ============================================================================

/**
 * Tracks the previous value of a prop or state across component renders.
 *
 * On the very first render, this returns `initialValue` (or undefined if omitted).
 * On subsequent renders, it returns the value from the immediately preceding render.
 *
 * @param value - The current value to track.
 * @param initialValue - Optional value to return on the initial render before any updates.
 * @returns The value from the previous render.
 */
export function usePrevious<T>(value: T, initialValue?: T): T | undefined {
  // Ref holds the value across renders without causing extra re-renders
  const ref = useRef<T | undefined>(initialValue);

  // Update the ref after the current render has been committed to the screen
  useEffect(() => {
    ref.current = value;
  }, [value]);

  // Return what was stored before the effect ran
  return ref.current;
}
