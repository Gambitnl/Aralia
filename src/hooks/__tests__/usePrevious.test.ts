import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrevious } from '../usePrevious';

/**
 * This test suite verifies the behavior of the usePrevious hook.
 *
 * In game UI and animations, systems often compare current state against the prior
 * render's state (e.g. detecting HP drops for damage floaters, checking if a player
 * stepped onto a new tile, or noticing when a modal changes from closed to open).
 *
 * Covers: usePrevious.ts
 * Tests: Initial values, subsequent render tracking, sequence shifts, and object references.
 */

// ============================================================================
// Previous Value Unit Tests
// ============================================================================
// Tests verifying value tracking across component render cycles.
// ============================================================================

describe('usePrevious', () => {
  it('should return undefined on initial render if no initialValue is provided', () => {
    const { result } = renderHook(() => usePrevious(10));
    expect(result.current).toBeUndefined();
  });

  it('should return initialValue on initial render if provided', () => {
    const { result } = renderHook(() => usePrevious(10, 0));
    expect(result.current).toBe(0);
  });

  it('should return previous value after rerender', () => {
    const { result, rerender } = renderHook(({ val }) => usePrevious(val), {
      initialProps: { val: 'first' },
    });

    expect(result.current).toBeUndefined();

    // Rerender with new value
    rerender({ val: 'second' });
    expect(result.current).toBe('first');

    // Rerender again with third value
    rerender({ val: 'third' });
    expect(result.current).toBe('second');
  });

  it('should accurately track numbers and boolean state transitions', () => {
    const { result, rerender } = renderHook(({ hp }) => usePrevious(hp, 100), {
      initialProps: { hp: 100 },
    });

    expect(result.current).toBe(100);

    // Player takes 25 damage -> hp = 75
    rerender({ hp: 75 });
    expect(result.current).toBe(100);

    // Player heals 10 -> hp = 85
    rerender({ hp: 85 });
    expect(result.current).toBe(75);
  });

  it('should track complex object references correctly', () => {
    const pos1 = { x: 10, y: 20 };
    const pos2 = { x: 11, y: 20 };
    const pos3 = { x: 12, y: 21 };

    const { result, rerender } = renderHook(({ pos }) => usePrevious(pos), {
      initialProps: { pos: pos1 },
    });

    expect(result.current).toBeUndefined();

    rerender({ pos: pos2 });
    expect(result.current).toBe(pos1);

    rerender({ pos: pos3 });
    expect(result.current).toBe(pos2);
  });
});
