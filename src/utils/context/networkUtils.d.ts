/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:51
 * Dependents: context/index.ts, networkUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Network utilities for consistent API handling.
 * Implements Diplomat's philosophy: resilience, typing, and timeouts.
 */
export declare class NetworkError extends Error {
    status?: number;
    statusText?: string;
    originalError?: unknown;
    constructor(message: string, status?: number, statusText?: string, originalError?: unknown);
}
interface FetchOptions extends RequestInit {
    timeoutMs?: number;
    responseType?: 'json' | 'text';
}
interface RetryOptions {
    retries?: number;
    delay?: number;
    backoff?: number;
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
export declare function fetchWithTimeout<T>(url: string, options?: FetchOptions): Promise<T>;
/**
 * Check if device is online
 */
export declare const isOnline: () => boolean;
/**
 * Retries a promise-returning function with exponential backoff
 */
export declare const withRetry: <T>(fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;
export {};
