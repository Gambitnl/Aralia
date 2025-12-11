import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SafeStorage, SafeSession } from '../storageUtils';

describe('SafeStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getItem', () => {
    it('returns the item from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(SafeStorage.getItem('test-key')).toBe('test-value');
    });

    it('returns null if item does not exist', () => {
      expect(SafeStorage.getItem('non-existent')).toBeNull();
    });

    it('returns null and warns if localStorage.getItem throws', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('Access denied');
      });

      expect(SafeStorage.getItem('test-key')).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading'), expect.any(Error));
    });
  });

  describe('setItem', () => {
    it('sets the item in localStorage', () => {
      SafeStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');
    });

    it('propagates errors from localStorage.setItem', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      expect(() => SafeStorage.setItem('test-key', 'value')).toThrow('QuotaExceededError');
    });
  });

  describe('removeItem', () => {
    it('removes the item from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      SafeStorage.removeItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('swallows errors if localStorage.removeItem throws', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('Access denied');
      });

      expect(() => SafeStorage.removeItem('test-key')).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('getAllKeys', () => {
    it('returns all keys from localStorage', () => {
      localStorage.setItem('key1', 'val1');
      localStorage.setItem('key2', 'val2');
      const keys = SafeStorage.getAllKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });

    it('returns empty array if iterating throws', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Mocking length access is tricky in jsdom environment, so we mock key()
      // or we can mock the whole localStorage object but it is global.
      // Trying to mock the length getter on the prototype.
      vi.spyOn(Storage.prototype, 'length', 'get').mockImplementationOnce(() => {
         throw new Error('Access denied');
      });

      const keys = SafeStorage.getAllKeys();
      expect(keys).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});

describe('SafeSession', () => {
  // Similar tests for SafeSession...
  it('sets and gets item', () => {
      SafeSession.setItem('s-key', 's-val');
      expect(SafeSession.getItem('s-key')).toBe('s-val');
  });

  it('removes item', () => {
      SafeSession.setItem('s-key', 's-val');
      SafeSession.removeItem('s-key');
      expect(SafeSession.getItem('s-key')).toBeNull();
  });
});
