import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';
import { z } from 'zod';

// Mock the SafeStorage utility
const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock('../../utils/storageUtils', () => ({
  SafeStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
  },
}));

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with initial value if storage is empty', () => {
    mockGetItem.mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('initial');
    expect(mockGetItem).toHaveBeenCalledWith('test-key');
  });

  it('should initialize with stored value if storage has data', () => {
    mockGetItem.mockReturnValue(JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('stored');
  });

  it('should fallback to initial value if parsing fails', () => {
    mockGetItem.mockReturnValue('invalid-json');
    // Suppress console.warn for this test
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('initial');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should update storage when value changes', () => {
    mockGetItem.mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(mockSetItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
  });

  it('should support functional updates', () => {
    mockGetItem.mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('test-key', 1));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(mockSetItem).toHaveBeenCalledWith('test-key', JSON.stringify(2));
  });

  it('should handle storage write errors gracefully', () => {
    mockGetItem.mockReturnValue(null);
    mockSetItem.mockImplementation(() => { throw new Error('QuotaExceeded'); });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial', { onError }));

    act(() => {
      result.current[1]('new-value');
    });

    // State should still update even if storage fails
    expect(result.current[0]).toBe('new-value');
    expect(consoleSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should remove value from storage', () => {
    mockGetItem.mockReturnValue(JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe('initial');
    expect(mockRemoveItem).toHaveBeenCalledWith('test-key');
  });

  describe('Schema Validation', () => {
    const schema = z.object({
        count: z.number(),
        active: z.boolean(),
    });

    it('should return stored value if it matches schema', () => {
        const validData = { count: 10, active: true };
        mockGetItem.mockReturnValue(JSON.stringify(validData));

        const { result } = renderHook(() =>
            useLocalStorage('test-key', { count: 0, active: false }, { schema })
        );

        expect(result.current[0]).toEqual(validData);
    });

    it('should fallback to initial value if data does not match schema', () => {
        const invalidData = { count: "10", active: "yes" }; // Wrong types
        mockGetItem.mockReturnValue(JSON.stringify(invalidData));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onError = vi.fn();

        const { result } = renderHook(() =>
            useLocalStorage('test-key', { count: 0, active: false }, { schema, onError })
        );

        expect(result.current[0]).toEqual({ count: 0, active: false });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Schema validation failed'), expect.any(Object));
        expect(onError).toHaveBeenCalled();
    });

    it('should strip unknown keys if using z.object (depending on schema definition)', () => {
        // Zod by default strips unknown keys if not strict
        const dataWithExtra = { count: 5, active: true, extra: 'junk' };
        mockGetItem.mockReturnValue(JSON.stringify(dataWithExtra));

        const { result } = renderHook(() =>
            useLocalStorage('test-key', { count: 0, active: false }, { schema })
        );

        expect(result.current[0]).toEqual({ count: 5, active: true });
        // The extra key is gone
    });
  });
});
