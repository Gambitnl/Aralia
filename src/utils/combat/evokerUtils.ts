// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:30:57
 * Dependents: utils/combat/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Evoker (Wizard, School of Evocation) Sculpt Spells and Potent Cantrip.
 *
 * Sculpt Spells lets the wizard exclude up to 1 + spell level visible creatures
 * from an Evocation area; those creatures automatically succeed on their saving
 * throws and take no damage when the spell would otherwise deal half on a save.
 * Potent Cantrip makes a cantrip deal half damage (with no additional effects)
 * when it misses or the target succeeds on its save. This file owns the creature
 * limit, the sculpted-save override, and the cantrip half-damage rule, gated on
 * the `sculpt_spells` and `potent_cantrip` features.
 */

import type { CombatCharacter } from '../../types/combat';

export const SCULPT_SPELLS_FEATURE_ID = 'sculpt_spells';
export const POTENT_CANTRIP_FEATURE_ID = 'potent_cantrip';

export function hasSculptSpells(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === SCULPT_SPELLS_FEATURE_ID);
}

export function hasPotentCantrip(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === POTENT_CANTRIP_FEATURE_ID);
}

// ============================================================================
// Sculpt Spells
// ============================================================================

/** The safe-creature limit is 1 + the spell's level. */
export function calculateSculptSpellsCreatureLimit(spellLevel: number): number {
  return 1 + Math.max(0, Math.floor(spellLevel));
}

/** Selects at most `limit` creature ids from the candidates, in order. */
export function selectSculptedCreatures(candidateIds: string[], limit: number): string[] {
  return candidateIds.slice(0, Math.max(0, limit));
}

export interface SculptedSaveOutcome {
  /** True when the target's saving throw is treated as a success. */
  saveSucceeds: boolean;
  /** True when the target would take half damage on a successful save. */
  takesHalfDamage: boolean;
}

/**
 * Resolves one target's save under Sculpt Spells. A sculpted target always
 * succeeds and takes no half damage; a non-sculpted target uses the base save.
 */
export function resolveSculptedTargetSave(
  character: CombatCharacter,
  sculpted: boolean,
  baseSaveSucceeded: boolean,
  wouldTakeHalfDamageOnSave: boolean,
): SculptedSaveOutcome {
  if (!hasSculptSpells(character) || !sculpted) {
    return {
      saveSucceeds: baseSaveSucceeded,
      takesHalfDamage: baseSaveSucceeded && wouldTakeHalfDamageOnSave,
    };
  }
  return { saveSucceeds: true, takesHalfDamage: false };
}

// ============================================================================
// Potent Cantrip
// ============================================================================

export interface PotentCantripResult {
  damage: number;
  negatesAdditionalEffects: boolean;
}

/**
 * A Potent Cantrip deals half damage (rounded down) when the attack misses or
 * the target succeeds on its save, and applies no additional effects in that
 * case. A full hit, a failed save, or a non-cantrip is unchanged.
 */
export function resolvePotentCantripDamage(
  character: CombatCharacter,
  input: { isCantrip: boolean; fullDamage: number; missedOrSaved: boolean },
): PotentCantripResult {
  const { isCantrip, fullDamage, missedOrSaved } = input;
  if (!hasPotentCantrip(character) || !isCantrip || !missedOrSaved) {
    return { damage: fullDamage, negatesAdditionalEffects: false };
  }
  return { damage: Math.floor(fullDamage / 2), negatesAdditionalEffects: true };
}
