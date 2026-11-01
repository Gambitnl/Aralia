/**
 * @file actionMovementPlanning.ts
 * Checks prepayment movement eligibility and plans one disk-follow update.
 * Receives explicit state and receipt sources; does not prompt, publish React
 * state, claim actions or emit events. The hook keeps those timing boundaries.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:36:36
 * Dependents: hooks/combat/useActionExecutor.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatAction, CombatLogEntry, BattleMapData } from "../../types/combat";
import { getOccupiedTiles, getCharacterSizeMultiplier } from "../../utils/combat";
import { validateTauntWillingMove } from "./tauntConstraint";
import { resolveAerialMovement, type AerialMovementResolution } from "../../utils/combat/aerialMovementUtils";
import { ActionExecutionReceiptSources } from "./actionExecutionReceipt";

// ============================================================================
// Movement Legality Helpers
// ============================================================================
// Movement must not place two living combatants on the same tile. The player
// movement preview and AI planner try to avoid those spaces, but the executor
// is the final authority before state changes are committed.
// ============================================================================

export const getOccupyingCombatant = (
  characters: CombatCharacter[],
  movingCharacterId: string,
  targetPosition: { x: number; y: number }
): CombatCharacter | undefined => {
  return characters.find(character => {
    if (character.id === movingCharacterId || character.currentHP <= 0) return false;
    const occupied = getOccupiedTiles(character);
    return occupied.some(tile => tile.x === targetPosition.x && tile.y === targetPosition.y);
  });
};



export const getGridDistanceFeet = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): number => Math.hypot(to.x - from.x, to.y - from.y) * 5;



export const getMapTileElevation = (
  mapData: BattleMapData,
  position: { x: number; y: number }
): number | undefined => {
  for (const tile of mapData.tiles.values()) {
    if (tile.coordinates.x === position.x && tile.coordinates.y === position.y) {
      return tile.elevation;
    }
  }

  return undefined;
};



export const crossesTenserElevationBarrier = (
  mapData: BattleMapData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxChangeFeet: number
): boolean => {
  const startElevation = getMapTileElevation(mapData, from);
  const endElevation = getMapTileElevation(mapData, to);

  if (startElevation === undefined || endElevation === undefined) {
    return false;
  }

  return Math.abs(endElevation - startElevation) >= maxChangeFeet;
};



export const getTenserFollowPosition = (
  diskPosition: { x: number; y: number },
  casterPosition: { x: number; y: number },
  followDistanceFeet: number
): { x: number; y: number } => {
  const followTiles = Math.max(0, Math.floor(followDistanceFeet / 5));
  const dx = casterPosition.x - diskPosition.x;
  const dy = casterPosition.y - diskPosition.y;
  const distanceTiles = Math.hypot(dx, dy);
  const tilesToMove = Math.max(0, distanceTiles - followTiles);

  if (distanceTiles === 0 || tilesToMove === 0) {
    return diskPosition;
  }

  return {
    x: diskPosition.x + Math.round((dx / distanceTiles) * tilesToMove),
    y: diskPosition.y + Math.round((dy / distanceTiles) * tilesToMove)
  };
};

export interface ActionMovementPreparation {
  resolvedAction: CombatAction;
  aerialMovement?: AerialMovementResolution;
  rejection?: CombatLogEntry;
}

/** Runs the ordered prepayment checks without publishing state or claiming delivery. */
export function prepareActionMovement(
  startCharacter: CombatCharacter, action: CombatAction, characters: CombatCharacter[],
  mapData: BattleMapData | null, receipts: ActionExecutionReceiptSources
): ActionMovementPreparation {
  let resolvedAction = action;
  let aerialMovement: AerialMovementResolution | undefined;


    if (action.type === 'move' && action.targetPosition) {
      const protectedTiles = startCharacter.summonMetadata?.bloodCircle?.protectedTiles ?? [];
      const movementTiles = action.movementPath?.length
        ? action.movementPath
        : [startCharacter.position, action.targetPosition];
      const crossedBloodCircle = movementTiles.slice(1).some(position => protectedTiles.some(protectedTile =>
        protectedTile.x === position.x && protectedTile.y === position.y
      ));
      if (crossedBloodCircle) {
        return { resolvedAction, aerialMovement, rejection: {
          id: receipts.generateId(),
          timestamp: receipts.now(),
          type: 'action',
          message: `${startCharacter.name} cannot cross its protective blood circle.`,
          characterId: startCharacter.id,
          data: { bloodCircle: 'movement_blocked' }
        } };
      }
    }

    // Pre-move occupancy check (guard before resource spend)
    if (action.type === 'move' && action.targetPosition) {
      const tauntMove = validateTauntWillingMove(startCharacter, action.targetPosition, characters);
      if (!tauntMove.allowed) {
        return { resolvedAction, aerialMovement, rejection: {
          id: receipts.generateId(), timestamp: receipts.now(), type: 'action',
          message: `${startCharacter.name} cannot willingly move more than ${tauntMove.status?.taunt?.leashRangeFeet} feet from ${tauntMove.caster?.name}.`,
          characterId: startCharacter.id,
          targetIds: tauntMove.caster ? [tauntMove.caster.id] : [],
          data: { spellId: tauntMove.status?.sourceSpellId, tauntConstraint: 'willing_movement_leash' }
        } };
      }

      if (action.movementMode === 'fly') {
        if (
          !mapData
          || typeof action.targetAltitudeFeet !== 'number'
          || !startCharacter.aerialMovement?.isFlying
        ) {
          return { resolvedAction, aerialMovement, rejection: {
            id: receipts.generateId(), timestamp: receipts.now(), type: 'action',
            message: `${startCharacter.name} cannot fly because the Move action has no battle map or destination altitude.`,
            characterId: startCharacter.id,
          } };
        }

        aerialMovement = resolveAerialMovement({
          character: startCharacter,
          destination: action.targetPosition,
          destinationAltitudeFeet: action.targetAltitudeFeet,
          mapData,
          characters,
          route: action.movementPath?.map((position, index, path) => ({
            position,
            altitudeFeet: startCharacter.aerialMovement!.altitudeFeet
              + (action.targetAltitudeFeet! - startCharacter.aerialMovement!.altitudeFeet)
                * (path.length <= 1 ? 1 : index / (path.length - 1)),
          })),
        });
        if (!aerialMovement.allowed) {
          return { resolvedAction, aerialMovement, rejection: {
            id: receipts.generateId(), timestamp: receipts.now(), type: 'action',
            message: `${startCharacter.name} cannot complete the aerial Move: ${aerialMovement.reason}`,
            characterId: startCharacter.id,
          } };
        }

        // The resolver is authoritative for horizontal-plus-vertical cost.
        // Replacing a caller's preview cost prevents stale UI math from under-
        // charging the actual route or charging it a second time.
        resolvedAction = {
          ...action,
          cost: { ...action.cost, movementCost: aerialMovement.costFeet },
          movementPath: aerialMovement.route.map(waypoint => waypoint.position),
        };
      } else {
        const multiplier = getCharacterSizeMultiplier(startCharacter.stats.size);
        for (let dx = 0; dx < multiplier; dx++) {
          for (let dy = 0; dy < multiplier; dy++) {
            const checkPos = { x: action.targetPosition.x + dx, y: action.targetPosition.y + dy };
            const occupyingCombatant = getOccupyingCombatant(characters, action.characterId, checkPos);
            if (occupyingCombatant) {
              return { resolvedAction, aerialMovement, rejection: {
                id: receipts.generateId(), timestamp: receipts.now(), type: 'action',
                message: `${startCharacter.name} cannot move there because ${occupyingCombatant.name} is in the way.`,
                characterId: startCharacter.id, targetIds: [occupyingCombatant.id]
              } };
            }
          }
        }
      }
    }
  return { resolvedAction, aerialMovement };
}

export type TenserDiskFollowPlan =
  | { kind: 'stay' }
  | { kind: 'update'; character: CombatCharacter }
  | { kind: 'remove'; id: string; log: Omit<CombatLogEntry, 'id' | 'timestamp'> };

export function planTenserDiskFollow(
  disk: CombatCharacter, caster: CombatCharacter, casterDestination: { x: number; y: number }, mapData: BattleMapData | null
): TenserDiskFollowPlan {

      const metadata = disk.summonMetadata;
      const travelDetails = metadata?.travelDetails || {};
      const maxLoadPounds = typeof travelDetails.maxLoadPounds === 'number' ? travelDetails.maxLoadPounds : 500;
      const carriedWeightPounds = metadata?.carriedWeightPounds ?? 0;

      if (carriedWeightPounds > maxLoadPounds) {
        
        return { kind: 'remove', id: disk.id, log: { type: 'status', message: `${disk.name} disappears because it is overloaded.`, characterId: caster.id, targetIds: [disk.id], data: {
            spellId: metadata?.spellId,
            summonCondition: 'carried_weight_exceeds_limit',
            travelRule: 'maxLoadPounds',
            carriedWeightPounds,
            maxLoadPounds,
            removedSummonIds: [disk.id]
          } } };
      }

      const cannotCrossElevationChangeFeet = typeof travelDetails.cannotCrossElevationChangeFeet === 'number'
        ? travelDetails.cannotCrossElevationChangeFeet
        : 10;
      if (mapData && crossesTenserElevationBarrier(mapData, disk.position, casterDestination, cannotCrossElevationChangeFeet)) {
        
        return { kind: 'remove', id: disk.id, log: { type: 'status', message: `${disk.name} cannot follow across the elevation change and disappears.`, characterId: caster.id, targetIds: [disk.id], data: {
            spellId: metadata?.spellId,
            summonCondition: 'cannot_cross_elevation_change',
            travelRule: 'cannotCrossElevationChangeFeet',
            cannotCrossElevationChangeFeet: Boolean(cannotCrossElevationChangeFeet),
            removedSummonIds: [disk.id]
          } } };
      }

      const followDistanceFeet = typeof travelDetails.followDistanceFeet === 'number'
        ? travelDetails.followDistanceFeet
        : metadata?.followDistance ?? 20;
      const immobileWithinFeet = typeof travelDetails.immobileWithinFeet === 'number'
        ? travelDetails.immobileWithinFeet
        : 20;
      const currentDistanceFeet = getGridDistanceFeet(disk.position, casterDestination);

      if (currentDistanceFeet <= immobileWithinFeet) {
        return { kind: 'stay' };
      }

      const nextPosition = getTenserFollowPosition(disk.position, casterDestination, followDistanceFeet);
      return { kind: 'update', character: {
        ...disk,
        position: nextPosition
      } };
    
}
