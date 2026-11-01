/**
 * @file src/systems/crafting/__tests__/craftingEngine.coverage.test.ts
 * Coverage pass (gap C14) for the crafting engine helpers. The d20 is mocked
 * so each test chooses its roll. The crafter (PlayerCharacter) path goes
 * through rollAbilityCheck and is not covered here.
 *
 * Deliberately NOT pinned: canCraft ignores hasTool (a recipe is craftable
 * with no tool proficiency), and attemptCrafting always passes an empty tool
 * list. The in-code comment says the check validates tools, so this is
 * reported as a suspected bug instead of being tested.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rollDiceMock = vi.hoisted(() => vi.fn<(notation: string) => number>());
vi.mock('../../dice/rollers', () => ({ rollDice: rollDiceMock }));

import { ItemType } from '../../../types';
import type { Item } from '../../../types';
import { ALL_RECIPES } from '../alchemyRecipes';
import type { CraftingRecipe } from '../alchemyRecipes';
import { createCrafterProgression, XP_REWARDS } from '../crafterProgression';
import {
    attemptCrafting,
    calculateCraftingTime,
    countItemInInventory,
    getAllRecipeCraftability,
    getCraftingSummary,
    getQualityColor,
    getQualityIcon,
    updateProgressionAfterCraft
} from '../craftingEngine';
import type { CraftingResult } from '../craftingEngine';

const recipe: CraftingRecipe = {
    id: 'engine_coverage_salve',
    name: 'Engine Coverage Salve',
    description: 'Fixture for engine coverage.',
    rarity: 'uncommon',
    craftingDC: 15,
    craftingDays: 2,
    goldCost: 20,
    ingredients: [{ itemId: 'rowan_berry', quantity: 2, name: 'Rowan Berry' }],
    outputItemId: 'engine_coverage_salve',
    outputQuantity: 3,
    toolRequired: 'herbalism_kit',
    category: 'potion'
};

function berry(quantity?: number): Item {
    return {
        id: 'rowan_berry',
        name: 'Rowan Berry',
        description: 'Engine coverage reagent.',
        type: ItemType.Reagent,
        ...(quantity === undefined ? {} : { quantity })
    };
}

const enoughBerries: Item[] = [berry(5)];

beforeEach(() => {
    rollDiceMock.mockReset();
});

describe('countItemInInventory', () => {
    it('counts matching rows, not stack quantity', () => {
        const inventory = [berry(5), berry(), { ...berry(), id: 'oil_flask', name: 'Flask of Oil' }];
        expect(countItemInInventory(inventory, 'rowan_berry')).toBe(2);
        expect(countItemInInventory(inventory, 'oil_flask')).toBe(1);
        expect(countItemInInventory(inventory, 'missing')).toBe(0);
        expect(countItemInInventory([], 'rowan_berry')).toBe(0);
    });
});

describe('calculateCraftingTime', () => {
    it('uses an 8-hour (480 minute) workday', () => {
        expect(calculateCraftingTime(recipe)).toBe(960);
        expect(calculateCraftingTime({ ...recipe, craftingDays: 0 })).toBe(0);
    });
});

describe('getAllRecipeCraftability', () => {
    it('returns one status per recipe when unfiltered', () => {
        const all = getAllRecipeCraftability([], 0);
        expect(all.length).toBe(ALL_RECIPES.length);
        expect(all.every(s => !s.canCraft)).toBe(true);
    });

    it('filters by tool', () => {
        const poisons = getAllRecipeCraftability([], 0, [], 'poisoners_kit');
        expect(poisons.length).toBeGreaterThan(0);
        expect(poisons.every(s => s.recipe.toolRequired === 'poisoners_kit')).toBe(true);
    });

    it('keeps unknown recipes by default and hides them when showUnknown is false', () => {
        const known = new Set(['smokebomb', 'antitoxin']);
        const shown = getAllRecipeCraftability([], 0, [], undefined, known);
        expect(shown.length).toBe(ALL_RECIPES.length);
        expect(shown.filter(s => s.isKnown).map(s => s.recipe.id).sort()).toEqual(['antitoxin', 'smokebomb']);

        const hidden = getAllRecipeCraftability([], 0, [], undefined, known, false);
        expect(hidden.map(s => s.recipe.id).sort()).toEqual(['antitoxin', 'smokebomb']);
    });
});

describe('attemptCrafting', () => {
    it('refuses without rolling when the recipe is unknown', () => {
        const progression = createCrafterProgression();
        const result = attemptCrafting(recipe, 0, enoughBerries, 100, progression);
        expect(rollDiceMock).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.materialsConsumed).toBe(false);
        expect(result.goldSpent).toBe(0);
        expect(result.timeSpentMinutes).toBe(0);
        expect(result.xpGained).toBe(0);
        expect(result.message).toContain('Recipe not yet discovered');
    });

    it('refuses for missing gold, then for missing ingredients', () => {
        expect(attemptCrafting(recipe, 0, enoughBerries, 19).message).toContain('Need 20 GP');
        expect(attemptCrafting(recipe, 0, [berry(1)], 100).message).toContain('Missing ingredients');
        expect(rollDiceMock).not.toHaveBeenCalled();
    });

    it('adds the modifier and progression bonus to the d20 and produces standard output', () => {
        rollDiceMock.mockReturnValueOnce(10);
        const progression = { ...createCrafterProgression(), knownRecipes: new Set([recipe.id]), bonusModifier: 2 };
        const result = attemptCrafting(recipe, 3, enoughBerries, 100, progression);

        expect(rollDiceMock).toHaveBeenCalledWith('1d20');
        expect(result.rawRoll).toBe(10);
        expect(result.roll).toBe(15);
        expect(result.quality).toBe('standard');
        expect(result.success).toBe(true);
        expect(result.outputItem).toEqual({ itemId: recipe.outputItemId, quantity: 3 });
        expect(result.materialsConsumed).toBe(true);
        expect(result.goldSpent).toBe(20);
        expect(result.timeSpentMinutes).toBe(960);
        expect(result.xpGained).toBe(XP_REWARDS.uncommon_success);
        expect(result.message).toContain('vs DC 15');
    });

    it('doubles output and adds the legendary XP bonus on a natural 20', () => {
        rollDiceMock.mockReturnValueOnce(20);
        const result = attemptCrafting(recipe, 0, enoughBerries, 100);
        expect(result.isNat20).toBe(true);
        expect(result.quality).toBe('legendary');
        expect(result.outputItem?.quantity).toBe(6);
        expect(result.xpGained).toBe(XP_REWARDS.uncommon_success + XP_REWARDS.legendary_bonus);
        expect(result.message).toContain('NATURAL 20');
    });

    it('adds the masterwork XP bonus when the roll beats the DC by 5 or more', () => {
        rollDiceMock.mockReturnValueOnce(19);
        const result = attemptCrafting(recipe, 1, enoughBerries, 100);
        expect(result.quality).toBe('masterwork');
        expect(result.xpGained).toBe(XP_REWARDS.uncommon_success + XP_REWARDS.masterwork_bonus);
    });

    it('marks flawed output in the message and keeps full quantity', () => {
        rollDiceMock.mockReturnValueOnce(12);
        const result = attemptCrafting(recipe, 0, enoughBerries, 100);
        expect(result.quality).toBe('flawed');
        expect(result.outputItem?.quantity).toBe(3);
        expect(result.message).toContain('(50% effectiveness)');
    });

    it('consumes materials and grants failure XP on a natural 1', () => {
        rollDiceMock.mockReturnValueOnce(1);
        const result = attemptCrafting(recipe, 30, enoughBerries, 100);
        expect(result.isNat1).toBe(true);
        expect(result.success).toBe(false);
        expect(result.quality).toBe('ruined');
        expect(result.outputItem).toBeUndefined();
        expect(result.materialsConsumed).toBe(true);
        expect(result.goldSpent).toBe(20);
        expect(result.xpGained).toBe(XP_REWARDS.failure);
        expect(result.message).toContain('CRITICAL FAILURE');
    });
});

describe('updateProgressionAfterCraft', () => {
    function resultWith(overrides: Partial<CraftingResult>): CraftingResult {
        return {
            success: true,
            roll: 15,
            rawRoll: 15,
            dc: 15,
            message: '',
            materialsConsumed: true,
            goldSpent: 0,
            quality: 'standard',
            qualityResult: { quality: 'standard', effectMultiplier: 1, durationMultiplier: 1, quantityMultiplier: 1, description: '' },
            xpGained: 0,
            timeSpentMinutes: 0,
            isNat20: false,
            isNat1: false,
            ...overrides
        };
    }

    it('counts successes by quality and adds XP', () => {
        let progression = createCrafterProgression();
        progression = updateProgressionAfterCraft(progression, resultWith({ quality: 'masterwork', xpGained: 40 }));
        progression = updateProgressionAfterCraft(progression, resultWith({ quality: 'legendary', xpGained: 75 }));

        expect(progression.stats.totalCrafted).toBe(2);
        expect(progression.stats.successfulCrafts).toBe(2);
        expect(progression.stats.masterworkCrafts).toBe(1);
        expect(progression.stats.legendaryRolls).toBe(1);
        // 115 XP crosses the 100 XP level-2 threshold.
        expect(progression.level).toBe(2);
        expect(progression.xp).toBe(15);
    });

    it('counts ruined failures and leaves XP alone when none was gained', () => {
        const start = createCrafterProgression();
        const progression = updateProgressionAfterCraft(start, resultWith({ success: false, quality: 'ruined', xpGained: 0 }));
        expect(progression.stats.failedCrafts).toBe(1);
        expect(progression.stats.ruinedMaterials).toBe(1);
        expect(progression.xp).toBe(0);
        // The input stats object is not mutated.
        expect(start.stats.totalCrafted).toBe(0);
    });
});

describe('getCraftingSummary', () => {
    it('totals recipes by rarity and counts known ones', () => {
        const known = new Set(['smokebomb']);
        const summary = getCraftingSummary([], 0, [], known);

        expect(summary.total).toBe(ALL_RECIPES.length);
        expect(summary.known).toBe(1);
        expect(summary.craftable).toBe(0);
        for (const rarity of ['common', 'uncommon', 'rare', 'very_rare'] as const) {
            expect(summary.byRarity[rarity].total).toBe(ALL_RECIPES.filter(r => r.rarity === rarity).length);
        }
    });

    it('counts a recipe as craftable when ingredients and gold are present', () => {
        const smokebomb = ALL_RECIPES.find(r => r.id === 'smokebomb');
        expect(smokebomb).toBeDefined();
        const inventory: Item[] = (smokebomb?.ingredients ?? []).map(ing => ({
            id: ing.itemId,
            name: ing.name ?? ing.itemId,
            description: 'Summary coverage reagent.',
            type: ItemType.Reagent,
            quantity: ing.quantity
        }));
        const summary = getCraftingSummary(inventory, 1000, [], new Set(['smokebomb']));
        expect(summary.craftable).toBe(1);
        expect(summary.byRarity.common.craftable).toBe(1);
    });
});

describe('getQualityColor / getQualityIcon', () => {
    it('gives each quality a distinct color and icon', () => {
        const qualities = ['ruined', 'flawed', 'standard', 'masterwork', 'legendary'] as const;
        const colors = qualities.map(getQualityColor);
        const icons = qualities.map(getQualityIcon);
        expect(new Set(colors).size).toBe(5);
        expect(new Set(icons).size).toBe(5);
        expect(colors.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
        expect(getQualityColor('ruined')).toBe('#ff4444');
        expect(getQualityIcon('legendary')).toBe('🌟');
    });

    it('falls back for an unexpected value', () => {
        expect(getQualityColor('unknown' as never)).toBe('#ffffff');
        expect(getQualityIcon('unknown' as never)).toBe('?');
    });
});
