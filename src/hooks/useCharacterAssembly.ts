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
import { SKILLS_DATA } from '../../../data/skills';
import { WEAPONS_DATA } from '../../../data/items';
import { ALL_RACES_DATA as RACES_DATA, TIEFLING_LEGACIES_DATA as TIEFLING_LEGACIES } from '../../../data/races';
import { CharacterCreationState } from '../state/characterCreatorState'; 
import { getAbilityModifierValue, applyFeatToCharacter } from '../../../utils/characterUtils';
import { FEATS_DATA } from '../../../data/feats/featsData';

// --- Helper Functions for Character Assembly ---
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

function calculateCharacterDarkvision(race: Race, lineageId?: string): number {
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
        if(legacy) {
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
        spellSlots.level_1 = { current: 1, max: 1};
      }
  }

  return { spellbook, spellSlots, spellcastingAbility: classAbility, limitedUses };
}


function assembleFinalSkills(state: CharacterCreationState): Skill[] {
    const { selectedRace, selectedSkills, racialSelections } = state;
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

    const finalClass = { ...selectedClass };
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
      darkvisionRange: calculateCharacterDarkvision(selectedRace, racialSelections['elf']?.choiceId as 'drow' | 'high_elf' | 'wood_elf' | undefined),
      transportMode: 'foot',
      selectedWeaponMasteries: currentState.selectedWeaponMasteries || [],
      equippedItems: {}, 
      ...castingProperties,
      selectedFightingStyle: currentState.selectedFightingStyle || undefined,
      selectedDivineOrder: currentState.selectedDivineOrder || undefined,
      selectedDruidOrder: currentState.selectedDruidOrder || undefined,
      selectedWarlockPatron: currentState.selectedWarlockPatron || undefined,
      racialSelections: currentState.racialSelections,
      featChoices: currentState.featChoices as any,
      visuals: {
        gender: currentState.visuals.gender === 'Male' ? 'Male' : 'Female',
        skinColor: currentState.visuals.skinColor,
        hairStyle: currentState.visuals.hairStyle,
        clothingStyle: currentState.visuals.clothing,
      },
    };

    // Apply selected feat if present
    if (currentState.selectedFeat) {
      const feat = FEATS_DATA.find(f => f.id === currentState.selectedFeat);
      if (feat) {
        const choices = currentState.featChoices?.[currentState.selectedFeat];
        assembledCharacter = applyFeatToCharacter(assembledCharacter, feat, {
          selectedAbilityScore: choices?.selectedAbilityScore,
          selectedCantrips: choices?.selectedCantrips,
          selectedLeveledSpells: choices?.selectedLeveledSpells,
          selectedSpellSource: choices?.selectedSpellSource,
        });
      }
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