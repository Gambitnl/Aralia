/**
 * @file src/systems/crafting/CookingSystem.ts
 * System for cooking meals, supporting ingredient substitutions via tags.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Skill affects quality.
 */
import { Crafter } from './craftingSystem';
import { Recipe, CraftingResult, MaterialRequirement } from './types';
export declare const INGREDIENT_TAGS: Record<string, string[]>;
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
export declare function resolveCookingRecipe(crafter: Crafter, recipe: CookingRecipe): Recipe | null;
/**
 * Attempts to cook a meal.
 * Validates flexible ingredients, resolves them to specific items, then executes a standard craft.
 */
export declare function attemptCooking(crafter: Crafter, recipe: CookingRecipe): CraftingResult;
