/**
 * @file src/systems/crafting/craftingSystem.ts
 * Core logic for crafting items, including recipe validation and execution.
 */
import { Recipe, CraftingResult, MaterialRequirement } from './types';

/**
 * Interface representing a character capable of crafting.
 * Decoupled from full Character object to allow easier testing and usage.
 */
export interface Crafter {
  id: string;
  name: string;
  inventory: { itemId: string; quantity: number }[];
  /**
   * Callback to roll a skill check.
   * Returns a number representing the total roll (d20 + modifiers).
   */
  rollSkill: (skillName: string) => number;
}

/**
 * Checks if the crafter has the necessary materials for a recipe.
 */
export function canCraft(crafter: Crafter, recipe: Recipe): boolean {
  for (const input of recipe.inputs) {
    const itemInInventory = crafter.inventory.find(i => i.itemId === input.itemId);
    const quantity = itemInInventory ? itemInInventory.quantity : 0;

    if (quantity < input.quantity) {
      return false;
    }
  }
  return true;
}

/**
 * Attempts to craft an item using the provided recipe.
 */
export function attemptCraft(crafter: Crafter, recipe: Recipe): CraftingResult {
  // 1. Validate Materials
  if (!canCraft(crafter, recipe)) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Insufficient materials.'
    };
  }

  // 2. Perform Skill Check (if required)
  let roll = 0;
  let success = true;
  let quality: 'poor' | 'standard' | 'superior' | 'masterwork' = 'standard';
  let materialsLost = false;

  if (recipe.skillCheck) {
    roll = crafter.rollSkill(recipe.skillCheck.skill);
    const dc = recipe.skillCheck.dc;

    if (roll < dc) {
      // Failure
      success = false;
      materialsLost = true; // Strict ALCHEMIST philosophy: Failure costs resources
      quality = 'poor';
    } else if (roll >= dc + 10) {
      // Critical Success
      quality = 'superior';
    } else if (roll >= dc + 5) {
      // Good Success (could define 'standard' as baseline, but let's allow superior)
      // For now, let's keep it simple: > DC+10 is superior, else standard.
    }
  }

  // 3. Determine Outcomes
  const outputs: { itemId: string; quantity: number }[] = [];
  const consumed: { itemId: string; quantity: number }[] = [];

  // Determine consumed materials
  // Even on failure, if materialsLost is true, we consume "consumed" inputs
  // If failure but materialsLost is false (e.g. tools broke but materials safe? - simpler to just consume on fail usually)
  // Logic: If success, consume inputs. If fail and materialsLost, consume inputs.
  if (success || materialsLost) {
    for (const input of recipe.inputs) {
      if (input.consumed) {
        consumed.push({ itemId: input.itemId, quantity: input.quantity });
      }
    }
  }

  if (success) {
    for (const output of recipe.outputs) {
      let qty = output.quantity;
      // Future: apply quality bonuses to quantity or item ID mapping
      outputs.push({ itemId: output.itemId, quantity: qty });
    }
  }

  return {
    success,
    quality,
    outputs: success ? outputs : [],
    consumedMaterials: consumed,
    materialsLost: !success && materialsLost,
    message: success
      ? `Successfully crafted ${recipe.name} (${quality}).`
      : `Failed to craft ${recipe.name}. Materials ${materialsLost ? 'lost' : 'preserved'}.`
  };
}
