/**
 * @file src/utils/characterUtils.ts
 * This file contains utility functions related to player characters,
 * such as calculating ability score modifiers, armor class, and equipment rules.
 */
import { PlayerCharacter, Race, Item, ArmorCategory, ArmorProficiencyLevel, TempPartyMember, AbilityScores, Class as CharClass, DraconicAncestryInfo, EquipmentSlotType } from '../types';
import { RACES_DATA, GIANT_ANCESTRIES, TIEFLING_LEGACIES, CLASSES_DATA, DRAGONBORN_ANCESTRIES } from '../constants';

/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export const getAbilityModifierValue = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

/**
 * Calculates the final ability scores for a character, including racial bonuses and equipment bonuses.
 * @param {AbilityScores} baseScores - The character's base ability scores.
 * @param {Race} race - The character's race.
 * @param {Partial<Record<EquipmentSlotType, Item>>} equippedItems - The character's equipped items.
 * @returns {AbilityScores} The final calculated ability scores.
 */
export const calculateFinalAbilityScores = (
  baseScores: AbilityScores,
  race: Race,
  equippedItems: Partial<Record<EquipmentSlotType, Item>>
): AbilityScores => {
  // 1. Start with base scores + racial bonuses
  const scores = calculateFixedRacialBonuses(baseScores, race);

  // 2. Add bonuses from equipped items
  Object.values(equippedItems).forEach(item => {
    if (item && item.statBonuses) {
      (Object.keys(item.statBonuses) as Array<keyof AbilityScores>).forEach(stat => {
        if (item.statBonuses![stat]) {
          scores[stat] += item.statBonuses![stat]!;
        }
      });
    }
  });

  return scores;
};

/**
 * Calculates the D&D ability score modifier and returns it as a string.
 * @param {number} score - The ability score.
 * @returns {string} The modifier string (e.g., "+2", "-1", "0").
 */
export const getAbilityModifierString = (score: number): string => {
  const mod = getAbilityModifierValue(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

/**
 * Generates a descriptive race display string for a character.
 * e.g., "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
 * @param {PlayerCharacter} character - The player character object.
 * @returns {string} The formatted race display string.
 */
export function getCharacterRaceDisplayString(character: PlayerCharacter): string {
  const { race, racialSelections } = character;

  if (!race) return 'Unknown Race';

  const getSelectionName = (data: any[] | undefined, id: string | undefined, nameKey: string, suffixToRemove: string): string | null => {
    if (!id || !data) return null;
    const found = data.find(item => item.id === id);
    return found ? found[nameKey].replace(suffixToRemove, '').trim() : null;
  }

  switch (race.id) {
    case 'elf': {
      const lineageName = getSelectionName(RACES_DATA.elf?.elvenLineages, racialSelections?.['elf']?.choiceId, 'name', 'Lineage');
      return lineageName ? `${lineageName}` : race.name;
    }
    case 'dragonborn': {
      const ancestryId = racialSelections?.['dragonborn']?.choiceId;
      const ancestry = ancestryId ? (DRAGONBORN_ANCESTRIES as Record<string, DraconicAncestryInfo>)[ancestryId] : null;
      return ancestry ? `${ancestry.type} ${race.name}` : race.name;
    }
    case 'gnome': {
      const subraceName = getSelectionName(RACES_DATA.gnome?.gnomeSubraces, racialSelections?.['gnome']?.choiceId, 'name', '');
      return subraceName ? subraceName : race.name;
    }
    case 'goliath': {
      const ancestryName = getSelectionName(GIANT_ANCESTRIES, racialSelections?.['goliath']?.choiceId, 'id', '');
      return ancestryName ? `${ancestryName} ${race.name}` : race.name;
    }
    case 'tiefling': {
      const legacyName = getSelectionName(TIEFLING_LEGACIES, racialSelections?.['tiefling']?.choiceId, 'name', 'Legacy');
      return legacyName ? `${legacyName} ${race.name}` : race.name;
    }
    default:
      return race.name;
  }
}

/**
 * Returns a numerical value for armor categories to allow for comparisons.
 * @param {ArmorCategory} [category] - The armor category.
 * @returns {number} A numerical representation of the proficiency level.
 */
export const getArmorCategoryHierarchy = (category?: ArmorCategory): number => {
  if (!category) return 0;
  switch (category) {
    case 'Light': return 1;
    case 'Medium': return 2;
    case 'Heavy': return 3;
    case 'Shield': return 0;
    default: return 0;
  }
};

/**
 * Determines the highest level of armor a character is proficient with.
 * @param {PlayerCharacter} character - The character object.
 * @returns {ArmorProficiencyLevel} The highest level of armor proficiency.
 */
export const getCharacterMaxArmorProficiency = (character: PlayerCharacter): ArmorProficiencyLevel => {
  const profs = character.class.armorProficiencies.map(p => p.toLowerCase());
  if (profs.includes('all armor') || profs.includes('heavy armor')) return 'heavy';
  if (profs.includes('medium armor')) return 'medium';
  if (profs.includes('light armor')) return 'light';
  return 'unarmored';
};

/**
 * Calculates a character's Armor Class based on their equipped items and stats.
 * @param {PlayerCharacter} character - The character object.
 * @returns {number} The calculated Armor Class.
 */
export const calculateArmorClass = (character: PlayerCharacter): number => {
  let baseAc = 10;
  let dexBonus = getAbilityModifierValue(character.finalAbilityScores.Dexterity);

  const armor = character.equippedItems.Torso;

  if (armor && armor.type === 'armor' && armor.baseArmorClass) {
    baseAc = armor.baseArmorClass;
    if (armor.addsDexterityModifier) {
      if (armor.maxDexterityBonus !== undefined) {
        dexBonus = Math.min(dexBonus, armor.maxDexterityBonus);
      }
    } else {
      dexBonus = 0;
    }
  } else { // Unarmored
    if (character.class.id === 'barbarian') {
      baseAc = 10 + dexBonus + getAbilityModifierValue(character.finalAbilityScores.Constitution);
      dexBonus = 0; // Already included in baseAc calculation
    } else if (character.class.id === 'monk') {
      baseAc = 10 + dexBonus + getAbilityModifierValue(character.finalAbilityScores.Wisdom);
      dexBonus = 0; // Already included
    }
  }


  const shield = character.equippedItems.OffHand;
  const shieldBonus = (shield && shield.type === 'armor' && shield.armorCategory === 'Shield' && shield.armorClassBonus) ? shield.armorClassBonus : 0;

  return baseAc + dexBonus + shieldBonus;
};

/**
 * Checks if a character can equip a given item based on proficiencies and requirements.
 * @param {PlayerCharacter} character - The character attempting to equip the item.
 * @param {Item} item - The item to be equipped.
 * @returns {{can: boolean, reason?: string}} An object indicating if the item can be equipped and why not if applicable.
 */
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  if (item.type === 'armor') {
    if (item.strengthRequirement && character.finalAbilityScores.Strength < item.strengthRequirement) {
      return { can: false, reason: `Requires ${item.strengthRequirement} Strength.` };
    }

    if (item.armorCategory) {
      const charMaxProf = getCharacterMaxArmorProficiency(character);
      if (item.armorCategory === 'Shield') {
        if (!character.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields')) {
          return { can: false, reason: 'Not proficient with shields.' };
        }
      } else {
        const itemProfValue = getArmorCategoryHierarchy(item.armorCategory);
        const charProfValue = getArmorCategoryHierarchy(charMaxProf.charAt(0).toUpperCase() + charMaxProf.slice(1) as ArmorCategory);
        if (itemProfValue > charProfValue) {
          return { can: false, reason: `Not proficient with ${item.armorCategory} armor.` };
        }
      }
    }
  }

  if (item.requirements) {
    const { requirements } = item;
    if (requirements.minLevel && (character.level || 1) < requirements.minLevel) {
      return { can: false, reason: `Requires Level ${requirements.minLevel}.` };
    }
    if (requirements.classId && !requirements.classId.includes(character.class.id)) {
      return { can: false, reason: `Class restricted.` };
    }
    // Check stat requirements against BASE or CURRENT stats? 
    // Usually current final stats.
    if (requirements.minStrength && character.finalAbilityScores.Strength < requirements.minStrength) {
      return { can: false, reason: `Requires ${requirements.minStrength} Strength.` };
    }
    if (requirements.minDexterity && character.finalAbilityScores.Dexterity < requirements.minDexterity) {
      return { can: false, reason: `Requires ${requirements.minDexterity} Dexterity.` };
    }
    if (requirements.minConstitution && character.finalAbilityScores.Constitution < requirements.minConstitution) {
      return { can: false, reason: `Requires ${requirements.minConstitution} Constitution.` };
    }
    if (requirements.minIntelligence && character.finalAbilityScores.Intelligence < requirements.minIntelligence) {
      return { can: false, reason: `Requires ${requirements.minIntelligence} Intelligence.` };
    }
    if (requirements.minWisdom && character.finalAbilityScores.Wisdom < requirements.minWisdom) {
      return { can: false, reason: `Requires ${requirements.minWisdom} Wisdom.` };
    }
    if (requirements.minCharisma && character.finalAbilityScores.Charisma < requirements.minCharisma) {
      return { can: false, reason: `Requires ${requirements.minCharisma} Charisma.` };
    }
  }

  return { can: true };
};

/**
 * Applies fixed racial bonuses to a set of base ability scores.
 * @param {AbilityScores} baseScores - The base scores before racial bonuses.
 * @param {Race | null} race - The character's race.
 * @returns {AbilityScores} The final scores after fixed bonuses are applied.
 */
export const calculateFixedRacialBonuses = (baseScores: AbilityScores, race: Race | null): AbilityScores => {
  const finalScores: AbilityScores = { ...baseScores };
  if (race && race.abilityBonuses) {
    race.abilityBonuses.forEach(bonus => {
      finalScores[bonus.ability] = (finalScores[bonus.ability] || 0) + bonus.bonus;
    });
  }
  return finalScores;
};

/**
 * Creates a full PlayerCharacter object from a simplified TempPartyMember object.
 * @param {TempPartyMember} tempMember - The temporary member data.
 * @returns {PlayerCharacter} A complete PlayerCharacter object.
 */
export const createPlayerCharacterFromTemp = (tempMember: TempPartyMember): PlayerCharacter => {
  const classData = CLASSES_DATA[tempMember.classId] || CLASSES_DATA['fighter'];
  const raceData = RACES_DATA['human']; // Default to Human for simplicity
  const baseAbilityScores: AbilityScores = { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 };
  const finalAbilityScores = calculateFixedRacialBonuses(baseAbilityScores, raceData);
  const maxHp = classData.hitDie + getAbilityModifierValue(finalAbilityScores.Constitution);

  const newChar: PlayerCharacter = {
    id: tempMember.id,
    name: `${classData.name} ${tempMember.level}`,
    level: tempMember.level,
    race: raceData,
    class: classData,
    abilityScores: baseAbilityScores,
    finalAbilityScores,
    skills: [],
    hp: maxHp,
    maxHp: maxHp,
    armorClass: 10 + getAbilityModifierValue(finalAbilityScores.Dexterity),
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    proficiencyBonus: Math.floor((tempMember.level - 1) / 4) + 2,
  };
  newChar.armorClass = calculateArmorClass(newChar);
  return newChar;
};