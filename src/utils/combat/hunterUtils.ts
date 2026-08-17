// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 13:53:37
 * Dependents: utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Hunter (Ranger) Hunter's Prey choice and combat contracts.
 *
 * The level-3 `hunters_prey` grant offers three mutually exclusive options, and
 * each has a distinct combat outcome the runtime must own rather than describe
 * in preview text. This file keeps the canonical choice catalog, a persistence
 * helper (`applyHunterPreyChoice` stores the chosen option on the character), and
 * one transaction per option:
 *   - Colossus Slayer: once per turn, +1d8 damage against a target below max HP.
 *   - Giant Killer: spend your reaction to attack a Large+ creature that missed
 *     you this turn while within 5 feet.
 *   - Horde Breaker: once per turn, an extra attack against a different creature
 *     within 5 feet of the original target.
 * Each transaction is gated on the `hunters_prey` ability being present, so a
 * non-Hunter ranger can never trigger one of these riders.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import { rollDice } from './combatUtils';

// ============================================================================
// Choice Catalog
// ============================================================================

export const HUNTER_PREY_FEATURE_ID = 'hunters_prey';
export const COLOSSUS_SLAYER_DICE = '1d8';
export const GIANT_KILLER_REACH_TILES = 1;
export const HORDE_BREAKER_REACH_TILES = 1;

export type HunterPreyChoice = NonNullable<CombatCharacter['hunterPreyChoice']>;

export interface HunterPreyDefinition {
  id: HunterPreyChoice;
  name: string;
  description: string;
}

export const HUNTER_PREY_CHOICES: Record<HunterPreyChoice, HunterPreyDefinition> = {
  colossus_slayer: {
    id: 'colossus_slayer',
    name: 'Colossus Slayer',
    description: 'Once per turn, deal an extra 1d8 damage to a creature below its hit point maximum.',
  },
  giant_killer: {
    id: 'giant_killer',
    name: 'Giant Killer',
    description: 'When a Large or larger creature within 5 feet misses you, use your reaction to attack it.',
  },
  horde_breaker: {
    id: 'horde_breaker',
    name: 'Horde Breaker',
    description: 'Once per turn, make another attack against a different creature within 5 feet of the original target.',
  },
};

export function isHunterPreyChoice(id: string): id is HunterPreyChoice {
  return id in HUNTER_PREY_CHOICES;
}

// ============================================================================
// Choice Persistence
// ============================================================================
// The choice is stored as an optional field on the character so the combat
// transactions can read it without re-deriving subclass state mid-combat. The
// optional shape keeps the character contract unchanged for non-Hunters.
// ============================================================================

export function hasHuntersPrey(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === HUNTER_PREY_FEATURE_ID);
}

export function applyHunterPreyChoice<T extends CombatCharacter>(
  character: T,
  choice: string,
): T {
  if (!isHunterPreyChoice(choice)) return character;
  return { ...character, hunterPreyChoice: choice };
}

export function getHunterPreyChoice(character: CombatCharacter): HunterPreyChoice | undefined {
  return character.hunterPreyChoice;
}

// ============================================================================
// Shared Eligibility Helpers
// ============================================================================

const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const;

function sizeRank(size: string | undefined): number {
  const index = SIZE_ORDER.indexOf(size as (typeof SIZE_ORDER)[number]);
  return index === -1 ? SIZE_ORDER.indexOf('Medium') : index;
}

function adjacentTiles(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= GIANT_KILLER_REACH_TILES;
}

export function targetIsBelowMaxHp(target: { currentHP: number; maxHP: number }): boolean {
  return target.currentHP < target.maxHP;
}

// ============================================================================
// Colossus Slayer
// ============================================================================

export interface ColossusSlayerResult {
  eligible: boolean;
  bonusDamage: number;
  reason?: 'missing_hunters_prey' | 'wrong_choice' | 'already_used_this_turn' | 'target_not_below_max';
}

export function resolveColossusSlayer(
  character: CombatCharacter,
  target: { currentHP: number; maxHP: number },
  alreadyUsedThisTurn: boolean,
  rng?: () => number,
): ColossusSlayerResult {
  if (!hasHuntersPrey(character)) {
    return { eligible: false, bonusDamage: 0, reason: 'missing_hunters_prey' };
  }
  if (getHunterPreyChoice(character) !== 'colossus_slayer') {
    return { eligible: false, bonusDamage: 0, reason: 'wrong_choice' };
  }
  if (alreadyUsedThisTurn) {
    return { eligible: false, bonusDamage: 0, reason: 'already_used_this_turn' };
  }
  if (!targetIsBelowMaxHp(target)) {
    return { eligible: false, bonusDamage: 0, reason: 'target_not_below_max' };
  }
  return { eligible: true, bonusDamage: rollDice(COLOSSUS_SLAYER_DICE, { rng }) };
}

// ============================================================================
// Giant Killer
// ============================================================================

export interface GiantKillerResult {
  state: CombatState;
  resolved: boolean;
  failure?:
    | 'ranger_missing'
    | 'missing_hunters_prey'
    | 'wrong_choice'
    | 'target_missing'
    | 'target_too_small'
    | 'target_out_of_reach'
    | 'no_recent_miss'
    | 'no_reaction';
}

export function resolveGiantKillerReaction(
  state: CombatState,
  request: { rangerId: string; targetId: string; targetMissedRangerThisTurn: boolean },
): GiantKillerResult {
  const ranger = state.characters.find(character => character.id === request.rangerId);
  if (!ranger) return { state, resolved: false, failure: 'ranger_missing' };
  if (!hasHuntersPrey(ranger)) return { state, resolved: false, failure: 'missing_hunters_prey' };
  if (getHunterPreyChoice(ranger) !== 'giant_killer') return { state, resolved: false, failure: 'wrong_choice' };

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing' };
  if (sizeRank(target.stats.size) < sizeRank('Large')) {
    return { state, resolved: false, failure: 'target_too_small' };
  }
  if (!adjacentTiles(ranger.position, target.position)) {
    return { state, resolved: false, failure: 'target_out_of_reach' };
  }
  if (!request.targetMissedRangerThisTurn) {
    return { state, resolved: false, failure: 'no_recent_miss' };
  }
  if (ranger.actionEconomy.reaction.used || ranger.actionEconomy.reaction.remaining <= 0) {
    return { state, resolved: false, failure: 'no_reaction' };
  }

  const nextRanger: CombatCharacter = {
    ...ranger,
    actionEconomy: {
      ...ranger.actionEconomy,
      reaction: { used: true, remaining: ranger.actionEconomy.reaction.remaining - 1 },
    },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === ranger.id ? nextRanger : character
      )),
    },
    resolved: true,
  };
}

// ============================================================================
// Horde Breaker
// ============================================================================

export interface HordeBreakerResult {
  state: CombatState;
  resolved: boolean;
  failure?:
    | 'ranger_missing'
    | 'missing_hunters_prey'
    | 'wrong_choice'
    | 'already_used_this_turn'
    | 'original_target_missing'
    | 'secondary_target_missing'
    | 'secondary_out_of_reach';
  secondaryTargetId?: string;
}

export function resolveHordeBreaker(
  state: CombatState,
  request: {
    rangerId: string;
    originalTargetId: string;
    secondaryTargetId: string;
    alreadyUsedThisTurn: boolean;
  },
): HordeBreakerResult {
  const ranger = state.characters.find(character => character.id === request.rangerId);
  if (!ranger) return { state, resolved: false, failure: 'ranger_missing' };
  if (!hasHuntersPrey(ranger)) return { state, resolved: false, failure: 'missing_hunters_prey' };
  if (getHunterPreyChoice(ranger) !== 'horde_breaker') return { state, resolved: false, failure: 'wrong_choice' };
  if (request.alreadyUsedThisTurn) return { state, resolved: false, failure: 'already_used_this_turn' };

  const original = state.characters.find(character => character.id === request.originalTargetId);
  if (!original) return { state, resolved: false, failure: 'original_target_missing' };

  const secondary = state.characters.find(character => character.id === request.secondaryTargetId);
  if (!secondary || secondary.id === original.id) {
    return { state, resolved: false, failure: 'secondary_target_missing' };
  }
  if (!adjacentTiles(original.position, secondary.position)) {
    return { state, resolved: false, failure: 'secondary_out_of_reach' };
  }

  return { state, resolved: true, secondaryTargetId: secondary.id };
}
