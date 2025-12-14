import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, NetworkError } from '../networkUtils';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return parsed JSON data on success (default)', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout<{ id: number; name: string }>('/api/test');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      signal: expect.anything(),
    }));
  });

  it('should return text data when responseType is text', async () => {
    const mockText = 'Hello World';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockText),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout<string>('/api/test', { responseType: 'text' });

    expect(result).toEqual(mockText);
  });

  it('should throw NetworkError on non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    await expect(fetchWithTimeout('/api/test')).rejects.toThrow(NetworkError);
    await expect(fetchWithTimeout('/api/test')).rejects.toThrow('Request to /api/test failed: 404 Not Found');
  });

  it('should throw timeout error when request times out', async () => {
    (global.fetch as any).mockImplementation(async (url: string, { signal }: { signal: AbortSignal }) => {
        return new Promise((_, reject) => {
            if (signal.aborted) {
                reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                return;
            }
            signal.addEventListener('abort', () => {
                reject(signal.reason || new DOMException('Aborted', 'AbortError'));
            });
        });
    });

    const promise = fetchWithTimeout('/api/test', { timeoutMs: 100 });

    // Fast-forward time
    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow('Request to /api/test timed out after 100ms');
  });

  it('should respect external AbortSignal', async () => {
    // For this test, do NOT use fake timers because JSDOM event propagation might rely on real scheduling,
    // or simply because we don't want to advance timers for 'timeout' related logic, just abort immediately.
    vi.useRealTimers();

    const userController = new AbortController();

    (global.fetch as any).mockImplementation(async (url: string, { signal }: { signal: AbortSignal }) => {
        return new Promise((_, reject) => {
            if (signal.aborted) {
                 reject(signal.reason || new DOMException('Aborted', 'AbortError'));
                 return;
            }
            signal.addEventListener('abort', () => {
                 reject(signal.reason || new DOMException('Aborted', 'AbortError'));
            });
        });
    });

    const promise = fetchWithTimeout('/api/test', { signal: userController.signal });

    // Abort from outside
    setTimeout(() => userController.abort(new DOMException('Aborted', 'AbortError')), 10);

    await expect(promise).rejects.toThrow('Aborted');
  });
});
