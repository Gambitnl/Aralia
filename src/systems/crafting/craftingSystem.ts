
import { Recipe, CraftResult, Crafter } from './types';

/**
 * Validates if the crafter has the necessary materials.
 * Note: This is a pure function that checks a list of available items against the recipe.
 * It does not check the inventory of a 'Character' object directly to avoid tight coupling.
 */
export function validateMaterials(
  availableItems: { itemId: string; quantity: number }[],
  recipe: Recipe
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const input of recipe.inputs) {
    const item = availableItems.find(i => i.itemId === input.itemId);
    if (!item || item.quantity < input.quantity) {
      missing.push(input.itemId);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Attempts to craft an item based on the recipe and a skill roll.
 * The roll is passed in to allow for external dice rolling logic (UI, 3D dice, etc).
 */
export function attemptCraft(
  recipe: Recipe,
  skillRollTotal: number
): CraftResult {
  // 1. Check DC
  if (recipe.skillCheck) {
    const dc = recipe.skillCheck.difficultyClass;

    // Critical Failure (Generic rule: fail by 10 or more)
    if (skillRollTotal <= dc - 10) {
       return {
         success: false,
         quality: 'poor',
         details: 'Critical failure. Materials ruined.',
         materialsLost: true
       };
    }

    // Failure
    if (skillRollTotal < dc) {
      return {
        success: false,
        quality: 'poor',
        details: 'Crafting failed. Materials salvageable.',
        materialsLost: false // Benevolent DM rule: you just fail to make progress
      };
    }

    // Critical Success (Generic rule: succeed by 10 or more)
    if (skillRollTotal >= dc + 10) {
      return {
        success: true,
        quality: 'superior',
        details: 'Masterpiece created!',
        materialsLost: true, // Consumed to make the item
        outputs: recipe.outputs.map(o => ({
            itemId: o.itemId,
            quantity: o.quantity * (o.qualityFromRoll ? 2 : 1) // Example bonus
        }))
      };
    }
  }

  // Standard Success
  return {
    success: true,
    quality: 'standard',
    details: 'Crafting successful.',
    materialsLost: true,
    outputs: recipe.outputs.map(o => ({
        itemId: o.itemId,
        quantity: o.quantity
    }))
  };
}

// TODO(Architect): Integrate `attemptCraft` into `ActionPane.tsx` or a new `CraftingStation` component to allow players to trigger this logic.
