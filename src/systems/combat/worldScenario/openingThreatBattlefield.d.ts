/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:09
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns a hostile opening's real mounted WorldForge crop into a
 * source-framed tactical standoff.
 *
 * The opening model supplies dialogue and a bestiary roster, but it does not
 * choose geometry. This adapter validates the game-authored seed/cell receipt,
 * asks the Ground-derived referee grid to author one deterministic entity scene,
 * and freezes exact world-meter positions plus ecological evidence in a receipt.
 *
 * Called by: World3DWrapper's mounted opening-combat provider
 * Depends on: the opening receipt and an already extracted WorldForge battle map
 */
import type { OpeningBattlefieldSource } from "@/systems/gameEntry/types";
import type { BattleMapData } from "@/types/combat";
import type { OpeningThreatSceneReceipt, OpeningThreatSceneReceiptV2 } from "./worldforgeEncounterReceipt";
export type OpeningThreatBattlefieldResult = {
    status: "ready";
    detail: string;
    mapData: BattleMapData;
    receipt: OpeningThreatSceneReceiptV2;
} | {
    status: "source-gap";
    detail: string;
};
/** Minimal roster facts needed to author source entities without combat rules. */
export interface OpeningThreatRosterEntry {
    name: string;
    quantity: number;
    cr?: string;
}
/** Rebuild a resolved opening site without treating its remaining bodies as a new fight. */
export declare function projectResolvedOpeningThreatReturnBattlefield(mapData: BattleMapData, source: OpeningBattlefieldSource, roster: readonly OpeningThreatRosterEntry[], receipt: OpeningThreatSceneReceiptV2): OpeningThreatBattlefieldResult;
/**
 * Validate one opening receipt against the extracted map and add an honest
 * tactical frame. No terrain, props, structures, occupants, or roster facts are
 * generated here; all existing source layers pass through unchanged.
 */
export declare function projectOpeningThreatBattlefield(mapData: BattleMapData, source: OpeningBattlefieldSource, roster: readonly OpeningThreatRosterEntry[], existingReceipt?: OpeningThreatSceneReceipt): OpeningThreatBattlefieldResult;
