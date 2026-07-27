/**
 * @file src/systems/crafting/RefiningSystem.ts
 * System for processing raw materials into refined components (Refining).
 * Focuses on batch processing and efficiency.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Time is an ingredient.
 */
import { Crafter } from './craftingSystem';
import { Recipe, CraftingResult } from './types';
export interface RefiningRecipe extends Recipe {
    recipeType: 'refine';
    /**
     * Defines how efficient the refining process can be.
     * e.g., "For every 5 points above DC, gain 10% more output".
     */
    yieldBonus?: {
        thresholdStep: number;
        bonusPercent: number;
        maxBonus?: number;
    };
}
export interface BatchRefineRequest {
    recipe: RefiningRecipe;
    batchSize: number;
}
export interface BatchRefineResult {
    results: CraftingResult[];
    totalTimeSpent: number;
    totalExperience: number;
    summary: {
        successes: number;
        failures: number;
        totalOutput: Record<string, number>;
        bonusYield: Record<string, number>;
    };
}
/**
 * Calculates the time modifier for batch processing.
 * Larger batches might be slightly more efficient per unit due to setup time amortization.
 */
export declare function calculateBatchTime(baseTime: number, batchSize: number): number;
/**
 * Attempts to refine a batch of materials.
 * NOTE: This function does NOT mutate the actual crafter object's inventory permanently.
 * It simulates the batch and returns the result. The caller (Game Loop/Reducer) must apply the changes.
 */
export declare function processRefiningBatch(crafter: Crafter, request: BatchRefineRequest): BatchRefineResult;
