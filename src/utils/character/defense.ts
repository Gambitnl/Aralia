// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 16:40:25
 * Dependents: utils/character/characterUtils.ts, utils/character/index.ts, utils/character/progression.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file handles character defense calculations and equipment rules.
 *
 * It determines whether a character is proficient with a piece of armor or shield,
 * checks if they meet stat/level requirements to equip items, calculates how an
 * item change would affect their total Armor Class (AC), and provides AC calculation
 * helpers.
 *
 * Called by: Character sheet inventory, equipment mannequin, combat resolution, and characterUtils facade.
 * Depends on: weaponUtils (for weapon proficiency checks) and statUtils (for core AC formulas).
 */

import {
  PlayerCharacter,
  Item,
  ArmorCategory,
  ArmorProficiencyLevel,
} from '../../types';
import {
  calculateArmorClass,
  calculateFinalAC,
  ACComponents,
  ACRelevantActiveEffect,
} from './statUtils';
import {
  isWeaponProficient,
  isWeaponMartial,
} from './weaponUtils';

// Re-export AC calculation utilities so defense callers can access them from this module
export {
  calculateArmorClass,
  calculateFinalAC,
};
export type {
  ACComponents,
  ACRelevantActiveEffect,
  ArmorCategory,
  ArmorProficiencyLevel,
};

// ============================================================================
// Armor Proficiency and Hierarchy
// ============================================================================
// These functions rank armor types (Light, Medium, Heavy) so we can compare
// a character's training level against the requirements of specific armor.
// ============================================================================

/**
 * Returns a numerical value for armor categories to allow for comparisons.
 * Light is 1, Medium is 2, Heavy is 3. Shields are handled separately.
 *
 * @param {ArmorCategory} [category] - The armor category.
 * @returns {number} A numerical rank of the armor category (0 to 3).
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
 * Determines the highest level of armor a character is proficient with
 * based on their class's granted armor proficiencies.
 *
 * @param {PlayerCharacter} character - The character object.
 * @returns {ArmorProficiencyLevel} The highest level of armor proficiency ('heavy', 'medium', 'light', or 'unarmored').
 */
export const getCharacterMaxArmorProficiency = (character: PlayerCharacter): ArmorProficiencyLevel => {
  const profs = character.class.armorProficiencies.map(p => p.toLowerCase());
  // Check from highest proficiency level down to lowest
  if (profs.includes('all armor') || profs.includes('heavy armor')) return 'heavy';
  if (profs.includes('medium armor')) return 'medium';
  if (profs.includes('light armor')) return 'light';
  return 'unarmored';
};

// ============================================================================
// Equipment Validation
// ============================================================================
// Checks whether a character meets the level, class, attribute, and proficiency
// requirements needed to equip a given weapon, armor, or wondrous item.
// ============================================================================

/**
 * Checks if a character can equip a given item based on proficiencies and requirements.
 *
 * @param {PlayerCharacter} character - The character attempting to equip the item.
 * @param {Item} item - The item to be equipped.
 * @returns {{can: boolean, reason?: string}} An object indicating if the item can be equipped and why not if applicable.
 */
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Check general requirements first (min level, class restrictions, minimum ability scores)
  if (item.requirements) {
    const { requirements } = item;
    if (requirements.minLevel && (character.level || 1) < requirements.minLevel) {
      return { can: false, reason: `Requires Level ${requirements.minLevel}.` };
    }
    if (requirements.classId && !requirements.classId.includes(character.class.id)) {
      return { can: false, reason: `Class restricted.` };
    }
    // Check ability score requirements against current final stats
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

  // Handle armor-specific requirements and proficiencies
  if (item.type === 'armor') {
    if (item.strengthRequirement && character.finalAbilityScores.Strength < item.strengthRequirement) {
      // 5e rules: Wearing heavy armor without meeting the Strength requirement is allowed
      // but reduces movement speed by 10 feet. We return can: true with a warning reason.
      return { can: true, reason: `Low Strength: speed penalty active. Requires Strength ${item.strengthRequirement}.` };
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

  // Handle weapon-specific proficiencies (weapons can be equipped without proficiency, but with warning)
  if (item.type === 'weapon') {
    const isProficient = isWeaponProficient(character, item);

    if (!isProficient) {
      const weaponType = isWeaponMartial(item) ? 'Martial weapons' : 'Simple weapons';
      return {
        can: true, // Permissive: 5e rules allow equipping non-proficient weapons
        reason: `Not Proficient — No Proficiency Bonus to Attacks. Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`
      };
    }
  }

  return { can: true };
};

// ============================================================================
// AC Comparison and Upgrade Indicators
// ============================================================================
// Computes hypothetical AC changes to power inventory upgrade indicators.
// ============================================================================

/**
 * Calculates the AC change if an item were equipped in place of the current gear.
 * Used to display upgrade indicators in the inventory UI.
 *
 * @param character - The character to evaluate
 * @param item - The item to check
 * @returns The AC change (positive = upgrade, negative = downgrade, 0 = no change)
 */
export const calculatePotentialAcChange = (character: PlayerCharacter, item: Item): number => {
  // Only armor items affect AC
  if (item.type !== 'armor') return 0;

  // Clone character's equipped items for hypothetical calculation
  const hypotheticalEquippedItems = { ...character.equippedItems };

  // Determine which slot the item goes in and equip it
  if (item.armorCategory === 'Shield') {
    hypotheticalEquippedItems.OffHand = item;
  } else if (item.slot === 'Torso') {
    hypotheticalEquippedItems.Torso = item;
  } else if (item.slot) {
    // For other armor slots (Head, Hands, Legs, Feet, Wrists), include them for completeness
    hypotheticalEquippedItems[item.slot] = item;
  }

  // Create a hypothetical character with the new equipment
  const hypotheticalCharacter: PlayerCharacter = {
    ...character,
    equippedItems: hypotheticalEquippedItems,
  };

  // Calculate new AC using the centralized formula
  const newAc = calculateArmorClass(hypotheticalCharacter, character.activeEffects || []);

  return newAc - character.armorClass;
};
