/**
 * @file src/utils/movementUtils.ts
 * Utilities for calculating movement costs and distances using D&D 5e Variant rules (5-10-5).
 *
 * CURRENT FUNCTIONALITY:
 * - Implements 5-10-5 diagonal movement costing system
 * - Calculates step costs for cardinal and diagonal movement
 * - Tracks diagonal count for proper cost alternation
 * - Provides foundation for pathfinding algorithms
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Per-step calculation overhead in complex pathfinding
 *    - Implement batch movement cost calculation
 *    - Add movement cost lookup tables for common patterns
 *    - Optimize for frequently calculated paths
 * 2. COMPLETENESS: Missing advanced movement mechanics
 *    - No support for difficult terrain costing
 *    - Lacks climbing/swimming movement modes
 *    - Missing vehicle/mount movement calculations
 * 3. INTEGRATION: Poor coupling with other systems
 *    - No integration with character speed modifiers
 *    - Lacks connection to encumbrance effects
 *    - Missing synergy with spell/item movement bonuses
 * 4. EXTENSIBILITY: Rigid implementation limits future features
 *    - Add support for custom movement rules
 *    - Implement movement action point system
 *    - Support for simultaneous movement tracking
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: commands/effects/MovementCommand.ts, components/DesignPreview/steps/raceDomain/leaves/earthGenasiRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/terrainScenarioControls.ts, hooks/movementUtils.ts, systems/combat/fightInPlace/inSceneMovement.ts, utils/combat/aerialMovementUtils.ts, utils/combat/combatUtils.ts, utils/combat/grappleUtils.ts, utils/combat/index.ts, utils/spatial/pathfinding.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Position } from '../../types/combat';
import type { BattleMapDecoration, BattleMapTerrain, BattleMapTile } from '../../types/combat';
import { getElevationTransitionCostFeet } from '../spatial/elevationGeometry';

// ============================================================================
// Tile Cost Normalization
// ============================================================================
// Older battle-map generators stored tile movementCost as feet per square
// (5 for normal terrain, 10 for difficult terrain). Newer terrain systems
// often store it as a multiplier (1 for normal, 2 for difficult). These helpers
// preserve both formats so movement math can use one feet-based rulebook.
// ============================================================================

export function getTileMovementMultiplier(tileMovementCost: number | undefined): number {
  if (!Number.isFinite(tileMovementCost) || tileMovementCost === undefined || tileMovementCost <= 0) {
    return 1;
  }

  // Values above 4 are treated as feet-per-tile. A normal generated battle
  // tile is 5, which means "one 5 ft square", not "5x movement cost".
  if (tileMovementCost > 4) {
    return tileMovementCost / 5;
  }

  return tileMovementCost;
}

export function isDifficultMovementCost(tileMovementCost: number | undefined): boolean {
  return getTileMovementMultiplier(tileMovementCost) > 1;
}

// ============================================================================
// Race-Aware Terrain Movement Policy
// ============================================================================
// Traits such as Earth Walk and Timberwalk waive the difficult-terrain
// surcharge, but each waives it only over a named surface. Character records
// flatten every such trait into one unconditional `ignoreDifficultTerrain`
// boolean (see data/races/racialTraits.ts), which throws the qualifier away:
// movement math that reads only that boolean lets an Earth Genasi wade
// through difficult water for free.
//
// A terrain movement policy is the seam that keeps the qualifier attached to
// the rule. It is one per-tile predicate, and the same value is understood by
// path costing below, by production pathfinding
// (utils/spatial/pathfinding.findPath), and by the movement helpers the combat
// hooks call, so no surface re-derives racial terrain rules for itself.
// ============================================================================

/** The policies this game knows, each named after the trait that grants it. */
export type TerrainMovementPolicyId = 'earth-walk' | 'timberwalk' | 'any-difficult-terrain';

export interface TerrainMovementPolicy {
  /** Which trait this policy speaks for. Carried into logs and receipts. */
  readonly id: TerrainMovementPolicyId;
  /** True when entering this tile costs the mover no difficult-terrain surcharge. */
  ignoresDifficultTerrain(tile: BattleMapTile): boolean;
}

/**
 * Terrain kinds that count as "walking on the ground or a floor". Water is a
 * wade or a swim and a wall is not a surface at all, so neither qualifies.
 */
export const GROUND_OR_FLOOR_TERRAIN: readonly BattleMapTerrain[] = [
  'grass',
  'rock',
  'difficult',
  'floor',
  'sand',
  'mud',
];

/** Decorations that make a square difficult because of plants and undergrowth. */
export const PLANT_UNDERGROWTH_DECORATIONS: readonly NonNullable<BattleMapDecoration>[] = [
  'tree',
  'bush',
  'stump',
  'fallen_log',
  'mangrove',
  'cactus',
];

/** Earth Walk (Earth Genasi): ground and floors only, never water or a wall. */
export const EARTH_WALK_TERRAIN_POLICY: TerrainMovementPolicy = {
  id: 'earth-walk',
  ignoresDifficultTerrain: (tile) => (
    !tile.blocksMovement && GROUND_OR_FLOOR_TERRAIN.includes(tile.terrain)
  ),
};

/** Timberwalk (Lotusden Halfling): nonmagical plants and undergrowth only. */
export const TIMBERWALK_TERRAIN_POLICY: TerrainMovementPolicy = {
  id: 'timberwalk',
  ignoresDifficultTerrain: (tile) => (
    !tile.blocksMovement
    && (
      tile.terrain === 'grass'
      || (tile.decoration !== null && PLANT_UNDERGROWTH_DECORATIONS.includes(tile.decoration))
    )
  ),
};

/**
 * The unqualified waiver. A trait that names no surface keeps the historical
 * behaviour of the flat `ignoreDifficultTerrain` flag, so nothing that already
 * waived every square silently loses that grant to this seam.
 */
export const ANY_DIFFICULT_TERRAIN_POLICY: TerrainMovementPolicy = {
  id: 'any-difficult-terrain',
  ignoresDifficultTerrain: (tile) => !tile.blocksMovement,
};

/**
 * Reads the canonical trait text a race authored and returns the policy it
 * grants, or null when no trait waives the surcharge.
 *
 * Matching the QUALIFIER clause, not just the waiver, is the point of this
 * function: `racialTraits.ts` recognizes only the unqualified Earth Walk
 * sentence and stores a boolean, so Timberwalk is invisible to it and Earth
 * Walk loses its ground/floor condition on the way in.
 */
export function resolveTerrainMovementPolicyFromTraits(
  traits: readonly string[] | undefined,
): TerrainMovementPolicy | null {
  for (const trait of traits ?? []) {
    const waivesSurcharge = /move\s+across\s+difficult\s+terrain/i.test(trait)
      && /without\s+expending\s+extra\s+movement/i.test(trait);
    if (!waivesSurcharge) continue;
    if (/walking\s+on\s+the\s+ground\s+or\s+a\s+floor/i.test(trait)) {
      return EARTH_WALK_TERRAIN_POLICY;
    }
    if (/plants?\s+and\s+undergrowth/i.test(trait)) {
      return TIMBERWALK_TERRAIN_POLICY;
    }
    return ANY_DIFFICULT_TERRAIN_POLICY;
  }
  return null;
}

/**
 * The tile's movement multiplier as THIS mover experiences it: the ordinary
 * multiplier, with the difficult-terrain surcharge dropped when the mover
 * policy covers this square. A caller with no policy gets the ordinary cost.
 */
export function getPolicyAwareTileMovementMultiplier(
  tile: BattleMapTile,
  policy: TerrainMovementPolicy | null | undefined,
): number {
  const multiplier = getTileMovementMultiplier(tile.movementCost);
  if (multiplier > 1 && policy?.ignoresDifficultTerrain(tile)) {
    return 1;
  }
  return multiplier;
}

/**
 * Calculates the cost of a single step.
 * @param dx Change in X
 * @param dy Change in Y
 * @param diagonalCount Number of diagonals already taken in this path
 * @returns Object containing the cost of this step and whether it was diagonal
 *
 * CURRENT FUNCTIONALITY:
 * - Implements D&D 5e variant diagonal movement (5-10-5 rule)
 * - Alternates diagonal costs between 5 and 10 feet
 * - Distinguishes between cardinal (5ft) and diagonal movement
 * - Tracks diagonal count for proper cost calculation
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. ACCURACY: Simplistic diagonal tracking may miss edge cases
 *    - Add path-aware diagonal counting for complex routes
 *    - Implement lookahead for optimal path cost calculation
 *    - Handle movement restrictions that reset diagonal counters
 * 2. PERFORMANCE: Per-call overhead for simple movements
 *    - Pre-calculate common movement patterns
 *    - Implement movement cost caching for repeated paths
 *    - Add bulk calculation methods for multi-step movements
 * 3. EXTENSIBILITY: Hard-coded 5-10-5 system limits flexibility
 *    - Add support for alternative movement costing systems
 *    - Implement character-specific movement rules
 *    - Support for temporary movement cost modifications
 * 4. INTEGRATION: Missing connection to character capabilities
 *    - No consideration of character speed modifiers
 *    - Lacks integration with encumbrance effects
 *    - Missing synergy with spell/item movement bonuses
 */
export function calculateMovementCost(dx: number, dy: number, diagonalCount: number): { cost: number; isDiagonal: boolean } {
  const isDiagonal = dx !== 0 && dy !== 0;

  if (!isDiagonal) {
    return { cost: 5, isDiagonal: false };
  }

  // 5-10-5 rule:
  // 1st diagonal: 5
  // 2nd diagonal: 10
  // 3rd diagonal: 5
  // ...
  // Even counts (0, 2, 4...) cost 5
  // Odd counts (1, 3, 5...) cost 10
  const cost = (diagonalCount % 2 === 0) ? 5 : 10;

  return { cost, isDiagonal: true };
}

export function calculateStepMovementCost(
  dx: number,
  dy: number,
  diagonalCount: number,
  tileMovementCost: number | undefined
): { cost: number; isDiagonal: boolean } {
  const baseStep = calculateMovementCost(dx, dy, diagonalCount);
  const terrainMultiplier = getTileMovementMultiplier(tileMovementCost);

  return {
    cost: baseStep.cost * terrainMultiplier,
    isDiagonal: baseStep.isDiagonal
  };
}

export function calculatePathMovementCost(
  path: BattleMapTile[],
  terrainPolicy: TerrainMovementPolicy | null = null
): number {
  let totalCost = 0;
  let diagonalCount = 0;

  // The first tile is the character's current square. Movement is only charged
  // for entering subsequent tiles, using each destination tile's terrain cost
  // as the mover's own terrain policy prices it.
  for (let i = 1; i < path.length; i += 1) {
    const previous = path[i - 1];
    const next = path[i];
    const dx = next.coordinates.x - previous.coordinates.x;
    const dy = next.coordinates.y - previous.coordinates.y;
    const step = calculateStepMovementCost(
      dx,
      dy,
      diagonalCount,
      getPolicyAwareTileMovementMultiplier(next, terrainPolicy)
    );

    // Ground travel pays the horizontal/terrain step and the real vertical
    // separation. This matches aerial movement's additive three-dimensional
    // ruler without turning controlled descent into fall damage.
    totalCost += step.cost + getElevationTransitionCostFeet(previous, next);
    if (step.isDiagonal) {
      diagonalCount += 1;
    }
  }

  return totalCost;
}

/**
 * Calculates the distance between two points using 5-10-5 diagonal rules.
 * This is equivalent to counting steps where every other diagonal costs double.
 * Useful for range checks that strictly follow grid movement.
 */
export function getTargetDistance(pos1: Position, pos2: Position): number {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);

  const diagonals = Math.min(dx, dy);
  const straights = Math.abs(dx - dy);

  // Calculate diagonal cost:
  // First diagonal is 5, second is 10, etc.
  // Formula:
  // n diagonals.
  // Number of 10s = floor(n/2)
  // Number of 5s = ceil(n/2)
  // Total = (floor(n/2) * 10) + (ceil(n/2) * 5)
  // Which simplifies to: 5 * n + 5 * floor(n/2)

  const diagonalCost = (5 * diagonals) + (5 * Math.floor(diagonals / 2));
  const straightCost = straights * 5;

  return diagonalCost + straightCost;
}
