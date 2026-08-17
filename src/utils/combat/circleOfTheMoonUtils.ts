// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 13:43:05
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
 * Circle of the Moon (Druid) Circle Forms and Moonlight Step.
 *
 * Circle Forms grants three-times-level Temporary HP when the druid assumes a
 * Wild Shape, and Moonlight Step teleports through dim light or darkness for a
 * per-Long-Rest resource. This file owns those two transactions: the temp-HP
 * grant and the teleport resource spend, so a caller does not hand-roll either
 * number in preview text.
 */

import type { ActiveCondition, CombatCharacter, CombatState, StatusEffect } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

export const CIRCLE_FORMS_STATUS_ID = 'circle_forms';
export const MOONLIGHT_STEP_RESOURCE_KEY = 'moonlight_step';
export const MOONLIGHT_STEP_DEFAULT_USES = 2;
export const MOONLIGHT_STEP_RANGE_FEET = 30;

// ============================================================================
// Circle Forms Temporary Hit Points
// ============================================================================
// The subclass grants three-times-level Temporary HP when Wild Shaping. The
// grant keeps the higher of the existing temp pool and the new value (temp HP
// does not stack) and marks the Circle Forms state on both condition mirrors.
// ============================================================================

export function calculateCircleFormsTempHp(level: number): number {
  return Math.max(0, 3 * Math.floor(level));
}

export function applyCircleFormsTempHp(
  character: CombatCharacter,
  level: number,
): CombatCharacter {
  const granted = calculateCircleFormsTempHp(level);
  const statusEffect: StatusEffect = {
    id: CIRCLE_FORMS_STATUS_ID,
    name: 'Circle Forms',
    type: 'buff',
    duration: Number.POSITIVE_INFINITY,
    source: 'Circle Forms',
    effect: { type: 'condition' },
  };
  const condition: ActiveCondition = {
    name: 'Circle Forms',
    duration: { type: 'permanent' },
    appliedTurn: 0,
    source: 'Circle Forms',
  };
  const marked = applyRuntimeStatusCondition(character, statusEffect, condition).character;

  return {
    ...marked,
    tempHP: Math.max(marked.tempHP ?? 0, granted),
  };
}

// ============================================================================
// Moonlight Step Resource
// ============================================================================

export function getMoonlightStepUses(character: CombatCharacter): number {
  const pool = character.limitedUses?.[MOONLIGHT_STEP_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return MOONLIGHT_STEP_DEFAULT_USES;
}

function spendMoonlightStepUse(character: CombatCharacter): CombatCharacter {
  const uses = getMoonlightStepUses(character);
  if (uses <= 0) return character;
  const pool = character.limitedUses?.[MOONLIGHT_STEP_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : MOONLIGHT_STEP_DEFAULT_USES;
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [MOONLIGHT_STEP_RESOURCE_KEY]: {
      name: 'Moonlight Step',
      current: uses - 1,
      max,
      resetOn: 'long_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

// ============================================================================
// Moonlight Step Transaction
// ============================================================================
// One use produces one teleport of up to 30 feet (6 tiles). The destination must
// be unoccupied by another living combatant and within the authored range; both
// are validated before the resource is paid.
// ============================================================================

export type MoonlightStepFailure =
  | 'caster_missing'
  | 'no_moonlight_step_uses'
  | 'destination_out_of_range'
  | 'destination_occupied';

export interface MoonlightStepResult {
  state: CombatState;
  resolved: boolean;
  failure?: MoonlightStepFailure;
  destination?: { x: number; y: number };
  remainingUses?: number;
}

export function resolveMoonlightStep(
  state: CombatState,
  request: { casterId: string; destination: { x: number; y: number } },
): MoonlightStepResult {
  const caster = state.characters.find(character => character.id === request.casterId);
  if (!caster) return { state, resolved: false, failure: 'caster_missing' };

  if (getMoonlightStepUses(caster) <= 0) {
    return { state, resolved: false, failure: 'no_moonlight_step_uses' };
  }

  const rangeTiles = MOONLIGHT_STEP_RANGE_FEET / 5;
  const dx = request.destination.x - caster.position.x;
  const dy = request.destination.y - caster.position.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance > rangeTiles) {
    return { state, resolved: false, failure: 'destination_out_of_range' };
  }

  const occupied = state.characters.some(other => (
    other.id !== caster.id
    && other.currentHP > 0
    && other.position.x === request.destination.x
    && other.position.y === request.destination.y
  ));
  if (occupied) {
    return { state, resolved: false, failure: 'destination_occupied' };
  }

  const spentCaster = spendMoonlightStepUse(caster);
  const movedCaster: CombatCharacter = {
    ...spentCaster,
    position: { ...request.destination },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === caster.id ? movedCaster : character
      )),
    },
    resolved: true,
    destination: { ...request.destination },
    remainingUses: getMoonlightStepUses(spentCaster),
  };
}
