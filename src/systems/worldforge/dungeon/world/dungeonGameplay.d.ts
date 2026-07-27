/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:46:10
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file supplies the first playable rules for a canonical generated dungeon.
 *
 * Movement stays on the generator's real five-foot floor grid. The first meaningful interaction
 * uses rooms already authored with the `treasure` type, giving each cache a stable id derived from
 * the canonical dungeon receipt and generated room id. The mounted 3D expedition reports that id
 * to the existing durable lifecycle ledger instead of keeping a parallel component-owned record.
 * The same floor and route helpers now seat vertical transitions in authored rooms and restore the
 * exact parent coordinate after ascent. Level-zero movement and treasure behaviour stay unchanged.
 *
 * Called by: Dungeon3DPreview.tsx, dungeonLevels.ts, and focused dungeon gameplay tests.
 * Depends on: DungeonPlan geometry, canonical dungeon identity, and the lifecycle progress patch.
 */
import { type Cell, type DungeonPlan, type DungeonSpawn } from '../types';
import type { DungeonIdentity } from './dungeonIdentity';
import type { DungeonProgressPatch } from './dungeonLifecycle';
export type DungeonMoveDirection = 'north' | 'east' | 'south' | 'west';
export interface DungeonTreasureInteraction {
    eventId: string;
    roomId: number;
    targetCell: Cell;
    distance: number;
}
export interface DungeonEncounterInteraction {
    eventId: string;
    roomId: number;
    /** Real bestiary key of the generated monster, surfaced for the interaction prompt only. */
    monsterKey: string;
    targetCell: Cell;
    distance: number;
}
export declare function dungeonTreasureEventId(identity: DungeonIdentity, roomId: number): string;
/** The generated five-foot grid cell a spawn stands on, derived from its frozen plot-feet position. */
export declare function dungeonSpawnCell(plan: DungeonPlan, spawn: DungeonSpawn): Cell;
/**
 * Freeze one encounter's stable key from the canonical receipt, its authored room, and its grid
 * cell. A room may hold several generated spawns, so the cell disambiguates them without depending
 * on the mutable spawn-array order. The same seeded plan therefore yields the same encounter id
 * across exit, save/load, and revisit.
 */
export declare function dungeonEncounterEventId(identity: DungeonIdentity, roomId: number, cell: Cell): string;
export declare function dungeonRoomPlayerCell(plan: DungeonPlan, roomId: number): Cell;
/** Place the party on the truthful floor nearest the generated entrance-room centre. */
export declare function dungeonEntrancePlayerCell(plan: DungeonPlan): Cell;
export declare function findNextDungeonTreasureInteraction(plan: DungeonPlan, identity: DungeonIdentity, claimedTreasureIds: readonly string[], playerCell: Cell): DungeonTreasureInteraction | null;
export declare function findNextDungeonEncounterInteraction(plan: DungeonPlan, identity: DungeonIdentity, clearedEncounterIds: readonly string[], playerCell: Cell): DungeonEncounterInteraction | null;
export declare function dungeonPathBetweenCells(plan: DungeonPlan, playerCell: Cell, targetCell: Cell): Cell[];
/** Reuse the shared shortest floor route for the selected authored treasure cache. */
export declare function dungeonPathToTreasureInteraction(plan: DungeonPlan, playerCell: Cell, interaction: DungeonTreasureInteraction): Cell[];
/** Reuse the same shortest floor route for the selected generated encounter. */
export declare function dungeonPathToEncounterInteraction(plan: DungeonPlan, playerCell: Cell, interaction: DungeonEncounterInteraction): Cell[];
export declare function moveDungeonPlayer(plan: DungeonPlan, playerCell: Cell, direction: DungeonMoveDirection): Cell;
export declare function canClaimDungeonTreasure(playerCell: Cell, interaction: DungeonTreasureInteraction | null): boolean;
export declare function dungeonTreasureProgressPatch(interaction: DungeonTreasureInteraction): DungeonProgressPatch;
export declare function canClearDungeonEncounter(playerCell: Cell, interaction: DungeonEncounterInteraction | null): boolean;
export declare function dungeonEncounterProgressPatch(interaction: DungeonEncounterInteraction): DungeonProgressPatch;
/** One completed boss (or other authored) objective, recorded through the shared progress action. */
export declare function dungeonObjectiveProgressPatch(objectiveId: string): DungeonProgressPatch;
export declare function dungeonCellToScenePosition(plan: DungeonPlan, cell: Cell): {
    x: number;
    z: number;
};
