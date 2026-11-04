// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This dependency header is initialized for the CS15 object transaction.
 * Run the codebase visualizer sync after verification to record its consumers.
 */
// @dependencies-end

/**
 * This file resolves one tactical interaction with a targetable map object.
 *
 * Validation completes before any resource or object mutation. Legal open/use
 * interactions spend the once-per-turn free interaction first and fall back to
 * the Action; damaging an object always uses the Action. Stable event IDs make
 * repeated delivery an exact no-op across React map snapshots.
 *
 * Called by: production combat adapters and the Object Interaction sandbox.
 * Depends on: shared action economy, range geometry, and line-of-sight rules.
 */

import type {
  BattleMapData,
  CombatCharacter,
  MapObjectInteractionState,
  TargetableMapObject,
  TurnState,
} from '../../types/combat';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../utils/combat/actionEconomyUtils';
import { getCombatantToPositionDistanceFeet } from '../../utils/spatial/elevationGeometry';
import { hasLineOfSight } from '../../utils/spatial/lineOfSight';
import {
  getObjectAC,
  getObjectHPAverage,
  type ObjectMaterial,
  type ObjectSize,
} from '../../utils/combat/physicsUtils';

// ============================================================================
// Public Transaction Contract
// ============================================================================

export type ObjectInteractionOperation = 'open' | 'use' | 'damage';
export type ObjectInteractionCost = 'free' | 'action';

export interface ObjectInteractionRequest {
  eventId: string;
  actorId: string;
  objectId: string;
  operation: ObjectInteractionOperation;
  damage?: number;
  maxDistanceFeet?: number;
  /**
   * Attack roll made against the object's Armor Class (GG-206).
   * When provided on a damage operation, the attack must equal or exceed
   * the object's AC to hit and deal damage; otherwise the attack misses.
   */
  attackRoll?: number;
}

export interface ObjectInteractionResult {
  accepted: boolean;
  reason: string;
  characters: CombatCharacter[];
  mapData: BattleMapData;
  cost: ObjectInteractionCost | null;
  /** Whether the attack roll hit the object's AC (undefined for open/use or unrolled attacks). */
  isHit?: boolean;
  /** The target object's effective Armor Class. */
  armorClass?: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function reject(
  reason: string,
  characters: CombatCharacter[],
  mapData: BattleMapData,
): ObjectInteractionResult {
  // Invalid actions return the original references. Callers can therefore
  // prove that no partial payment or object mutation escaped validation.
  return { accepted: false, reason, characters, mapData, cost: null };
}

function interactionStateOf(targetObject: TargetableMapObject): MapObjectInteractionState | null {
  const existing = targetObject.interactionState ?? null;
  if (!existing) return null;

  // GG-206: Seed material, size, AC, and HP defaults if missing
  const material = (existing.material ?? targetObject.material ?? 'wood') as ObjectMaterial;
  const size = (existing.size ?? (targetObject.size?.toLowerCase() || 'medium')) as ObjectSize;
  const armorClass = existing.armorClass ?? getObjectAC(material);
  const maxHitPoints = existing.maxHitPoints > 0
    ? existing.maxHitPoints
    : getObjectHPAverage(size, existing.isFragile ?? false);
  const hitPoints = existing.hitPoints !== undefined && existing.hitPoints > 0
    ? existing.hitPoints
    : maxHitPoints;

  return {
    ...existing,
    material,
    size,
    armorClass,
    maxHitPoints,
    hitPoints,
  };
}

function resolveCost(
  actor: CombatCharacter,
  operation: ObjectInteractionOperation,
): ObjectInteractionCost | null {
  // Damage is an attack-like use of the Action. Open and use follow the 5e
  // once-per-turn free interaction, then legitimately fall back to the Action.
  if (operation !== 'damage' && canAffordActionCost(actor, { type: 'free' })) {
    return 'free';
  }
  return canAffordActionCost(actor, { type: 'action' }) ? 'action' : null;
}

// ============================================================================
// Atomic Object Interaction
// ============================================================================

export function resolveObjectInteraction(input: {
  characters: CombatCharacter[];
  mapData: BattleMapData;
  turnState?: TurnState;
  request: ObjectInteractionRequest;
}): ObjectInteractionResult {
  const { characters, mapData, turnState, request } = input;
  const actor = characters.find(character => character.id === request.actorId);
  const targetObject = (mapData.targetableObjects ?? [])
    .find(candidate => candidate.id === request.objectId);

  if (!actor) return reject('Actor unavailable.', characters, mapData);
  if (turnState?.currentCharacterId && turnState.currentCharacterId !== actor.id) {
    return reject('Actor does not own the current turn.', characters, mapData);
  }
  if (!targetObject) return reject('Target object unavailable.', characters, mapData);

  const interactionState = interactionStateOf(targetObject);
  if (!interactionState) return reject('Target is not interactive.', characters, mapData);
  if (interactionState.resolvedEventIds.includes(request.eventId)) {
    return reject('Duplicate interaction event ignored.', characters, mapData);
  }
  if (interactionState.ownerId && interactionState.ownerId !== actor.id) {
    return reject('Actor does not own this object.', characters, mapData);
  }
  if (interactionState.destroyed) return reject('Target object is destroyed.', characters, mapData);

  const maxDistanceFeet = request.maxDistanceFeet ?? 5;
  const distanceFeet = getCombatantToPositionDistanceFeet(actor, targetObject.position, mapData);
  if (distanceFeet > maxDistanceFeet) {
    return reject(`Target is ${distanceFeet} feet away; interaction range is ${maxDistanceFeet} feet.`, characters, mapData);
  }

  const actorTile = mapData.tiles.get(`${actor.position.x}-${actor.position.y}`);
  const objectTile = mapData.tiles.get(`${targetObject.position.x}-${targetObject.position.y}`);
  if (!actorTile || !objectTile || !hasLineOfSight(actorTile, objectTile, mapData)) {
    return reject('Line of sight to the object is blocked.', characters, mapData);
  }
  if (request.operation === 'open' && interactionState.isOpen) {
    return reject('Object is already open.', characters, mapData);
  }
  if (request.operation === 'use' && !interactionState.isOpen) {
    return reject('Object must be open before it can be used.', characters, mapData);
  }
  const damage = Math.max(0, Math.floor(request.damage ?? 0));
  if (request.operation === 'damage' && damage <= 0) {
    return reject('Damage must be a positive whole number.', characters, mapData);
  }

  const cost = resolveCost(actor, request.operation);
  if (!cost) return reject('No free interaction or Action remains.', characters, mapData);

  // GG-206: If an attackRoll is provided for a damage operation, compare against object AC.
  const objectAC = interactionState.armorClass ?? 10;
  if (request.operation === 'damage' && request.attackRoll !== undefined && request.attackRoll < objectAC) {
    // Attack missed the object's AC! Action is spent on the attack attempt, but no damage is dealt.
    const paidActor = consumeActionCost(actor, { type: cost });
    const nextState: MapObjectInteractionState = {
      ...interactionState,
      resolvedEventIds: [...interactionState.resolvedEventIds, request.eventId],
    };
    const nextObject = { ...targetObject, interactionState: nextState };
    const nextMapData = {
      ...mapData,
      targetableObjects: (mapData.targetableObjects ?? []).map(candidate => (
        candidate.id === nextObject.id ? nextObject : candidate
      )),
    };
    const nextCharacters = characters.map(character => (
      character.id === paidActor.id ? paidActor : character
    ));
    return {
      accepted: true,
      isHit: false,
      armorClass: objectAC,
      reason: `Attack roll (${request.attackRoll}) missed ${targetObject.name}'s AC ${objectAC}.`,
      characters: nextCharacters,
      mapData: nextMapData,
      cost,
    };
  }

  // All gates are now complete. Payment and object replacement are constructed
  // together, so no invalid branch can spend only one half of the transaction.
  const paidActor = consumeActionCost(actor, { type: cost });
  const hitPoints = request.operation === 'damage'
    ? Math.max(0, interactionState.hitPoints - damage)
    : interactionState.hitPoints;
  const nextState: MapObjectInteractionState = {
    ...interactionState,
    isOpen: request.operation === 'open' ? true : interactionState.isOpen,
    useCount: request.operation === 'use' ? interactionState.useCount + 1 : interactionState.useCount,
    hitPoints,
    destroyed: hitPoints === 0,
    resolvedEventIds: [...interactionState.resolvedEventIds, request.eventId],
  };
  const nextObject = { ...targetObject, interactionState: nextState };
  const nextMapData = {
    ...mapData,
    targetableObjects: (mapData.targetableObjects ?? []).map(candidate => (
      candidate.id === nextObject.id ? nextObject : candidate
    )),
  };
  const nextCharacters = characters.map(character => (
    character.id === paidActor.id ? paidActor : character
  ));

  return {
    accepted: true,
    isHit: request.operation === 'damage' ? true : undefined,
    armorClass: objectAC,
    reason: request.operation === 'damage'
      ? `${targetObject.name} took ${damage} damage and has ${hitPoints}/${interactionState.maxHitPoints} HP.`
      : request.operation === 'open'
        ? `${targetObject.name} opened.`
        : `${targetObject.name} used (${nextState.useCount}).`,
    characters: nextCharacters,
    mapData: nextMapData,
    cost,
  };
}
