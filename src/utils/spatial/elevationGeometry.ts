// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This dependency header is initialized for a new shared tactical helper.
 * Run the codebase visualizer sync after verification to record its consumers.
 */
// @dependencies-end

/**
 * This file gives tactical range, sight, and movement one vertical ruler.
 *
 * Battle-map terrain stores renderer-oriented elevation units, while combat
 * ranges and movement budgets use feet. These helpers convert ground height,
 * respect explicit flying altitude, and combine the closest occupied squares
 * without changing any character or map record.
 *
 * Called by: target validation, line of sight, pathfinding, and grid movement.
 * Depends on: battle-map elevation configuration and production combat types.
 */

import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from '../../config/mapConfig';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../types/combat';

// ============================================================================
// Tactical Unit Conversion
// ============================================================================
// Elevation is rounded to whole feet before rules use it. The renderer already
// presents whole-foot relief, so this prevents a visible ten-foot ledge from
// becoming a hidden 9.84-foot range boundary.
// ============================================================================

const FEET_PER_METER = 3.280839895;
const TACTICAL_TILE_FEET = 5;

export function getBattleMapTileAltitudeFeet(tile: Pick<BattleMapTile, 'elevation'>): number {
  if (!Number.isFinite(tile.elevation)) return 0;
  return Math.round(
    tile.elevation * BATTLE_MAP_ELEVATION_METERS_PER_UNIT * FEET_PER_METER,
  );
}

// ============================================================================
// Creature Footprint Heights
// ============================================================================
// Flying creatures carry an explicit absolute altitude. Grounded creatures use
// each occupied square's surface, which keeps Large creatures honest on uneven
// terrain when the closest three-dimensional pair is measured.
// ============================================================================

function getFootprintWidth(character: CombatCharacter): number {
  switch (character.stats.size) {
    case 'Large': return 2;
    case 'Huge': return 3;
    case 'Gargantuan': return 4;
    default: return 1;
  }
}

function getOccupiedPositions(character: CombatCharacter): Position[] {
  const width = getFootprintWidth(character);
  const positions: Position[] = [];

  // The character position is the top-left occupied square. Expanding here
  // avoids treating a Large creature's centre as its only legal range origin.
  for (let xOffset = 0; xOffset < width; xOffset += 1) {
    for (let yOffset = 0; yOffset < width; yOffset += 1) {
      positions.push({
        x: character.position.x + xOffset,
        y: character.position.y + yOffset,
      });
    }
  }
  return positions;
}

export function getCombatantAltitudeFeet(
  character: CombatCharacter,
  mapData: BattleMapData,
  occupiedPosition: Position,
): number {
  // Explicit flight altitude is already measured from the battle map's local
  // zero and therefore outranks the ground directly beneath the creature.
  if (character.aerialMovement?.isFlying) {
    return character.aerialMovement.altitudeFeet;
  }

  const tile = mapData.tiles.get(`${occupiedPosition.x}-${occupiedPosition.y}`);
  return tile ? getBattleMapTileAltitudeFeet(tile) : 0;
}

// ============================================================================
// Three-Dimensional Range
// ============================================================================
// Aralia's tactical ruler follows the established aerial-movement contract:
// horizontal grid distance plus actual vertical separation. Ability storage
// remains in five-foot tiles, while this helper returns canonical feet.
// ============================================================================

function getPositionPairDistanceFeet(
  first: Position,
  firstAltitudeFeet: number,
  second: Position,
  secondAltitudeFeet: number,
): number {
  const horizontalTiles = Math.max(
    Math.abs(first.x - second.x),
    Math.abs(first.y - second.y),
  );
  return horizontalTiles * TACTICAL_TILE_FEET
    + Math.abs(firstAltitudeFeet - secondAltitudeFeet);
}

export function getCombatDistanceFeet(
  first: CombatCharacter,
  second: CombatCharacter,
  mapData: BattleMapData,
): number {
  let closestDistanceFeet = Number.POSITIVE_INFINITY;

  // Compare complete footprints and retain the nearest legal origin/target
  // pair, matching the existing size-aware horizontal targeting contract.
  for (const firstPosition of getOccupiedPositions(first)) {
    const firstAltitudeFeet = getCombatantAltitudeFeet(first, mapData, firstPosition);
    for (const secondPosition of getOccupiedPositions(second)) {
      const secondAltitudeFeet = getCombatantAltitudeFeet(second, mapData, secondPosition);
      closestDistanceFeet = Math.min(
        closestDistanceFeet,
        getPositionPairDistanceFeet(
          firstPosition,
          firstAltitudeFeet,
          secondPosition,
          secondAltitudeFeet,
        ),
      );
    }
  }

  return Number.isFinite(closestDistanceFeet) ? closestDistanceFeet : 0;
}

export function getCombatantToPositionDistanceFeet(
  character: CombatCharacter,
  targetPosition: Position,
  mapData: BattleMapData,
): number {
  const targetTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
  const targetAltitudeFeet = targetTile ? getBattleMapTileAltitudeFeet(targetTile) : 0;
  let closestDistanceFeet = Number.POSITIVE_INFINITY;

  // Empty-space targeting still starts from the closest occupied caster square
  // and ends on the selected tile's real ground height.
  for (const occupiedPosition of getOccupiedPositions(character)) {
    closestDistanceFeet = Math.min(
      closestDistanceFeet,
      getPositionPairDistanceFeet(
        occupiedPosition,
        getCombatantAltitudeFeet(character, mapData, occupiedPosition),
        targetPosition,
        targetAltitudeFeet,
      ),
    );
  }

  return Number.isFinite(closestDistanceFeet) ? closestDistanceFeet : 0;
}

// ============================================================================
// Ground Height Transitions
// ============================================================================
// Walking across a height boundary spends the real vertical feet in addition
// to horizontal travel. Both ascent and controlled descent use this rule; fall
// damage and loss of support remain owned by their separate production path.
// ============================================================================

export function getElevationTransitionCostFeet(
  fromTile: Pick<BattleMapTile, 'elevation'>,
  toTile: Pick<BattleMapTile, 'elevation'>,
): number {
  return Math.abs(
    getBattleMapTileAltitudeFeet(toTile) - getBattleMapTileAltitudeFeet(fromTile),
  );
}
