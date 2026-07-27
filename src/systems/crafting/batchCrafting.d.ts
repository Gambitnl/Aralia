/**
 * @file src/systems/crafting/batchCrafting.ts
 * Batch crafting system - craft multiple items at once.
 */
import { CraftingRecipe } from './alchemyRecipes';
import { Item, PlayerCharacter } from '../../types';
import { RecipeCraftability } from './craftingEngine';
import { CraftingQuality } from './crafterProgression';
export interface BatchCraftingConfig {
    maxBatchSize: number;
    dcIncreasePerItem: number;
    timeMultiplier: number;
}
export declare const DEFAULT_BATCH_CONFIG: BatchCraftingConfig;
export interface BatchCraftabilityResult {
    baseRecipe: RecipeCraftability;
    maxCraftable: number;
    batchSizes: BatchSizeOption[];
}
export interface BatchSizeOption {
    quantity: number;
    effectiveDC: number;
    totalGoldCost: number;
    totalTime: number;
    ingredientsSatisfied: boolean;
}
export interface BatchCraftResult {
    quantity: number;
    results: SingleCraftResult[];
    totalSuccess: number;
    totalFailed: number;
    totalXpGained: number;
    totalTimeSpent: number;
    summary: string;
}
export interface SingleCraftResult {
    success: boolean;
    quality: CraftingQuality;
    roll: number;
    dc: number;
}
/**
 * Calculates how many of a recipe can be batch crafted.
 */
export declare function calculateBatchCraftability(recipe: CraftingRecipe, inventory: Item[], gold: number, config?: BatchCraftingConfig): BatchCraftabilityResult;
/**
 * Attempts to batch craft multiple items.
 * Each item in the batch is rolled separately but with increased DC.
 */
export declare function attemptBatchCraft(recipe: CraftingRecipe, quantity: number, crafterModifier: number, config?: BatchCraftingConfig, crafter?: PlayerCharacter): BatchCraftResult;
/**
 * Generates dispatch actions for batch crafting.
 */
export declare function generateBatchCraftActions(recipe: CraftingRecipe, result: BatchCraftResult): {
    type: string;
    payload: unknown;
}[];
/**
 * Gets the DC increase display for batch size.
 */
export declare function getBatchDCDisplay(basedc: number, quantity: number, config?: BatchCraftingConfig): string;
