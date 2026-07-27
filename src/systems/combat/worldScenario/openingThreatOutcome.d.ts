/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:56:42
 * Dependents: state/reducers/worldReducer.ts, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { BattleMapData, CombatEnemySnapshotEntry } from "@/types/combat";
import type { OpeningThreatSceneReceiptV2 } from "./worldforgeEncounterReceipt";
export type OpeningThreatOutcomeReconciliation = {
    status: "ready";
    receipt: OpeningThreatSceneReceiptV2;
    detail: string;
} | {
    status: "source-gap";
    detail: string;
};
export type OpeningThreatBattleResult = "victory" | "defeat";
/**
 * Turn final combat tokens into one immutable scene resolution.
 *
 * Withdrawn creatures retain their last seen cell rather than receiving an
 * invented off-map destination. Downed creatures remain physical return-visit
 * evidence. A party defeat leaves standing enemies holding the disturbed site.
 */
export declare function resolveOpeningThreatSceneAfterCombat(receipt: OpeningThreatSceneReceiptV2, mapData: BattleMapData, finalEnemies: readonly CombatEnemySnapshotEntry[], result: OpeningThreatBattleResult, resolvedAtGameTimeMs: number): OpeningThreatOutcomeReconciliation;
