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
export declare const DEBUG_LOG_KEY = "aralia-debug-log";
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
export declare function readDebugLog(): DebugLogEntry[];
export declare function appendDebugLog(category: DebugLogCategory, message: string, data?: Record<string, unknown>): void;
export declare function clearDebugLog(): void;
