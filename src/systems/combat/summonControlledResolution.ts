/**
 * This file validates where a spell-created creature may enter combat.
 *
 * SummoningCommand uses the occupancy and terrain checks as its final defensive
 * boundary. Tactical Sandbox controls also use the complete range and sight check
 * before asking the normal ability system to spend an Action or spell slot. Keeping
 * those facts here prevents the preview from inventing a looser placement rule.
 *
 * Called by: SummoningCommand and the Summons & Controlled Allies scenario controls.
 * Depends on: shared occupied-footprint, elevation-distance, and line-of-sight rules.
 */

// ============================================================================
// Production Types And Geometry
// ============================================================================
// A placement request contains only live battle-map facts. The result is pure and
// carries a stable reason suitable for both combat logs and deterministic tests.
// ============================================================================

import type { BattleMapData, CombatCharacter, Position } from '../../types/combat';
import { getOccupiedTiles } from '../../utils/combat';
import { hasLineOfSight } from '../../utils/spatial';
import {
  getBattleMapTileAltitudeFeet,
  getCombatantAltitudeFeet,
  getCombatantToPositionDistanceFeet,
} from '../../utils/spatial/elevationGeometry';

export interface SummonPlacementRequest {
  caster: CombatCharacter;
  destination: Position;
  characters: CombatCharacter[];
  mapData?: BattleMapData | null;
  rangeFeet?: number;
  requireLineOfSight?: boolean;
}

export type SummonPlacementResolution =
  | { status: 'allowed'; distanceFeet: number }
  | {
      status: 'rejected';
      reason: 'off_board' | 'blocked' | 'occupied' | 'out_of_range' | 'no_line_of_sight';
      message: string;
      distanceFeet: number;
    };

// ============================================================================
// Exact Placement Validation
// ============================================================================
// Spell text says "an unoccupied space", so the requested square is authoritative.
// A blocked or occupied square is rejected rather than silently moving the summon to
// a neighboring square the player did not choose.
// ============================================================================

export function resolveSummonPlacement(
  request: SummonPlacementRequest,
): SummonPlacementResolution {
  const {
    caster,
    destination,
    characters,
    mapData,
    rangeFeet = Number.POSITIVE_INFINITY,
    requireLineOfSight = false,
  } = request;

  // Mapless combat preserves the older unbounded placement behavior, but still
  // enforces occupied space. A loaded map makes its authored tiles authoritative.
  const hasLoadedMap = Boolean(mapData && mapData.tiles.size > 0);
  const destinationTile = hasLoadedMap
    ? mapData?.tiles.get(`${destination.x}-${destination.y}`)
    : undefined;
  const distanceFeet = hasLoadedMap && mapData
    ? getCombatantToPositionDistanceFeet(caster, destination, mapData)
    : Math.max(
        Math.abs(caster.position.x - destination.x),
        Math.abs(caster.position.y - destination.y),
      ) * 5;

  // Empty map fixtures mean combat is running without a mounted board. Only a
  // populated tile registry can authoritatively reject an off-board coordinate.
  if (hasLoadedMap && !destinationTile) {
    return {
      status: 'rejected',
      reason: 'off_board',
      message: `The chosen summon space ${destination.x},${destination.y} is off the battle map.`,
      distanceFeet,
    };
  }

  if (destinationTile?.blocksMovement) {
    return {
      status: 'rejected',
      reason: 'blocked',
      message: `The chosen summon space ${destination.x},${destination.y} is blocked terrain.`,
      distanceFeet,
    };
  }

  // Complete creature footprints matter here. A Large creature occupying any part
  // of the chosen square blocks the manifestation just like a Small creature does.
  const occupant = characters.find(character => getOccupiedTiles(character).some(tile => (
    tile.x === destination.x && tile.y === destination.y
  )));
  if (occupant) {
    return {
      status: 'rejected',
      reason: 'occupied',
      message: `The chosen summon space ${destination.x},${destination.y} is occupied by ${occupant.name}.`,
      distanceFeet,
    };
  }

  if (distanceFeet > rangeFeet) {
    return {
      status: 'rejected',
      reason: 'out_of_range',
      message: `The chosen summon space is ${distanceFeet} ft away, beyond the ${rangeFeet} ft range.`,
      distanceFeet,
    };
  }

  if (requireLineOfSight && mapData && destinationTile) {
    const destinationAltitudeFeet = getBattleMapTileAltitudeFeet(destinationTile);
    const visible = getOccupiedTiles(caster).some(casterTilePosition => {
      const casterTile = mapData.tiles.get(`${casterTilePosition.x}-${casterTilePosition.y}`);
      if (!casterTile) return false;

      return hasLineOfSight(casterTile, destinationTile, mapData, {
        startAltitudeFeet: getCombatantAltitudeFeet(caster, mapData, casterTilePosition),
        endAltitudeFeet: destinationAltitudeFeet,
      });
    });

    if (!visible) {
      return {
        status: 'rejected',
        reason: 'no_line_of_sight',
        message: `The chosen summon space ${destination.x},${destination.y} is not visible to ${caster.name}.`,
        distanceFeet,
      };
    }
  }

  return { status: 'allowed', distanceFeet };
}

// ============================================================================
// Source Ownership Lookup
// ============================================================================
// Cleanup and scenario proof identify summons by both caster and spell. Matching
// only one field could remove another caster's creature or another owned spell.
// ============================================================================

export function getExactOwnedSummons(
  characters: CombatCharacter[],
  casterId: string,
  spellId: string,
): CombatCharacter[] {
  return characters.filter(character => (
    character.isSummon === true
    && character.summonMetadata?.casterId === casterId
    && character.summonMetadata?.spellId === spellId
  ));
}
