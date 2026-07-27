/**
 * @file src/systems/crafting/craftingEngine.ts
 * Core engine for checking recipe requirements and executing crafting.
 * Enhanced with quality tiers, time advancement, and recipe discovery.
 */
import { Item, PlayerCharacter } from '../../types';
import { CraftingRecipe, CraftingTool } from './alchemyRecipes';
import { CraftingQuality, QualityResult, CrafterProgression } from './crafterProgression';
export interface IngredientStatus {
    itemId: string;
    name: string;
    required: number;
    available: number;
    isSatisfied: boolean;
}
export interface RecipeCraftability {
    recipe: CraftingRecipe;
    canCraft: boolean;
    hasAllIngredients: boolean;
    hasEnoughGold: boolean;
    hasTool: boolean;
    isKnown: boolean;
    ingredientStatuses: IngredientStatus[];
    missingGold: number;
}
export interface CraftingResult {
    success: boolean;
    roll: number;
    rawRoll: number;
    dc: number;
    message: string;
    outputItem?: {
        itemId: string;
        quantity: number;
    };
    materialsConsumed: boolean;
    goldSpent: number;
    quality: CraftingQuality;
    qualityResult: QualityResult;
    xpGained: number;
    timeSpentMinutes: number;
    isNat20: boolean;
    isNat1: boolean;
    modifiersApplied?: {
        source: string;
        value: number;
    }[];
}
/**
 * Counts matching inventory rows for older callers that still want entry count.
 */
export declare function countItemInInventory(inventory: Item[], itemId: string): number;
/**
 * Checks if a specific recipe can be crafted with the current resources.
 */
export declare function checkRecipeCraftability(recipe: CraftingRecipe, inventory: Item[], gold: number, toolProficiencies?: string[], knownRecipes?: Set<string>): RecipeCraftability;
/**
 * Gets all recipes and their craftability status.
 */
export declare function getAllRecipeCraftability(inventory: Item[], gold: number, toolProficiencies?: string[], filterTool?: CraftingTool, knownRecipes?: Set<string>, showUnknown?: boolean): RecipeCraftability[];
/**
 * Calculates crafting time in minutes.
 */
export declare function calculateCraftingTime(recipe: CraftingRecipe): number;
/**
 * Attempts to craft a recipe with the enhanced quality system.
 * Returns the result including quality tier and XP gained.
 */
export declare function attemptCrafting(recipe: CraftingRecipe, crafterModifier: number, inventory: Item[], gold: number, progression?: CrafterProgression, crafter?: PlayerCharacter): CraftingResult;
/**
 * Generates the dispatch actions needed to consume ingredients, gold, and advance time.
 */
export declare function generateCraftingActions(recipe: CraftingRecipe, result: CraftingResult): {
    type: string;
    payload: unknown;
}[];
/**
 * Updates crafter progression after a crafting attempt.
 */
export declare function updateProgressionAfterCraft(progression: CrafterProgression, result: CraftingResult): CrafterProgression;
/**
 * Gets a summary of craftable vs non-craftable recipes for UI display.
 */
export declare function getCraftingSummary(inventory: Item[], gold: number, toolProficiencies?: string[], knownRecipes?: Set<string>): {
    craftable: number;
    total: number;
    known: number;
    byRarity: Record<string, {
        craftable: number;
        total: number;
    }>;
};
/**
 * Gets the quality color for UI display.
 */
export declare function getQualityColor(quality: CraftingQuality): string;
/**
 * Gets the quality icon for UI display.
 */
export declare function getQualityIcon(quality: CraftingQuality): string;
