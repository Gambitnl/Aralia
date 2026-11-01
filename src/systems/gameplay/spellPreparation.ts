/**
 * Expedition spell choices are saved intentions until an eligible long rest.
 * The active list remains authoritative for casting while the plan is edited.
 * Existing class lists, learned wizard spells, slots and racial grants remain
 * the source of eligibility; browsing a spell never teaches it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 13:51:52
 * Dependents: components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/ui/LongRestModal.tsx, hooks/actions/handleResourceActions.ts, state/reducers/characterReducer.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter, SpellPreparationPlan } from '../../types/character';
import type { RulesEdition } from '../../config/rulesEdition';
import { CLASSES_DATA } from '../../data/classes';
import { getMaxPreparedSpells } from '../../utils/character/getMaxPreparedSpells';
import { getPreparedSpellsAffectingLimit, isRacialSpellLockedForPreparation } from '../../utils/character/stats';
import { spellSlotsForClassLevel } from '../character/spellSlotProgression';

const DAILY_CLASSES = ['cleric', 'druid', 'wizard', 'paladin', 'artificer'];
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));

export function usesRestPreparation(character: PlayerCharacter, edition: RulesEdition): boolean {
  return DAILY_CLASSES.includes(character.class.id.toLowerCase())
    || (edition === '2024' && character.class.id.toLowerCase() === 'ranger');
}

export function preparationSpellError(character: PlayerCharacter, spellId: string,
  spellLevel: number | undefined, edition: RulesEdition): string | null {
  if (!usesRestPreparation(character, edition)) return 'This class changes its spells when gaining a level, not by resting.';
  if (!Number.isInteger(spellLevel) || !spellLevel || spellLevel < 1 || spellLevel > 9) return 'Only verified leveled spells can be planned.';
  const classId = character.class.id.toLowerCase();
  const level = character.classLevels?.[classId] ?? character.level ?? 1;
  if (edition === '2014' && classId === 'paladin' && level < 2) return 'A 2014 Paladin gains Spellcasting at level 2.';
  const classSlots = spellSlotsForClassLevel(classId, level);
  if (!(classSlots?.[`level_${spellLevel}` as keyof typeof classSlots]?.max)
    || !(character.spellSlots?.[`level_${spellLevel}` as keyof NonNullable<PlayerCharacter['spellSlots']>]?.max)) {
    return 'This spell is above the levels available to this class.';
  }
  if (classId === 'wizard') {
    if (!character.spellbook?.knownSpells.includes(spellId)) return 'A wizard must first learn this spell in the spellbook.';
  } else if (!CLASSES_DATA[classId]?.spellcasting?.spellList.includes(spellId)) return 'This spell is not on this class list.';
  return null;
}

function locked(character: PlayerCharacter, id: string): boolean {
  return isRacialSpellLockedForPreparation(character, id)
    || (character.class.id === 'druid' && id === 'speak-with-animals');
}

/** Incomplete replacement drafts are editable, but never become active. */
export function preparationPlanError(character: PlayerCharacter, plan: SpellPreparationPlan,
  edition: RulesEdition, complete = true): string | null {
  if (!character.spellbook || !usesRestPreparation(character, edition)) return 'This class cannot prepare a daily spell list.';
  if (plan.rulesEdition !== edition || !sameList(plan.basePreparedSpells, character.spellbook.preparedSpells)) return 'The active spells or campaign rules changed. Reset this plan before choosing again.';
  if (new Set(plan.preparedSpells).size !== plan.preparedSpells.length) return 'The planned list contains duplicate spells.';
  if (plan.basePreparedSpells.some(id => locked(character, id) && !plan.preparedSpells.includes(id))) return 'Always-prepared spells cannot be removed.';
  // Preserve retained legacy and feature spells. Only new choices need a class
  // source check; a new feature is not silently erased by opening the sheet.
  for (const id of plan.preparedSpells.filter(id => !plan.basePreparedSpells.includes(id))) {
    const error = preparationSpellError(character, id, plan.spellLevels[id], edition);
    if (error) return error;
  }
  const plannedCharacter = {...character, spellbook: {...character.spellbook, preparedSpells: plan.preparedSpells}};
  const max = getMaxPreparedSpells(character, edition);
  const count = getPreparedSpellsAffectingLimit(plannedCharacter).size;
  if (max === null || count > max) return 'The planned list exceeds your preparation limit.';
  if (edition === '2014' && [...getPreparedSpellsAffectingLimit(plannedCharacter)].some(id => !Number.isInteger(plan.spellLevels[id]) || plan.spellLevels[id] < 1)) {
    return 'Spell levels must be verified before prayer or study time can be calculated.';
  }
  if (edition === '2024' && ['paladin', 'ranger'].includes(character.class.id.toLowerCase())) {
    const removed = plan.basePreparedSpells.filter(id => !plan.preparedSpells.includes(id)).length;
    const added = plan.preparedSpells.filter(id => !plan.basePreparedSpells.includes(id)).length;
    const openPlaces = Math.max(0, max - getPreparedSpellsAffectingLimit(character).size);
    if (removed > 1 || added > removed + openPlaces) return 'You can replace only one spell after each long rest.';
    if (complete && removed > added) return 'Choose the replacement spell before resting; your active list is unchanged.';
  }
  return null;
}

export function togglePreparationPlan(character: PlayerCharacter, spellId: string,
  spellLevels: Record<string, number>, edition: RulesEdition, reset = false): {character: PlayerCharacter; error?: string} {
  if (!character.spellbook) return {character, error: 'No spellbook is available.'};
  if (reset) {
    const {preparationPlan: _old, ...spellbook} = character.spellbook;
    return {character: {...character, spellbook}};
  }
  const existing = character.spellbook.preparationPlan;
  const plan: SpellPreparationPlan = existing
    ? {...existing, preparedSpells: [...existing.preparedSpells], spellLevels: {...existing.spellLevels, ...spellLevels}}
    : {basePreparedSpells: [...character.spellbook.preparedSpells], preparedSpells: [...character.spellbook.preparedSpells], spellLevels, rulesEdition: edition};
  if (locked(character, spellId)) return {character, error: 'This spell is always prepared.'};
  if (plan.preparedSpells.includes(spellId)) plan.preparedSpells = plan.preparedSpells.filter(id => id !== spellId);
  else {
    const error = preparationSpellError(character, spellId, spellLevels[spellId], edition);
    if (error) return {character, error};
    plan.preparedSpells.push(spellId);
  }
  // Persist only relevant source levels, not a second copy of the spell registry.
  plan.spellLevels = Object.fromEntries([...new Set([...plan.basePreparedSpells, ...plan.preparedSpells])]
    .filter(id => plan.spellLevels[id] !== undefined).map(id => [id, plan.spellLevels[id]]));
  const error = preparationPlanError(character, plan, edition, false);
  if (error) return {character, error};
  const {preparationPlan: _old, ...spellbook} = character.spellbook;
  return {character: {...character, spellbook: {...spellbook,
    ...(sameList(plan.preparedSpells, plan.basePreparedSpells) ? {} : {preparationPlan: plan})}}};
}

/** 2014 prayer/study is explicit additional time after the eight-hour rest. */
export function preparationMinutes(character: PlayerCharacter, edition: RulesEdition): number {
  const plan = character.spellbook?.preparationPlan;
  if (!plan || preparationPlanError(character, plan, edition)) return 0;
  const plannedCharacter = {...character, spellbook: {...character.spellbook!, preparedSpells: plan.preparedSpells}};
  return edition === '2014' ? [...getPreparedSpellsAffectingLimit(plannedCharacter)].reduce((sum, id) => sum + plan.spellLevels[id], 0) : 0;
}

export function completePreparation(character: PlayerCharacter, edition: RulesEdition): PlayerCharacter {
  const plan = character.spellbook?.preparationPlan;
  if (!plan || !character.spellbook || preparationPlanError(character, plan, edition)) return character;
  const {preparationPlan: _old, ...spellbook} = character.spellbook;
  return {...character, spellbook: {...spellbook, preparedSpells: [...plan.preparedSpells]}};
}
