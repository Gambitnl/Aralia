/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/06/2026, 14:53:09
 * Dependents: components/Combat/MonsterPicker.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { MonsterData } from '../../types/ui';
export interface BestiaryEntry {
    name: string;
    cr: string;
    crLair?: string;
    xpLair?: number;
    type: string;
    source: string;
    raw: MonsterData;
}
export declare function useBestiary(): {
    entries: BestiaryEntry[];
    isLoading: boolean;
    error: string;
};
