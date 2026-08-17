// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:30:44
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
 * Path of the Berserker (Barbarian) Rage/Frenzy lifecycle.
 *
 * The level-3 `frenzy` grant means the character can make a bonus-action melee
 * attack each turn while raging, and suffers exhaustion when that rage ends.
 * This file owns the one lifecycle boundary the scattered seams did not: it
 * answers "am I raging?", "is Frenzy legal right now?", and "what happens when
 * the rage ends?" so the executor and future rest/cleanup paths share it instead
 * of re-deriving the Rage status by id in several places.
 */

import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../types/combat';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

export const RAGE_STATUS_ID = 'raging';
export const RAGE_STATUS_NAME = 'Raging';
export const BEAR_SPIRIT_RAGE_NAME = 'Raging (Bear Spirit)';
export const EXHAUSTION_CONDITION_NAME = 'Exhaustion';
export const FRENZY_ABILITY_ID = 'frenzy_attack';

// ============================================================================
// Rage State
// ============================================================================
// The Rage status lives on the `statusEffects` mirror the executor writes when
// the `rage` ability resolves. Reading both mirrors keeps this helper honest
// for any fixture that only populated the structured `conditions` list.
// ============================================================================

export function isRaging(character: CombatCharacter): boolean {
  const rageNames = new Set([RAGE_STATUS_NAME, BEAR_SPIRIT_RAGE_NAME]);
  return (
    character.statusEffects.some(effect => (
      effect.id === RAGE_STATUS_ID || rageNames.has(effect.name)
    ))
    || (character.conditions ?? []).some(condition => rageNames.has(condition.name))
  );
}

// ============================================================================
// Frenzy Eligibility
// ============================================================================
// Frenzy is the Berserker's bonus-action attack while raging. It is legal only
// while the barbarian is actively raging and still owns an unspent bonus action,
// and only when the combat build actually granted the frenzy attack button.
// ============================================================================

export function canUseFrenzy(character: CombatCharacter): boolean {
  if (!isRaging(character)) return false;
  if (character.actionEconomy.bonusAction.used) return false;
  return character.abilities.some(ability => ability.id === FRENZY_ABILITY_ID);
}

// ============================================================================
// Exhaustion
// ============================================================================
// The authored Frenzy contract applies exhaustion when the rage ends. This
// models one level of Exhaustion as a shared condition on both mirrors so the
// status badge and any future d20/speed penalty readers see the same fact.
// ============================================================================

export function applyExhaustion(character: CombatCharacter): CombatCharacter {
  const statusEffect: StatusEffect = {
    id: 'exhaustion',
    name: EXHAUSTION_CONDITION_NAME,
    type: 'debuff',
    duration: Number.POSITIVE_INFINITY,
    source: 'Frenzy',
    effect: { type: 'condition' },
  };
  const condition: ActiveCondition = {
    name: EXHAUSTION_CONDITION_NAME,
    duration: { type: 'permanent' },
    appliedTurn: 0,
    source: 'Frenzy',
  };
  return applyRuntimeStatusCondition(character, statusEffect, condition).character;
}

// ============================================================================
// Rage End Lifecycle
// ============================================================================
// Ending a rage removes the Rage status from both mirrors. When the Berserker
// option is set (the authored Frenzy contract), the same transaction also applies
// the exhaustion result, so a caller cannot drop the status and forget the cost.
// ============================================================================

export function endRage(
  character: CombatCharacter,
  options: { applyExhaustion?: boolean } = {},
): CombatCharacter {
  const isRageEffect = (fact: { id?: string; name: string }): boolean => (
    fact.id === RAGE_STATUS_ID
    || fact.name === RAGE_STATUS_NAME
    || fact.name === BEAR_SPIRIT_RAGE_NAME
  );

  const statusEffects = character.statusEffects.filter(effect => !isRageEffect(effect));
  const conditions = (character.conditions ?? []).filter(condition => !isRageEffect(condition));

  const withoutRage: CombatCharacter = { ...character, statusEffects, conditions };
  return options.applyExhaustion ? applyExhaustion(withoutRage) : withoutRage;
}

// ============================================================================
// Reconciliation
// ============================================================================
// Rage also ends when the barbarian can no longer sustain it. An incapacitated
// barbarian cannot attack or take damage, so the canonical lifecycle closes the
// rage here and, for a Berserker, applies the authored exhaustion cost.
// ============================================================================

export function reconcileRageLifecycle(
  character: CombatCharacter,
  options: { berserker?: boolean } = {},
): CombatCharacter {
  const isIncapacitated = (character.conditions ?? []).some(condition => (
    condition.name === 'Incapacitated'
    || condition.name === 'Unconscious'
    || condition.name === 'Paralyzed'
    || condition.name === 'Stunned'
  ));

  if (!isIncapacitated || !isRaging(character)) {
    return character;
  }

  return endRage(character, { applyExhaustion: options.berserker ?? false });
}
