// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:43:40
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
 * Life Domain (Cleric) Disciple of Life and Domain Spells.
 *
 * Disciple of Life makes every 1st-level-or-higher healing spell restore an
 * extra 2 + spell level hit points. This file owns that bonus as a pure,
 * subclass-gated transaction the healing command can call, and lists the
 * always-prepared Life Domain spells so the prepared-spell path has one source.
 */

import type { CombatCharacter } from '../../types/combat';

export const DISCIPLE_OF_LIFE_ABILITY_ID = 'disciple_of_life';
export const DISCIPLE_OF_LIFE_BASE_BONUS = 2;

// ============================================================================
// Disciple Of Life
// ============================================================================
// The subclass identity lives on a `disciple_of_life` ability in combat builds
// (the runtime does not carry a `subclassId` field). The bonus applies only to
// 1st-level-or-higher spells, matching the canonical contract, and never invents
// a total — it only adds the authored 2 + spell level on top of rolled healing.
// ============================================================================

export function isLifeDomainCaster(caster: CombatCharacter): boolean {
  return caster.abilities.some(ability => ability.id === DISCIPLE_OF_LIFE_ABILITY_ID);
}

export function calculateDiscipleOfLifeBonus(spellLevel: number): number {
  return DISCIPLE_OF_LIFE_BASE_BONUS + Math.max(0, spellLevel);
}

export function applyDiscipleOfLifeHealing(
  caster: CombatCharacter,
  healingAmount: number,
  spellLevel: number,
): number {
  if (!isLifeDomainCaster(caster) || spellLevel < 1) {
    return healingAmount;
  }
  return healingAmount + calculateDiscipleOfLifeBonus(spellLevel);
}

// ============================================================================
// Domain Spells (always prepared)
// ============================================================================
// The Life Domain prepares Bless, Cure Wounds, and other life spells without
// counting against the cleric's prepared total. This list is the canonical
// source; `mergeLifeDomainPreparedSpells` dedupes them into an existing list.
// ============================================================================

export const LIFE_DOMAIN_SPELL_IDS = [
  'bless',
  'cure_wounds',
  'lesser_restoration',
  'aid',
  'revivify',
  'mass_healing_word',
  'death_ward',
];

export function mergeLifeDomainPreparedSpells(preparedSpells: string[]): string[] {
  const merged = new Set(preparedSpells);
  for (const id of LIFE_DOMAIN_SPELL_IDS) {
    merged.add(id);
  }
  return Array.from(merged);
}
