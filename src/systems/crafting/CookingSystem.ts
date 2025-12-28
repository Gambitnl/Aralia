/**
 * @file src/systems/crafting/CookingSystem.ts
 * System for cooking meals, supporting ingredient substitutions via tags.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Skill affects quality.
 */
import { Crafter, attemptCraft } from './craftingSystem';
import { Recipe, CraftingResult, MaterialRequirement } from './types';

// Mock Tag Database (In a real system, this would be on the Item definitions)
// TODO(Alchemist): Move these tags to the Item definitions in src/data/items/ or src/types/items.ts
export const INGREDIENT_TAGS: Record<string, string[]> = {
  'venison': ['meat', 'protein'],
  'raw_beef': ['meat', 'protein'],
  'carrot': ['vegetable', 'root'],
  'potato': ['vegetable', 'root', 'starch'],
  'onion': ['vegetable', 'aromatic'],
  'garlic': ['vegetable', 'aromatic', 'spice'],
  'herb_red_root': ['herb', 'spice'],
  'water_clean': ['water', 'liquid'],
  'bread': ['starch', 'grain'],
};

export interface CookingMaterialRequirement extends Omit<MaterialRequirement, 'itemId'> {
  /** Specific Item ID required (standard). */
  itemId?: string;
  /** OR a tag that satisfies the requirement (e.g. 'meat'). */
  tag?: string;
}

export interface CookingRecipe extends Omit<Recipe, 'inputs'> {
  inputs: CookingMaterialRequirement[];
  recipeType: 'cooking';
}

/**
 * Resolves a CookingRecipe into a concrete Recipe by finding matching ingredients in the Crafter's inventory.
 * Returns null if ingredients are missing.
 */
export function resolveCookingRecipe(crafter: Crafter, recipe: CookingRecipe): Recipe | null {
  const concreteInputs: MaterialRequirement[] = [];

  // Clone inventory availability to track usage across multiple inputs
  // (e.g. if recipe needs 2 meats, we need to make sure we don't use the same piece twice if quantity is low)
  const availableInventory = crafter.inventory.map(i => ({ ...i }));

  for (const input of recipe.inputs) {
    let foundItemId: string | null = null;

    if (input.itemId) {
      // Direct Item Match
      const item = availableInventory.find(i => i.itemId === input.itemId && i.quantity >= input.quantity);
      if (item) {
        foundItemId = item.itemId;
      }
    } else if (input.tag) {
      // Tag Match
      // Strategy: Find FIRST item with the tag that has enough quantity.
      // (Future: Prioritize expiring items or allow mixing types? For now, simple single-item slot fill).
      const match = availableInventory.find(i => {
        const tags = INGREDIENT_TAGS[i.itemId] || [];
        return tags.includes(input.tag!) && i.quantity >= input.quantity;
      });

      if (match) {
        foundItemId = match.itemId;
      }
    }

    if (!foundItemId) {
      return null; // Missing ingredient
    }

    // "Consume" from our temp availability tracker
    const invItem = availableInventory.find(i => i.itemId === foundItemId)!;
    invItem.quantity -= input.quantity;

    concreteInputs.push({
      itemId: foundItemId,
      quantity: input.quantity,
      consumed: input.consumed
    });
  }

  // Construct valid base Recipe
  return {
    ...recipe,
    inputs: concreteInputs,
    recipeType: 'cooking' // Ensure type is correct
  };
}

/**
 * Attempts to cook a meal.
 * Validates flexible ingredients, resolves them to specific items, then executes a standard craft.
 */
export function attemptCooking(crafter: Crafter, recipe: CookingRecipe): CraftingResult {
  const concreteRecipe = resolveCookingRecipe(crafter, recipe);

  if (!concreteRecipe) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Missing ingredients for cooking.'
    };
  }

  // Delegate to the core crafting system with the fully resolved recipe
  return attemptCraft(crafter, concreteRecipe);
}
