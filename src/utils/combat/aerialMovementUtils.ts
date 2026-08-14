// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 08:00:28
 * Dependents: components/DesignPreview/steps/scenarioControls/flyingAerialMovementScenarioControls.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useGridMovement.ts, hooks/useBattleMap.ts, systems/combat/fallingGroundImpactResolution.ts
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
import { calculateMovementCost, getTargetDistance } from './movementUtils';
import {
  calculateMovementModeTotal,
  calculateMovementTotal,
  canAffordActionCost,
  consumeActionCost,
} from './actionEconomyUtils';

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
  /**
   * Optional exact three-dimensional route, including source and destination.
   * Ordinary Move builds a direct grid route when this is omitted.
   */
  route?: AerialRouteWaypoint[];
}

export interface AerialRouteWaypoint {
  position: Position;
  altitudeFeet: number;
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
  route: AerialRouteWaypoint[];
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

// ============================================================================
// Direct Grid Route
// ============================================================================
// Normal flying Move follows the shortest direct grid trace. Each crossed cell
// receives an interpolated altitude so a climb cannot clear a tall obstruction
// merely because its endpoint is high enough.
// ============================================================================

export function buildAerialRoute(
  start: Position,
  destination: Position,
  startAltitudeFeet: number,
  destinationAltitudeFeet: number,
): AerialRouteWaypoint[] {
  const deltaX = destination.x - start.x;
  const deltaY = destination.y - start.y;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  if (steps === 0) {
    return [
      { position: { ...start }, altitudeFeet: startAltitudeFeet },
      { position: { ...destination }, altitudeFeet: destinationAltitudeFeet },
    ];
  }

  const route: AerialRouteWaypoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    route.push({
      position: {
        x: Math.round(start.x + deltaX * progress),
        y: Math.round(start.y + deltaY * progress),
      },
      altitudeFeet: startAltitudeFeet
        + (destinationAltitudeFeet - startAltitudeFeet) * progress,
    });
  }

  return route.filter((waypoint, index) => {
    const previous = route[index - 1];
    return !previous
      || previous.position.x !== waypoint.position.x
      || previous.position.y !== waypoint.position.y
      || previous.altitudeFeet !== waypoint.altitudeFeet;
  });
}

function getRouteHorizontalDistanceFeet(route: AerialRouteWaypoint[]): number {
  let diagonalCount = 0;
  let distanceFeet = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1].position;
    const current = route[index].position;
    const deltaX = Math.abs(current.x - previous.x);
    const deltaY = Math.abs(current.y - previous.y);

    // A route is a sequence of adjacent tactical cells. Rejecting jumps here
    // prevents a caller from skipping the intervening collision volume.
    if (deltaX > 1 || deltaY > 1) {
      return Number.NaN;
    }

    // A pure climb or descent stays in one horizontal square. It contributes
    // no horizontal distance but remains a real waypoint for ceiling checks.
    if (deltaX === 0 && deltaY === 0) continue;

    const step = calculateMovementCost(deltaX, deltaY, diagonalCount);
    distanceFeet += step.cost;
    if (step.isDiagonal) diagonalCount += 1;
  }

  return distanceFeet;
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
    const blockingTopFeet = tile.airspace?.blockerTopFeet ?? groundFeet;
    const clearsBlockingTop = destinationKeys.has(key)
      && tile.blocksMovement
      && !tile.airspace?.blocksFlight
      && destinationAltitudeFeet > blockingTopFeet;
    tiles.set(key, clearsBlockingTop ? { ...tile, blocksMovement: false } : tile);
  });

  return { ...mapData, tiles };
}

export function getAerialWaypointRejection(
  character: CombatCharacter,
  waypoint: AerialRouteWaypoint,
  mapData: BattleMapData,
  characters: CombatCharacter[],
): string | null {
  const projectedCharacter = { ...character, position: { ...waypoint.position } };
  const occupiedTiles = getOccupiedTiles(projectedCharacter);
  const characterTopFeet = waypoint.altitudeFeet + getCharacterVerticalSizeFeet(character);

  for (const occupiedPosition of occupiedTiles) {
    const tile = mapData.tiles.get(`${occupiedPosition.x}-${occupiedPosition.y}`);
    if (!tile) {
      return `${character.name}'s footprint leaves the battle map at ${occupiedPosition.x},${occupiedPosition.y}.`;
    }

    const groundFeet = Math.round(elevationUnitsToFeet(tile.elevation));
    if (waypoint.altitudeFeet < groundFeet) {
      return `Altitude ${waypoint.altitudeFeet} ft intersects ground at ${groundFeet} ft on ${occupiedPosition.x},${occupiedPosition.y}.`;
    }
    if (tile.airspace?.blocksFlight) {
      return `Airspace is sealed at ${occupiedPosition.x},${occupiedPosition.y}.`;
    }
    if (
      typeof tile.airspace?.blockerTopFeet === 'number'
      && waypoint.altitudeFeet < tile.airspace.blockerTopFeet
    ) {
      return `Airspace blocker reaches ${tile.airspace.blockerTopFeet} ft at ${occupiedPosition.x},${occupiedPosition.y}; altitude ${waypoint.altitudeFeet} ft does not clear it.`;
    }
    if (
      typeof tile.airspace?.ceilingFeet === 'number'
      && characterTopFeet > tile.airspace.ceilingFeet
    ) {
      return `${character.name}'s ${characterTopFeet}-foot top exceeds the ${tile.airspace.ceilingFeet}-foot ceiling at ${occupiedPosition.x},${occupiedPosition.y}.`;
    }
  }

  const altitudeAwareMap = createAltitudeAwareDestinationMap(
    character,
    waypoint.position,
    waypoint.altitudeFeet,
    mapData,
  );
  const altitudePeers = charactersOccupyingDestinationAltitude(
    character,
    waypoint.altitudeFeet,
    mapData,
    characters,
  );
  const placement = validateCharacterPlacement(
    character,
    waypoint.position,
    altitudeAwareMap,
    altitudePeers,
  );

  return placement.allowed ? null : placement.reason;
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
  const route = request.route ?? buildAerialRoute(
    character.position,
    destination,
    currentAltitudeFeet,
    destinationAltitudeFeet,
  );
  const routeHorizontalDistanceFeet = getRouteHorizontalDistanceFeet(route);
  const horizontalDistanceFeet = Number.isFinite(routeHorizontalDistanceFeet)
    ? routeHorizontalDistanceFeet
    : getTargetDistance(character.position, destination);
  // Every climb and descent consumes movement. Summing adjacent altitude
  // changes prevents a route that rises over a blocker and later descends from
  // paying only the endpoint difference.
  const verticalDistanceFeet = route.slice(1).reduce((total, waypoint, index) => (
    total + Math.abs(waypoint.altitudeFeet - route[index].altitudeFeet)
  ), 0);
  const distanceFeet = horizontalDistanceFeet + verticalDistanceFeet;
  const costFeet = distanceFeet;
  const proofGroundTiles = crossedGroundTiles.length > 0
    ? crossedGroundTiles
    : route.slice(1).map(waypoint => waypoint.position);
  const ignoredGroundMovementCost = proofGroundTiles.some(position => {
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
    route,
    reason,
  });

  if (!character.aerialMovement?.isFlying || flySpeedFeet <= 0) {
    return reject(`${character.name} is not currently supported by a positive Fly Speed.`);
  }

  if (!Number.isFinite(destinationAltitudeFeet) || destinationAltitudeFeet < 0) {
    return reject(`Destination altitude ${destinationAltitudeFeet} ft is outside the battle map's legal airspace.`);
  }

  const firstWaypoint = route[0];
  const finalWaypoint = route[route.length - 1];
  if (
    !firstWaypoint
    || !finalWaypoint
    || firstWaypoint.position.x !== character.position.x
    || firstWaypoint.position.y !== character.position.y
    || finalWaypoint.position.x !== destination.x
    || finalWaypoint.position.y !== destination.y
    || finalWaypoint.altitudeFeet !== destinationAltitudeFeet
    || !Number.isFinite(routeHorizontalDistanceFeet)
  ) {
    return reject('Aerial route must be contiguous and include the live source and exact destination.');
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

  for (let index = 0; index < route.length; index += 1) {
    const waypoint = route[index];
    const rejection = getAerialWaypointRejection(character, waypoint, mapData, characters);
    if (rejection) {
      return reject(`Aerial route segment ${index} at ${waypoint.position.x},${waypoint.position.y}@${waypoint.altitudeFeet} ft is illegal: ${rejection}`);
    }
  }

  const movementCost = MOVEMENT_ONLY_COST(costFeet);
  const flyModeTotal = calculateMovementModeTotal(character, 'fly');
  const usedFeet = character.actionEconomy.movement.used;
  const movementTotal = calculateMovementTotal(character);
  const normalizedCharacter = character.actionEconomy.movement.total === movementTotal
    ? character
    : {
        ...character,
        actionEconomy: {
          ...character.actionEconomy,
          movement: { ...character.actionEconomy.movement, total: movementTotal },
        },
      };
  if (
    usedFeet + costFeet > flyModeTotal
    || !canAffordActionCost(normalizedCharacter, movementCost)
  ) {
    const remainingFeet = Math.max(0, flyModeTotal - usedFeet);
    return reject(
      `Aerial route costs ${costFeet} ft but only ${remainingFeet} ft of Fly Speed remains after ${usedFeet} ft already moved this turn.`,
    );
  }

  const paid = consumeActionCost(normalizedCharacter, movementCost);
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
    route,
    reason: `${character.name}'s complete footprint fits at ${destination.x},${destination.y} and altitude ${destinationAltitudeFeet} ft.`,
  };
}

// ============================================================================
// Loss Of Flying Support Boundary
// ============================================================================
// The rules glossary identifies when a flyer falls. This helper detects that
// trigger and hover exception. The CS32 transaction now owns landing, reaction,
// damage, defenses, downing, and Prone once a caller supplies the live board.
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
    runtimeSupported: true,
    trigger,
    reason: `${character.name} must fall after ${trigger}; resolve the event through the canonical aerial support-loss impact transaction.`,
  };
}
