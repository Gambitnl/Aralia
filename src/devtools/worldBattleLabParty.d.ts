/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 17:40:13
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { PlayerCharacter } from "../types";
export declare function buildWorldBattleLabParty(sourceParty?: readonly PlayerCharacter[]): PlayerCharacter[];
