/**
 * @file src/utils/characterUtils.ts
 * This file contains utility functions related to player characters,
 * such as calculating ability score modifiers, armor class, and equipment rules.
 */
import { PlayerCharacter, Race, Item, ArmorCategory, ArmorProficiencyLevel, TempPartyMember, AbilityScores, Class as CharClass, DraconicAncestryInfo, EquipmentSlotType } from '../types';
import { RACES_DATA, GIANT_ANCESTRIES, TIEFLING_LEGACIES, CLASSES_DATA, DRAGONBORN_ANCESTRIES } from '../constants';
import { XP_THRESHOLDS_BY_LEVEL } from '../data/dndData';

/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export { getAbilityModifierValue, calculateFinalAbilityScores, getAbilityModifierString } from './statUtils';
import { getAbilityModifierValue, calculateFinalAbilityScores, calculateFixedRacialBonuses, calculateArmorClass } from './statUtils';

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

export { calculateArmorClass };

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

export { calculateFixedRacialBonuses };

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
    xp: 0,
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

/**
 * Returns the XP required to reach the next level.
 * @param {number} currentLevel - The character's current level.
 * @returns {number | null} The XP required, or null if max level.
 */
export const getXpRequiredForNextLevel = (currentLevel: number): number | null => {
  if (currentLevel >= 20) return null;
  // D&D 5e XP cumulative thresholds are usually:
  // 1->2: 300, 2->3: 900, 3->4: 2700...
  // The provided XP_THRESHOLDS_BY_LEVEL seems to be encounter thresholds (Easy, Medium, Hard, Deadly), NOT leveling thresholds.
  // I need to use standard D&D 5e leveling XP.

  // Standard 5e XP Table (Cumulative)
  const LEVEL_XP: Record<number, number> = {
      1: 0,
      2: 300,
      3: 900,
      4: 2700,
      5: 6500,
      6: 14000,
      7: 23000,
      8: 34000,
      9: 48000,
      10: 64000,
      11: 85000,
      12: 100000,
      13: 120000,
      14: 140000,
      15: 165000,
      16: 195000,
      17: 225000,
      18: 265000,
      19: 305000,
      20: 355000
  };

  return LEVEL_XP[currentLevel + 1] || null;
};

/**
 * Checks if a character has enough XP to level up.
 * @param {PlayerCharacter} character - The character.
 * @returns {boolean} True if eligible for level up.
 */
export const canLevelUp = (character: PlayerCharacter): boolean => {
  const currentLevel = character.level || 1;
  const currentXp = character.xp || 0;
  const nextLevelXp = getXpRequiredForNextLevel(currentLevel);

  if (nextLevelXp === null) return false;
  return currentXp >= nextLevelXp;
};

/**
 * Performs a basic level up on a character, returning the updated character object.
 * Note: This only handles automatic stat updates (Level, HP, Proficiency Bonus).
 * Feature selections must be handled separately.
 * @param {PlayerCharacter} character - The character to level up.
 * @returns {PlayerCharacter} The updated character.
 */
export const performLevelUp = (character: PlayerCharacter): PlayerCharacter => {
  if (!canLevelUp(character)) return character;

  const currentLevel = character.level || 1;
  const newLevel = currentLevel + 1;

  // Calculate HP increase (Average of Hit Die + Con Mod)
  // Hit Die is typically 6, 8, 10, or 12. Average is (HitDie / 2) + 1.
  const hitDie = character.class.hitDie;
  const hpIncreaseBase = (hitDie / 2) + 1;
  const conMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);
  const hpIncrease = Math.max(1, hpIncreaseBase + conMod); // Min 1 HP gain

  // Calculate new Proficiency Bonus
  const newProficiencyBonus = Math.floor((newLevel - 1) / 4) + 2;

  return {
    ...character,
    level: newLevel,
    maxHp: character.maxHp + hpIncrease,
    hp: character.hp + hpIncrease, // Heals the new amount? Or just max increases? Usually max increases and current stays, but for video games usually both.
    proficiencyBonus: newProficiencyBonus,
  };
};