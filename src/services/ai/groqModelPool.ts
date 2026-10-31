/**
 * @file src/services/ai/groqModelPool.ts
 *
 * The Groq model pool. On Groq's free plan each text model has its OWN rate
 * limits (per minute and per day, measured 2026-10-31 on Remy's account:
 * 30 requests/min, 1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day for
 * every model below). Remy asked for as many requests as possible, so the game
 * uses the best model until Groq refuses it with a rate-limit error (429), then
 * moves to the next model, and so on. Three models give about three times the
 * daily allowance of one.
 *
 * This is a stated pool the player chose, not a silent fallback:
 *   - only a rate-limit refusal moves to the next model; every other error is
 *     returned as it is;
 *   - the model that answered is recorded and shown in the AI settings pane and
 *     the AI log;
 *   - when every model is at its limit, the call fails with a message that
 *     names the soonest time a model is free again.
 *
 * State is in memory only. After a page reload the first refused request
 * finds the limit again; a refused request costs no tokens.
 */

import { useSyncExternalStore } from 'react';

/**
 * Free-plan text models, best writer first. All three share the same limits,
 * so the order is by writing quality only.
 */
export const GROQ_MODEL_POOL: readonly string[] = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

/**
 * Rest used when a 429 gives no wait time we can read. The browser cannot see
 * Groq's rate-limit headers (CORS), so the wait comes from the error text.
 */
export const GROQ_DEFAULT_REST_MS = 60_000;

export interface GroqPoolStatus {
  /** The model that answered the most recent successful call, if any. */
  lastAnsweredBy: string | null;
  /** Models at their rate limit, with the time (ms since epoch) they free up. */
  restingUntil: Record<string, number>;
}

let status: GroqPoolStatus = { lastAnsweredBy: null, restingUntil: {} };
const listeners = new Set<() => void>();

function publish(next: GroqPoolStatus): void {
  status = next;
  for (const l of listeners) l();
}

/** The order to try models in: the chosen model first, then the rest of the pool. */
export function groqModelOrder(preferred: string): string[] {
  return [preferred, ...GROQ_MODEL_POOL.filter((m) => m !== preferred)];
}

/** True while a model is at its rate limit. */
export function isGroqModelResting(model: string, now = Date.now()): boolean {
  const until = status.restingUntil[model];
  return until !== undefined && until > now;
}

/** Record a rate-limit refusal: the model rests for `restMs`. */
export function markGroqModelResting(model: string, restMs: number, now = Date.now()): void {
  publish({ ...status, restingUntil: { ...status.restingUntil, [model]: now + restMs } });
}

/** Record the model that answered. A model that answers is no longer resting. */
export function markGroqModelAnswered(model: string): void {
  const restingUntil = { ...status.restingUntil };
  delete restingUntil[model];
  publish({ lastAnsweredBy: model, restingUntil });
}

/**
 * Read Groq's wait time from a 429 error text, for example
 * "Please try again in 1m26.4s" or "Please try again in 850ms".
 * Returns null when the text names no wait time.
 */
export function parseGroqRetryAfterMs(text: string): number | null {
  const m = /try again in\s+((?:\d+(?:\.\d+)?(?:h|ms|m|s))+)/i.exec(text);
  if (!m) return null;
  let ms = 0;
  for (const part of m[1].matchAll(/(\d+(?:\.\d+)?)(h|ms|m|s)/g)) {
    const n = Number(part[1]);
    const unit = part[2];
    ms += unit === 'h' ? n * 3_600_000 : unit === 'm' ? n * 60_000 : unit === 's' ? n * 1000 : n;
  }
  return Math.ceil(ms);
}

/** Snapshot of the pool, for tests and non-React readers. */
export function getGroqPoolStatus(): GroqPoolStatus {
  return status;
}

/** Clear all pool state (tests only). */
export function resetGroqPool(): void {
  publish({ lastAnsweredBy: null, restingUntil: {} });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: the live pool status, for the AI settings pane. */
export function useGroqPoolStatus(): GroqPoolStatus {
  return useSyncExternalStore(subscribe, getGroqPoolStatus, getGroqPoolStatus);
}
