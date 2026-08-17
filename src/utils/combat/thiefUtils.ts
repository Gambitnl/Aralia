// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:01:48
 * Dependents: utils/combat/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Thief (Rogue) Fast Hands and Second-Story Work.
 *
 * Fast Hands lets the Thief spend their Cunning Action bonus action on Sleight
 * of Hand, thieves' tools, or Use an Object. Second-Story Work makes climbing
 * cost no extra movement and extends the Thief's long jump by their Dexterity
 * modifier in feet. Both are owned here as subclass-aware transactions: Fast
 * Hands validates the `fast_hands` ability and pays the bonus action, while the
 * climb/jump helpers only alter the shared physics results when `second_story_work`
 * is present, so a non-Thief rogue never benefits.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import { getAbilityModifierValue } from '../character/statUtils';
import { calculateJumpDistance, type MovementConfig } from './physicsUtils';

export const FAST_HANDS_FEATURE_ID = 'fast_hands';
export const SECOND_STORY_WORK_FEATURE_ID = 'second_story_work';
export const CUNNING_ACTION_COST: 'bonus_action' = 'bonus_action';

// ============================================================================
// Fast Hands
// ============================================================================

export type FastHandsAction = 'sleight_of_hand' | 'use_thieves_tools' | 'use_object';

export interface FastHandsActionDefinition {
  id: FastHandsAction;
  name: string;
  description: string;
}

export const FAST_HANDS_ACTIONS: Record<FastHandsAction, FastHandsActionDefinition> = {
  sleight_of_hand: {
    id: 'sleight_of_hand',
    name: 'Sleight of Hand',
    description: 'Use your Cunning Action bonus action to make a Sleight of Hand check.',
  },
  use_thieves_tools: {
    id: 'use_thieves_tools',
    name: "Use Thieves' Tools",
    description: 'Use your Cunning Action bonus action to use thieves\' tools.',
  },
  use_object: {
    id: 'use_object',
    name: 'Use an Object',
    description: 'Use your Cunning Action bonus action to use an object.',
  },
};

export function isFastHandsAction(id: string): id is FastHandsAction {
  return id in FAST_HANDS_ACTIONS;
}

export function hasFastHands(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === FAST_HANDS_FEATURE_ID);
}

export type FastHandsFailure =
  | 'thief_missing'
  | 'missing_fast_hands'
  | 'unknown_action'
  | 'no_bonus_action';

export interface FastHandsResult {
  state: CombatState;
  resolved: boolean;
  failure?: FastHandsFailure;
  actionType?: FastHandsAction;
}

export function resolveFastHands(
  state: CombatState,
  request: { thiefId: string; actionType: string },
): FastHandsResult {
  const thief = state.characters.find(character => character.id === request.thiefId);
  if (!thief) return { state, resolved: false, failure: 'thief_missing' };
  if (!hasFastHands(thief)) return { state, resolved: false, failure: 'missing_fast_hands' };
  if (!isFastHandsAction(request.actionType)) {
    return { state, resolved: false, failure: 'unknown_action' };
  }
  if (thief.actionEconomy.bonusAction.used || thief.actionEconomy.bonusAction.remaining <= 0) {
    return { state, resolved: false, failure: 'no_bonus_action' };
  }

  const nextThief: CombatCharacter = {
    ...thief,
    actionEconomy: {
      ...thief.actionEconomy,
      bonusAction: {
        used: true,
        remaining: thief.actionEconomy.bonusAction.remaining - 1,
      },
    },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === thief.id ? nextThief : character
      )),
    },
    resolved: true,
    actionType: request.actionType as FastHandsAction,
  };
}

// ============================================================================
// Second-Story Work
// ============================================================================

export function hasSecondStoryWork(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === SECOND_STORY_WORK_FEATURE_ID);
}

/**
 * Returns the movement config with the climbing penalty removed for a Thief
 * with Second-Story Work (climbing no longer costs extra movement). Non-Thieves
 * get the config back unchanged.
 */
export function applySecondStoryWorkClimb(
  character: CombatCharacter,
  config: MovementConfig,
): MovementConfig {
  if (!hasSecondStoryWork(character)) return config;
  return { ...config, hasClimbSpeed: true };
}

/**
 * Computes the Thief's jump distance. A Thief with Second-Story Work adds their
 * Dexterity modifier in feet to a long jump; high jumps and non-Thieves use the
 * shared strength-based calculation unchanged.
 */
export function calculateSecondStoryWorkJumpDistance(
  character: CombatCharacter,
  type: 'long' | 'high',
  standing = false,
): number {
  const base = calculateJumpDistance(character.stats.strength, type, standing);
  if (!hasSecondStoryWork(character) || type !== 'long') return base;
  return base + getAbilityModifierValue(character.stats.dexterity);
}
