/**
 * Calculates one pre-cast restriction at a time without rolling or publishing.
 * The adapter still owns the roll and delivers each log before the next save;
 * this preserves callback changes to the live roster and stops on the first fail.
 * Receipts deliberately have no ID or clock until their original publish point.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:53:10
 * Dependents: hooks/ability/useAbilityExecution.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatLogEntry } from '../../types/combat';
import type { Spell, SpellcastingRestriction } from '../../types/spells';
import { calculateSpellDC } from '../../utils/character';

export const getSpellcastingRestrictionContext = (caster: CombatCharacter, characters: CombatCharacter[]) => {
  const liveCaster = characters.find(character => character.id === caster.id) ?? caster;
  const restrictions = (liveCaster.statusEffects || [])
    .map(effect => effect.spellcastingRestriction)
    .filter((restriction): restriction is SpellcastingRestriction => Boolean(restriction));
  return { liveCaster, restrictions };
};

export const getSpellcastingRestrictionDC = (
  liveCaster: CombatCharacter, characters: CombatCharacter[], restriction: SpellcastingRestriction
): number => {
  const sourceCaster = restriction.dc === undefined
    ? characters.find(character => character.id === liveCaster.statusEffects?.find(effect => effect.spellcastingRestriction === restriction)?.sourceCasterId)
    : undefined;
  return restriction.dc ?? (sourceCaster ? calculateSpellDC(sourceCaster) : 10);
};

// These existing payload fields are retained locally without opening the shared
// log schema to arbitrary keys. Stored log readers still receive the same fields.
type RestrictionLogDraft = Omit<CombatLogEntry, 'id' | 'timestamp'> & {
  data: NonNullable<CombatLogEntry['data']> & { preCastRestriction: true; castingFailed?: true };
};
export const resolveSpellcastingRestrictionAttempt = (
  liveCaster: CombatCharacter, spell: Spell, restriction: SpellcastingRestriction,
  saveDC: number, saveResult: { success: boolean; total: number }
): { saveLog: RestrictionLogDraft } => {
  const saveLog: RestrictionLogDraft = {
    type: 'status',
    message: `${liveCaster.name} ${saveResult.success ? 'succeeds' : 'fails'} the ${restriction.saveType} save required by ${spell.name} (${saveResult.total} vs DC ${saveDC}).`,
    characterId: liveCaster.id, targetIds: [liveCaster.id],
    data: { spellId: spell.id, preCastRestriction: true, saveSucceeded: saveResult.success, failureOutcome: restriction.failureOutcome }
  };
  return { saveLog };
};

export const getSpellcastingRestrictionFailureMessage = (liveCaster: CombatCharacter, spell: Spell, restriction: SpellcastingRestriction): string =>
  `${spell.name} is wasted because ${liveCaster.name} failed the required ${restriction.saveType} save.`;
