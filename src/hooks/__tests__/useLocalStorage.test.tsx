import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';
import { SafeStorage } from '../../utils/storageUtils';

// Mock SafeStorage
vi.mock('../../utils/storageUtils', () => ({
  SafeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial value if storage is empty', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('should return stored value if storage has data', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue(JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('stored');
  });

  it('should return initial value if parsing fails', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue('invalid-json');
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('should update storage when value changes', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(SafeStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
  });

  it('should handle function updates', () => {
      vi.mocked(SafeStorage.getItem).mockReturnValue(null);
      const { result } = renderHook(() => useLocalStorage<number>('count-key', 0));

      act(() => {
          result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);
      expect(SafeStorage.setItem).toHaveBeenCalledWith('count-key', '1');
  });

  it('should handle write errors gracefully', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue(null);
    vi.mocked(SafeStorage.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Should not throw
    act(() => {
      result.current[1]('new-value');
    });

    // State should still update even if storage fails
    expect(result.current[0]).toBe('new-value');
  });
});
