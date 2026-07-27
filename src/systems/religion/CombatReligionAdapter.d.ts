/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 06:37:00
 * Dependents: components/Combat/CombatView.tsx, systems/religion/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { AppAction } from '../../state/actionTypes';
import { CombatLogEntry } from '../../types/combat';
/**
 * Adapter to translate combat log events into religion triggers.
 * It keeps the legacy fixed triggers working, but now prefers deity-authored
 * combat taxonomy labels when they exist so new doctrine hooks can be added
 * without widening this file again.
 */
export declare class CombatReligionAdapter {
    /**
     * Analyzes a log entry and dispatches deity triggers if matches are found.
     */
    static processLogEntry(entry: CombatLogEntry, dispatch: React.Dispatch<AppAction>): void;
}
