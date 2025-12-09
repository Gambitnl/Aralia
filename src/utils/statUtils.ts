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
/**
 * Calculates a character's Armor Class based on their equipped items, stats, and active effects.
 * @param {PlayerCharacter} character - The character object.
 * @param {ActiveEffect[]} [activeEffects] - Optional list of active effects on the character.
 * @returns {number} The calculated Armor Class.
 */
export const calculateArmorClass = (character: PlayerCharacter, activeEffects: any[] = []): number => {
  // 1. Determine Base AC Calculation
  // Default: 10 + Dex
  // Armor: Armor Base + Dex (capped)
  // Unarmored Defense: 10 + Dex + Con/Wis
  // Spells (Mage Armor): Set Base + Dex (usually)

  let baseAc = 10;
  let dexBonus = getAbilityModifierValue(character.finalAbilityScores.Dexterity);
  let additionalBaseBonus = 0; // For Unarmored Defense like effects

  const armor = character.equippedItems.Torso;
  let usingArmorCalculation = false;

  // Check for Base AC overrides from spells (e.g., Mage Armor) - ONLY if not wearing armor usually
  // But some might override regardless. Mage Armor specifically says "Target who isn't wearing armor".
  // We'll trust the "restrictions" field was bonded at cast time, so if the effect is active, we use it.
  // We sort by value if there are multiple? Usually higher base prevails.

  // Actually, we must check if we ARE wearing armor to invalidate Mage Armor if it was cast previously?
  // Or do we assume the effect would be removed? The engine should probably handle removal, but let's be safe.
  const baseAcEffects = activeEffects.filter(e => e.type === 'set_base_ac');

  let spellBaseAc = 0;
  let spellUsesDex = true; // Most set_base_ac like Mage Armor use Dex

  if (baseAcEffects.length > 0 && (!armor || armor.type !== 'armor')) { // Mage armor doesn't work with armor
    // Parse formula like "13 + dex_mod"
    // For now, we expect the effect value to be the base number (e.g. 13)
    // and we assume it allows full Dex unless specified. 
    // We'll take the highest base value.
    for (const effect of baseAcEffects) {
      if ((effect.value || 0) > spellBaseAc) {
        spellBaseAc = effect.value || 0;
        // If we had a flag for "noDex", we'd check it here. Default is yes.
      }
    }
  }

  if (armor && armor.type === 'armor' && armor.baseArmorClass) {
    usingArmorCalculation = true;
    baseAc = armor.baseArmorClass;
    if (armor.addsDexterityModifier) {
      if (armor.maxDexterityBonus !== undefined) {
        dexBonus = Math.min(dexBonus, armor.maxDexterityBonus);
      }
    } else {
      dexBonus = 0;
    }
  } else if (spellBaseAc > 0) {
    // Spell Override (Mage Armor)
    baseAc = spellBaseAc;
    // Full Dex applies for Mage Armor
  } else {
    // Unarmored Defense
    if (character.class.id === 'barbarian') {
      additionalBaseBonus = getAbilityModifierValue(character.finalAbilityScores.Constitution);
    } else if (character.class.id === 'monk') {
      additionalBaseBonus = getAbilityModifierValue(character.finalAbilityScores.Wisdom);
    }
  }

  // 2. Shield Bonus
  const shield = character.equippedItems.OffHand;
  const shieldBonus = (shield && shield.type === 'armor' && shield.armorCategory === 'Shield' && shield.armorClassBonus) ? shield.armorClassBonus : 0;

  // 3. Effect Bonuses (Shield spell, Shield of Faith, Haste)
  let effectBonus = 0;
  activeEffects.forEach(e => {
    if (e.type === 'ac_bonus') {
      effectBonus += (e.value || 0);
    }
  });

  // Calculate Preliminary AC
  let totalAc = baseAc + dexBonus + additionalBaseBonus + shieldBonus + effectBonus;

  // 4. AC Minimum (Barkskin)
  // "Target's AC can't be less than 16"
  // This applies to the FINAL total.
  let minAc = 0;
  activeEffects.forEach(e => {
    if (e.type === 'ac_minimum') {
      // If the effect stores the min value in a property like 'acMinimum' or just 'value'
      // We'll look for 'value' as per the generic ActiveEffect structure usually holding the magnitude
      if ((e.value || 0) > minAc) {
        minAc = e.value || 0;
      }
    }
  });

  return Math.max(totalAc, minAc);
};
