/**
 * @file src/systems/crafting/__tests__/batchCrafting.coverage.test.ts
 * Coverage pass (gap C14) for batch crafting rolls and the DC label.
 * The d20 is mocked so every roll is chosen by the test, not retried.
 * The crafter (PlayerCharacter) path goes through rollAbilityCheck and is not
 * covered here.
 *
 * Deliberately NOT pinned: totalXpGained. Batch XP uses its own flat values
 * (10 per success, +5 masterwork, +20 legendary, 2 per failure) that disagree
 * with XP_REWARDS used by attemptCrafting. Reported as a suspected bug.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rollDiceMock = vi.hoisted(() => vi.fn<(notation: string) => number>());
vi.mock('../../dice/rollers', () => ({ rollDice: rollDiceMock }));

import type { CraftingRecipe } from '../alchemyRecipes';
import { attemptBatchCraft, DEFAULT_BATCH_CONFIG, getBatchDCDisplay } from '../batchCrafting';

const recipe: CraftingRecipe = {
    id: 'batch_coverage_tonic',
    name: 'Batch Coverage Tonic',
    description: 'Fixture for batch roll coverage.',
    rarity: 'common',
    craftingDC: 10,
    craftingDays: 1,
    goldCost: 5,
    ingredients: [{ itemId: 'rowan_berry', quantity: 1, name: 'Rowan Berry' }],
    outputItemId: 'batch_coverage_tonic',
    outputQuantity: 1,
    toolRequired: 'herbalism_kit',
    category: 'potion'
};

function queueRolls(...rolls: number[]): void {
    for (const roll of rolls) rollDiceMock.mockReturnValueOnce(roll);
}

beforeEach(() => {
    rollDiceMock.mockReset();
});

describe('attemptBatchCraft', () => {
    it('rolls 1d20 once per item and raises the DC by one per extra item', () => {
        queueRolls(10, 10, 10);
        const result = attemptBatchCraft(recipe, 3, 2);

        expect(rollDiceMock).toHaveBeenCalledTimes(3);
        expect(rollDiceMock).toHaveBeenCalledWith('1d20');
        // DC 10 + 1 * (3 - 1) = 12; roll 10 + 2 = 12 -> standard.
        expect(result.results.every(r => r.dc === 12 && r.roll === 12)).toBe(true);
        expect(result.results.every(r => r.quality === 'standard' && r.success)).toBe(true);
        expect(result.totalSuccess).toBe(3);
        expect(result.totalFailed).toBe(0);
    });

    it('scores each quality tier with its own XP and counts ruined items as failures', () => {
        // Modifier 0, DC 10 + 3 = 13 for four items.
        // 20 -> legendary (nat 20), 18 -> masterwork, 9 -> flawed, 1 -> ruined (nat 1).
        queueRolls(20, 18, 9, 1);
        const result = attemptBatchCraft(recipe, 4, 0);

        expect(result.results.map(r => r.quality)).toEqual(['legendary', 'masterwork', 'flawed', 'ruined']);
        expect(result.results.map(r => r.success)).toEqual([true, true, true, false]);
        expect(result.totalSuccess).toBe(3);
        expect(result.totalFailed).toBe(1);
        expect(result.summary).toContain('4x Batch Coverage Tonic');
        expect(result.summary).toContain('3 succeeded');
        expect(result.summary).toContain('1 failed');
        expect(result.summary).toContain('1 Legendary');
        expect(result.summary).toContain('1 Masterwork');
        expect(result.summary).toContain('1 Flawed');
    });

    it('omits quality lines from the summary when no item reached them', () => {
        queueRolls(12);
        const result = attemptBatchCraft(recipe, 1, 0);
        expect(result.summary).not.toContain('Legendary');
        expect(result.summary).not.toContain('Masterwork');
        expect(result.summary).not.toContain('Flawed');
    });

    it('charges full time for the first item and the time multiplier for each extra item', () => {
        queueRolls(15);
        expect(attemptBatchCraft(recipe, 1, 0).totalTimeSpent).toBe(480);

        queueRolls(15, 15, 15);
        // 480 * (1 + 0.8 * 2) = 1248
        expect(attemptBatchCraft(recipe, 3, 0).totalTimeSpent).toBeCloseTo(1248);
    });

    it('honours a custom config for DC growth and time', () => {
        queueRolls(15, 15);
        const result = attemptBatchCraft(recipe, 2, 0, { maxBatchSize: 10, dcIncreasePerItem: 3, timeMultiplier: 0.5 });
        expect(result.results[0].dc).toBe(13);
        expect(result.totalTimeSpent).toBe(720);
    });

    it('returns an empty result for quantity 0 without rolling', () => {
        const result = attemptBatchCraft(recipe, 0, 0);
        expect(rollDiceMock).not.toHaveBeenCalled();
        expect(result.results).toEqual([]);
        expect(result.totalSuccess).toBe(0);
        expect(result.totalXpGained).toBe(0);
    });
});

describe('getBatchDCDisplay', () => {
    it('shows the plain DC for a single item', () => {
        expect(getBatchDCDisplay(12, 1)).toBe('DC 12');
    });

    it('shows the raised DC and the increase for larger batches', () => {
        expect(getBatchDCDisplay(12, 3)).toBe('DC 14 (+2)');
        expect(getBatchDCDisplay(12, DEFAULT_BATCH_CONFIG.maxBatchSize)).toBe('DC 16 (+4)');
    });

    it('uses the config DC step', () => {
        expect(getBatchDCDisplay(10, 3, { maxBatchSize: 5, dcIncreasePerItem: 2, timeMultiplier: 1 })).toBe('DC 14 (+4)');
        expect(getBatchDCDisplay(10, 4, { maxBatchSize: 5, dcIncreasePerItem: 0, timeMultiplier: 1 })).toBe('DC 10');
    });
});
