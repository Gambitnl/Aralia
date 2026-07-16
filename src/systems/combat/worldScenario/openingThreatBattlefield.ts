// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 01:43:32
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a hostile opening's real mounted WorldForge crop into a
 * source-framed tactical standoff.
 *
 * The opening model supplies dialogue and a bestiary roster, but it supplies no
 * exact enemy coordinates or approach heading. This adapter therefore validates
 * the game-authored seed/cell receipt, keeps the player at the live crop anchor,
 * and records those missing world facts explicitly. The combat setup may apply
 * a deterministic standoff formation, but it may not present that formation as
 * source-authored geometry.
 *
 * Called by: World3DWrapper's mounted opening-combat provider
 * Depends on: the opening receipt and an already extracted WorldForge battle map
 */
import type { OpeningBattlefieldSource } from '@/systems/gameEntry/types';
import type { BattleMapData, BattleMapTile } from '@/types/combat';

// ============================================================================
// Projection Result
// ============================================================================
// A rejected receipt is an actionable source gap. Callers carry that refusal to
// CombatView instead of swapping in the legacy procedural arena.
// ============================================================================

export type OpeningThreatBattlefieldResult =
  | {
      status: 'ready';
      detail: string;
      mapData: BattleMapData;
    }
  | {
      status: 'source-gap';
      detail: string;
    };

// ============================================================================
// Anchor Selection
// ============================================================================
// The Ground -> Tactical extractor centers the live player meters in the crop.
// Terrain can make that exact cell unusable, so choose the closest legal cell
// deterministically and avoid placing the party on an ambient resident.
// ============================================================================

function nearestWalkableAnchor(mapData: BattleMapData): BattleMapTile | null {
  const center = {
    x: Math.floor(mapData.dimensions.width / 2),
    y: Math.floor(mapData.dimensions.height / 2),
  };
  const occupied = new Set((mapData.worldOccupants ?? []).map((occupant) => (
    `${occupant.position.x}-${occupant.position.y}`
  )));

  const candidates = [...mapData.tiles.values()]
    .filter((tile) => (
      !tile.blocksMovement
      && !occupied.has(`${tile.coordinates.x}-${tile.coordinates.y}`)
    ))
    .sort((a, b) => {
      const aDistance = (a.coordinates.x - center.x) ** 2 + (a.coordinates.y - center.y) ** 2;
      const bDistance = (b.coordinates.x - center.x) ** 2 + (b.coordinates.y - center.y) ** 2;
      return aDistance - bDistance
        || a.coordinates.y - b.coordinates.y
        || a.coordinates.x - b.coordinates.x;
    });

  return candidates[0] ?? null;
}

// ============================================================================
// Source Validation And Tactical Framing
// ============================================================================

/**
 * Validate one opening receipt against the extracted map and add an honest
 * tactical frame. No terrain, props, structures, occupants, or roster facts are
 * generated here; all existing source layers pass through unchanged.
 */
export function projectOpeningThreatBattlefield(
  mapData: BattleMapData,
  source: OpeningBattlefieldSource,
): OpeningThreatBattlefieldResult {
  const provenance = mapData.provenance;
  if (!provenance) {
    return {
      status: 'source-gap',
      detail: `Opening receipt ${source.receiptId} reached combat without WorldForge tactical provenance.`,
    };
  }

  // Both dimensions of source identity must agree. A matching cell in a
  // different seed is a different world; a matching seed in another cell is a
  // different place.
  if (provenance.worldSeed !== source.worldSeed || provenance.anchorCellId !== source.cellId) {
    return {
      status: 'source-gap',
      detail: `Opening receipt ${source.receiptId} expected world ${source.worldSeed}, cell ${source.cellId}, but the live tactical crop identifies world ${provenance.worldSeed}, cell ${provenance.anchorCellId ?? 'unknown'}.`,
    };
  }

  const anchor = nearestWalkableAnchor(mapData);
  if (!anchor) {
    return {
      status: 'source-gap',
      detail: `Opening receipt ${source.receiptId} has no legal player anchor in its WorldForge crop.`,
    };
  }

  // Preserve the complete source map. Only provenance lineage and encounter
  // framing are extended; the model is not allowed to repaint the location.
  return {
    status: 'ready',
    detail: `Opening receipt ${source.receiptId} projected from the live GroundWorld; enemy world positions and approach direction remain explicitly unauthored.`,
    mapData: {
      ...mapData,
      provenance: {
        ...provenance,
        locationLabel: provenance.locationLabel ?? source.locationLabel,
        generationPath: [
          ...provenance.generationPath,
          `Opening threat ${source.receiptId}`,
        ],
      },
      encounterContext: {
        kind: 'opening-standoff',
        source: 'worldforge-opening',
        sourceReceiptId: source.receiptId,
        sourceWorldCellId: source.cellId,
        anchorTile: { ...anchor.coordinates },
        deployment: {
          player: 'current-position',
          enemy: 'terrain-fit-standoff-constellation',
        },
        omittedFacts: {
          enemyWorldPositions: 'not-authored',
          approachDirection: 'not-authored',
        },
      },
    },
  };
}
