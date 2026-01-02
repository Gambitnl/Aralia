/**
 * @file src/systems/crafting/batchCrafting.ts
 * Batch crafting system - craft multiple items at once.
 */
import { CraftingRecipe } from './alchemyRecipes';
import { Item } from '../../types';
import { checkRecipeCraftability, RecipeCraftability } from './craftingEngine';
import { rollDice } from '../../utils/combatUtils';
import { determineCraftingQuality, CraftingQuality, QualityResult } from './crafterProgression';

export interface BatchCraftingConfig {
    maxBatchSize: number;
    dcIncreasePerItem: number;
    timeMultiplier: number; // Time per additional item (e.g., 0.8 means 80% of base time per extra)
}

export const DEFAULT_BATCH_CONFIG: BatchCraftingConfig = {
    maxBatchSize: 5,
    dcIncreasePerItem: 1,
    timeMultiplier: 0.8
};

export interface BatchCraftabilityResult {
    baseRecipe: RecipeCraftability;
    maxCraftable: number;
    batchSizes: BatchSizeOption[];
}

export interface BatchSizeOption {
    quantity: number;
    effectiveDC: number;
    totalGoldCost: number;
    totalTime: number; // In minutes
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
export function calculateBatchCraftability(
    recipe: CraftingRecipe,
    inventory: Item[],
    gold: number,
    config: BatchCraftingConfig = DEFAULT_BATCH_CONFIG
): BatchCraftabilityResult {
    const baseRecipe = checkRecipeCraftability(recipe, inventory, gold);

    // Calculate max craftable based on ingredients
    let maxByIngredients = Infinity;
    for (const ing of recipe.ingredients) {
        const available = inventory.filter(item => item.id === ing.itemId).length;
        const canMake = Math.floor(available / ing.quantity);
        maxByIngredients = Math.min(maxByIngredients, canMake);
    }

    // Calculate max by gold
    const maxByGold = Math.floor(gold / recipe.goldCost);

    // Overall max
    const maxCraftable = Math.min(maxByIngredients, maxByGold, config.maxBatchSize);

    // Generate batch size options
    const batchSizes: BatchSizeOption[] = [];
    for (let qty = 1; qty <= Math.min(maxCraftable + 1, config.maxBatchSize); qty++) {
        const ingredientsSatisfied = qty <= maxByIngredients && qty <= maxByGold;

        batchSizes.push({
            quantity: qty,
            effectiveDC: recipe.craftingDC + (config.dcIncreasePerItem * (qty - 1)),
            totalGoldCost: recipe.goldCost * qty,
            totalTime: recipe.craftingDays * 480 * (1 + (config.timeMultiplier * (qty - 1))),
            ingredientsSatisfied
        });
    }

    return {
        baseRecipe,
        maxCraftable,
        batchSizes
    };
}

/**
 * Attempts to batch craft multiple items.
 * Each item in the batch is rolled separately but with increased DC.
 */
export function attemptBatchCraft(
    recipe: CraftingRecipe,
    quantity: number,
    crafterModifier: number,
    config: BatchCraftingConfig = DEFAULT_BATCH_CONFIG
): BatchCraftResult {
    const effectiveDC = recipe.craftingDC + (config.dcIncreasePerItem * (quantity - 1));
    const results: SingleCraftResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalXpGained = 0;

    // Roll for each item in the batch
    for (let i = 0; i < quantity; i++) {
        const rawRoll = rollDice('1d20');
        const totalRoll = rawRoll + crafterModifier;
        const isNat20 = rawRoll === 20;
        const isNat1 = rawRoll === 1;

        const qualityResult = determineCraftingQuality(totalRoll, effectiveDC, isNat20, isNat1);
        const success = qualityResult.quality !== 'ruined';

        results.push({
            success,
            quality: qualityResult.quality,
            roll: totalRoll,
            dc: effectiveDC
        });

        if (success) {
            totalSuccess++;
            totalXpGained += 10; // Base XP per success
            if (qualityResult.quality === 'masterwork') totalXpGained += 5;
            if (qualityResult.quality === 'legendary') totalXpGained += 20;
        } else {
            totalFailed++;
            totalXpGained += 2; // Small XP for failures
        }
    }

    // Calculate total time
    const totalTimeSpent = recipe.craftingDays * 480 * (1 + (config.timeMultiplier * (quantity - 1)));

    // Generate summary
    const qualityCounts: Record<CraftingQuality, number> = {
        ruined: 0,
        flawed: 0,
        standard: 0,
        masterwork: 0,
        legendary: 0
    };
    for (const result of results) {
        qualityCounts[result.quality]++;
    }

    let summary = `Batch Craft Complete (${quantity}x ${recipe.name}):\n`;
    summary += `✓ ${totalSuccess} succeeded, ✗ ${totalFailed} failed\n`;
    if (qualityCounts.legendary > 0) summary += `🌟 ${qualityCounts.legendary} Legendary\n`;
    if (qualityCounts.masterwork > 0) summary += `⭐ ${qualityCounts.masterwork} Masterwork\n`;
    if (qualityCounts.flawed > 0) summary += `⚠️ ${qualityCounts.flawed} Flawed\n`;

    return {
        quantity,
        results,
        totalSuccess,
        totalFailed,
        totalXpGained,
        totalTimeSpent,
        summary
    };
}

/**
 * Generates dispatch actions for batch crafting.
 */
export function generateBatchCraftActions(
    recipe: CraftingRecipe,
    result: BatchCraftResult
): { type: string; payload: unknown }[] {
    const actions: { type: string; payload: unknown }[] = [];

    // Remove ingredients for ALL attempted crafts (even failures)
    for (const ing of recipe.ingredients) {
        actions.push({
            type: 'REMOVE_ITEM',
            payload: { itemId: ing.itemId, count: ing.quantity * result.quantity }
        });
    }

    // Deduct gold for all
    actions.push({
        type: 'MODIFY_GOLD',
        payload: { amount: -(recipe.goldCost * result.quantity) }
    });

    // Add time
    actions.push({
        type: 'ADVANCE_TIME',
        payload: { seconds: result.totalTimeSpent * 60 }
    });

    // Add successful items
    // Count output by quality (legendary gets double)
    let totalOutput = 0;
    for (const r of result.results) {
        if (r.success) {
            let outputQty = recipe.outputQuantity;
            if (r.quality === 'legendary') outputQty *= 2;
            if (r.quality === 'flawed') outputQty = Math.max(1, Math.floor(outputQty * 0.5));
            totalOutput += outputQty;
        }
    }

    if (totalOutput > 0) {
        actions.push({
            type: 'ADD_ITEM',
            payload: { itemId: recipe.outputItemId, count: totalOutput }
        });
    }

    return actions;
}

/**
 * Gets the DC increase display for batch size.
 */
export function getBatchDCDisplay(basedc: number, quantity: number, config: BatchCraftingConfig = DEFAULT_BATCH_CONFIG): string {
    const increase = (quantity - 1) * config.dcIncreasePerItem;
    if (increase === 0) return `DC ${basedc}`;
    return `DC ${basedc + increase} (+${increase})`;
}
