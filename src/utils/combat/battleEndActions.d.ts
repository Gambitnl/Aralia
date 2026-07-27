/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:12
 * Dependents: App.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Translates a finished combat into application-level state actions. CombatView
 * reports the outcome; App owns whether play resumes or reaches game over.
 */
import type { AppAction } from "../../state/actionTypes";
import { type Item } from "../../types";
import type { CombatEnemySnapshotEntry, CombatPartySnapshotEntry } from "../../types/combat";
export type BattleEndResult = "victory" | "defeat";
export type BattleRewards = {
    gold: number;
    items: Item[];
    xp: number;
};
export declare const createBattleEndActions: (result: BattleEndResult, rewards?: BattleRewards, finalPartyState?: CombatPartySnapshotEntry[], finalEnemyState?: CombatEnemySnapshotEntry[]) => AppAction[];
