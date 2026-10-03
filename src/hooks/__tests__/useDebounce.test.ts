import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

/**
 * This test suite verifies the behavior of the useDebounce and useDebouncedCallback hooks.
 *
 * In an RPG with high-frequency user interactions (typing search terms in the glossary,
 * zooming on the world map, dragging sliders, or triggering auto-save countdowns), debouncing
 * prevents unnecessary computations and server roundtrips until user input pauses.
 *
 * Covers: useDebounce.ts
 * Tests: Initial state, timer delays, rapid updates, zero-delay fast path, cancel, and flush.
 */

// ============================================================================
// Value Debounce Tests
// ============================================================================
// Verifies that primitive and object values update only after the delay passes.
// ============================================================================

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return initial value immediately on first render', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('should not update debounced value before delayMs elapses', () => {
    const { result, rerender } = renderHook(
      ({ val, delay }) => useDebounce(val, delay),
      { initialProps: { val: 'initial', delay: 300 } }
    );

    // Change input value
    rerender({ val: 'updated', delay: 300 });
    expect(result.current).toBe('initial');

    // Advance partial time
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('initial');

    // Advance remaining time
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid consecutive updates', () => {
    const { result, rerender } = renderHook(
      ({ val, delay }) => useDebounce(val, delay),
      { initialProps: { val: 'first', delay: 300 } }
    );

    // Update to second at 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ val: 'second', delay: 300 });
    expect(result.current).toBe('first');

    // Update to third at another 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ val: 'third', delay: 300 });
    expect(result.current).toBe('first');

    // Advance 250ms (not yet 300ms since the 'third' update)
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('first');

    // Advance final 50ms (full 300ms since 'third')
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('third');
  });

  it('should update immediately if delayMs is 0 or negative', () => {
    const { result, rerender } = renderHook(
      ({ val, delay }) => useDebounce(val, delay),
      { initialProps: { val: 'initial', delay: 0 } }
    );

    rerender({ val: 'instant', delay: 0 });
    expect(result.current).toBe('instant');
  });
});

// ============================================================================
// Callback Debounce Tests
// ============================================================================
// Verifies that wrapped functions execute once with latest arguments, plus cancel/flush.
// ============================================================================

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should execute callback with latest args after delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    // Call with arg 1
    act(() => {
      result.current('first');
    });
    expect(callback).not.toHaveBeenCalled();

    // Call with arg 2 before 200ms
    act(() => {
      vi.advanceTimersByTime(100);
      result.current('second');
    });
    expect(callback).not.toHaveBeenCalled();

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('second');
  });

  it('should cancel pending execution when cancel() is called', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('test');
    });

    act(() => {
      vi.advanceTimersByTime(150);
      result.current.cancel();
      vi.advanceTimersByTime(300);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should immediately execute pending call when flush() is called', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('flush-arg');
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('flush-arg');

    // Timer expiration should not trigger a second duplicate call
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute immediately when delayMs is 0', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 0));

    act(() => {
      result.current('instant-call');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('instant-call');
  });

  it('should always use the freshest callback reference across renders', () => {
    let captured = '';
    const { result, rerender } = renderHook(
      ({ text }) =>
        useDebouncedCallback((msg: string) => {
          captured = `${text}:${msg}`;
        }, 200),
      { initialProps: { text: 'v1' } }
    );

    act(() => {
      result.current('payload');
    });

    // Rerender with v2 before timer fires
    rerender({ text: 'v2' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(captured).toBe('v2:payload');
  });
});
