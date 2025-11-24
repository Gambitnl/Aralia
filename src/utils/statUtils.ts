/**
 * @file src/utils/statUtils.ts
 * specific utility functions for calculating stats to avoid circular dependencies.
 */
import { AbilityScores, Race, PlayerCharacter, ArmorCategory, Item, EquipmentSlotType } from '../types';

/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export const getAbilityModifierValue = (score: number): number => {
  return Math.floor((score - 10) / 2);
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
