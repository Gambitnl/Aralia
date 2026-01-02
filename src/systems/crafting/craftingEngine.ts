/**
 * @file src/systems/crafting/craftingEngine.ts
 * Core engine for checking recipe requirements and executing crafting.
 * Enhanced with quality tiers, time advancement, and recipe discovery.
 */
import { Item } from '../../types';
import { CraftingRecipe, CraftingTool, ALL_RECIPES } from './alchemyRecipes';
import { rollDice } from '../../utils/combatUtils';
import {
    determineCraftingQuality,
    CraftingQuality,
    QualityResult,
    CrafterProgression,
    XP_REWARDS,
    addCraftingXP
} from './crafterProgression';

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
    rawRoll: number; // The d20 roll before modifiers
    dc: number;
    message: string;
    outputItem?: { itemId: string; quantity: number };
    materialsConsumed: boolean;
    goldSpent: number;
    quality: CraftingQuality;
    qualityResult: QualityResult;
    xpGained: number;
    timeSpentMinutes: number;
    isNat20: boolean;
    isNat1: boolean;
}

// Crafting time in minutes per workday
const MINUTES_PER_WORKDAY = 480; // 8 hours

/**
 * Counts how many of a specific item are in the inventory.
 */
export function countItemInInventory(inventory: Item[], itemId: string): number {
    return inventory.filter(item => item.id === itemId).length;
}

/**
 * Checks if a specific recipe can be crafted with the current resources.
 */
export function checkRecipeCraftability(
    recipe: CraftingRecipe,
    inventory: Item[],
    gold: number,
    toolProficiencies: string[] = [],
    knownRecipes?: Set<string>
): RecipeCraftability {
    // Check tool proficiency
    const toolMap: Record<CraftingTool, string> = {
        'alchemist_supplies': "Alchemist's Supplies",
        'herbalism_kit': 'Herbalism Kit',
        'poisoners_kit': "Poisoner's Kit"
    };
    const requiredTool = toolMap[recipe.toolRequired];
    const hasTool = toolProficiencies.some(
        t => t.toLowerCase().includes(recipe.toolRequired.replace('_', ' ')) ||
            t.toLowerCase().includes(requiredTool.toLowerCase())
    );

    // Check if recipe is known (if discovery system is active)
    const isKnown = knownRecipes ? knownRecipes.has(recipe.id) : true;

    // Check gold
    const hasEnoughGold = gold >= recipe.goldCost;
    const missingGold = hasEnoughGold ? 0 : recipe.goldCost - gold;

    // Check ingredients
    const ingredientStatuses: IngredientStatus[] = recipe.ingredients.map(req => {
        const available = countItemInInventory(inventory, req.itemId);
        return {
            itemId: req.itemId,
            name: req.name || req.itemId,
            required: req.quantity,
            available,
            isSatisfied: available >= req.quantity
        };
    });

    const hasAllIngredients = ingredientStatuses.every(s => s.isSatisfied);
    const canCraft = hasAllIngredients && hasEnoughGold && isKnown;

    return {
        recipe,
        canCraft,
        hasAllIngredients,
        hasEnoughGold,
        hasTool,
        isKnown,
        ingredientStatuses,
        missingGold
    };
}

/**
 * Gets all recipes and their craftability status.
 */
export function getAllRecipeCraftability(
    inventory: Item[],
    gold: number,
    toolProficiencies: string[] = [],
    filterTool?: CraftingTool,
    knownRecipes?: Set<string>,
    showUnknown: boolean = true
): RecipeCraftability[] {
    let recipes = filterTool
        ? ALL_RECIPES.filter(r => r.toolRequired === filterTool)
        : ALL_RECIPES;

    // Optionally filter to only known recipes
    if (!showUnknown && knownRecipes) {
        recipes = recipes.filter(r => knownRecipes.has(r.id));
    }

    return recipes.map(recipe =>
        checkRecipeCraftability(recipe, inventory, gold, toolProficiencies, knownRecipes)
    );
}

/**
 * Calculates crafting time in minutes.
 */
export function calculateCraftingTime(recipe: CraftingRecipe): number {
    return recipe.craftingDays * MINUTES_PER_WORKDAY;
}

/**
 * Attempts to craft a recipe with the enhanced quality system.
 * Returns the result including quality tier and XP gained.
 */
export function attemptCrafting(
    recipe: CraftingRecipe,
    crafterModifier: number,
    inventory: Item[],
    gold: number,
    progression?: CrafterProgression
): CraftingResult {
    // First, verify we can craft
    const craftability = checkRecipeCraftability(
        recipe,
        inventory,
        gold,
        [],
        progression?.knownRecipes
    );

    const timeSpentMinutes = calculateCraftingTime(recipe);

    if (!craftability.canCraft) {
        let failMessage = 'Cannot craft: ';
        if (!craftability.isKnown) failMessage += 'Recipe not yet discovered. ';
        else if (!craftability.hasEnoughGold) failMessage += `Need ${recipe.goldCost} GP. `;
        else if (!craftability.hasAllIngredients) failMessage += 'Missing ingredients. ';

        return {
            success: false,
            roll: 0,
            rawRoll: 0,
            dc: recipe.craftingDC,
            message: failMessage,
            materialsConsumed: false,
            goldSpent: 0,
            quality: 'ruined',
            qualityResult: determineCraftingQuality(0, recipe.craftingDC, false, false),
            xpGained: 0,
            timeSpentMinutes: 0,
            isNat20: false,
            isNat1: false
        };
    }

    // Roll the crafting check: d20 + modifier + progression bonus
    const rawRoll = rollDice('1d20');
    const progressionBonus = progression?.bonusModifier || 0;
    const totalRoll = rawRoll + crafterModifier + progressionBonus;

    const isNat20 = rawRoll === 20;
    const isNat1 = rawRoll === 1;

    // Determine quality based on roll
    const qualityResult = determineCraftingQuality(totalRoll, recipe.craftingDC, isNat20, isNat1);
    const quality = qualityResult.quality;

    // Materials are consumed regardless (unless crafting wasn't attempted)
    const materialsConsumed = true;
    const goldSpent = recipe.goldCost;

    // Calculate output quantity with quality multiplier
    const baseQuantity = recipe.outputQuantity;
    const finalQuantity = Math.floor(baseQuantity * qualityResult.quantityMultiplier);

    // Calculate XP reward
    let xpGained = XP_REWARDS.failure;
    if (quality !== 'ruined') {
        const rarityXp = XP_REWARDS[`${recipe.rarity}_success` as keyof typeof XP_REWARDS] || 10;
        xpGained = typeof rarityXp === 'number' ? rarityXp : 10;

        if (quality === 'masterwork') xpGained += XP_REWARDS.masterwork_bonus;
        if (quality === 'legendary') xpGained += XP_REWARDS.legendary_bonus;
    }

    // Build result message
    let message = '';
    if (isNat20) {
        message = `🎲 NATURAL 20! `;
    } else if (isNat1) {
        message = `💀 CRITICAL FAILURE! `;
    }

    message += `Roll: ${totalRoll} (${rawRoll}+${crafterModifier + progressionBonus}) vs DC ${recipe.craftingDC}. `;
    message += qualityResult.description;

    if (quality !== 'ruined' && quality !== 'flawed') {
        message += ` Created ${finalQuantity}x ${recipe.name}.`;
        if (quality === 'flawed') {
            message += ' (50% effectiveness)';
        }
    }

    const success = quality !== 'ruined';

    return {
        success,
        roll: totalRoll,
        rawRoll,
        dc: recipe.craftingDC,
        message,
        outputItem: success ? {
            itemId: recipe.outputItemId,
            quantity: finalQuantity
        } : undefined,
        materialsConsumed,
        goldSpent,
        quality,
        qualityResult,
        xpGained,
        timeSpentMinutes,
        isNat20,
        isNat1
    };
}

/**
 * Generates the dispatch actions needed to consume ingredients, gold, and advance time.
 */
export function generateCraftingActions(
    recipe: CraftingRecipe,
    result: CraftingResult
): { type: string; payload: unknown }[] {
    const actions: { type: string; payload: unknown }[] = [];

    // Consume ingredients
    if (result.materialsConsumed) {
        for (const ingredient of recipe.ingredients) {
            actions.push({
                type: 'REMOVE_ITEM',
                payload: { itemId: ingredient.itemId, count: ingredient.quantity }
            });
        }
    }

    // Deduct gold
    if (result.goldSpent > 0) {
        actions.push({
            type: 'MODIFY_GOLD',
            payload: { amount: -result.goldSpent }
        });
    }

    // Advance time (crafting takes time!)
    if (result.timeSpentMinutes > 0) {
        actions.push({
            type: 'ADVANCE_TIME',
            payload: { seconds: result.timeSpentMinutes * 60 }
        });
    }

    // Add output item on success (flawed items still produce output)
    if (result.success && result.outputItem) {
        actions.push({
            type: 'ADD_ITEM',
            payload: { itemId: result.outputItem.itemId, count: result.outputItem.quantity }
        });
    }

    return actions;
}

/**
 * Updates crafter progression after a crafting attempt.
 */
export function updateProgressionAfterCraft(
    progression: CrafterProgression,
    result: CraftingResult
): CrafterProgression {
    // Update stats
    const newStats = { ...progression.stats };
    newStats.totalCrafted++;

    if (result.success) {
        newStats.successfulCrafts++;
        if (result.quality === 'masterwork') newStats.masterworkCrafts++;
        if (result.quality === 'legendary') newStats.legendaryRolls++;
    } else {
        newStats.failedCrafts++;
        if (result.quality === 'ruined') newStats.ruinedMaterials++;
    }

    // Add XP
    let updatedProgression = {
        ...progression,
        stats: newStats
    };

    if (result.xpGained > 0) {
        updatedProgression = addCraftingXP(updatedProgression, result.xpGained);
    }

    return updatedProgression;
}

/**
 * Gets a summary of craftable vs non-craftable recipes for UI display.
 */
export function getCraftingSummary(
    inventory: Item[],
    gold: number,
    toolProficiencies: string[] = [],
    knownRecipes?: Set<string>
): {
    craftable: number;
    total: number;
    known: number;
    byRarity: Record<string, { craftable: number; total: number }>
} {
    const all = getAllRecipeCraftability(inventory, gold, toolProficiencies, undefined, knownRecipes);

    const byRarity: Record<string, { craftable: number; total: number }> = {
        common: { craftable: 0, total: 0 },
        uncommon: { craftable: 0, total: 0 },
        rare: { craftable: 0, total: 0 },
        very_rare: { craftable: 0, total: 0 }
    };

    let craftable = 0;
    let known = 0;

    for (const status of all) {
        byRarity[status.recipe.rarity].total++;
        if (status.isKnown) known++;
        if (status.canCraft) {
            craftable++;
            byRarity[status.recipe.rarity].craftable++;
        }
    }

    return {
        craftable,
        total: all.length,
        known,
        byRarity
    };
}

/**
 * Gets the quality color for UI display.
 */
export function getQualityColor(quality: CraftingQuality): string {
    switch (quality) {
        case 'ruined': return '#ff4444';
        case 'flawed': return '#ff9944';
        case 'standard': return '#aaaaaa';
        case 'masterwork': return '#44aaff';
        case 'legendary': return '#ffaa00';
        default: return '#ffffff';
    }
}

/**
 * Gets the quality icon for UI display.
 */
export function getQualityIcon(quality: CraftingQuality): string {
    switch (quality) {
        case 'ruined': return '💔';
        case 'flawed': return '⚠️';
        case 'standard': return '✓';
        case 'masterwork': return '⭐';
        case 'legendary': return '🌟';
        default: return '?';
    }
}
