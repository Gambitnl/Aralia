// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 01:36:56
 * Dependents: components/DesignPreview/steps/scenarioControls/teleportationOccupiedSpacesScenarioControls.ts, systems/spells/mechanics/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves exact, creature-chosen teleport destinations in combat.
 *
 * Spells such as Misty Step must either place the whole creature in the chosen
 * visible space or do nothing. This resolver checks the canonical spell range,
 * line of sight, battle-map bounds, blocking terrain, and every occupied square
 * before it pays the spell's Bonus Action and slot. A successful teleport then
 * changes position directly, so intervening terrain, movement budgets, and
 * opportunity-attack traversal never masquerade as ordinary walking.
 *
 * Called by: Tactical Sandbox controls and future exact-destination spell flows.
 * Depends on: canonical spell data, placement, sight, distance, and economy helpers.
 */

// ============================================================================
// Canonical Combat Inputs
// ============================================================================
// These are the same spell, map, placement, sight, and economy surfaces used by
// live combat. The production resolver has no scenario-specific dependency.
// ============================================================================

import type { BattleMapData, CombatCharacter, Position } from '../../../types/combat';
import type { MovementEffect, Spell } from '../../../types/spells';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';
import {
  getDistance,
  validateCharacterPlacement,
  type CharacterPlacementValidation,
} from '../../../utils/combat/combatUtils';
import { hasLineOfSight } from '../../../utils/spatial';

// ============================================================================
// Resolution Contract
// ============================================================================
// Callers receive both state and an explicit rules reason. Rejections return the
// original character array by reference, making "no cost and no effect" easy to
// prove without relying on narration or a UI-only flag.
// ============================================================================

export type TeleportationResolutionReason =
  | 'teleported'
  | 'caster_not_found'
  | 'invalid_teleport_spell'
  | 'destination_out_of_range'
  | 'destination_not_visible'
  | 'destination_out_of_bounds'
  | 'destination_blocked'
  | 'destination_occupied'
  | 'insufficient_resources';

export interface TeleportTraversalProof {
  movementSpentFeet: 0;
  pathTilesEntered: 0;
  opportunityAttacksProvoked: 0;
}

export interface TeleportationResolution {
  status: 'teleported' | 'rejected';
  reason: TeleportationResolutionReason;
  characters: CombatCharacter[];
  origin?: Position;
  destination: Position;
  distanceFeet: number;
  maxDistanceFeet: number;
  placement?: CharacterPlacementValidation;
  traversal: TeleportTraversalProof;
}

export interface ResolveTeleportationInput {
  characters: CombatCharacter[];
  mapData: BattleMapData;
  casterId: string;
  spell: Spell;
  destination: Position;
}

const NO_TRAVERSAL: TeleportTraversalProof = {
  movementSpentFeet: 0,
  pathTilesEntered: 0,
  opportunityAttacksProvoked: 0,
};

// ============================================================================
// Canonical Spell Facts
// ============================================================================
// Structured spell rows are not perfectly uniform yet. Misty Step stores its
// useful 30-foot budget in forcedMovement.maxDistance, while other teleport
// rows can store a numeric distance. This parser accepts either canonical form.
// ============================================================================

function parseFeet(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? Math.max(0, Number.parseInt(match[0], 10)) : 0;
  }
  return 0;
}

function findTeleportEffect(spell: Spell): MovementEffect | null {
  return spell.effects.find((effect): effect is MovementEffect => (
    effect.type === 'MOVEMENT' && effect.movementType === 'teleport'
  )) ?? null;
}

function getTeleportDistanceFeet(effect: MovementEffect): number {
  return Math.max(
    parseFeet(effect.distance),
    parseFeet(effect.forcedMovement?.maxDistance),
  );
}

function rejection(
  input: ResolveTeleportationInput,
  reason: TeleportationResolutionReason,
  facts: {
    origin?: Position;
    distanceFeet?: number;
    maxDistanceFeet?: number;
    placement?: CharacterPlacementValidation;
  } = {},
): TeleportationResolution {
  return {
    status: 'rejected',
    reason,
    characters: input.characters,
    origin: facts.origin,
    destination: { ...input.destination },
    distanceFeet: facts.distanceFeet ?? 0,
    maxDistanceFeet: facts.maxDistanceFeet ?? 0,
    placement: facts.placement,
    traversal: NO_TRAVERSAL,
  };
}

// ============================================================================
// Exact-Destination Teleport Resolution
// ============================================================================
// Destination legality comes before payment. Unlike the general movement
// command's legacy fallback behavior, this player-choice resolver never clamps
// an off-board point or silently substitutes a nearby space.
// ============================================================================

export function resolveTeleportation(
  input: ResolveTeleportationInput,
): TeleportationResolution {
  const caster = input.characters.find(character => character.id === input.casterId);
  if (!caster) {
    return rejection(input, 'caster_not_found');
  }

  const teleportEffect = findTeleportEffect(input.spell);
  const maxDistanceFeet = teleportEffect ? getTeleportDistanceFeet(teleportEffect) : 0;
  if (!teleportEffect || maxDistanceFeet <= 0) {
    return rejection(input, 'invalid_teleport_spell', {
      origin: caster.position,
      maxDistanceFeet,
    });
  }

  const distanceFeet = getDistance(caster.position, input.destination) * 5;
  if (distanceFeet > maxDistanceFeet) {
    return rejection(input, 'destination_out_of_range', {
      origin: caster.position,
      distanceFeet,
      maxDistanceFeet,
    });
  }

  const originTile = input.mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
  const destinationTile = input.mapData.tiles.get(
    `${input.destination.x}-${input.destination.y}`,
  );
  if (!destinationTile) {
    return rejection(input, 'destination_out_of_bounds', {
      origin: caster.position,
      distanceFeet,
      maxDistanceFeet,
    });
  }

  const requiresSight = input.spell.targeting?.lineOfSight ?? true;
  if (requiresSight && (!originTile || !hasLineOfSight(originTile, destinationTile, input.mapData))) {
    return rejection(input, 'destination_not_visible', {
      origin: caster.position,
      distanceFeet,
      maxDistanceFeet,
    });
  }

  const placement = validateCharacterPlacement(
    caster,
    input.destination,
    input.mapData,
    input.characters,
  );
  if (!placement.allowed) {
    const reason = placement.blockerId
      ? 'destination_occupied'
      : placement.reason.includes('leaves the battle map')
        ? 'destination_out_of_bounds'
        : 'destination_blocked';
    return rejection(input, reason, {
      origin: caster.position,
      distanceFeet,
      maxDistanceFeet,
      placement,
    });
  }

  const cost = {
    type: input.spell.castingTime?.combatCost?.type === 'bonus_action'
      ? 'bonus' as const
      : 'action' as const,
    spellSlotLevel: input.spell.level,
  };
  if (!canAffordActionCost(caster, cost)) {
    return rejection(input, 'insufficient_resources', {
      origin: caster.position,
      distanceFeet,
      maxDistanceFeet,
      placement,
    });
  }

  const paidCaster = consumeActionCost(caster, cost);
  const movedCaster: CombatCharacter = {
    ...paidCaster,
    position: { ...input.destination },
  };
  const characters = input.characters.map(character => (
    character.id === caster.id ? movedCaster : character
  ));

  return {
    status: 'teleported',
    reason: 'teleported',
    characters,
    origin: { ...caster.position },
    destination: { ...input.destination },
    distanceFeet,
    maxDistanceFeet,
    placement,
    traversal: NO_TRAVERSAL,
  };
}
