// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:16:15
 * Dependents: utils/combat/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Warrior of the Open Hand (Monk) Open Hand Technique Flurry riders.
 *
 * When a Flurry of Blows hit lands, the monk can impose one rider: knock the
 * target Prone, push it up to 15 feet, or deny its reactions until the end of
 * the monk's next turn. Each rider is gated on a Dexterity save against the
 * monk's Ki save DC. This file owns the save DC, the three rider transactions,
 * and the `open_hand_technique` gate, so a non-Open-Hand monk never triggers one.
 */

import type { ActiveCondition, CombatCharacter, CombatState, StatusEffect } from '../../types/combat';
import { getAbilityModifierValue } from '../character/statUtils';
import {
  calculateProficiencyBonus,
  rollSavingThrow,
  type SavingThrowResult,
} from '../character/savingThrowUtils';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

export const OPEN_HAND_TECHNIQUE_FEATURE_ID = 'open_hand_technique';
export const OPEN_HAND_PUSH_FEET = 15;

export type OpenHandRider = 'knock_prone' | 'push' | 'deny_reactions';

export interface OpenHandRiderDefinition {
  id: OpenHandRider;
  name: string;
  description: string;
  saveAbility: 'Dexterity';
  conditionOnFailedSave?: string;
}

export const OPEN_HAND_RIDERS: Record<OpenHandRider, OpenHandRiderDefinition> = {
  knock_prone: {
    id: 'knock_prone',
    name: 'Knock Prone',
    description: 'The target must succeed on a Dexterity save or fall Prone.',
    saveAbility: 'Dexterity',
    conditionOnFailedSave: 'Prone',
  },
  push: {
    id: 'push',
    name: 'Push',
    description: 'The target must succeed on a Dexterity save or be pushed up to 15 feet away.',
    saveAbility: 'Dexterity',
  },
  deny_reactions: {
    id: 'deny_reactions',
    name: 'Deny Reactions',
    description: "The target must succeed on a Dexterity save or can't take reactions until the end of your next turn.",
    saveAbility: 'Dexterity',
  },
};

export function isOpenHandRider(id: string): id is OpenHandRider {
  return id in OPEN_HAND_RIDERS;
}

export function hasOpenHandTechnique(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === OPEN_HAND_TECHNIQUE_FEATURE_ID);
}

export function calculateOpenHandSaveDc(monk: CombatCharacter): number {
  const proficiency = calculateProficiencyBonus(monk.level ?? 1);
  const wisdomMod = getAbilityModifierValue(monk.stats.wisdom);
  return 8 + proficiency + wisdomMod;
}

export type OpenHandRiderFailure =
  | 'monk_missing'
  | 'missing_open_hand_technique'
  | 'unknown_rider'
  | 'target_missing';

export interface OpenHandRiderResult {
  state: CombatState;
  resolved: boolean;
  failure?: OpenHandRiderFailure;
  riderId?: OpenHandRider;
  save?: SavingThrowResult;
  applied?: string;
  pushDistanceTiles?: number;
}

export function resolveOpenHandFlurryRider(
  state: CombatState,
  request: { monkId: string; targetId: string; riderId: string; rng?: () => number },
): OpenHandRiderResult {
  const monk = state.characters.find(character => character.id === request.monkId);
  if (!monk) return { state, resolved: false, failure: 'monk_missing' };
  if (!hasOpenHandTechnique(monk)) return { state, resolved: false, failure: 'missing_open_hand_technique' };

  const rider = OPEN_HAND_RIDERS[request.riderId as OpenHandRider];
  if (!rider) return { state, resolved: false, failure: 'unknown_rider' };

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing' };

  const dc = calculateOpenHandSaveDc(monk);
  const save = rollSavingThrow(target, rider.saveAbility, dc, [], undefined, undefined, {
    rng: request.rng,
  });

  if (save.success) {
    return { state, resolved: true, riderId: rider.id, save, applied: 'saved' };
  }

  let nextState = state;
  let applied: string = rider.id;

  if (rider.conditionOnFailedSave) {
    const statusEffect: StatusEffect = {
      id: `open-hand-${rider.id}-${monk.id}-${target.id}`,
      name: rider.conditionOnFailedSave,
      type: 'debuff',
      duration: 1,
      source: 'Open Hand Technique',
      sourceCasterId: monk.id,
      effect: { type: 'condition' },
    };
    const condition: ActiveCondition = {
      name: rider.conditionOnFailedSave,
      duration: { type: 'rounds', value: 1 },
      appliedTurn: state.turnState?.currentTurn ?? 0,
      source: 'Open Hand Technique',
      sourceCasterId: monk.id,
    };
    const appliedTarget = applyRuntimeStatusCondition(target, statusEffect, condition).character;
    nextState = {
      ...nextState,
      characters: nextState.characters.map(character => (
        character.id === target.id ? appliedTarget : character
      )),
    };
    applied = rider.conditionOnFailedSave;
  } else if (rider.id === 'push') {
    const dx = target.position.x - monk.position.x;
    const dy = target.position.y - monk.position.y;
    const dirX = dx === 0 ? 1 : Math.sign(dx);
    const dirY = dy === 0 ? 0 : Math.sign(dy);
    const pushDistanceTiles = Math.round(OPEN_HAND_PUSH_FEET / 5);
    const movedTarget: CombatCharacter = {
      ...target,
      position: {
        x: target.position.x + dirX * pushDistanceTiles,
        y: target.position.y + dirY * pushDistanceTiles,
      },
    };
    nextState = {
      ...nextState,
      characters: nextState.characters.map(character => (
        character.id === target.id ? movedTarget : character
      )),
    };
    applied = 'pushed';
  } else if (rider.id === 'deny_reactions') {
    const statusEffect: StatusEffect = {
      id: `open-hand-deny-reactions-${monk.id}-${target.id}`,
      name: 'Reactions Denied',
      type: 'debuff',
      duration: 1,
      source: 'Open Hand Technique',
      sourceCasterId: monk.id,
      effect: { type: 'condition' },
    };
    const appliedTarget: CombatCharacter = {
      ...target,
      statusEffects: [...target.statusEffects, statusEffect],
    };
    nextState = {
      ...nextState,
      characters: nextState.characters.map(character => (
        character.id === target.id ? appliedTarget : character
      )),
    };
  }

  return {
    state: nextState,
    resolved: true,
    riderId: rider.id,
    save,
    applied,
    pushDistanceTiles: rider.id === 'push' ? Math.round(OPEN_HAND_PUSH_FEET / 5) : undefined,
  };
}
