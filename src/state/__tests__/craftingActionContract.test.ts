import { describe, expect, it } from 'vitest';
import {
    CRAFTING_BENCH_ACTION_TYPES,
    describeCraftingBenchActionMismatch,
    isCraftingBenchAction
} from '../craftingActionContract';
import { craftingReducer } from '../reducers/craftingReducer';
import { initialGameState } from '../appState';
import { createInitialCraftingState } from '../../types/crafting';
import type { GameState } from '../../types';
import type { CraftingBenchAction } from '../actionTypes';
import { generateCraftingActions } from '../../systems/crafting/craftingEngine';
import type { CraftingResult } from '../../systems/crafting/craftingEngine';
import { generateBatchCraftActions } from '../../systems/crafting/batchCrafting';
import type { BatchCraftResult } from '../../systems/crafting/batchCrafting';
import type { CraftingRecipe } from '../../systems/crafting/alchemyRecipes';

/**
 * Contract proof for the alchemy bench (ui-features:G3).
 *
 * WHY THIS EXISTS: `AlchemyBenchPanel` forwards actions produced by
 * `generateCraftingActions` and `generateBatchCraftActions`, both of which return
 * `{ type: string; payload: unknown }[]`. Before this contract the panel widened each
 * element with `as Parameters<typeof dispatch>[0]`, so a drifted payload field or a
 * misspelled action type compiled clean and was then dropped by the reducer at runtime
 * with no error anywhere. These tests fail on exactly that drift.
 */

const RECIPE: CraftingRecipe = {
    id: 'test_tonic',
    name: 'Test Tonic',
    description: 'Fixture recipe for the action contract test.',
    rarity: 'common',
    craftingDC: 10,
    craftingDays: 1,
    goldCost: 25,
    ingredients: [
        { itemId: 'spring_water', quantity: 2, name: 'Spring Water' },
        { itemId: 'silver_dust', quantity: 1, name: 'Silver Dust' }
    ],
    outputItemId: 'test_tonic_item',
    outputQuantity: 1,
    toolRequired: 'alchemist_supplies',
    category: 'potion'
};

const SUCCESSFUL_RESULT: CraftingResult = {
    success: true,
    roll: 18,
    rawRoll: 15,
    dc: 10,
    message: 'Crafted.',
    outputItem: { itemId: RECIPE.outputItemId, quantity: 1 },
    materialsConsumed: true,
    goldSpent: RECIPE.goldCost,
    quality: 'standard',
    qualityResult: {
        quality: 'standard',
        effectMultiplier: 1,
        durationMultiplier: 1,
        quantityMultiplier: 1,
        description: 'Standard.'
    },
    xpGained: 20,
    timeSpentMinutes: 480,
    isNat20: false,
    isNat1: false
};

const BATCH_RESULT: BatchCraftResult = {
    quantity: 3,
    results: [
        { success: true, quality: 'standard', roll: 14, dc: 12 },
        { success: true, quality: 'legendary', roll: 20, dc: 12 },
        { success: false, quality: 'ruined', roll: 4, dc: 12 }
    ],
    totalSuccess: 2,
    totalFailed: 1,
    totalXpGained: 45,
    totalTimeSpent: 1440,
    summary: 'Crafted 2 of 3.'
};

/** Every action `AlchemyBenchPanel` writes out by hand, with its real payload shape. */
const PANEL_LITERAL_DISPATCHES: CraftingBenchAction[] = [
    { type: 'INIT_CRAFTING_STATE', payload: { toolProficiencies: ['alchemist', 'herbalism'] } },
    { type: 'ADD_CRAFTING_XP', payload: { amount: 45 } },
    { type: 'LEARN_RECIPE', payload: { recipeId: RECIPE.id } },
    {
        type: 'UPDATE_CRAFTING_STATS',
        payload: { quality: 'standard', category: RECIPE.category, isNat20: false }
    },
    { type: 'MODIFY_GOLD', payload: { amount: -50 } },
    { type: 'ADVANCE_TIME', payload: { seconds: 28800 } }
];

describe('crafting bench action contract — declared shapes', () => {
    it('covers every crafting-owned action the reducer handles', () => {
        // The reducer's switch is the other half of the contract. If a case is added
        // there without a declared shape here, the bench can never dispatch it safely.
        expect(CRAFTING_BENCH_ACTION_TYPES).toEqual(
            expect.arrayContaining([
                'INIT_CRAFTING_STATE',
                'LEARN_RECIPE',
                'ADD_CRAFTING_XP',
                'UPDATE_CRAFTING_STATS',
                'UNLOCK_ACHIEVEMENT',
                'SET_CRAFTING_LOCATION'
            ])
        );
    });

    it('accepts every action AlchemyBenchPanel dispatches as a literal', () => {
        for (const action of PANEL_LITERAL_DISPATCHES) {
            expect(describeCraftingBenchActionMismatch(action)).toBeNull();
        }
    });
});

describe('crafting bench action contract — engine output', () => {
    it('accepts every action generateCraftingActions emits', () => {
        const actions = generateCraftingActions(RECIPE, SUCCESSFUL_RESULT);

        expect(actions.length).toBeGreaterThan(0);
        for (const action of actions) {
            expect(describeCraftingBenchActionMismatch(action)).toBeNull();
        }
        // Guards against a generator that stops emitting the item or the cost.
        expect(actions.map((a) => a.type)).toEqual(
            expect.arrayContaining(['REMOVE_ITEM', 'MODIFY_GOLD', 'ADVANCE_TIME', 'ADD_ITEM'])
        );
    });

    it('accepts every action generateBatchCraftActions emits', () => {
        const actions = generateBatchCraftActions(RECIPE, BATCH_RESULT);

        expect(actions.length).toBeGreaterThan(0);
        for (const action of actions) {
            expect(describeCraftingBenchActionMismatch(action)).toBeNull();
        }
        expect(actions.map((a) => a.type)).toEqual(
            expect.arrayContaining(['REMOVE_ITEM', 'MODIFY_GOLD', 'ADVANCE_TIME', 'ADD_ITEM'])
        );
    });
});

describe('crafting bench action contract — rejects wrong payload shapes', () => {
    // Each case is a drift that used to compile and then fail silently at runtime.
    const badActions: { name: string; action: unknown; expectIn: string }[] = [
        {
            name: 'renamed field: ADD_ITEM count -> quantity',
            action: { type: 'ADD_ITEM', payload: { itemId: 'test_tonic_item', quantity: 2 } },
            expectIn: 'quantity'
        },
        {
            name: 'renamed field: REMOVE_ITEM itemId -> id',
            action: { type: 'REMOVE_ITEM', payload: { id: 'spring_water', count: 1 } },
            expectIn: 'itemId'
        },
        {
            name: 'wrong type: MODIFY_GOLD amount as a string',
            action: { type: 'MODIFY_GOLD', payload: { amount: '-25' } },
            expectIn: 'amount'
        },
        {
            name: 'non-finite number: ADVANCE_TIME seconds NaN',
            action: { type: 'ADVANCE_TIME', payload: { seconds: Number.NaN } },
            expectIn: 'seconds'
        },
        {
            name: 'wrong units: ADVANCE_TIME emitting minutes instead of seconds',
            action: { type: 'ADVANCE_TIME', payload: { minutes: 480 } },
            expectIn: 'seconds'
        },
        {
            name: 'typo in quality: UPDATE_CRAFTING_STATS quality "masterful"',
            action: {
                type: 'UPDATE_CRAFTING_STATS',
                payload: { quality: 'masterful', category: 'potion', isNat20: false }
            },
            expectIn: 'quality'
        },
        {
            name: 'typo in category: UPDATE_CRAFTING_STATS category "potions"',
            action: {
                type: 'UPDATE_CRAFTING_STATS',
                payload: { quality: 'standard', category: 'potions', isNat20: false }
            },
            expectIn: 'category'
        },
        {
            name: 'missing field: UPDATE_CRAFTING_STATS without isNat20',
            action: {
                type: 'UPDATE_CRAFTING_STATS',
                payload: { quality: 'standard', category: 'potion' }
            },
            expectIn: 'isNat20'
        },
        {
            name: 'wrong container: INIT_CRAFTING_STATE toolProficiencies as a Set',
            action: { type: 'INIT_CRAFTING_STATE', payload: { toolProficiencies: new Set(['alchemist']) } },
            expectIn: 'toolProficiencies'
        },
        {
            name: 'misspelled action type',
            action: { type: 'ADD_CRAFT_XP', payload: { amount: 10 } },
            expectIn: 'ADD_CRAFT_XP'
        },
        {
            name: 'payload omitted entirely',
            action: { type: 'LEARN_RECIPE' },
            expectIn: 'payload'
        }
    ];

    for (const { name, action, expectIn } of badActions) {
        it(`rejects ${name}`, () => {
            expect(isCraftingBenchAction(action)).toBe(false);
            expect(describeCraftingBenchActionMismatch(action)).toContain(expectIn);
        });
    }

    it('rejects real generator output once a payload field is renamed', () => {
        // The regression this contract exists to catch, driven off the live engine
        // rather than a hand-written literal: take what generateCraftingActions emits
        // today, rename `count` to `quantity` the way a careless refactor would, and
        // confirm every drifted action is reported instead of silently dispatched.
        const actions = generateCraftingActions(RECIPE, SUCCESSFUL_RESULT);
        const withCount = actions.filter(
            (a) => 'count' in (a.payload as Record<string, unknown>)
        );
        expect(withCount.length).toBeGreaterThan(0);

        for (const action of withCount) {
            const payload = action.payload as Record<string, unknown>;
            const drifted = {
                type: action.type,
                payload: { itemId: payload.itemId, quantity: payload.count }
            };
            expect(describeCraftingBenchActionMismatch(action)).toBeNull();
            expect(describeCraftingBenchActionMismatch(drifted)).toContain('quantity');
        }
    });

    it('rejects a non-action value', () => {
        expect(isCraftingBenchAction(null)).toBe(false);
        expect(isCraftingBenchAction('ADD_ITEM')).toBe(false);
    });
});

describe('crafting bench action contract — reducer agreement', () => {
    const baseState: GameState = {
        ...initialGameState,
        crafting: createInitialCraftingState(['alchemist'])
    };

    it('applies each contract-valid crafting action to the reducer', () => {
        // Proves the declared shapes are the shapes the reducer actually reads, so a
        // payload that passes the guard produces a real state change rather than a no-op.
        const learned = craftingReducer(baseState, {
            type: 'LEARN_RECIPE',
            payload: { recipeId: RECIPE.id }
        });
        expect(learned.crafting?.knownRecipes).toContain(RECIPE.id);

        const stats = craftingReducer(baseState, {
            type: 'UPDATE_CRAFTING_STATS',
            payload: { quality: 'masterwork', category: 'potion', isNat20: true }
        });
        expect(stats.crafting?.stats.masterworkCrafts).toBe(1);
        expect(stats.crafting?.stats.nat20Count).toBe(1);
        expect(stats.crafting?.stats.categoryCounts.potion).toBe(1);

        const located = craftingReducer(baseState, {
            type: 'SET_CRAFTING_LOCATION',
            payload: { locationId: 'alchemy_lab' }
        });
        expect(located.crafting?.currentLocation).toBe('alchemy_lab');

        const unlocked = craftingReducer(baseState, {
            type: 'UNLOCK_ACHIEVEMENT',
            payload: { achievementId: 'first_potion' }
        });
        expect(unlocked.crafting?.unlockedAchievements).toContain('first_potion');

        const xp = craftingReducer(baseState, {
            type: 'ADD_CRAFTING_XP',
            payload: { amount: 45 }
        });
        expect(xp.crafting?.xp).toBe(45);
    });
});
