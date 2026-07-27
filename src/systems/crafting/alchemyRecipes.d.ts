/**
 * @file src/systems/crafting/alchemyRecipes.ts
 * Complete recipe definitions for Alchemy, Herbalism, and Poisoner's Kit crafting.
 * Based on the PDF source material.
 */
export type RecipeRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';
export type CraftingTool = 'alchemist_supplies' | 'herbalism_kit' | 'poisoners_kit';
export interface RecipeIngredient {
    itemId: string;
    quantity: number;
    name?: string;
}
export interface CraftingRecipe {
    id: string;
    name: string;
    description: string;
    rarity: RecipeRarity;
    craftingDC: number;
    craftingDays: number;
    goldCost: number;
    ingredients: RecipeIngredient[];
    outputItemId: string;
    outputQuantity: number;
    toolRequired: CraftingTool;
    category: 'potion' | 'oil' | 'poison' | 'bomb' | 'utility' | 'ink';
}
export declare const ALL_RECIPES: CraftingRecipe[];
export declare function getRecipeById(id: string): CraftingRecipe | undefined;
export declare function getRecipesByTool(tool: CraftingTool): CraftingRecipe[];
export declare function getRecipesByRarity(rarity: RecipeRarity): CraftingRecipe[];
export declare function getRecipesByCategory(category: CraftingRecipe['category']): CraftingRecipe[];
/**
 * Gets the research cost and time for learning a new recipe by rarity.
 */
export declare function getResearchCost(rarity: string): {
    gold: number;
    days: number;
};
