/**
 * @file refiningEnchantingSelectors.test.ts
 * Unit tests for the Refining & Enchanting panel helpers (crafting G5).
 */
import { describe, it, expect } from 'vitest';
import {
    countItemQuantity,
    buildCrafterInventory,
    getRecipeReadiness,
    getMaxBatchSize,
    buildRefineBatchActions,
    buildEnchantActions,
} from '../refiningEnchantingSelectors';
import { Item } from '../../../types';
import { Recipe } from '../../../systems/crafting/types';
import { BatchRefineResult, RefiningRecipe } from '../../../systems/crafting/RefiningSystem';
import { EnchantingResult } from '../../../systems/crafting/EnchantingSystem';

const item = (id: string, quantity?: number): Item =>
    ({ id, name: id, type: 'reagent', description: '', weight: 0.1, quantity }) as unknown as Item;

const refineRecipe = (overrides: Partial<RefiningRecipe> = {}): RefiningRecipe => ({
    id: 'refine_iron',
    name: 'Smelt Iron',
    description: 'Ore to ingot.',
    recipeType: 'refine',
    station: 'forge',
    timeMinutes: 30,
    skillCheck: { skill: "Smith's Tools", dc: 10 },
    inputs: [
        { itemId: 'iron_ore', quantity: 2, consumed: true },
        { itemId: 'smiths_hammer', quantity: 1, consumed: false },
    ],
    outputs: [{ itemId: 'iron_ingot', quantity: 1 }],
    ...overrides,
});

describe('countItemQuantity / buildCrafterInventory', () => {
    it('sums stacked rows and single rows for the same id', () => {
        const inv = [item('iron_ore', 3), item('iron_ore'), item('coal', 2)];
        expect(countItemQuantity(inv, 'iron_ore')).toBe(4);
        expect(countItemQuantity(inv, 'coal')).toBe(2);
        expect(countItemQuantity(inv, 'missing')).toBe(0);
    });

    it('aggregates the flat inventory into crafter shape', () => {
        const crafterInv = buildCrafterInventory([item('a', 2), item('b'), item('a')]);
        expect(crafterInv).toEqual(
            expect.arrayContaining([
                { itemId: 'a', quantity: 3 },
                { itemId: 'b', quantity: 1 },
            ]),
        );
        expect(crafterInv).toHaveLength(2);
    });
});

describe('getRecipeReadiness', () => {
    it('reports per-input availability and overall craftability', () => {
        const readiness = getRecipeReadiness(refineRecipe(), [
            item('iron_ore', 5),
            item('smiths_hammer'),
        ]);
        expect(readiness.canCraft).toBe(true);
        expect(readiness.inputs).toEqual([
            { itemId: 'iron_ore', required: 2, available: 5, satisfied: true, consumed: true },
            { itemId: 'smiths_hammer', required: 1, available: 1, satisfied: true, consumed: false },
        ]);
    });

    it('fails when any input is missing', () => {
        const readiness = getRecipeReadiness(refineRecipe(), [item('iron_ore', 1)]);
        expect(readiness.canCraft).toBe(false);
    });
});

describe('getMaxBatchSize', () => {
    it('is limited only by consumed inputs; tools need one presence', () => {
        const inv = [item('iron_ore', 7), item('smiths_hammer')];
        expect(getMaxBatchSize(refineRecipe(), inv)).toBe(3); // 7 ore / 2 per batch
    });

    it('returns 0 when the tool is absent', () => {
        expect(getMaxBatchSize(refineRecipe(), [item('iron_ore', 10)])).toBe(0);
    });

    it('caps at the provided maximum', () => {
        const inv = [item('iron_ore', 100), item('smiths_hammer')];
        expect(getMaxBatchSize(refineRecipe(), inv, 5)).toBe(5);
    });
});

describe('buildRefineBatchActions', () => {
    it('aggregates consumed materials, adds total output, advances time', () => {
        const result: BatchRefineResult = {
            results: [
                {
                    success: true, quality: 'standard', materialsLost: false, message: '',
                    outputs: [{ itemId: 'iron_ingot', quantity: 1 }],
                    consumedMaterials: [{ itemId: 'iron_ore', quantity: 2 }],
                },
                {
                    success: true, quality: 'standard', materialsLost: false, message: '',
                    outputs: [{ itemId: 'iron_ingot', quantity: 1 }],
                    consumedMaterials: [{ itemId: 'iron_ore', quantity: 2 }],
                },
            ],
            totalTimeSpent: 54,
            totalExperience: 120,
            summary: {
                successes: 2,
                failures: 0,
                totalOutput: { iron_ingot: 2 },
                bonusYield: { iron_ingot: 0 },
            },
        };
        expect(buildRefineBatchActions(result)).toEqual([
            { type: 'REMOVE_ITEM', payload: { itemId: 'iron_ore', count: 4 } },
            { type: 'ADD_ITEM', payload: { itemId: 'iron_ingot', count: 2 } },
            { type: 'ADVANCE_TIME', payload: { seconds: 54 * 60 } },
        ]);
    });

    it('emits no ADD_ITEM when the batch failed outright', () => {
        const result: BatchRefineResult = {
            results: [{
                success: false, quality: 'poor', materialsLost: true, message: '',
                outputs: [], consumedMaterials: [{ itemId: 'iron_ore', quantity: 2 }],
            }],
            totalTimeSpent: 30,
            totalExperience: 0,
            summary: { successes: 0, failures: 1, totalOutput: {}, bonusYield: {} },
        };
        const actions = buildRefineBatchActions(result);
        expect(actions.some(a => a.type === 'ADD_ITEM')).toBe(false);
        expect(actions[0]).toEqual({ type: 'REMOVE_ITEM', payload: { itemId: 'iron_ore', count: 2 } });
    });
});

describe('buildEnchantActions', () => {
    const enchantRecipe: Recipe = {
        id: 'ench',
        name: 'Enchant Dagger',
        description: '',
        recipeType: 'enchant',
        station: 'enchanters_table',
        timeMinutes: 240,
        inputs: [
            { itemId: 'dagger', quantity: 1, consumed: true },
            { itemId: 'arcane_dust', quantity: 5, consumed: true },
        ],
        outputs: [{ itemId: 'dagger_plus_one', quantity: 1 }],
    };

    it('mirrors engine-decided consumption and output, always spends time', () => {
        const result: EnchantingResult = {
            success: true, quality: 'standard', materialsLost: false, message: 'ok',
            criticalFailure: false,
            outputs: [{ itemId: 'dagger_plus_one', quantity: 1 }],
            consumedMaterials: [
                { itemId: 'dagger', quantity: 1 },
                { itemId: 'arcane_dust', quantity: 5 },
            ],
        };
        expect(buildEnchantActions(enchantRecipe, result)).toEqual([
            { type: 'REMOVE_ITEM', payload: { itemId: 'dagger', count: 1 } },
            { type: 'REMOVE_ITEM', payload: { itemId: 'arcane_dust', count: 5 } },
            { type: 'ADD_ITEM', payload: { itemId: 'dagger_plus_one', count: 1 } },
            { type: 'ADVANCE_TIME', payload: { seconds: 240 * 60 } },
        ]);
    });

    it('preserves the base item on a standard failure (engine omits it from consumed)', () => {
        const result: EnchantingResult = {
            success: false, quality: 'standard', materialsLost: true, message: 'fail',
            criticalFailure: false,
            outputs: [],
            consumedMaterials: [{ itemId: 'arcane_dust', quantity: 5 }],
        };
        const actions = buildEnchantActions(enchantRecipe, result);
        expect(actions).toEqual([
            { type: 'REMOVE_ITEM', payload: { itemId: 'arcane_dust', count: 5 } },
            { type: 'ADVANCE_TIME', payload: { seconds: 240 * 60 } },
        ]);
    });
});
