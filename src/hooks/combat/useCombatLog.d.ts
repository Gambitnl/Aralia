/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 07:03:36
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatLogEntry } from '../../types/combat';
interface UseCombatLogOptions {
    /**
     * Optional storage namespace for the combat log.
     * When omitted, the hook falls back to a shared default key.
     */
    storageKey?: string;
}
/**
 * useCombatLog
 *
 * A custom hook to manage the state of the combat log.
 * It handles adding new entries and truncating the log to a maximum size
 * to prevent performance degradation over long encounters. The current log is
 * also mirrored to localStorage so a refresh can restore the same encounter's
 * history when CombatView passes the same storage key back in.
 *
 * @returns {
 *   logs: CombatLogEntry[];
 *   addLogEntry: (entry: CombatLogEntry) => void;
 *   clearLogs: () => void;
 * }
 */
export declare const useCombatLog: ({ storageKey }?: UseCombatLogOptions) => {
    logs: CombatLogEntry[];
    addLogEntry: (entry: CombatLogEntry) => void;
    clearLogs: () => void;
};
export {};
