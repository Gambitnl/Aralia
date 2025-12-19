/**
 * @file src/systems/crafting/salvageSystem.ts
 * Logic for salvaging/disassembling items into materials.
 * ALCHEMIST PHILOSOPHY: Destruction should cost resources (the item) and failure teaches (loss of materials).
 */
import { Recipe, CraftingResult } from './types';
import { Crafter } from './craftingSystem';

/**
 * Attempts to salvage an item using the provided recipe.
 *
 * Salvage Rules:
 * - Input item is ALWAYS consumed (it's being broken down).
 * - Success: Returns materials (outputs).
 * - Failure: Returns nothing (scrap), item is lost.
 * - Critical Success: Returns materials + potential bonus (implemented as superior quality for now).
 */
export function attemptSalvage(crafter: Crafter, recipe: Recipe): CraftingResult {
  // 1. Validate: Ensure recipe is a salvage recipe
  if (recipe.recipeType !== 'salvage') {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Invalid recipe type for salvage.'
    };
  }

  // 2. Validate: Check if crafter has the item to salvage
  // In salvage recipes, inputs usually contain the item to be destroyed.
  const missingInputs = recipe.inputs.filter(input => {
    const itemInInventory = crafter.inventory.find(i => i.itemId === input.itemId);
    const qty = itemInInventory ? itemInInventory.quantity : 0;
    return qty < input.quantity;
  });

  if (missingInputs.length > 0) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Missing item to salvage.'
    };
  }

  // 3. Perform Skill Check
  let roll = 0;
  let success = true;
  let quality: 'poor' | 'standard' | 'superior' | 'masterwork' = 'standard';

  // Default DC if none provided (salvaging usually requires some care)
  const dc = recipe.skillCheck?.dc || 10;
  const skillName = recipe.skillCheck?.skill || 'Strength'; // Fallback skill

  if (recipe.skillCheck) {
    roll = crafter.rollSkill(skillName);

    if (roll < dc) {
      success = false;
      quality = 'poor';
    } else if (roll >= dc + 10) {
      quality = 'superior';
    }
  }

  // 4. Determine Outcomes
  const outputs: { itemId: string; quantity: number }[] = [];
  const consumed: { itemId: string; quantity: number }[] = [];

  // Always consume inputs for salvage (you broke it!)
  for (const input of recipe.inputs) {
    if (input.consumed) {
      consumed.push({ itemId: input.itemId, quantity: input.quantity });
    }
  }

  if (success) {
    for (const output of recipe.outputs) {
      let qty = output.quantity;
      // Bonus for superior salvage?
      if (quality === 'superior' && output.qualityBound) {
         qty = Math.ceil(qty * 1.5); // 50% bonus yield
      }
      outputs.push({ itemId: output.itemId, quantity: qty });
    }
  }

  return {
    success,
    quality,
    outputs: success ? outputs : [],
    consumedMaterials: consumed,
    materialsLost: true, // For salvage, the input is always "lost" (transformed), but on failure it's wasted.
    message: success
      ? `Successfully salvaged ${recipe.name}. Received materials.`
      : `Failed to salvage ${recipe.name}. The item was ruined.`
  };
}
