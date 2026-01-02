import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { withRetry, fetchWithTimeout } from '../networkUtils';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return data on success', async () => {
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    const result = await fetchWithTimeout('https://example.com');
    expect(result).toEqual({ data: 'test' });
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { retries: 3, delay: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw last error after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(withRetry(fn, { retries: 2, delay: 1 }))
      .rejects.toThrow('always fail');

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});
