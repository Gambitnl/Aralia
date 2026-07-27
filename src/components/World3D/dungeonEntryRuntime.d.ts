/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 06:50:34
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns a world-grown dungeon doorway into one validated expedition session.
 *
 * The 3D world supplies the canonical entrance id and frozen seed path created by
 * Worldforge. This boundary validates that receipt through the existing dungeon generator,
 * remembers the exact ground position the player came from, and returns the generated plan
 * to the player-facing overlay. Durable lifecycle state now lives in GameState and uses the same
 * identity receipt; this runtime remains responsible only for validation, generation, and return.
 *
 * Called by: World3DWrapper.tsx when the player chooses Enter Dungeon.
 * Depends on: the canonical dungeon identity resolver and GroundWorld entrance contract.
 */
import type { GroundDungeonEntrance } from '../../systems/worldforge/bridge/groundChunkLoader';
import { type DungeonIdentity } from '../../systems/worldforge/dungeon/world/deriveIdentity';
import type { DungeonPlan } from '../../systems/worldforge/dungeon/types';
export declare const DUNGEON_ENTRY_INTERACTION_RADIUS_M = 18;
export interface DungeonWorldReturnContext {
    worldSeed: number;
    cellId: number;
    tileX: number;
    tileY: number;
    xM: number;
    zM: number;
}
export interface ActiveDungeonEntry {
    identity: DungeonIdentity;
    entranceKind: GroundDungeonEntrance['entranceKind'];
    plan: DungeonPlan;
    returnContext: DungeonWorldReturnContext;
}
/**
 * Find the closest entrance that is near enough to enter.
 *
 * Stable array order breaks equal-distance ties, matching the GroundWorld attachment order and
 * avoiding a second identity policy at overlapping town entrances.
 */
export declare function nearestEnterableDungeon(entrances: readonly GroundDungeonEntrance[], xM: number, zM: number, radiusM?: number): GroundDungeonEntrance | null;
/**
 * Validate a world entrance and open its canonical generated dungeon.
 *
 * Invalid, stale, or cross-world attachments throw from `generateDungeonForIdentity`. The caller
 * presents that message visibly instead of substituting a preview seed or unrelated interior.
 */
export declare function createDungeonEntry(entrance: GroundDungeonEntrance, returnContext: DungeonWorldReturnContext): ActiveDungeonEntry;
