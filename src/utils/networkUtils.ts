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

  // Handle external signal if provided
  const externalSignal = fetchOptions.signal;

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
    }

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
    if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
    }

    if (error.name === 'AbortError') {
      // Differentiate between timeout and external abort
      if (externalSignal?.aborted) {
        // If external signal was aborted, rethrow the abort error (or wrap it)
        // Usually, calling code expects AbortError if they aborted it.
        // But fetchWithTimeout currently wraps everything in NetworkError or rethrows.
        // Let's create a NetworkError that indicates abortion, or just rethrow original error
        // if we want to mimic standard fetch behavior for aborts.
        // The existing code threw NetworkError for timeouts.
        throw new NetworkError('Request aborted by user', undefined, undefined, error);
      }
      throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || 'Unknown network error', undefined, undefined, error);
  }
}
