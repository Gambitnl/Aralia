
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, NetworkError } from '../networkUtils';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should successfully fetch data', async () => {
    const mockResponse = { id: 1, name: 'Test' };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchWithTimeout<{ id: number; name: string }>('/api/test');
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('should handle text response type', async () => {
    const mockResponse = 'Plain Text';
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => mockResponse,
    });

    const result = await fetchWithTimeout<string>('/api/test', { responseType: 'text' });
    expect(result).toEqual(mockResponse);
  });

  it('should throw NetworkError on HTTP error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchWithTimeout('/api/test')).rejects.toThrow(NetworkError);
    await expect(fetchWithTimeout('/api/test')).rejects.toThrow('Request to /api/test failed: 404 Not Found');
  });

  it('should throw NetworkError on timeout', async () => {
    // To simulate timeout, we can make the fetch promise reject with an AbortError
    // But since we are mocking fetch, we need to simulate the AbortSignal aborting.
    // However, the fetch implementation in fetchWithTimeout uses an internal controller.

    // We can simulate the abort error directly coming from fetch
    (global.fetch as any).mockRejectedValue({ name: 'AbortError' });

    // We can't easily test the timeout trigger itself without more complex mocking because
    // fetch is called immediately. But we can test that AbortError is converted to Timeout error.

    await expect(fetchWithTimeout('/api/test')).rejects.toThrow('timed out');
  });

  it('should respect external AbortSignal', async () => {
    // Use real timers for this test since we are dealing with promises and signals
    vi.useRealTimers();

    const controller = new AbortController();
    const signal = controller.signal;

    // Mock fetch to wait for abort
    (global.fetch as any).mockImplementation((url: string, options: any) => {
        return new Promise((resolve, reject) => {
             if (options.signal) {
                 if (options.signal.aborted) {
                     const e = new Error('Aborted');
                     e.name = 'AbortError';
                     reject(e);
                     return;
                 }
                 options.signal.addEventListener('abort', () => {
                     const e = new Error('Aborted');
                     e.name = 'AbortError';
                     reject(e);
                 });
             }
        });
    });

    const promise = fetchWithTimeout('/api/test', { signal, timeoutMs: 5000 });

    // Trigger abort
    controller.abort();

    // Expect the promise to reject with AbortError, NOT NetworkError (timeout)
    await expect(promise).rejects.toThrow('Aborted');
  });
});
