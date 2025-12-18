
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
import { SKILLS_DATA, WEAPONS_DATA, RACES_DATA, TIEFLING_LEGACIES } from '../../../constants';
import { BACKGROUNDS } from '../../../data/backgrounds';
import { CharacterCreationState } from '../state/characterCreatorState';
import { getAbilityModifierValue, applyAllFeats } from '../../../utils/characterUtils';

// --- Helper Functions for Character Assembly ---

// Age ranges and categories for different races (mechanical effects)
const getAgeDataForAssembly = (raceId: string) => {
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

const getAgeCategoryForAssembly = (age: number, ageData: any) => {
  if (age <= ageData.categories.child.max) return ageData.categories.child;
  if (age <= ageData.categories.adolescent.max) return ageData.categories.adolescent;
  if (age <= ageData.categories.adult.max) return ageData.categories.adult;
  if (age <= ageData.categories.middleAged.max) return ageData.categories.middleAged;
  return ageData.categories.elderly;
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
  if (selectedRace.id === 'elf' && (!racialSelections['elf']?.choiceId || !racialSelections['elf']?.spellAbility)) return false;
  if (selectedRace.id === 'gnome' && (!racialSelections['gnome']?.choiceId || !racialSelections['gnome']?.spellAbility)) return false;
  if (selectedRace.id === 'goliath' && !racialSelections['goliath']?.choiceId) return false;
  if (selectedRace.id === 'tiefling' && (!racialSelections['tiefling']?.choiceId || !racialSelections['tiefling']?.spellAbility)) return false;
  if (selectedRace.id === 'centaur' && !racialSelections['centaur']?.skillIds?.[0]) return false;
  if (selectedRace.id === 'changeling' && (!racialSelections['changeling']?.skillIds || racialSelections['changeling'].skillIds.length !== 2)) return false;

  // Check consolidated racial spell ability choices for races that have them
  if (selectedRace.racialSpellChoice && !racialSelections[selectedRace.id]?.spellAbility) return false;

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

function calculateCharacterDarkvision(race: Race, lineageId?: string, subraceId?: string): number {
  let range = 0;
  const dvTrait = race.traits.find(t => t.toLowerCase().includes('darkvision'));
  if (dvTrait) {
    const match = dvTrait.match(/(\d+)/);
    if (match) range = parseInt(match[1], 10);
  }
  if ((race.id === 'elf' && lineageId === 'drow') || race.id === 'deep_gnome' || race.id === 'duergar' || race.id === 'dwarf' || race.id === 'orc') {
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
  }

  const spellbook: SpellbookData = {
    cantrips: Array.from(cantripIds),
    preparedSpells: Array.from(spellIds),
    knownSpells: [...(selectedClass.spellcasting?.spellList || []), ...Array.from(spellIds)],
  };

  let spellSlots: SpellSlots | undefined = undefined;
  if (['cleric', 'wizard', 'sorcerer', 'artificer', 'paladin', 'druid', 'bard', 'warlock', 'ranger'].includes(selectedClass.id)) {
    spellSlots = {
      level_1: { current: 2, max: 2 },
      level_2: { current: 0, max: 0 }, level_3: { current: 0, max: 0 },
      level_4: { current: 0, max: 0 }, level_5: { current: 0, max: 0 },
      level_6: { current: 0, max: 0 }, level_7: { current: 0, max: 0 },
      level_8: { current: 0, max: 0 }, level_9: { current: 0, max: 0 },
    };
    if (selectedClass.id === 'warlock') {
      spellSlots.level_1 = { current: 1, max: 1 };
    }
  }

  return { spellbook, spellSlots, spellcastingAbility: classAbility, limitedUses };
}


function assembleFinalSkills(state: CharacterCreationState): Skill[] {
  const { selectedRace, selectedSkills, racialSelections, selectedBackground } = state;
  const BUGBEAR_AUTO_SKILL_ID = 'stealth';
  let finalSkillsList: Skill[] = [...selectedSkills];

  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  if (selectedRace?.id === 'human' && humanSkillId) {
    const skill = SKILLS_DATA[humanSkillId];
    if (skill) finalSkillsList.push(skill);
  }
  if (selectedRace?.id === 'bugbear') {
    const stealthSkill = SKILLS_DATA[BUGBEAR_AUTO_SKILL_ID];
    if (stealthSkill) finalSkillsList.push(stealthSkill);
  }
  const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
  if (selectedRace?.id === 'centaur' && centaurSkillId) {
    const naturalAffinitySkill = SKILLS_DATA[centaurSkillId];
    if (naturalAffinitySkill) finalSkillsList.push(naturalAffinitySkill);
  }
  const changelingSkillIds = racialSelections['changeling']?.skillIds;
  if (selectedRace?.id === 'changeling' && changelingSkillIds) {
    changelingSkillIds.forEach(skillId => {
      const instinctSkill = SKILLS_DATA[skillId];
      if (instinctSkill) finalSkillsList.push(instinctSkill);
    });
  }

  // Add background skill proficiencies
  if (selectedBackground && BACKGROUNDS[selectedBackground]) {
    const background = BACKGROUNDS[selectedBackground];
    background.skillProficiencies.forEach(skillId => {
      const skill = SKILLS_DATA[skillId];
      if (skill) finalSkillsList.push(skill);
    });
  }

  return [...new Set(finalSkillsList.map(s => s.id))].map(id => finalSkillsList.find(s => s.id === id)!).filter(Boolean);
}


// --- Hook ---
interface UseCharacterAssemblyProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
}

export function useCharacterAssembly({ onCharacterCreate }: UseCharacterAssemblyProps) {
  const generatePreviewCharacter = useCallback((currentState: CharacterCreationState, currentName: string): PlayerCharacter | null => {
    const { selectedRace, selectedClass, finalAbilityScores, baseAbilityScores, racialSelections } = currentState;
    if (!validateAllSelectionsMade(currentState) || !selectedRace || !selectedClass || !finalAbilityScores || !baseAbilityScores) {
      console.error("Missing critical data for review step. Cannot generate preview.", currentState);
      return null;
    }

    let finalClass = { ...selectedClass };
    if (currentState.selectedDivineOrder === 'Protector') {
      finalClass.armorProficiencies = [...new Set([...finalClass.armorProficiencies, 'Heavy armor'])];
      finalClass.weaponProficiencies = [...new Set([...finalClass.weaponProficiencies, 'Martial weapons'])];
    }

    const castingProperties = assembleCastingProperties(currentState);

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
      abilityScores: baseAbilityScores,
      finalAbilityScores,
      skills: assembleFinalSkills(currentState),
      hp: calculateCharacterMaxHp(selectedClass, finalAbilityScores, selectedRace),
      maxHp: calculateCharacterMaxHp(selectedClass, finalAbilityScores, selectedRace),
      armorClass: 10 + getAbilityModifierValue(finalAbilityScores.Dexterity),
      speed: calculateCharacterSpeed(selectedRace, racialSelections['elf']?.choiceId as 'drow' | 'high_elf' | 'wood_elf' | undefined),
      darkvisionRange: calculateCharacterDarkvision(selectedRace, racialSelections['elf']?.choiceId as 'drow' | 'high_elf' | 'wood_elf' | undefined, racialSelections['gnome']?.choiceId as 'forest_gnome' | 'rock_gnome' | 'deep_gnome' | undefined),
      transportMode: 'foot',
      selectedWeaponMasteries: currentState.selectedWeaponMasteries || [],
      feats: currentState.selectedFeat ? [currentState.selectedFeat] : [],
      featChoices: currentState.featChoices || {},
      equippedItems: {},
      ...castingProperties,
      selectedFightingStyle: currentState.selectedFightingStyle || undefined,
      selectedDivineOrder: currentState.selectedDivineOrder || undefined,
      selectedDruidOrder: currentState.selectedDruidOrder || undefined,
      selectedWarlockPatron: currentState.selectedWarlockPatron || undefined,
      racialSelections: currentState.racialSelections,
      visuals: currentState.visuals,
    };

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
        assembledCharacter.ageSizeOverride = ageCategory.sizeModifier as any;
      }
    }

    // Apply feat benefits after the baseline character is assembled so derived stats update.
    if (assembledCharacter.feats && assembledCharacter.feats.length > 0) {
      assembledCharacter = applyAllFeats(assembledCharacter, assembledCharacter.feats, currentState.featChoices);
    }

    return assembledCharacter;

  }, []);

  const assembleAndSubmitCharacter = useCallback((currentState: CharacterCreationState, name: string): void => {
    const character = generatePreviewCharacter(currentState, name);
    if (character) {
      const startingInventory: Item[] = currentState.selectedWeaponMasteries
        ?.map(id => WEAPONS_DATA[id])
        .filter((item): item is Item => !!item) || [];

      onCharacterCreate(character, startingInventory);
    } else {
      console.error("Character assembly failed in useCharacterAssembly. Cannot submit.");
    }
  }, [onCharacterCreate, generatePreviewCharacter]);

  return { assembleAndSubmitCharacter, generatePreviewCharacter };
}
