// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:35:51
 * Dependents: utils/combat/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * College of Lore (Bard) Cutting Words and Bonus Proficiencies.
 *
 * Cutting Words spends a Reaction and one Bardic Inspiration die to subtract a
 * d6 from an enemy's attack roll, ability check, or damage roll. This file owns
 * that transaction — resource debit, reaction payment, deterministic subtraction,
 * and target-result — so the combat runtime does not need a preview-only roll.
 * Bonus Proficiencies is the subclass's three-skill choice, applied through the
 * shared skill registry so the persisted state is the same `Skill` records the
 * rest of the character sheet already reads.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import type { Skill } from '../../types/core';
import { SKILLS_DATA } from '../../data/skills';
import { rollDice } from './combatUtils';

export const BARDIC_INSPIRATION_KEY = 'bardic_inspiration';
export const CUTTING_WORDS_ABILITY_ID = 'cutting_words';
// A level-3 College of Lore bard uses a d6 Bardic Inspiration die.
export const CUTTING_WORDS_DIE = '1d6';

export type CuttingWordsRollType = 'attack' | 'check' | 'damage';

export type CuttingWordsFailure =
  | 'bard_missing'
  | 'not_college_of_lore'
  | 'reaction_unavailable'
  | 'no_bardic_inspiration';

export interface CuttingWordsResult {
  state: CombatState;
  resolved: boolean;
  failure?: CuttingWordsFailure;
  dieRolled?: number;
  subtractedValue?: number;
  newRollValue?: number;
}

// ============================================================================
// Eligibility
// ============================================================================
// Cutting Words is a subclass feature, so the combat build must have granted the
// button. It then needs an unspent Reaction and at least one Bardic Inspiration
// die. This mirrors the same gate the executor will apply before payment.
// ============================================================================

export function canUseCuttingWords(bard: CombatCharacter): boolean {
  if (bard.actionEconomy.reaction.used) return false;
  const pool = bard.limitedUses?.[BARDIC_INSPIRATION_KEY];
  if (!pool || (typeof pool.current === 'number' && pool.current <= 0)) return false;
  return bard.abilities.some(ability => ability.id === CUTTING_WORDS_ABILITY_ID);
}

// ============================================================================
// Cutting Words Transaction
// ============================================================================
// One reaction + one Bardic Inspiration die produce one d6 roll subtracted from
// the target's roll. The resource and Reaction are paid only after eligibility is
// confirmed, so a failed reaction or an exhausted pool never spends either.
// ============================================================================

export function resolveCuttingWords(
  state: CombatState,
  request: {
    bardId: string;
    rollType: CuttingWordsRollType;
    rollValue: number;
    rng?: () => number;
  },
): CuttingWordsResult {
  const bard = state.characters.find(character => character.id === request.bardId);
  if (!bard) {
    return { state, resolved: false, failure: 'bard_missing' };
  }

  if (!bard.abilities.some(ability => ability.id === CUTTING_WORDS_ABILITY_ID)) {
    return { state, resolved: false, failure: 'not_college_of_lore' };
  }

  if (bard.actionEconomy.reaction.used) {
    return { state, resolved: false, failure: 'reaction_unavailable' };
  }

  const pool = bard.limitedUses?.[BARDIC_INSPIRATION_KEY];
  if (!pool || (typeof pool.current === 'number' && pool.current <= 0)) {
    return { state, resolved: false, failure: 'no_bardic_inspiration' };
  }

  const remaining = typeof pool.current === 'number' ? Math.max(0, pool.current - 1) : 0;
  const nextUses: LimitedUses = {
    ...(bard.limitedUses ?? {}),
    [BARDIC_INSPIRATION_KEY]: { ...pool, current: remaining },
  };
  const nextBard: CombatCharacter = {
    ...bard,
    limitedUses: nextUses,
    actionEconomy: {
      ...bard.actionEconomy,
      reaction: { ...bard.actionEconomy.reaction, used: true, remaining: 0 },
    },
  };

  const dieRolled = rollDice(CUTTING_WORDS_DIE, { rng: request.rng });

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === bard.id ? nextBard : character
      )),
    },
    resolved: true,
    dieRolled,
    subtractedValue: dieRolled,
    newRollValue: request.rollValue - dieRolled,
  };
}

// ============================================================================
// Bonus Proficiencies (three-skill choice)
// ============================================================================
// The subclass lets the bard choose three skills. This merges up to three chosen
// ids into the existing skill list through the shared registry, reporting which
// ids applied and which were rejected (unknown id). Deduping preserves prior
// selections instead of duplicating a skill the character already knew.
// ============================================================================

export interface LoreBonusProficienciesResult {
  skills: Skill[];
  applied: string[];
  rejected: string[];
}

export function applyLoreBonusProficiencies(
  skills: Skill[],
  chosenSkillIds: string[],
): LoreBonusProficienciesResult {
  const merged = new Map(skills.map(skill => [skill.id, skill]));
  const applied: string[] = [];
  const rejected: string[] = [];

  for (const id of chosenSkillIds) {
    // The three-skill cap counts only successfully applied skills, so an
    // invalid id does not silently consume one of the three choice slots.
    if (applied.length >= 3) break;
    const skill = SKILLS_DATA[id];
    if (!skill) {
      rejected.push(id);
      continue;
    }
    merged.set(id, skill);
    applied.push(id);
  }

  return {
    skills: Array.from(merged.values()),
    applied,
    rejected,
  };
}
