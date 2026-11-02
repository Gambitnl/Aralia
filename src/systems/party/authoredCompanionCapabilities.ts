/** Give an authored person explicit class choices through the existing pure
 * Character Creator assembler. Its generated identity, full HP, loadout, gold
 * and score adjustments are deliberately not adopted: this person already
 * exists. Old saves recover capacity with empty new pools, then ordinary rest
 * determines when that capacity becomes available. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:10:45
 * Dependents: state/reducers/companionReducer.ts, systems/party/restoreAuthoredCompanionBuild.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter, SpellSlots, LimitedUses } from '../../types/character';
import type { Companion } from '../../types/companions';
import { ELARA_CLERIC_BUILD as build } from '../../data/companionBuilds';
import { SKILLS_DATA } from '../../data/skills';
import { initialCharacterCreatorState } from '../character/characterCreatorState';
import { assemblePlayerCharacter } from '../character/characterAssembly';
import { getRulesEdition, type RulesEdition } from '../../config/rulesEdition';

export function authoredCompanionCapabilities(
  character: PlayerCharacter,
  companion: Companion | undefined,
  mode: 'legacy' | 'new-recruit' = 'legacy',
  campaign?: { rulesEdition?: RulesEdition },
): PlayerCharacter {
  if (getRulesEdition(campaign) !== build.rulesEdition || character.authoredCapabilities || !companion || companion.id !== build.companionId
    || character.id !== companion.id || character.class?.id !== 'cleric'
    || companion.identity.class.toLowerCase() !== 'cleric' || character.race.id !== 'human'
    || character.level !== 1 || (character.xp ?? 0) !== 0
    || (mode === 'legacy' && (!companion.inParty || character.retainedNpcBuild?.npcId !== companion.id))
    || character.spellbook || character.skills.length || character.feats?.length
    || character.selectedDivineOrder || Object.keys(character.racialSelections ?? {}).length
    || Object.keys(character.featChoices ?? {}).length) return character;

  const assembled = assemblePlayerCharacter({
    ...initialCharacterCreatorState,
    selectedClass: character.class, selectedRace: character.race,
    baseAbilityScores: character.abilityScores, finalAbilityScores: character.finalAbilityScores,
    characterAge: typeof companion.identity.age === 'number' ? companion.identity.age : 32,
    selectedBackground: companion.identity.background.toLowerCase(),
    selectedSkills: build.classSkillIds.map(id => SKILLS_DATA[id]),
    racialSelections: { human: { skillIds: [build.humanSkillId] } },
    racialFeatId: build.humanFeatId, backgroundFeatId: 'magic_initiate',
    featChoices: { magic_initiate: build.magicInitiate },
    selectedDivineOrder: build.divineOrder,
    selectedCantrips: build.cantripIds.map(id => ({id})),
    selectedSpellsL1: build.preparedSpellIds.map(id => ({id})),
  }, character.name);
  if (!assembled) return character;

  const fresh = mode === 'new-recruit';
  const spellSlots = character.spellSlots ?? (assembled.spellSlots && Object.fromEntries(
    Object.entries(assembled.spellSlots).map(([key, pool]) => [key, { ...pool, current: fresh ? pool.current : 0 }]),
  ) as SpellSlots);
  const limitedUses: LimitedUses = { ...character.limitedUses };
  for (const [key, pool] of Object.entries(assembled.limitedUses ?? {})) {
    limitedUses[key] ??= { ...pool, current: fresh ? pool.current : 0 };
  }
  // Copy capabilities only. Existing wounds, scores, worn gear, conditions,
  // inventory ownership and all unrelated runtime fields remain authoritative.
  return { ...character,
    class: assembled.class, skills: assembled.skills,
    toolProficiencies: assembled.toolProficiencies,
    selectedDivineOrder: assembled.selectedDivineOrder,
    racialSelections: assembled.racialSelections,
    feats: assembled.feats, featChoices: assembled.featChoices,
    modifiers: { advantage: [], disadvantage: [], bonuses: [], ...assembled.modifiers, ...character.modifiers },
    spellbook: assembled.spellbook, spellcastingAbility: assembled.spellcastingAbility,
    spellSlots, limitedUses,
    authoredCapabilities: { version: 1, profileId: build.id },
  };
}
