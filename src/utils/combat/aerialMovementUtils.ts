// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 03:22:12
 * Dependents: components/DesignPreview/steps/scenarioControls/flyingAerialMovementScenarioControls.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves vertical movement for creatures that have a Fly Speed.
 *
 * The normal battle-map pathfinder remains the authority for walking. Flight
 * needs a different narrow path because ground difficulty and low obstacles do
 * not increase aerial cost, while map bounds, occupied airspace, blocking
 * terrain at the chosen height, and the creature's live movement budget still
 * matter. The resolver composes those existing facts and stores the resulting
 * altitude on the combat character used by both map renderers.
 *
 * Called by: Tactical Sandbox flight controls and future combat flight actions.
 * Depends on: canonical elevation, full-footprint placement, grid distance,
 * and action-economy helpers.
 */

import type {
  AbilityCost,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../types/combat';
import { elevationUnitsToFeet } from '../../components/BattleMap/elevationPresentation';
import {
  getCharacterSizeMultiplier,
  getOccupiedTiles,
  validateCharacterPlacement,
} from './combatUtils';
import { getTargetDistance } from './movementUtils';
import { canAffordActionCost, consumeActionCost } from './actionEconomyUtils';

// ============================================================================
// Aerial Movement Contract
// ============================================================================
// A request names an exact horizontal destination and absolute altitude. The
// result always includes measured distance and cost, even when the move rejects,
// so logs and tests can explain the same boundary that the resolver enforced.
// ============================================================================

export interface AerialMovementRequest {
  character: CombatCharacter;
  destination: Position;
  destinationAltitudeFeet: number;
  mapData: BattleMapData;
  characters: CombatCharacter[];
  /** Ground cells directly beneath the authored flight path, for proof only. */
  crossedGroundTiles?: Position[];
}

export interface AerialMovementResolution {
  allowed: boolean;
  character: CombatCharacter;
  horizontalDistanceFeet: number;
  verticalDistanceFeet: number;
  distanceFeet: number;
  costFeet: number;
  flySpeedFeet: number;
  ignoredGroundMovementCost: boolean;
  reason: string;
}

export interface AerialSupportLossResolution {
  remainsAloft: boolean;
  requiresFall: boolean;
  runtimeSupported: boolean;
  trigger: 'none' | 'prone' | 'incapacitated' | 'zero_fly_speed';
  reason: string;
}

const MOVEMENT_ONLY_COST = (movementCost: number): AbilityCost => ({
  type: 'movement-only',
  movementCost,
});

// ============================================================================
// Height And Airspace Facts
// ============================================================================
// Ground elevation and aerial altitude share the battle map's local zero-foot
// floor. That common ruler lets a flyer clear a low wall without making the
// wall disappear for a creature trying to land inside it.
// ============================================================================

export function getBattleMapGroundAltitudeFeet(
  mapData: BattleMapData,
  position: Position,
): number | null {
  const tile = mapData.tiles.get(`${position.x}-${position.y}`);
  return tile ? Math.round(elevationUnitsToFeet(tile.elevation)) : null;
}

function getCharacterAltitudeFeet(
  character: CombatCharacter,
  mapData: BattleMapData,
): number {
  if (character.aerialMovement?.isFlying) {
    return character.aerialMovement.altitudeFeet;
  }

  return getBattleMapGroundAltitudeFeet(mapData, character.position) ?? 0;
}

function getCharacterVerticalSizeFeet(character: CombatCharacter): number {
  return getCharacterSizeMultiplier(character.stats.size) * 5;
}

function verticalBandsOverlap(
  firstAltitudeFeet: number,
  firstHeightFeet: number,
  secondAltitudeFeet: number,
  secondHeightFeet: number,
): boolean {
  return firstAltitudeFeet < secondAltitudeFeet + secondHeightFeet
    && secondAltitudeFeet < firstAltitudeFeet + firstHeightFeet;
}

function charactersOccupyingDestinationAltitude(
  movingCharacter: CombatCharacter,
  destinationAltitudeFeet: number,
  mapData: BattleMapData,
  characters: CombatCharacter[],
): CombatCharacter[] {
  const movingHeightFeet = getCharacterVerticalSizeFeet(movingCharacter);

  // Full-footprint placement will handle horizontal overlap. This filter keeps
  // only creatures whose vertical bodies overlap the chosen airspace, allowing
  // a flyer to pass above a ground creature without permitting two flyers to
  // occupy the same three-dimensional space.
  return characters.filter(character => {
    if (character.id === movingCharacter.id) return true;
    return verticalBandsOverlap(
      destinationAltitudeFeet,
      movingHeightFeet,
      getCharacterAltitudeFeet(character, mapData),
      getCharacterVerticalSizeFeet(character),
    );
  });
}

function createAltitudeAwareDestinationMap(
  character: CombatCharacter,
  destination: Position,
  destinationAltitudeFeet: number,
  mapData: BattleMapData,
): BattleMapData {
  const projectedCharacter = { ...character, position: { ...destination } };
  const destinationKeys = new Set(
    getOccupiedTiles(projectedCharacter).map(tile => `${tile.x}-${tile.y}`),
  );
  const tiles = new Map<string, BattleMapTile>();

  // A blocking square remains blocking at or below its authored top. Once the
  // creature's feet are above that height, only the destination's bounds and
  // occupied airspace remain relevant; the obstacle is still present on the map.
  mapData.tiles.forEach((tile, key) => {
    const groundFeet = Math.round(elevationUnitsToFeet(tile.elevation));
    const clearsBlockingTop = destinationKeys.has(key)
      && tile.blocksMovement
      && destinationAltitudeFeet > groundFeet;
    tiles.set(key, clearsBlockingTop ? { ...tile, blocksMovement: false } : tile);
  });

  return { ...mapData, tiles };
}

// ============================================================================
// Canonical Aerial Resolution
// ============================================================================
// Flight charges the authored horizontal grid distance plus the actual vertical
// change. Terrain multipliers beneath the route are intentionally ignored, but
// no state changes until every destination and budget check succeeds.
// ============================================================================

export function resolveAerialMovement(
  request: AerialMovementRequest,
): AerialMovementResolution {
  const {
    character,
    destination,
    destinationAltitudeFeet,
    mapData,
    characters,
    crossedGroundTiles = [],
  } = request;
  const flySpeedFeet = character.stats.extraMovementSpeeds?.fly ?? 0;
  const currentAltitudeFeet = getCharacterAltitudeFeet(character, mapData);
  const horizontalDistanceFeet = getTargetDistance(character.position, destination);
  const verticalDistanceFeet = Math.abs(destinationAltitudeFeet - currentAltitudeFeet);
  const distanceFeet = horizontalDistanceFeet + verticalDistanceFeet;
  const costFeet = distanceFeet;
  const ignoredGroundMovementCost = crossedGroundTiles.some(position => {
    const movementCost = mapData.tiles.get(`${position.x}-${position.y}`)?.movementCost;
    return typeof movementCost === 'number' && movementCost > 5;
  });

  const reject = (reason: string): AerialMovementResolution => ({
    allowed: false,
    character,
    horizontalDistanceFeet,
    verticalDistanceFeet,
    distanceFeet,
    costFeet,
    flySpeedFeet,
    ignoredGroundMovementCost,
    reason,
  });

  if (!character.aerialMovement?.isFlying || flySpeedFeet <= 0) {
    return reject(`${character.name} is not currently supported by a positive Fly Speed.`);
  }

  if (!Number.isFinite(destinationAltitudeFeet) || destinationAltitudeFeet < 0) {
    return reject(`Destination altitude ${destinationAltitudeFeet} ft is outside the battle map's legal airspace.`);
  }

  const destinationGroundFeet = getBattleMapGroundAltitudeFeet(mapData, destination);
  if (destinationGroundFeet === null) {
    return reject(`${character.name}'s footprint leaves the battle map at ${destination.x},${destination.y}.`);
  }

  if (destinationAltitudeFeet < destinationGroundFeet) {
    return reject(
      `Destination altitude ${destinationAltitudeFeet} ft intersects ground at ${destinationGroundFeet} ft.`,
    );
  }

  const altitudeAwareMap = createAltitudeAwareDestinationMap(
    character,
    destination,
    destinationAltitudeFeet,
    mapData,
  );
  const altitudePeers = charactersOccupyingDestinationAltitude(
    character,
    destinationAltitudeFeet,
    mapData,
    characters,
  );
  const placement = validateCharacterPlacement(
    character,
    destination,
    altitudeAwareMap,
    altitudePeers,
  );
  if (!placement.allowed) {
    return reject(placement.reason);
  }

  const movementCost = MOVEMENT_ONLY_COST(costFeet);
  if (costFeet > flySpeedFeet || !canAffordActionCost(character, movementCost)) {
    const remainingFeet = Math.max(
      0,
      character.actionEconomy.movement.total - character.actionEconomy.movement.used,
    );
    return reject(
      `Aerial route costs ${costFeet} ft but only ${Math.min(flySpeedFeet, remainingFeet)} ft of Fly Speed remains.`,
    );
  }

  const paid = consumeActionCost(character, movementCost);
  const isFlying = destinationAltitudeFeet > destinationGroundFeet;
  const moved: CombatCharacter = {
    ...paid,
    position: { ...destination },
    aerialMovement: {
      ...character.aerialMovement,
      altitudeFeet: destinationAltitudeFeet,
      isFlying,
    },
  };

  return {
    allowed: true,
    character: moved,
    horizontalDistanceFeet,
    verticalDistanceFeet,
    distanceFeet,
    costFeet,
    flySpeedFeet,
    ignoredGroundMovementCost,
    reason: `${character.name}'s complete footprint fits at ${destination.x},${destination.y} and altitude ${destinationAltitudeFeet} ft.`,
  };
}

// ============================================================================
// Loss Of Flying Support Boundary
// ============================================================================
// The rules glossary identifies when a flyer falls. This helper detects that
// trigger and hover exception, but it does not invent fall travel, landing, or
// impact state while combat lacks an integrated aerial fall-event resolver.
// ============================================================================

export function resolveAerialSupportLoss(
  character: CombatCharacter,
): AerialSupportLossResolution {
  if (!character.aerialMovement?.isFlying) {
    return {
      remainsAloft: false,
      requiresFall: false,
      runtimeSupported: true,
      trigger: 'none',
      reason: `${character.name} is not aloft.`,
    };
  }

  const conditionNames = [
    ...character.statusEffects.map(effect => effect.name.toLowerCase()),
    ...(character.conditions ?? []).map(condition => condition.name.toLowerCase()),
  ];
  const trigger: AerialSupportLossResolution['trigger'] = conditionNames.includes('prone')
    ? 'prone'
    : conditionNames.includes('incapacitated')
      ? 'incapacitated'
      : (character.stats.extraMovementSpeeds?.fly ?? 0) <= 0
        ? 'zero_fly_speed'
        : 'none';

  if (trigger === 'none') {
    return {
      remainsAloft: true,
      requiresFall: false,
      runtimeSupported: true,
      trigger,
      reason: `${character.name} retains flying support.`,
    };
  }

  if (character.aerialMovement.canHover) {
    return {
      remainsAloft: true,
      requiresFall: false,
      runtimeSupported: true,
      trigger,
      reason: `${character.name} can hover and remains aloft despite ${trigger}.`,
    };
  }

  return {
    remainsAloft: false,
    requiresFall: true,
    runtimeSupported: false,
    trigger,
    reason: `${character.name} must fall after ${trigger}, but combat has no integrated aerial fall-event, landing, and impact resolver.`,
  };
}
