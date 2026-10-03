// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:19:06
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
 * Warrior of Shadow (Monk) Shadow Arts and Shadow Step.
 *
 * Shadow Arts lets the monk spend Focus to cast Darkness, Darkvision, Pass
 * without Trace, or Silence; Shadow Step spends one Focus to teleport up to
 * 60 feet through dim light or darkness. This file owns the Focus resource
 * (`monks_focus`), the spell catalog with authored costs, and both transactions
 * so a caller does not hand-roll the Focus math or teleport validation. Both are
 * gated on the `shadow_arts` ability.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';

export const SHADOW_ARTS_FEATURE_ID = 'shadow_arts';
export const MONKS_FOCUS_RESOURCE_KEY = 'monks_focus';
export const SHADOW_STEP_RANGE_FEET = 60;
export const SHADOW_STEP_FOCUS_COST = 1;

export interface ShadowArtSpell {
  id: string;
  name: string;
  focusCost: number;
}

export const SHADOW_ARTS_SPELLS: Record<string, ShadowArtSpell> = {
  darkness: { id: 'darkness', name: 'Darkness', focusCost: 1 },
  darkvision: { id: 'darkvision', name: 'Darkvision', focusCost: 1 },
  pass_without_trace: { id: 'pass_without_trace', name: 'Pass without Trace', focusCost: 1 },
  silence: { id: 'silence', name: 'Silence', focusCost: 2 },
};

export function isShadowArtSpell(id: string): boolean {
  return id in SHADOW_ARTS_SPELLS;
}

export function hasShadowArts(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === SHADOW_ARTS_FEATURE_ID);
}

export function getFocusPoints(character: CombatCharacter): number {
  const pool = character.limitedUses?.[MONKS_FOCUS_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return character.level ?? 1;
}

function spendFocus(character: CombatCharacter, cost: number): CombatCharacter {
  const current = getFocusPoints(character);
  if (current < cost) return character;
  const pool = character.limitedUses?.[MONKS_FOCUS_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : Math.max(current, character.level ?? 1);
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [MONKS_FOCUS_RESOURCE_KEY]: {
      name: "Monk's Focus",
      current: current - cost,
      max,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

// ============================================================================
// Shadow Arts
// ============================================================================

export type ShadowArtsFailure =
  | 'monk_missing'
  | 'missing_shadow_arts'
  | 'unknown_spell'
  | 'not_enough_focus';

export interface ShadowArtsResult {
  state: CombatState;
  resolved: boolean;
  failure?: ShadowArtsFailure;
  spellId?: string;
  focusSpent?: number;
  remainingFocus?: number;
}

export function resolveShadowArtsCast(
  state: CombatState,
  request: { monkId: string; spellId: string },
): ShadowArtsResult {
  const monk = state.characters.find(character => character.id === request.monkId);
  if (!monk) return { state, resolved: false, failure: 'monk_missing' };
  if (!hasShadowArts(monk)) return { state, resolved: false, failure: 'missing_shadow_arts' };

  const spell = SHADOW_ARTS_SPELLS[request.spellId];
  if (!spell) return { state, resolved: false, failure: 'unknown_spell' };

  const focus = getFocusPoints(monk);
  if (focus < spell.focusCost) return { state, resolved: false, failure: 'not_enough_focus' };

  const spent = spendFocus(monk, spell.focusCost);

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === monk.id ? spent : character
      )),
    },
    resolved: true,
    spellId: spell.id,
    focusSpent: spell.focusCost,
    remainingFocus: getFocusPoints(spent),
  };
}

// ============================================================================
// Shadow Step
// ============================================================================

export type ShadowStepFailure =
  | 'monk_missing'
  | 'missing_shadow_arts'
  | 'not_enough_focus'
  | 'destination_out_of_range'
  | 'destination_occupied';

export interface ShadowStepResult {
  state: CombatState;
  resolved: boolean;
  failure?: ShadowStepFailure;
  destination?: { x: number; y: number };
  remainingFocus?: number;
}

export function resolveShadowStep(
  state: CombatState,
  request: { monkId: string; destination: { x: number; y: number } },
): ShadowStepResult {
  const monk = state.characters.find(character => character.id === request.monkId);
  if (!monk) return { state, resolved: false, failure: 'monk_missing' };
  if (!hasShadowArts(monk)) return { state, resolved: false, failure: 'missing_shadow_arts' };

  if (getFocusPoints(monk) < SHADOW_STEP_FOCUS_COST) {
    return { state, resolved: false, failure: 'not_enough_focus' };
  }

  const rangeTiles = SHADOW_STEP_RANGE_FEET / 5;
  const dx = request.destination.x - monk.position.x;
  const dy = request.destination.y - monk.position.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > rangeTiles) {
    return { state, resolved: false, failure: 'destination_out_of_range' };
  }

  const occupied = state.characters.some(other => (
    other.id !== monk.id
    && other.currentHP > 0
    && other.position.x === request.destination.x
    && other.position.y === request.destination.y
  ));
  if (occupied) return { state, resolved: false, failure: 'destination_occupied' };

  const spent = spendFocus(monk, SHADOW_STEP_FOCUS_COST);
  const movedMonk: CombatCharacter = { ...spent, position: { ...request.destination } };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === monk.id ? movedMonk : character
      )),
    },
    resolved: true,
    destination: { ...request.destination },
    remainingFocus: getFocusPoints(spent),
  };
}
