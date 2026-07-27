// @dependencies-start
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
// @dependencies-end

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
import {
  generateDungeonForIdentity,
  type DungeonIdentity,
} from '../../systems/worldforge/dungeon/world/deriveIdentity';
import type { DungeonPlan } from '../../systems/worldforge/dungeon/types';

// ============================================================================
// Interaction Distance
// ============================================================================
// Discovery happens from farther away so the entrance can be pinned on the map. Actual entry
// requires the player to walk close enough that the doorway reads as an intentional action.
// ============================================================================

export const DUNGEON_ENTRY_INTERACTION_RADIUS_M = 18;

// ============================================================================
// Active Expedition Receipt
// ============================================================================
// This transient mounted-view receipt keeps canonical identity, generated interior, and an exact
// return point. The serializable lifecycle ledger stores identity and progress, not the large plan.
// ============================================================================

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
export function nearestEnterableDungeon(
  entrances: readonly GroundDungeonEntrance[],
  xM: number,
  zM: number,
  radiusM = DUNGEON_ENTRY_INTERACTION_RADIUS_M,
): GroundDungeonEntrance | null {
  let nearest: GroundDungeonEntrance | null = null;
  let nearestDistance = radiusM;

  // Compare every low-count entrance in the current ground window and retain only the closest
  // mouth inside the interaction radius. Discovery radius is intentionally not reused here.
  for (const entrance of entrances) {
    const distance = Math.hypot(xM - entrance.xM, zM - entrance.zM);
    if (distance > radiusM || (nearest && distance >= nearestDistance)) continue;
    nearest = entrance;
    nearestDistance = distance;
  }

  return nearest;
}

/**
 * Validate a world entrance and open its canonical generated dungeon.
 *
 * Invalid, stale, or cross-world attachments throw from `generateDungeonForIdentity`. The caller
 * presents that message visibly instead of substituting a preview seed or unrelated interior.
 */
export function createDungeonEntry(
  entrance: GroundDungeonEntrance,
  returnContext: DungeonWorldReturnContext,
): ActiveDungeonEntry {
  const identity: DungeonIdentity = {
    dungeonId: entrance.id,
    seedPath: entrance.sitePath,
  };

  // Generate through the completed identity lane, preserving the world seed check and the exact
  // frozen seed path rather than rebuilding parameters inside the UI.
  const plan = generateDungeonForIdentity(identity, returnContext.worldSeed);

  return {
    identity,
    entranceKind: entrance.entranceKind,
    plan,
    returnContext: { ...returnContext },
  };
}
