import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';
import { z } from 'zod';
import { SafeStorage } from '../../utils/storageUtils';

// Mock SafeStorage
vi.mock('../../utils/storageUtils', () => ({
  SafeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('useLocalStorage Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate schema on load', () => {
    // Setup existing bad data in storage
    vi.mocked(SafeStorage.getItem).mockReturnValue(JSON.stringify({ volume: 'loud' })); // string instead of number

    const schema = z.object({
      volume: z.number().min(0).max(100)
    });

    const { result } = renderHook(() =>
      useLocalStorage('audio_settings', { volume: 50 }, { schema })
    );

    // Should fall back to initial value because "loud" is not a number
    expect(result.current[0]).toEqual({ volume: 50 });
  });

  it('should accept valid data', () => {
    vi.mocked(SafeStorage.getItem).mockReturnValue(JSON.stringify({ volume: 75 }));

    const schema = z.object({
      volume: z.number().min(0).max(100)
    });

    const { result } = renderHook(() =>
      useLocalStorage('audio_settings', { volume: 50 }, { schema })
    );

    expect(result.current[0]).toEqual({ volume: 75 });
  });

  it('should strip extra fields if schema allows', () => {
      vi.mocked(SafeStorage.getItem).mockReturnValue(JSON.stringify({ volume: 75, extra: 'data' }));

      const schema = z.object({
        volume: z.number()
      });

      const { result } = renderHook(() =>
        useLocalStorage('audio_settings', { volume: 50 }, { schema })
      );

      expect(result.current[0]).toEqual({ volume: 75 });
      // extra field is stripped by zod parse
  });
});
