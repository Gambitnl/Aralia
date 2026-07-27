/**
 * @file src/components/Crafting/refiningEnchantingSelectors.ts
 * Pure helpers for the dedicated Refining & Enchanting panel (crafting G5).
 *
 * Bridges live game inventory (Item[] with per-row quantity) to the lightweight
 * Crafter contract the RefiningSystem/EnchantingSystem engines expect, and
 * turns engine results into reducer actions.
 */
import { Item } from '../../types';
import { Recipe } from '../../systems/crafting/types';
import { BatchRefineResult, RefiningRecipe } from '../../systems/crafting/RefiningSystem';
import { EnchantingResult } from '../../systems/crafting/EnchantingSystem';
/** Reducer-facing action shape (matches generateCraftingActions in craftingEngine). */
export interface CraftingDispatchAction {
    type: string;
    payload: unknown;
}
/** Sums the full stack quantity of an item id across inventory rows. */
export declare function countItemQuantity(inventory: Item[], itemId: string): number;
/** Aggregates the flat Item[] inventory into the Crafter {itemId, quantity}[] shape. */
export declare function buildCrafterInventory(inventory: Item[]): {
    itemId: string;
    quantity: number;
}[];
export interface RecipeInputStatus {
    itemId: string;
    required: number;
    available: number;
    satisfied: boolean;
    consumed: boolean;
}
export interface RecipeReadiness {
    inputs: RecipeInputStatus[];
    canCraft: boolean;
}
/** Per-input availability for a recipe against live inventory. */
export declare function getRecipeReadiness(recipe: Recipe, inventory: Item[]): RecipeReadiness;
/**
 * Largest batch the inventory can feed. Only consumed inputs limit the batch;
 * tools (consumed: false) just need to be present once.
 */
export declare function getMaxBatchSize(recipe: RefiningRecipe, inventory: Item[], cap?: number): number;
/**
 * Converts a batch refine result into reducer actions:
 * remove everything consumed, add the total output, advance time.
 */
export declare function buildRefineBatchActions(result: BatchRefineResult): CraftingDispatchAction[];
/**
 * Converts an enchant attempt into reducer actions. The engine already decided
 * what survives a failure (base item preserved unless critical failure), so we
 * only mirror its consumed/output lists. Time is always spent on an attempt.
 */
export declare function buildEnchantActions(recipe: Recipe, result: EnchantingResult): CraftingDispatchAction[];
