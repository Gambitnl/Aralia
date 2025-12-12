import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';
import { SafeStorage } from '../../utils/storageUtils';

describe('useLocalStorage', () => {
  const KEY = 'test-hook-key';
  const INITIAL_VALUE = { foo: 'bar' };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    expect(result.current[0]).toEqual(INITIAL_VALUE);
  });

  it('should return stored value if exists', () => {
    const stored = { foo: 'baz' };
    localStorage.setItem(KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    expect(result.current[0]).toEqual(stored);
  });

  it('should update storage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    const newValue = { foo: 'updated' };

    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toEqual(newValue);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(newValue);
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 1 }));

    act(() => {
      result.current[1]((prev) => ({ count: prev.count + 1 }));
    });

    expect(result.current[0]).toEqual({ count: 2 });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ count: 2 });
  });

  it('should handle JSON parse errors gracefully and return initial value', () => {
    localStorage.setItem(KEY, '{ invalid json');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));

    expect(result.current[0]).toEqual(INITIAL_VALUE);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should sync with external storage changes', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    const newValue = { foo: 'external' };

    act(() => {
      const event = new StorageEvent('storage', {
        key: KEY,
        newValue: JSON.stringify(newValue),
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toEqual(newValue);
  });
});
