// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:38:49
 * Dependents: context/index.ts, networkUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  responseType?: 'json' | 'text';
}

interface RetryOptions {
  retries?: number;
  delay?: number;
  backoff?: number; // Multiplier for delay
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * A wrapper around fetch that adds timeout support and typed error handling.
 * Automatically parses JSON response by default, or text if specified.
 * Supports merging external AbortSignal with the internal timeout signal.
 *
 * @param url The URL to fetch
 * @param options Fetch options plus an optional timeoutMs (default 10000ms) and responseType (default 'json')
 * @returns Promise<T> The parsed response cast to T
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 10000, responseType = 'json', ...fetchOptions } = options;
  const controller = new AbortController();

  const id = setTimeout(() => controller.abort(), timeoutMs);

  // Merge external signal
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

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

    if (responseType === 'text') {
      return (await response.text()) as unknown as T;
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    clearTimeout(id);

    // Clean up external signal listener
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }

    if (error instanceof Error && error.name === 'AbortError') {
      // If the external signal was aborted, rethrow the AbortError (or a wrapped version)
      // to indicate it was a user cancellation, not a timeout.
      if (externalSignal?.aborted) {
        // We can either throw the original error or a specific "Cancelled" error.
        // Throwing the original error is usually best for AbortSignal patterns.
        throw error;
      }
      // Otherwise, it was our timeout
      throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }

    if (error instanceof NetworkError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    throw new NetworkError(errorMessage, undefined, undefined, error);
  } finally {
     if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Check if device is online
 */
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Retries a promise-returning function with exponential backoff
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true
  } = options;

  let attempt = 0;
  let currentDelay = delay;
  let success = false;
  let result: T | undefined;

  while (!success && attempt <= retries) {
    try {
      result = await fn();
      success = true;
    } catch (error) {
      attempt++;

      if (attempt > retries || !shouldRetry(error)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoff;
    }
  }
  
  return result as T;
};
