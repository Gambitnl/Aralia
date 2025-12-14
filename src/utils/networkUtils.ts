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

/**
 * Merges multiple AbortSignals into one.
 * The returned signal aborts when any of the input signals abort.
 */
function mergeSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal {
  const controller = new AbortController();

  // If no valid signals, return a fresh one (not aborted)
  const validSignals = signals.filter((s): s is AbortSignal => !!s);
  if (validSignals.length === 0) {
    return controller.signal;
  }

  // Check if any are already aborted
  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
  }

  // Listen to all
  const onAbort = (event: Event) => {
    // We can't easily get the reason from the event in a generic way,
    // so we try to find which signal aborted.
    const sourceSignal = event.target as AbortSignal;
    controller.abort(sourceSignal.reason);
  };

  for (const signal of validSignals) {
    signal.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}


/**
 * A wrapper around fetch that adds timeout support and typed error handling.
 * Automatically parses JSON response by default, or text if specified.
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
  const timeoutController = new AbortController();

  const id = setTimeout(() => timeoutController.abort(new Error(`Request to ${url} timed out after ${timeoutMs}ms`)), timeoutMs);

  const mergedSignal = mergeSignals(timeoutController.signal, fetchOptions.signal);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: mergedSignal,
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
  } catch (error: any) {
    clearTimeout(id);

    // Check if it was a timeout or user abort
    if (timeoutController.signal.aborted) {
        throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }

    // If the user's signal aborted, fetch throws AbortError (DOMException)
    if (error.name === 'AbortError') {
       throw error;
    }

    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || 'Unknown network error', undefined, undefined, error);
  }
}
