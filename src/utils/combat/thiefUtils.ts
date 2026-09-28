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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: hooks/combat/useActionExecutor.ts, utils/combat/combatUtils.ts, utils/combat/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatState } from '../../types/combat';
import { getAbilityModifierValue } from '../character/statUtils';
import { applyMovementCostModifiers, calculateJumpDistance, type MovementConfig } from './physicsUtils';

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

// ============================================================================
// Cunning Action
// ============================================================================
// Fast Hands is written as an extension of Cunning Action, so the Thief's three
// object-interaction options belong in the same bonus-action transaction as the
// rogue's Dash, Disengage, and Hide. One entry point owns the whole set: every
// rogue with `cunning_action` gets the three base options, and the option list
// widens to six only when `fast_hands` is present. A rogue without Cunning
// Action gets none of them, and a non-Thief asking for an object option is
// refused by name rather than silently downgraded.
// ============================================================================

export const CUNNING_ACTION_FEATURE_ID = 'cunning_action';

export type CunningActionBaseAction = 'dash' | 'disengage' | 'hide';
export type CunningActionOption = CunningActionBaseAction | FastHandsAction;

export interface CunningActionDefinition {
  id: CunningActionOption;
  name: string;
  description: string;
  /** True when the option comes from the Thief's Fast Hands rather than the base feature. */
  requiresFastHands: boolean;
}

export const CUNNING_ACTION_BASE_ACTIONS: Record<CunningActionBaseAction, CunningActionDefinition> = {
  dash: {
    id: 'dash',
    name: 'Dash',
    description: 'Use your Cunning Action bonus action to Dash.',
    requiresFastHands: false,
  },
  disengage: {
    id: 'disengage',
    name: 'Disengage',
    description: 'Use your Cunning Action bonus action to Disengage.',
    requiresFastHands: false,
  },
  hide: {
    id: 'hide',
    name: 'Hide',
    description: 'Use your Cunning Action bonus action to Hide.',
    requiresFastHands: false,
  },
};

export function isCunningActionBaseAction(id: string): id is CunningActionBaseAction {
  return id in CUNNING_ACTION_BASE_ACTIONS;
}

export function hasCunningAction(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === CUNNING_ACTION_FEATURE_ID);
}

/**
 * The bonus-action options this character can legally take right now. Empty for
 * a character without Cunning Action; three for any rogue with it; six for a
 * Thief, whose Fast Hands adds the object-interaction options.
 */
export function cunningActionOptionsFor(character: CombatCharacter): CunningActionDefinition[] {
  if (!hasCunningAction(character)) return [];
  const base = Object.values(CUNNING_ACTION_BASE_ACTIONS);
  if (!hasFastHands(character)) return base;
  return [
    ...base,
    ...Object.values(FAST_HANDS_ACTIONS).map(action => ({
      id: action.id,
      name: action.name,
      description: action.description,
      requiresFastHands: true,
    })),
  ];
}

export type CunningActionFailure =
  | 'rogue_missing'
  | 'missing_cunning_action'
  | 'unknown_action'
  | 'requires_fast_hands'
  | 'no_bonus_action';

export interface CunningActionResult {
  state: CombatState;
  resolved: boolean;
  failure?: CunningActionFailure;
  actionType?: CunningActionOption;
  /** True when the resolved option came from the Thief's Fast Hands. */
  usedFastHands?: boolean;
}

/**
 * Spends the rogue's bonus action on one Cunning Action option. The Thief's
 * object-interaction options resolve through the same transaction, so the
 * action economy is paid once and in one place.
 */
export function resolveCunningAction(
  state: CombatState,
  request: { rogueId: string; actionType: string },
): CunningActionResult {
  const rogue = state.characters.find(character => character.id === request.rogueId);
  if (!rogue) return { state, resolved: false, failure: 'rogue_missing' };
  if (!hasCunningAction(rogue)) return { state, resolved: false, failure: 'missing_cunning_action' };

  const isBase = isCunningActionBaseAction(request.actionType);
  const isObjectOption = isFastHandsAction(request.actionType);
  if (!isBase && !isObjectOption) return { state, resolved: false, failure: 'unknown_action' };
  if (isObjectOption && !hasFastHands(rogue)) {
    return { state, resolved: false, failure: 'requires_fast_hands' };
  }

  if (rogue.actionEconomy.bonusAction.used || rogue.actionEconomy.bonusAction.remaining <= 0) {
    return { state, resolved: false, failure: 'no_bonus_action' };
  }

  const nextRogue: CombatCharacter = {
    ...rogue,
    actionEconomy: {
      ...rogue.actionEconomy,
      bonusAction: {
        used: true,
        remaining: rogue.actionEconomy.bonusAction.remaining - 1,
      },
    },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === rogue.id ? nextRogue : character
      )),
    },
    resolved: true,
    actionType: request.actionType as CunningActionOption,
    usedFastHands: isObjectOption,
  };
}

// ============================================================================
// Second-Story Work Movement Cost
// ============================================================================

/**
 * The movement cost of a climb for this character, in feet. It is the shared
 * physics cost with the Thief's climbing penalty already removed, so a movement
 * caller asks once instead of deciding whether to apply Second-Story Work and
 * then applying the terrain rules itself.
 */
export function calculateSecondStoryWorkMovementCost(
  character: CombatCharacter,
  distanceFeet: number,
  config: MovementConfig,
): number {
  return applyMovementCostModifiers(distanceFeet, applySecondStoryWorkClimb(character, config));
}
