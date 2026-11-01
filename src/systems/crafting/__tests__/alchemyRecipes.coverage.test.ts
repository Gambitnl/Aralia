/**
 * @file src/systems/crafting/__tests__/alchemyRecipes.coverage.test.ts
 * Coverage pass (gap C14) for the recipe lookup helpers. Each filter must
 * return exactly the recipes that match, no more and no fewer.
 */
import { describe, expect, it } from 'vitest';
import {
    ALL_RECIPES,
    getRecipeById,
    getRecipesByCategory,
    getRecipesByRarity,
    getRecipesByTool,
    getResearchCost
} from '../alchemyRecipes';
import type { CraftingRecipe, CraftingTool, RecipeRarity } from '../alchemyRecipes';

const TOOLS: CraftingTool[] = ['alchemist_supplies', 'herbalism_kit', 'poisoners_kit'];
const RARITIES: RecipeRarity[] = ['common', 'uncommon', 'rare', 'very_rare'];
const CATEGORIES: CraftingRecipe['category'][] = ['potion', 'oil', 'poison', 'bomb', 'utility', 'ink'];

describe('recipe filters', () => {
    it('getRecipesByTool returns only and all recipes for that tool', () => {
        for (const tool of TOOLS) {
            const result = getRecipesByTool(tool);
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(r => r.toolRequired === tool)).toBe(true);
            expect(result.length).toBe(ALL_RECIPES.filter(r => r.toolRequired === tool).length);
        }
        const total = TOOLS.reduce((sum, tool) => sum + getRecipesByTool(tool).length, 0);
        expect(total).toBe(ALL_RECIPES.length);
    });

    it('getRecipesByRarity partitions the full recipe list', () => {
        let total = 0;
        for (const rarity of RARITIES) {
            const result = getRecipesByRarity(rarity);
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(r => r.rarity === rarity)).toBe(true);
            total += result.length;
        }
        expect(total).toBe(ALL_RECIPES.length);
    });

    it('getRecipesByCategory partitions the full list and returns [] for an unused category', () => {
        let total = 0;
        for (const category of CATEGORIES) {
            const result = getRecipesByCategory(category);
            expect(result.every(r => r.category === category)).toBe(true);
            total += result.length;
        }
        expect(total).toBe(ALL_RECIPES.length);
        expect(getRecipesByCategory('bomb').map(r => r.id)).toContain('alchemists_fire');
        // No recipe currently uses the 'utility' category.
        expect(getRecipesByCategory('utility')).toEqual([]);
    });

    it('getRecipeById finds a known recipe and returns undefined for an unknown id', () => {
        expect(getRecipeById('smokebomb')?.name).toBe('Smokebomb');
        expect(getRecipeById('no_such_recipe')).toBeUndefined();
    });
});

describe('getResearchCost (alchemyRecipes)', () => {
    it('scales gold and days with rarity and falls back for unknown rarity', () => {
        expect(getResearchCost('common')).toEqual({ gold: 50, days: 1 });
        expect(getResearchCost('uncommon')).toEqual({ gold: 250, days: 5 });
        expect(getResearchCost('rare')).toEqual({ gold: 500, days: 10 });
        expect(getResearchCost('very_rare')).toEqual({ gold: 1000, days: 30 });
        expect(getResearchCost('VERY_RARE')).toEqual({ gold: 100, days: 3 });
    });
});
