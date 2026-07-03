/**
 * @file debugLog.ts
 * @description Persistent developer debug log, surfaced in the Dev Menu.
 *
 * A tiny localStorage-backed event log for rare "the engine did something
 * invisible on your behalf" moments — startup self-heal reloads, save
 * auto-anchoring, migrations — so they leave a visible trace instead of
 * happening silently. NOT a general logging sink: gameplay/AI logging has its
 * own systems (logger, ollamaLogSink). Storage failures are swallowed — the
 * log is diagnostics, never behavior.
 *
 * The cold-start guard in index.html writes to the SAME key with the same
 * entry shape (it runs before any module code, so it can't import this file).
 * Keep DEBUG_LOG_KEY and the entry fields in sync with that inline script.
 */

export const DEBUG_LOG_KEY = 'aralia-debug-log';
const MAX_ENTRIES = 100;

export type DebugLogCategory = 'startup-recovery' | 'auto-anchor' | (string & {});

export interface DebugLogEntry {
  /** ISO timestamp. */
  time: string;
  /** Event family — drives the badge in the Dev Menu panel. */
  category: DebugLogCategory;
  /** Human-readable one-liner. */
  message: string;
  /** Optional structured details, shown collapsed in the panel. */
  data?: Record<string, unknown>;
}

export function readDebugLog(): DebugLogEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendDebugLog(category: DebugLogCategory, message: string, data?: Record<string, unknown>): void {
  try {
    const log = readDebugLog();
    log.push({ time: new Date().toISOString(), category, message, ...(data ? { data } : {}) });
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch {
    // Storage unavailable/full — diagnostics must never break the app.
  }
}

export function clearDebugLog(): void {
  try {
    localStorage.removeItem(DEBUG_LOG_KEY);
  } catch {
    // Ignore.
  }
}
