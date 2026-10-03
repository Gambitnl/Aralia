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
export function countItemQuantity(inventory: Item[], itemId: string): number {
    return inventory.reduce(
        (total, item) => (item.id === itemId ? total + (item.quantity ?? 1) : total),
        0,
    );
}

/** Aggregates the flat Item[] inventory into the Crafter {itemId, quantity}[] shape. */
export function buildCrafterInventory(inventory: Item[]): { itemId: string; quantity: number }[] {
    const byId = new Map<string, number>();
    for (const item of inventory) {
        byId.set(item.id, (byId.get(item.id) ?? 0) + (item.quantity ?? 1));
    }
    return Array.from(byId, ([itemId, quantity]) => ({ itemId, quantity }));
}

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
export function getRecipeReadiness(recipe: Recipe, inventory: Item[]): RecipeReadiness {
    const inputs = recipe.inputs.map(input => {
        const available = countItemQuantity(inventory, input.itemId);
        return {
            itemId: input.itemId,
            required: input.quantity,
            available,
            satisfied: available >= input.quantity,
            consumed: input.consumed,
        };
    });
    return { inputs, canCraft: inputs.every(i => i.satisfied) };
}

/**
 * Largest batch the inventory can feed. Only consumed inputs limit the batch;
 * tools (consumed: false) just need to be present once.
 */
export function getMaxBatchSize(recipe: RefiningRecipe, inventory: Item[], cap = 10): number {
    let max = cap;
    for (const input of recipe.inputs) {
        const available = countItemQuantity(inventory, input.itemId);
        if (!input.consumed) {
            if (available < input.quantity) return 0;
            continue;
        }
        max = Math.min(max, Math.floor(available / input.quantity));
    }
    return Math.max(0, max);
}

/**
 * Converts a batch refine result into reducer actions:
 * remove everything consumed, add the total output, advance time.
 */
export function buildRefineBatchActions(result: BatchRefineResult): CraftingDispatchAction[] {
    const actions: CraftingDispatchAction[] = [];

    const consumedTotals = new Map<string, number>();
    for (const step of result.results) {
        for (const consumed of step.consumedMaterials) {
            consumedTotals.set(
                consumed.itemId,
                (consumedTotals.get(consumed.itemId) ?? 0) + consumed.quantity,
            );
        }
    }
    for (const [itemId, count] of consumedTotals) {
        actions.push({ type: 'REMOVE_ITEM', payload: { itemId, count } });
    }

    for (const [itemId, count] of Object.entries(result.summary.totalOutput)) {
        if (count > 0) actions.push({ type: 'ADD_ITEM', payload: { itemId, count } });
    }

    if (result.totalTimeSpent > 0) {
        actions.push({ type: 'ADVANCE_TIME', payload: { seconds: Math.round(result.totalTimeSpent * 60) } });
    }

    return actions;
}

/**
 * Converts an enchant attempt into reducer actions. The engine already decided
 * what survives a failure (base item preserved unless critical failure), so we
 * only mirror its consumed/output lists. Time is always spent on an attempt.
 */
export function buildEnchantActions(
    recipe: Recipe,
    result: EnchantingResult,
): CraftingDispatchAction[] {
    const actions: CraftingDispatchAction[] = [];

    for (const consumed of result.consumedMaterials) {
        actions.push({
            type: 'REMOVE_ITEM',
            payload: { itemId: consumed.itemId, count: consumed.quantity },
        });
    }
    for (const output of result.outputs) {
        actions.push({ type: 'ADD_ITEM', payload: { itemId: output.itemId, count: output.quantity } });
    }
    if (recipe.timeMinutes > 0) {
        actions.push({ type: 'ADVANCE_TIME', payload: { seconds: recipe.timeMinutes * 60 } });
    }

    return actions;
}
