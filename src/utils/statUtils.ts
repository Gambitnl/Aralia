import { AbilityScores, Race, PlayerCharacter, ArmorCategory, Item, EquipmentSlotType } from '../types';
import { ActiveEffect } from '../types/combat';



// ... (keep intervening functions same if possible, but replace_file_content needs contiguous block. I'll replace from the imports down to end of file to be safe and clean, or just the function if I can context match. The imports are at the top.)
// I will split this into two edits if needed, but I can replace the whole key section updates.

// Let's replace the whole file content from imports down to ensure clean structure.
// Actually, I can just replace the definition of calculateArmorClass and the imports.

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
 * Components required to calculate final AC.
 * This interface allows both PlayerCharacter (detailed items) and CombatCharacter (simplified stats) to use the same logic.
 */
export interface ACComponents {
  baseAC: number;          // Natural AC, Armor Base AC, or current Monster AC. Default 10.
  dexMod: number;
  maxDexBonus?: number;    // If wearing armor with cap
  unarmoredBonus?: number; // Barbarian Con / Monk Wis
  shieldBonus?: number;
  activeEffects?: { type: string; value?: number; acBonus?: number; acMinimum?: number }[];
  stdBaseIncludesDex?: boolean; // If true, dexMod is not added to standardTotal (but still used for Spell Overrides)
}

/**
 * Core function to calculate AC from components.
 * Centralizes rules for Base AC overrides, stacking, and limits.
 */
export const calculateFinalAC = (components: ACComponents): number => {
  const { maxDexBonus, unarmoredBonus = 0, shieldBonus = 0, activeEffects = [], stdBaseIncludesDex = false } = components;
  let { baseAC, dexMod } = components;

  // Apply Max Dex logic to input
  if (maxDexBonus !== undefined) {
    dexMod = Math.min(dexMod, maxDexBonus);
  }

  // Determine effective Base AC (Standard vs Spell overrides)
  // Standard: baseAC + dexMod + unarmoredBonus
  // Spell (Set Base): value + dexMod (usually)

  const standardTotal = baseAC + (stdBaseIncludesDex ? 0 : dexMod) + unarmoredBonus;

  // Check for Set Base AC effects (Mage Armor)
  // These usually replace the calculation: "Your AC becomes 13 + Dex"
  let spellBaseTotal = 0;
  let hasSpellBase = false;

  const baseAcEffects = activeEffects.filter(e => e.type === 'set_base_ac');
  if (baseAcEffects.length > 0) {
    // Find highest spell base
    // Helper assumption: Spell overrides assume full Dex unless specified (no schema yet for that)
    // And generally they don't stack with armor/unarmored bonus, they REPLACE the base calculation.
    let maxSpellBase = 0;
    for (const effect of baseAcEffects) {
      const val = effect.value || 0;
      if (val > maxSpellBase) maxSpellBase = val;
    }
    if (maxSpellBase > 0) {
      spellBaseTotal = maxSpellBase + components.dexMod; // Use full dex for spells usually
      hasSpellBase = true;
    }
  }

  // Decision: Which Base to use?
  // D&D Rule: You choose the calculation. Usually max.
  // Note: If wearing armor (maxDexBonus defined), standard rules usually prevent Unarmored Defense/Mage Armor.
  // But here we rely on caller to only provide conflicting components if valid?
  // Actually, calculateArmorClass checks bounds.
  // For safety: If hasSpellBase, we compare.

  let currentTotal = standardTotal;
  if (hasSpellBase && spellBaseTotal > currentTotal) {
    currentTotal = spellBaseTotal;
  }

  // Add Bonuses (Shield + Effects)
  let bonusTotal = shieldBonus;
  activeEffects.forEach(e => {
    if (e.type === 'ac_bonus') {
      bonusTotal += (e.value || e.acBonus || 0);
    }
  });

  currentTotal += bonusTotal;

  // Apply Minimum
  let minAC = 0;
  activeEffects.forEach(e => {
    if (e.type === 'ac_minimum') {
      const val = e.value || e.acMinimum || 0;
      if (val > minAC) minAC = val;
    }
  });

  return Math.max(currentTotal, minAC);
};

/**
 * Calculates a character's Armor Class based on their equipped items, stats, and active effects.
 * @param {PlayerCharacter} character - The character object.
 * @param {ActiveEffect[]} [activeEffects] - Optional list of active effects on the character.
 * @returns {number} The calculated Armor Class.
 */
export const calculateArmorClass = (character: PlayerCharacter, activeEffects: ActiveEffect[] = []): number => {
  const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity);
  const armor = character.equippedItems.Torso;
  const shield = character.equippedItems.OffHand;

  let baseAC = 10;
  let maxDexBonus: number | undefined = undefined;
  let unarmoredBonus = 0;

  // 1. Determine Armor / Unarmored Configuration
  if (armor && armor.type === 'armor') {
    // Wearing Armor
    baseAC = armor.baseArmorClass || 10;
    if (armor.addsDexterityModifier && armor.maxDexterityBonus !== undefined) {
      maxDexBonus = armor.maxDexterityBonus;
    } else if (!armor.addsDexterityModifier) {
      maxDexBonus = 0; // No dex
    }
    // Unarmored Bonus doesn't apply
  } else {
    // Unarmored logic
    if (character.class.id === 'barbarian') {
      unarmoredBonus = getAbilityModifierValue(character.finalAbilityScores.Constitution);
    } else if (character.class.id === 'monk' && !shield) {
      unarmoredBonus = getAbilityModifierValue(character.finalAbilityScores.Wisdom);
    }
  }

  // 2. Shield
  const shieldBonus = (shield && shield.type === 'armor' && shield.armorCategory === 'Shield' && shield.armorClassBonus)
    ? shield.armorClassBonus
    : 0;

  // 3. Delegate to core calculator
  // Filter Mage Armor if wearing armor? 
  // Standard rule: Mage Armor ends if you don armor.
  // But if effect is present, `calculateFinalAC` will compare values.
  // However, Mage Armor calculation (13+Dex) vs Armor (12+Dex) might favor Mage Armor incorrectly if we don't suppress it while armored.
  // The 'set_base_ac' effects should strictly NOT apply if wearing armor.
  let validEffects = activeEffects;
  if (armor && armor.type === 'armor') {
    validEffects = activeEffects.filter(e => e.type !== 'set_base_ac');
  }

  const components: ACComponents = {
    baseAC,
    dexMod,
    maxDexBonus,
    unarmoredBonus,
    shieldBonus,
    activeEffects: validEffects
  };

  return calculateFinalAC(components);
};
