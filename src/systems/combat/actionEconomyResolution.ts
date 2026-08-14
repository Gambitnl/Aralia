/**
 * This file resolves one deterministic action-economy event against live combatants.
 *
 * The Tactical Sandbox uses it to prove that Action, Bonus Action, Reaction,
 * movement, and the free object interaction are independent resources. The
 * resolver delegates ordinary affordability and payment to the same production
 * helpers used by combat, keeps rejected events atomic, and treats a repeated
 * stable delivery as a no-op. It also owns the narrow Action Surge refresh rule:
 * the extra Action is available only when that advertised limited-use ability
 * exists, and it never spends or restores the free object interaction.
 *
 * Called by: Action Economy Stress Test scenario controls and focused combat tests.
 * Depends on: the shared action-economy affordability, payment, and turn-reset helpers.
 */

import type { AbilityCost, CombatCharacter } from '../../types/combat';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../utils/combat/actionEconomyUtils';

// ============================================================================
// Public Transaction Contract
// ============================================================================
// A caller chooses one authored event. The result always carries the original
// roster when the event is rejected or replayed, so no failed click can create
// a new character reference or accidentally publish partial payment.
// ============================================================================

export type ActionEconomyResourceCase =
  | 'action'
  | 'bonus_action'
  | 'reaction_outside_turn'
  | 'free_interaction'
  | 'movement'
  | 'combined_sequence'
  | 'action_surge';

export interface ResolveActionEconomyEventInput {
  characters: CombatCharacter[];
  actorId: string;
  reactionActorId: string;
  currentTurnOwnerId: string | null;
  eventId: string;
  resourceCase: ActionEconomyResourceCase;
  delivery: 'resolve' | 'replay';
}

export interface ActionEconomyEventResolution {
  characters: CombatCharacter[];
  eventId: string;
  outcome: 'accepted' | 'rejected' | 'duplicate';
  message: string;
}

// ============================================================================
// Canonical Costs
// ============================================================================
// These are ordinary production AbilityCost records. Movement spends the full
// thirty-foot fixture pool so an immediate second delivery has a visible and
// deterministic rejection, while the combined sequence pays every independent
// owner resource plus the other actor's out-of-turn Reaction atomically.
// ============================================================================

const ACTION_COST: AbilityCost = { type: 'action' };
const BONUS_ACTION_COST: AbilityCost = { type: 'bonus' };
const REACTION_COST: AbilityCost = { type: 'reaction' };
const FREE_INTERACTION_COST: AbilityCost = { type: 'free' };
const MOVEMENT_COST: AbilityCost = { type: 'movement-only', movementCost: 30 };

const OWNER_COSTS_BY_CASE: Partial<Record<ActionEconomyResourceCase, AbilityCost[]>> = {
  action: [ACTION_COST],
  bonus_action: [BONUS_ACTION_COST],
  free_interaction: [FREE_INTERACTION_COST],
  movement: [MOVEMENT_COST],
  combined_sequence: [ACTION_COST, BONUS_ACTION_COST, FREE_INTERACTION_COST, MOVEMENT_COST],
};

// ============================================================================
// Stable Replay Recognition
// ============================================================================
// The stress test gives each button a stable event id. Its first accepted state
// is visible in the real ledgers, so the same delivery can be recognized without
// adding a hidden UI-only receipt to CombatCharacter.
// ============================================================================

function isOwnerCostReflected(character: CombatCharacter, cost: AbilityCost): boolean {
  if (cost.type === 'action') return character.actionEconomy.action.used;
  if (cost.type === 'bonus') return character.actionEconomy.bonusAction.used;
  if (cost.type === 'free') return character.actionEconomy.freeActions === 0;
  if (cost.type === 'movement-only') {
    return character.actionEconomy.movement.used >= (cost.movementCost ?? 0);
  }
  return false;
}

function isEventAlreadyReflected(
  resourceCase: ActionEconomyResourceCase,
  actor: CombatCharacter,
  reactionActor: CombatCharacter,
): boolean {
  if (resourceCase === 'reaction_outside_turn') {
    return reactionActor.actionEconomy.reaction.used;
  }

  if (resourceCase === 'action_surge') {
    const surge = actor.abilities.find(ability => ability.id === 'action_surge');
    return surge?.usesRemaining === 0;
  }

  return (OWNER_COSTS_BY_CASE[resourceCase] ?? []).every(cost => (
    isOwnerCostReflected(actor, cost)
  ));
}

// ============================================================================
// Action Surge Refresh
// ============================================================================
// Action Surge is neither a normal Action nor a free object interaction. It is
// a limited-use special refresh, so it is legal only when the ability is visibly
// advertised on the actor and still has a use remaining.
// ============================================================================

function resolveActionSurge(character: CombatCharacter): CombatCharacter | null {
  const surgeIndex = character.abilities.findIndex(ability => ability.id === 'action_surge');
  if (surgeIndex < 0) return null;

  const surge = character.abilities[surgeIndex];
  if ((surge.usesRemaining ?? surge.maxUses ?? 0) <= 0) return null;

  const abilities = character.abilities.map((ability, index) => (
    index === surgeIndex
      ? { ...ability, usesRemaining: Math.max(0, (ability.usesRemaining ?? ability.maxUses ?? 1) - 1) }
      : ability
  ));

  return {
    ...character,
    abilities,
    actionEconomy: {
      ...character.actionEconomy,
      action: {
        used: false,
        remaining: Math.max(0, character.actionEconomy.action.remaining) + 1,
      },
    },
  };
}

// ============================================================================
// Event Resolution
// ============================================================================
// Every gate runs before payment. This guarantees that wrong-turn requests,
// spent resources, missing actors, and incomplete combined sequences cannot
// roll, move, refresh, or partially alter either combatant.
// ============================================================================

export function resolveActionEconomyEvent(
  input: ResolveActionEconomyEventInput,
): ActionEconomyEventResolution {
  const actor = input.characters.find(character => character.id === input.actorId);
  const reactionActor = input.characters.find(character => character.id === input.reactionActorId);

  if (!actor || !reactionActor) {
    return {
      characters: input.characters,
      eventId: input.eventId,
      outcome: 'rejected',
      message: `Action economy event ${input.eventId} rejected: an authored actor is unavailable.`,
    };
  }

  if (
    input.delivery === 'replay'
    && isEventAlreadyReflected(input.resourceCase, actor, reactionActor)
  ) {
    return {
      characters: input.characters,
      eventId: input.eventId,
      outcome: 'duplicate',
      message: `Duplicate action economy event ${input.eventId}: no resource or character state changed.`,
    };
  }

  if (input.resourceCase === 'reaction_outside_turn') {
    if (reactionActor.id === input.currentTurnOwnerId) {
      return {
        characters: input.characters,
        eventId: input.eventId,
        outcome: 'rejected',
        message: `Action economy event ${input.eventId} rejected: this proof requires a Reaction outside that actor's turn.`,
      };
    }

    if (!canAffordActionCost(reactionActor, REACTION_COST)) {
      return {
        characters: input.characters,
        eventId: input.eventId,
        outcome: 'rejected',
        message: `Action economy event ${input.eventId} rejected before mutation: the Reaction is already spent.`,
      };
    }

    const updatedReactionActor = consumeActionCost(reactionActor, REACTION_COST);
    return {
      characters: input.characters.map(character => (
        character.id === updatedReactionActor.id ? updatedReactionActor : character
      )),
      eventId: input.eventId,
      outcome: 'accepted',
      message: `${reactionActor.name} spends its Reaction outside its own turn; every other resource is unchanged.`,
    };
  }

  if (actor.id !== input.currentTurnOwnerId) {
    return {
      characters: input.characters,
      eventId: input.eventId,
      outcome: 'rejected',
      message: `Action economy event ${input.eventId} rejected before mutation: ${actor.name} does not own the current turn.`,
    };
  }

  if (input.resourceCase === 'action_surge') {
    const surgedActor = resolveActionSurge(actor);
    if (!surgedActor) {
      return {
        characters: input.characters,
        eventId: input.eventId,
        outcome: 'rejected',
        message: `Action economy event ${input.eventId} rejected before mutation: Action Surge is not advertised or has no use remaining.`,
      };
    }

    return {
      characters: input.characters.map(character => (
        character.id === surgedActor.id ? surgedActor : character
      )),
      eventId: input.eventId,
      outcome: 'accepted',
      message: `${actor.name} uses advertised Action Surge and gains one Action without changing Bonus Action, Reaction, movement, or free interaction.`,
    };
  }

  const ownerCosts = OWNER_COSTS_BY_CASE[input.resourceCase] ?? [];
  const combinedReactionAffordable = input.resourceCase !== 'combined_sequence'
    || (
      reactionActor.id !== input.currentTurnOwnerId
      && canAffordActionCost(reactionActor, REACTION_COST)
    );
  const ownerCostsAffordable = ownerCosts.every(cost => canAffordActionCost(actor, cost));

  if (!ownerCostsAffordable || !combinedReactionAffordable) {
    return {
      characters: input.characters,
      eventId: input.eventId,
      outcome: 'rejected',
      message: `Action economy event ${input.eventId} rejected before mutation: at least one required resource is already spent.`,
    };
  }

  const updatedActor = ownerCosts.reduce(
    (current, cost) => consumeActionCost(current, cost),
    actor,
  );
  const updatedReactionActor = input.resourceCase === 'combined_sequence'
    ? consumeActionCost(reactionActor, REACTION_COST)
    : reactionActor;

  return {
    characters: input.characters.map(character => {
      if (character.id === updatedActor.id) return updatedActor;
      if (character.id === updatedReactionActor.id) return updatedReactionActor;
      return character;
    }),
    eventId: input.eventId,
    outcome: 'accepted',
    message: input.resourceCase === 'combined_sequence'
      ? `${actor.name} spends Action, Bonus Action, free interaction, and 30 feet of movement while ${reactionActor.name} independently spends its out-of-turn Reaction.`
      : `${actor.name} resolves ${input.resourceCase.replaceAll('_', ' ')} through the production action-economy ledger.`,
  };
}

// ============================================================================
// Actor-Local Turn Start
// ============================================================================
// The turn manager calls the same reset helper when an actor's own turn begins.
// This small exported transaction lets focused proof show that starting another
// actor's turn cannot refresh the resources of the character that just acted.
// ============================================================================

export function resetOnlyTurnOwnerEconomy(
  characters: CombatCharacter[],
  turnOwnerId: string,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === turnOwnerId ? resetEconomy(character) : character
  ));
}
