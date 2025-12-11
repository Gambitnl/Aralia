import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, NetworkError } from '../networkUtils';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks
    global.fetch = vi.fn();

    // In JSDOM, AbortController exists. We should spy on it or replace it carefully.
    vi.stubGlobal('AbortController', class {
      abort = vi.fn();
      signal = { aborted: false } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    // To simulate timeout, we can make the fetch promise reject with an AbortError
    (global.fetch as any).mockRejectedValue({ name: 'AbortError' });

    await expect(fetchWithTimeout('/api/test', { timeoutMs: 100 })).rejects.toThrow('Request to /api/test timed out after 100ms');
  });
});
