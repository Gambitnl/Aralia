// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/06/2026, 20:43:21
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/CharacterCreator/hooks/useCharacterAssembly.ts
 * Custom hook for character assembly logic during creation.
 */
import { useCallback } from 'react';
import {
  PlayerCharacter,
  Race,
  Class as CharClass,
  AbilityScores,
  Skill,
  SpellbookData,
  SpellSlots,
  LimitedUses,
  Item,
} from '../../../types';
import { RACES_DATA, TIEFLING_LEGACIES } from '../../../constants';
import { SKILLS_DATA } from '../../../data/skills';
import { BACKGROUNDS } from '../../../data/backgrounds';
import { getRacialSpellCastingAbilityChoicesForRace } from '../../../data/races';
import { calculateArmorClass } from '../../../utils/character/statUtils';
import { buildStartingLoadout } from '../../../systems/character/buildStartingLoadout';
import { spellSlotsForClassLevel } from '../../../systems/character/spellSlotProgression';
import { CharacterCreationState } from '../state/characterCreatorState';
import {
  getAbilityModifierValue,
  applyAllFeats,
  buildHitPointDicePools,
  applyRacialSpellGrantsByLevel,
  getRacialSpellAbilityFromSelection,
} from '../../../utils/characterUtils';

// --- Helper Functions for Character Assembly ---

type AgeSizeOverride = NonNullable<PlayerCharacter['ageSizeOverride']>;

interface AgeCategory {
  max: number;
  statPenalty: number;
  sizeModifier?: AgeSizeOverride;
}

interface AgeData {
  categories: {
    child: AgeCategory;
    adolescent: AgeCategory;
    adult: AgeCategory;
    middleAged: AgeCategory;
    elderly: AgeCategory;
  };
}

export function assembleSelectedFeats(state: CharacterCreationState): string[] {
  const ids = [state.backgroundFeatId, state.racialFeatId].filter((id): id is string => !!id);
  // Defense-in-depth: a character can never legitimately hold the same feat twice.
  // The creation UI already prevents picking a feat in both the origin and racial
  // slots, but dedupe here so no assembly path can produce an invalid character.
  return [...new Set(ids)];
}

// Age ranges and categories for different races (mechanical effects)
const getAgeDataForAssembly = (raceId: string): AgeData => {
  switch (raceId) {
    case 'human':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 50, statPenalty: 0 },
          middleAged: { max: 70, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'elf':
    case 'eladrin':
      return {
        categories: {
          child: { max: 80, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 99, statPenalty: -1 },
          adult: { max: 400, statPenalty: 0 },
          middleAged: { max: 600, statPenalty: -1 },
          elderly: { max: 800, statPenalty: -2 }
        }
      };
    case 'dwarf':
    case 'duergar':
      return {
        categories: {
          child: { max: 35, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 49, statPenalty: -1 },
          adult: { max: 200, statPenalty: 0 },
          middleAged: { max: 300, statPenalty: -1 },
          elderly: { max: 400, statPenalty: -2 }
        }
      };
    case 'halfling':
      return {
        categories: {
          child: { max: 15, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 19, statPenalty: -1 },
          adult: { max: 80, statPenalty: 0 },
          middleAged: { max: 120, statPenalty: -1 },
          elderly: { max: 160, statPenalty: -2 }
        }
      };
    case 'gnome':
      return {
        categories: {
          child: { max: 30, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 39, statPenalty: -1 },
          adult: { max: 275, statPenalty: 0 },
          middleAged: { max: 400, statPenalty: -1 },
          elderly: { max: 550, statPenalty: -2 }
        }
      };
    case 'dragonborn':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'orc':
      return {
        categories: {
          child: { max: 9, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 11, statPenalty: -1 },
          adult: { max: 30, statPenalty: 0 },
          middleAged: { max: 40, statPenalty: -1 },
          elderly: { max: 55, statPenalty: -2 }
        }
      };
    case 'tiefling':
    case 'aasimar':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'air_genasi':
    case 'earth_genasi':
    case 'fire_genasi':
    case 'water_genasi':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 65, statPenalty: 0 },
          middleAged: { max: 95, statPenalty: -1 },
          elderly: { max: 130, statPenalty: -2 }
        }
      };
    case 'goliath':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'firbolg':
      return {
        categories: {
          child: { max: 25, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 29, statPenalty: -1 },
          adult: { max: 275, statPenalty: 0 },
          middleAged: { max: 400, statPenalty: -1 },
          elderly: { max: 550, statPenalty: -2 }
        }
      };
    case 'bugbear':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 15, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'goblin':
      return {
        categories: {
          child: { max: 6, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 7, statPenalty: -1 },
          adult: { max: 35, statPenalty: 0 },
          middleAged: { max: 50, statPenalty: -1 },
          elderly: { max: 65, statPenalty: -2 }
        }
      };
    case 'githyanki':
    case 'githzerai':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'aarakocra':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 20, statPenalty: 0 },
          middleAged: { max: 25, statPenalty: -1 },
          elderly: { max: 35, statPenalty: -2 }
        }
      };
    case 'centaur':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Large', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'fairy':
      return {
        categories: {
          child: { max: 50, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 99, statPenalty: -1 },
          adult: { max: 550, statPenalty: 0 },
          middleAged: { max: 800, statPenalty: -1 },
          elderly: { max: 1100, statPenalty: -2 }
        }
      };
    case 'changeling':
      return {
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    default:
      return {
        categories: {
          child: { max: 12, statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
  }
};

const getAgeCategoryForAssembly = (age: number, ageData: AgeData): AgeCategory => {
  if (age <= ageData.categories.child.max) return ageData.categories.child;
  if (age <= ageData.categories.adolescent.max) return ageData.categories.adolescent;
  if (age <= ageData.categories.adult.max) return ageData.categories.adult;
  if (age <= ageData.categories.middleAged.max) return ageData.categories.middleAged;
  return ageData.categories.elderly;
};

/** Human-readable label for the age band a character falls into. */
export type AgeBandLabel = 'Child' | 'Adolescent' | 'Adult' | 'Middle-aged' | 'Elderly';

export interface AgeAdjustmentSummary {
  /** The age band the character falls into. */
  band: AgeBandLabel;
  /** Flat modifier applied to every ability score (negative = penalty). */
  statPenalty: number;
  /** Size override the age band imposes, if any (e.g. children render Small). */
  sizeModifier?: AgeSizeOverride;
}

/**
 * Resolve how a character's age modifies their stats/size, so the review sheet
 * can EXPLAIN the age-adjusted ability scores instead of silently showing
 * numbers that differ from the pre-age sidebar values (GAPS.md C10). Returns
 * null when age has no mechanical effect (the Adult band).
 */
export const getAgeAdjustmentSummary = (raceId: string, age: number): AgeAdjustmentSummary | null => {
  if (!age || age <= 0) return null;
  const ageData = getAgeDataForAssembly(raceId);
  const categories = ageData.categories;
  let band: AgeBandLabel;
  let category: AgeCategory;
  if (age <= categories.child.max) { band = 'Child'; category = categories.child; }
  else if (age <= categories.adolescent.max) { band = 'Adolescent'; category = categories.adolescent; }
  else if (age <= categories.adult.max) { band = 'Adult'; category = categories.adult; }
  else if (age <= categories.middleAged.max) { band = 'Middle-aged'; category = categories.middleAged; }
  else { band = 'Elderly'; category = categories.elderly; }

  if (category.statPenalty === 0 && !category.sizeModifier) return null;
  return { band, statPenalty: category.statPenalty, sizeModifier: category.sizeModifier };
};

function validateAllSelectionsMade(state: CharacterCreationState): boolean {
  const {
    selectedRace, selectedClass, finalAbilityScores, baseAbilityScores,
    racialSelections, selectedFightingStyle, selectedDivineOrder,
    selectedWeaponMasteries,
  } = state;

  if (!selectedRace || !selectedClass || !finalAbilityScores || !baseAbilityScores) return false;

  // Check race-specific selections that have their own step
  if (selectedRace.id === 'dragonborn' && !racialSelections['dragonborn']?.choiceId) return false;
  if (selectedRace.id === 'gnome' && (!racialSelections['gnome']?.choiceId || !racialSelections['gnome']?.spellAbility)) return false;
  if (selectedRace.id === 'centaur' && !racialSelections['centaur']?.skillIds?.[0]) return false;
  if (selectedRace.id === 'changeling' && (!racialSelections['changeling']?.skillIds || racialSelections['changeling'].skillIds.length !== 2)) return false;

  // Check consolidated racial spell ability choices for races that have them
  if (getRacialSpellCastingAbilityChoicesForRace(selectedRace.id).length > 0 && !racialSelections[selectedRace.id]?.spellAbility) return false;

  // Check human skill
  if (selectedRace.id === 'human' && !racialSelections['human']?.skillIds?.[0]) return false;

  // Check class-specific selections
  if (selectedClass.id === 'cleric' && !selectedDivineOrder) return false;
  if (selectedClass.id === 'fighter' && !selectedFightingStyle) return false;

  if (selectedClass.spellcasting && (selectedClass.id === 'ranger' || selectedClass.id === 'paladin')) {
    if (state.selectedSpellsL1.length !== selectedClass.spellcasting.knownSpellsL1) return false;
    if (state.selectedCantrips.length > 0 && selectedClass.id === 'ranger') return false;
  }

  if (selectedClass.weaponMasterySlots && (!selectedWeaponMasteries || selectedWeaponMasteries.length !== selectedClass.weaponMasterySlots)) return false;

  return true;
}

function calculateCharacterMaxHp(charClass: CharClass, finalScores: AbilityScores, race: Race): number {
  const conMod = getAbilityModifierValue(finalScores.Constitution);
  let hp = charClass.hitDie + conMod;
  if (race.id === 'dwarf' || race.id === 'duergar') {
    hp += 1;
  }
  return hp;
}

function calculateCharacterSpeed(race: Race, lineageId?: string): number {
  let speed = 30;
  const speedTrait = race.traits.find(t => t.toLowerCase().startsWith('speed:'));
  if (speedTrait) {
    const match = speedTrait.match(/(\d+)/);
    if (match) speed = parseInt(match[1], 10);
  }
  if (race.id === 'elf' && lineageId === 'wood_elf') {
    speed += 5;
  }
  return speed;
}
function calculateCharacterDarkvision(race: Race, lineageId?: string): number {
  let range = 0;
  const dvTrait = race.traits.find(t => t.toLowerCase().includes('darkvision'));
  if (dvTrait) {
    const match = dvTrait.match(/(\d+)/);
    if (match) range = parseInt(match[1], 10);
  }
  if ((race.id === 'elf' && lineageId === 'drow') || race.id === 'duergar' || race.id === 'dwarf' || race.id === 'orc') {
    range = Math.max(range, 120);
  }
  return range;
}

function assembleCastingProperties(state: CharacterCreationState): {
  spellbook?: SpellbookData;
  spellSlots?: SpellSlots;
  spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma';
  limitedUses?: LimitedUses;
} {
  const { selectedClass, selectedCantrips, selectedSpellsL1, selectedRace, racialSelections } = state;
  if (!selectedClass) return { limitedUses: {} };

  const limitedUses: LimitedUses = {};
  if (selectedClass.id === 'fighter') {
    limitedUses['second_wind'] = { name: 'Second Wind', current: 1, max: 1, resetOn: 'short_rest' };
  }
  if (selectedClass.id === 'paladin') {
    limitedUses['lay_on_hands'] = { name: 'Lay on Hands', current: 5, max: 5, resetOn: 'long_rest' };
  }

  if (!selectedClass.spellcasting) {
    return { limitedUses };
  }

  const classAbility = selectedClass.spellcasting.ability.toLowerCase() as 'intelligence' | 'wisdom' | 'charisma';

  const cantripIds = new Set<string>(selectedCantrips.map(s => s.id));
  const spellIds = new Set<string>(selectedSpellsL1.map(s => s.id));

  if (selectedClass.id === 'druid') {
    spellIds.add('speak-with-animals');
  }

  if (selectedRace) {
    if (selectedRace.id === 'aasimar') cantripIds.add('light');
    const elvenLineageId = racialSelections?.['elf']?.choiceId;
    if (selectedRace.id === 'elf' && elvenLineageId) {
      const lineage = RACES_DATA['elf']?.elvenLineages?.find(l => l.id === elvenLineageId);
      lineage?.benefits.forEach(b => {
        if (b.cantripId) cantripIds.add(b.cantripId);
        if (b.spellId) spellIds.add(b.spellId);
      });
    }
    const fiendishLegacyId = racialSelections?.['tiefling']?.choiceId;
    if (selectedRace.id === 'tiefling' && fiendishLegacyId) {
      const legacy = TIEFLING_LEGACIES.find(fl => fl.id === fiendishLegacyId);
      if (legacy) {
        cantripIds.add(legacy.level1Benefit.cantripId);
        cantripIds.add('thaumaturgy');
        spellIds.add(legacy.level3SpellId);
        spellIds.add(legacy.level5SpellId);
      }
    }
    // Generic racial spell selection (Cantrips)
    const racialSpellIds = racialSelections?.[selectedRace.id]?.selectedSpellIds ?? [];
    racialSpellIds.forEach(id => cantripIds.add(id));
  }

  let knownSpells: string[] = [];
  let preparedSpells: string[] = [];

  const knownCasterIds = ['bard', 'sorcerer', 'warlock', 'ranger'];
  if (knownCasterIds.includes(selectedClass.id)) {
    // Known casters only know the spells they selected, and all are ready to cast.
    knownSpells = Array.from(spellIds);
    preparedSpells = Array.from(spellIds);
  } else if (selectedClass.id === 'wizard') {
    // Wizards "know" the spells in their spellbook (the ones they selected).
    // The wizard prepares a subset of them (INT mod + level). Since we don't ask
    // them to pick which ones to prepare in the creator yet, we just auto-prepare
    // up to their limit.
    knownSpells = Array.from(spellIds);
    const { finalAbilityScores } = state;
    let prepLimit = spellIds.size; // Default to all
    if (finalAbilityScores) {
      const intMod = Math.floor((finalAbilityScores.Intelligence - 10) / 2);
      prepLimit = Math.max(1, intMod + 1); // Wizard level is 1
    }
    preparedSpells = Array.from(spellIds).slice(0, prepLimit);
  } else {
    // Prepared casters (Cleric, Druid, Paladin, Artificer) have access to their whole
    // spell list, and prepare a specific subset. The assembled character only
    // carries the selected spells so the creator does not overstate what the
    // player actually picked.
    knownSpells = Array.from(spellIds);
    preparedSpells = Array.from(spellIds);
  }

  const spellbook: SpellbookData = {
    cantrips: Array.from(cantripIds),
    preparedSpells: preparedSpells,
    knownSpells: knownSpells,
  };

  const selectedRaceSpellAbility = selectedRace
    ? getRacialSpellAbilityFromSelection(selectedRace.id, racialSelections)?.toLowerCase() as
      | 'intelligence'
      | 'wisdom'
      | 'charisma'
      | undefined
    : undefined;

  // Spell slots come from the canonical progression table (level 1 at creation),
  // so they match what the character will grow into on level-up.
  const spellSlots: SpellSlots | undefined = spellSlotsForClassLevel(selectedClass.id, 1);

  return { spellbook, spellSlots, spellcastingAbility: classAbility ?? selectedRaceSpellAbility, limitedUses };
}


function assembleFinalSkills(state: CharacterCreationState): Skill[] {
  const { selectedRace, selectedSkills, racialSelections, selectedBackground } = state;
  const BUGBEAR_AUTO_SKILL_ID = 'stealth';
  const finalSkillsList: Skill[] = [...selectedSkills];

  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  if (selectedRace?.id === 'human' && humanSkillId) {
    const skill = SKILLS_DATA[humanSkillId];
    if (skill) finalSkillsList.push(skill);
  }
  if (selectedRace?.id === 'bugbear') {
    const stealthSkill = SKILLS_DATA[BUGBEAR_AUTO_SKILL_ID];
    if (stealthSkill) finalSkillsList.push(stealthSkill);
  }
  
  // Generic racial skill selection
  if (selectedRace) {
    const currentRaceSkillIds = racialSelections[selectedRace.id]?.skillIds ?? [];
    currentRaceSkillIds.forEach(skillId => {
      // Avoid duplicates
      if (!finalSkillsList.some(s => s.id === skillId)) {
        const skill = SKILLS_DATA[skillId];
        if (skill) finalSkillsList.push(skill);
      }
    });
  }

  // Add background skill proficiencies
  if (selectedBackground && BACKGROUNDS[selectedBackground]) {
    const background = BACKGROUNDS[selectedBackground];
    background.skillProficiencies.forEach(skillId => {
      const skill = SKILLS_DATA[skillId];
      if (skill && !finalSkillsList.some(s => s.id === skillId)) finalSkillsList.push(skill);
    });
  }

  return [...new Set(finalSkillsList.map(s => s.id))].map(id => finalSkillsList.find(s => s.id === id)!).filter(Boolean);
}

function assembleFinalTools(state: CharacterCreationState): string[] {
  const { selectedRace, racialSelections } = state;
  const tools: string[] = [];

  if (selectedRace) {
    const racialToolIds = racialSelections[selectedRace.id]?.toolIds ?? [];
    tools.push(...racialToolIds);
  }

  return tools;
}


/**
 * Pure character assembly — builds a PlayerCharacter from a completed creator
 * state. Exported so non-React callers (e.g. the premade-character generator
 * script) can assemble characters through the exact same pipeline the
 * creator's review step uses.
 */
export function assemblePlayerCharacter(currentState: CharacterCreationState, currentName: string): PlayerCharacter | null {
    const { selectedRace, selectedClass, finalAbilityScores, baseAbilityScores, racialSelections } = currentState;
    if (!validateAllSelectionsMade(currentState) || !selectedRace || !selectedClass || !finalAbilityScores || !baseAbilityScores) {
      console.error("Missing critical data for review step. Cannot generate preview.", currentState);
      return null;
    }

    const finalClass = { ...selectedClass };
    if (currentState.selectedDivineOrder === 'Protector') {
      finalClass.armorProficiencies = [...new Set([...finalClass.armorProficiencies, 'Heavy armor'])];
      finalClass.weaponProficiencies = [...new Set([...finalClass.weaponProficiencies, 'Martial weapons'])];
    }

    const castingProperties = assembleCastingProperties(currentState);

    // Seed class levels for Hit Dice pools (single-class at creation).
    const classLevels = { [finalClass.id]: 1 };
    let assembledCharacter: PlayerCharacter = {
      id: `${Date.now()}-${(currentName || "char").replace(/\s+/g, '-')}`,
      name: currentName || "Adventurer",
      age: currentState.characterAge,
      background: currentState.selectedBackground || undefined,
      level: 1,
      xp: 0,
      proficiencyBonus: 2,
      race: selectedRace,
      class: finalClass,
      classLevels,
      abilityScores: baseAbilityScores,
      finalAbilityScores,
      skills: assembleFinalSkills(currentState),
      toolProficiencies: assembleFinalTools(currentState),
      hp: calculateCharacterMaxHp(selectedClass, finalAbilityScores, selectedRace),
      maxHp: calculateCharacterMaxHp(selectedClass, finalAbilityScores, selectedRace),
      // Hit Dice pools are computed after assembly to include class levels.
      hitPointDice: undefined,
      armorClass: 10 + getAbilityModifierValue(finalAbilityScores.Dexterity),
      speed: calculateCharacterSpeed(selectedRace, racialSelections['elf']?.choiceId as 'drow' | 'high_elf' | 'wood_elf' | undefined),
      darkvisionRange: calculateCharacterDarkvision(selectedRace, racialSelections['elf']?.choiceId as 'drow' | 'high_elf' | 'wood_elf' | undefined),
      transportMode: 'foot',
      selectedWeaponMasteries: currentState.selectedWeaponMasteries || [],
      feats: assembleSelectedFeats(currentState),
      featChoices: (currentState.featChoices as unknown as Record<string, import('../../../types/character').FeatChoice>) || {},
      equippedItems: {},
      statusEffects: [],
      ...castingProperties,
      selectedFightingStyle: currentState.selectedFightingStyle || undefined,
      selectedDivineOrder: currentState.selectedDivineOrder || undefined,
      selectedDruidOrder: currentState.selectedDruidOrder || undefined,
      selectedWarlockPatron: currentState.selectedWarlockPatron || undefined,
      racialSelections: currentState.racialSelections,
      visuals: currentState.visuals,
      visualDescription: currentState.visualDescription || undefined,
      portraitUrl: currentState.portrait.url || undefined,
    };
    assembledCharacter.hitPointDice = buildHitPointDicePools(assembledCharacter, { classLevels });

    // Apply age-based modifications
    if (currentState.characterAge) {
      const ageData = getAgeDataForAssembly(selectedRace.id);
      const ageCategory = getAgeCategoryForAssembly(currentState.characterAge, ageData);

      if (ageCategory.statPenalty !== 0) {
        // Apply stat penalty to all ability scores
        const modifiedAbilityScores = { ...assembledCharacter.abilityScores };
        const modifiedFinalAbilityScores = { ...assembledCharacter.finalAbilityScores };

        (Object.keys(modifiedAbilityScores) as Array<keyof typeof modifiedAbilityScores>).forEach(key => {
          modifiedAbilityScores[key] = Math.max(1, modifiedAbilityScores[key] + ageCategory.statPenalty);
          modifiedFinalAbilityScores[key] = Math.max(1, modifiedFinalAbilityScores[key] + ageCategory.statPenalty);
        });

        assembledCharacter.abilityScores = modifiedAbilityScores;
        assembledCharacter.finalAbilityScores = modifiedFinalAbilityScores;

        // Recalculate HP with modified stats
        assembledCharacter.hp = calculateCharacterMaxHp(selectedClass, modifiedFinalAbilityScores, selectedRace);
        assembledCharacter.maxHp = calculateCharacterMaxHp(selectedClass, modifiedFinalAbilityScores, selectedRace);

        // Recalculate AC if it depends on Dex modifier
        assembledCharacter.armorClass = 10 + getAbilityModifierValue(modifiedFinalAbilityScores.Dexterity);
      }

      // Apply size modifier for children
      if (ageCategory.sizeModifier) {
        assembledCharacter.ageSizeOverride = ageCategory.sizeModifier;
      }
    }

    // Apply feat benefits after the baseline character is assembled so derived stats update.
    if (assembledCharacter.feats && assembledCharacter.feats.length > 0) {
      assembledCharacter = applyAllFeats(
        assembledCharacter,
        assembledCharacter.feats,
        (currentState.featChoices as unknown as Record<string, import('../../../types/character').FeatChoice>) || {}
      );
    }

    assembledCharacter = applyRacialSpellGrantsByLevel(assembledCharacter, assembledCharacter.level || 1);

    // Grant the class + background starting loadout: equip armor/shield/primary
    // weapon, then recompute AC from the equipped armor and record starting gold.
    // Before this, every character left creation unarmored at AC 10 with no class
    // gear (and mastery-less casters left unarmed).
    const loadout = buildStartingLoadout({
      classId: finalClass.id,
      background: currentState.selectedBackground,
      weaponMasteryIds: currentState.selectedWeaponMasteries || [],
    });
    assembledCharacter.equippedItems = loadout.equippedItems;
    assembledCharacter.startingGold = loadout.gold;
    assembledCharacter.armorClass = calculateArmorClass(assembledCharacter);

    return assembledCharacter;
}

// --- Hook ---
interface UseCharacterAssemblyProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
}

export function useCharacterAssembly({ onCharacterCreate }: UseCharacterAssemblyProps) {
  const generatePreviewCharacter = useCallback((currentState: CharacterCreationState, currentName: string): PlayerCharacter | null => {
    return assemblePlayerCharacter(currentState, currentName);
  }, []);

  // Returns true when the character was successfully assembled and submitted,
  // false when assembly failed. Callers must check this before doing anything
  // destructive (e.g. clearing the saved draft) — a failed submit must not
  // silently discard the player's in-progress work.
  const assembleAndSubmitCharacter = useCallback((currentState: CharacterCreationState, name: string): boolean => {
    const character = generatePreviewCharacter(currentState, name);
    if (character) {
      // The assembled character already carries its equipped gear + starting gold
      // (set in assemblePlayerCharacter); build the matching inventory (backup
      // weapons, packs, ammunition, provisions, background keepsakes) to hand over.
      const { inventory: startingInventory } = buildStartingLoadout({
        classId: character.class.id,
        background: currentState.selectedBackground,
        weaponMasteryIds: currentState.selectedWeaponMasteries || [],
      });

      onCharacterCreate(character, startingInventory);
      return true;
    }
    console.error("Character assembly failed in useCharacterAssembly. Cannot submit.");
    return false;
  }, [onCharacterCreate, generatePreviewCharacter]);

  return { assembleAndSubmitCharacter, generatePreviewCharacter };
}
