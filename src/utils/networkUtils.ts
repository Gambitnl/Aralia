/**
 * Network utilities for consistent API handling.
 * Implements Diplomat's philosophy: resilience, typing, and timeouts.
 */

export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * A wrapper around fetch that adds timeout support and typed error handling.
 * Automatically parses JSON response.
 *
 * @param url The URL to fetch
 * @param options Fetch options plus an optional timeoutMs (default 10000ms)
 * @returns Promise<T> The parsed JSON response cast to T
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  const controller = new AbortController();

  // If the caller provided a signal, we should respect it too, but AbortController chaining is complex.
  // For now, we assume we control the signal.
  // TODO: Merge signals if needed in future.

  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!response.ok) {
      throw new NetworkError(
        `Request to ${url} failed: ${response.status} ${response.statusText}`,
        response.status,
        response.statusText
      );
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || 'Unknown network error', undefined, undefined, error);
  }
}
