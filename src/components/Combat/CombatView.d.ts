/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:11
 * Dependents: components/Combat/index.ts
 * Imports: 46 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file CombatView.tsx
 * The main component for the active combat phase.
 * Initializes the turn manager and ability system with real game data.
 * Now handles Victory/Defeat states and Loot distribution.
 *
 * @modified 2026-02-10 — Integrated the rich combat messaging system (useCombatMessaging)
 *   via a bridge adapter (convertLogEntryToMessage). Every CombatLogEntry emitted by the
 *   combat hooks is now also converted to a CombatMessage and stored in parallel. The
 *   CombatLog component receives both arrays and can render either format.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import React from "react";
import { PlayerCharacter, Item } from "../../types";
import { BattleMapBiome, CombatCharacter, CombatEnemySnapshotEntry, CombatPartySnapshotEntry } from "../../types/combat";
import { Plane } from "../../types/planes";
interface CombatViewProps {
    party: PlayerCharacter[];
    enemies: CombatCharacter[];
    biome: BattleMapBiome;
    onRoundElapsed?: (seconds: number) => void;
    onBattleEnd: (result: "victory" | "defeat", rewards?: {
        gold: number;
        items: Item[];
        xp: number;
    }, finalPartyState?: CombatPartySnapshotEntry[], finalEnemyState?: CombatEnemySnapshotEntry[]) => void;
    currentPlane?: Plane;
}
declare const _default: React.NamedExoticComponent<CombatViewProps>;
export default _default;
