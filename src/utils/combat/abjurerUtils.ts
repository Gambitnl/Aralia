// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:45:29
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
 * Abjurer (Wizard, School of Abjuration) Arcane Ward.
 *
 * The ward is a persistent pool of hit points that absorbs damage before the
 * wizard's own hit points. It starts at 2×level + Intelligence modifier and
 * recharges 2×spell-level when the wizard casts a qualifying Abjuration spell.
 * This file owns the max formula, creation, recharge, and damage interception,
 * gated on the `arcane_ward` ability. It is distinct from temporary hit points,
 * which do not absorb damage this way.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import { getAbilityModifierValue } from '../character/statUtils';

export const ARCANE_WARD_FEATURE_ID = 'arcane_ward';

export function hasArcaneWard(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ARCANE_WARD_FEATURE_ID);
}

export function calculateArcaneWardMaxHp(level: number, intMod: number): number {
  return Math.max(0, 2 * Math.max(1, Math.floor(level)) + intMod);
}

export function getArcaneWardMaxHp(character: CombatCharacter): number {
  return calculateArcaneWardMaxHp(
    character.level ?? 1,
    getAbilityModifierValue(character.stats.intelligence),
  );
}

export function getArcaneWardHp(character: CombatCharacter): number {
  return character.arcaneWardHp ?? 0;
}

export function createArcaneWard(character: CombatCharacter): CombatCharacter {
  return { ...character, arcaneWardHp: getArcaneWardMaxHp(character) };
}

/** Recharges the ward by 2×spell-level after an Abjuration spell, capped at max. */
export function rechargeArcaneWard(character: CombatCharacter, spellLevel: number): CombatCharacter {
  if (!hasArcaneWard(character)) return character;
  const max = getArcaneWardMaxHp(character);
  const current = getArcaneWardHp(character);
  const gained = 2 * Math.max(0, Math.floor(spellLevel));
  return { ...character, arcaneWardHp: Math.min(max, current + gained) };
}

// ============================================================================
// Damage Interception
// ============================================================================

export type ArcaneWardAbsorbFailure = 'target_missing' | 'no_active_ward';

export interface ArcaneWardAbsorbResult {
  state: CombatState;
  resolved: boolean;
  failure?: ArcaneWardAbsorbFailure;
  absorbedDamage: number;
  remainingDamage: number;
  remainingWardHp: number;
}

/**
 * Intercepts `damage` against the target's Arcane Ward before hit points. Only
 * the part that exceeds the ward passes through to hit points.
 */
export function resolveArcaneWardAbsorption(
  state: CombatState,
  request: { targetId: string; damage: number },
): ArcaneWardAbsorbResult {
  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) {
    return { state, resolved: false, failure: 'target_missing', absorbedDamage: 0, remainingDamage: request.damage, remainingWardHp: 0 };
  }
  if (!hasArcaneWard(target) || getArcaneWardHp(target) <= 0) {
    return { state, resolved: false, failure: 'no_active_ward', absorbedDamage: 0, remainingDamage: request.damage, remainingWardHp: 0 };
  }

  const wardHp = getArcaneWardHp(target);
  const absorbedDamage = Math.min(wardHp, request.damage);
  const remainingWardHp = wardHp - absorbedDamage;
  const remainingDamage = request.damage - absorbedDamage;

  const nextTarget: CombatCharacter = { ...target, arcaneWardHp: remainingWardHp };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === target.id ? nextTarget : character
      )),
    },
    resolved: true,
    absorbedDamage,
    remainingDamage,
    remainingWardHp,
  };
}
