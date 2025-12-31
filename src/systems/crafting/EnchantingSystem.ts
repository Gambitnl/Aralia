/**
 * @file src/systems/crafting/EnchantingSystem.ts
 * Specific logic for the Enchanting system, extending standard crafting.
 * Includes "Critical Failure" mechanics as per Alchemist design.
 */
// TODO(lint-intent): 'MaterialRequirement' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Recipe, CraftingResult, MaterialRequirement as _MaterialRequirement } from './types';
import { Crafter, canCraft } from './craftingSystem';

/**
 * Result specific to enchanting, potentially including side effects.
 */
export interface EnchantingResult extends CraftingResult {
  /** If true, the base item was destroyed or cursed due to critical failure. */
  criticalFailure: boolean;
  /** Description of the magical backlash, if any. */
  backlashEffect?: string;
}

/**
 * Attempts to enchant an item using the provided recipe.
 * Implements strict "Essence Consumption" and "Critical Failure" rules.
 */
export function attemptEnchant(crafter: Crafter, recipe: Recipe): EnchantingResult {
  // 1. Validate Materials (Standard check)
  if (!canCraft(crafter, recipe)) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Insufficient essences or base items.',
      criticalFailure: false
    };
  }

  // 2. Perform Skill Check (Arcana usually)
  let roll = 0;
  if (recipe.skillCheck) {
    roll = crafter.rollSkill(recipe.skillCheck.skill);
  } else {
    // Enchanting ALWAYS requires a check in this system
    roll = crafter.rollSkill('Arcana');
  }

  const dc = recipe.skillCheck?.dc || 15; // Default DC 15 for enchanting

  let success = false;
  let criticalFailure = false;
  let quality: 'poor' | 'standard' | 'superior' | 'masterwork' = 'standard';
  let message = '';
  let backlashEffect = '';

  if (roll >= dc) {
    success = true;
    if (roll >= dc + 10) {
      quality = 'superior';
      message = `Enchantment critically succeeded! The item hums with power.`;
    } else {
      message = `Enchantment successful.`;
    }
  } else {
    // Failure
    success = false;

    // Check for Critical Failure (Fail by 5 or more)
    // Alchemist Philosophy: "Creation should cost resources. Failure teaches."
    if (roll <= dc - 5) {
      criticalFailure = true;
      message = `Critical Failure! The magical energies destabilize.`;
      backlashEffect = 'The essences burn up violently, and the base item is damaged or destroyed.';
    } else {
      message = `Enchantment failed. The magic didn't take.`;
    }
  }

  // 3. Determine Consumption and Output
  const outputs: { itemId: string; quantity: number }[] = [];
  const consumed: { itemId: string; quantity: number }[] = [];

  // In Enchanting, materials (essences) are ALWAYS consumed on attempt, success or fail.
  // This is stricter than standard crafting.
  for (const input of recipe.inputs) {
    if (input.consumed) {
      consumed.push({ itemId: input.itemId, quantity: input.quantity });
    }
  }

  // If Critical Failure, we might also consume the "non-consumed" base item (like the sword being enchanted)
  // This requires the recipe to identify which input is the "base item".
  // For now, we assume if it's a critical failure, we rely on the caller/UI to handle the narrative,
  // but mechanically we mark it as criticalFailure so the inventory system knows.

  // Actually, let's look at the recipe. inputs that are NOT consumed are usually tools.
  // But in enchanting, the "Sword" is an input that IS consumed (converted to "Magic Sword").
  // So the base item is already in the 'consumed' list if the recipe is written correctly (Iron Sword -> Magic Sword).

  // Wait, if I fail, I don't want to consume the Sword unless it's a critical failure.
  // Standard Fail: Lost dusts (consumed), kept Sword (not consumed?).
  // But the recipe says consumed=true for the sword?

  // Logic Adjustment:
  // If Recipe says Sword is consumed (because it turns into output), but we FAILED:
  // - Standard Fail: We should refund the Sword, but lose the Dust.
  // - Critical Fail: We lose the Sword AND the Dust.

  // To support this, we need to know which ingredients are "catalysts" (dust) vs "base" (sword).
  // Current Recipe structure doesn't distinguish, other than context.
  // HEURISTIC: If an item matches the output type (e.g. Dagger -> Magic Dagger), it's the base.
  // Or simpler: We just modify the 'consumed' list based on the result.

  const finalConsumed: { itemId: string; quantity: number }[] = [];

  if (success) {
    // Consume everything marked consumed
    finalConsumed.push(...consumed);
    // Grant outputs
    for (const output of recipe.outputs) {
      outputs.push({ itemId: output.itemId, quantity: output.quantity });
    }
  } else {
    // Failure
    if (criticalFailure) {
      // Consume everything marked consumed (Sword + Dust) - The item is destroyed!
      finalConsumed.push(...consumed);
    } else {
      // Standard Failure: Consume only "Essence/Material" types, return "Equipment" types.
      // Since we lack strict types on inputs here, we might need a better way.
      // For MVP: We will assume the FIRST input is the "Base Item" and others are catalysts.
      // This is a convention we will document.

      recipe.inputs.forEach((input, index) => {
         if (input.consumed) {
            if (index === 0) {
               // Convention: First input is base item.
               // On standard fail, do NOT consume base item.
            } else {
               // Catalysts: Always consumed
               finalConsumed.push({ itemId: input.itemId, quantity: input.quantity });
            }
         }
      });
    }
  }

  return {
    success,
    quality,
    outputs,
    consumedMaterials: finalConsumed,
    materialsLost: !success, // In enchanting, materials are always lost on fail
    message,
    criticalFailure,
    backlashEffect
  };
}

// TODO(Architect): Integrate with UI/Inventory System to allow selection of Base Item + Catalysts and display of Critical Failure warnings.
