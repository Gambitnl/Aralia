// [Architect] Extracted from src/utils/character/ to separate concerns
import { PlayerCharacter, Item, ArmorCategory, ArmorProficiencyLevel } from '../../types';
import { isWeaponProficient, isWeaponMartial } from '../weaponUtils';

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
 * Checks if a character can equip a given item based on proficiencies and requirements.
 * @param {PlayerCharacter} character - The character attempting to equip the item.
 * @param {Item} item - The item to be equipped.
 * @returns {{can: boolean, reason?: string}} An object indicating if the item can be equipped and why not if applicable.
 */
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Check requirements first, regardless of proficiency
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

  if (item.type === 'weapon') {
    // Check proficiency using the centralized helper
    const isProficient = isWeaponProficient(character, item);

    if (!isProficient) {
      // Fix Q9: Use isWeaponMartial helper to determine type
      const weaponType = isWeaponMartial(item) ? 'Martial weapons' : 'Simple weapons';
      return {
        can: true, // Permissive: can still equip
        reason: `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`
      };
    }
  }

  return { can: true };
};
