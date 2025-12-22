
import { describe, it, expect } from 'vitest';
import { Crafter } from '../craftingSystem';
import { Recipe } from '../types';
import { processRefiningBatch, calculateBatchTime, BatchRefineRequest } from '../RefiningSystem';

describe('RefiningSystem', () => {
  const mockCrafter: Crafter = {
    id: 'test_crafter',
    name: 'Smith',
    inventory: [
      { itemId: 'ore_iron', quantity: 10 },
      { itemId: 'coal', quantity: 10 }
    ],
    rollSkill: () => 15 // Always successful
  };

  const refiningRecipe: Recipe = {
    id: 'refine_iron',
    name: 'Smelt Iron Ingot',
    description: 'Turn ore into ingot.',
    station: 'forge',
    recipeType: 'refine',
    timeMinutes: 30,
    skillCheck: {
      skill: 'Smith\'s Tools',
      dc: 10
    },
    inputs: [
      { itemId: 'ore_iron', quantity: 2, consumed: true },
      { itemId: 'coal', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'ingot_iron', quantity: 1 }
    ]
  };

  describe('processRefiningBatch', () => {
    it('should process a batch correctly', () => {
      const request: BatchRefineRequest = {
        recipe: refiningRecipe,
        batchSize: 3
      };

      const result = processRefiningBatch(mockCrafter, request);

      expect(result.summary.successes).toBe(3);
      expect(result.summary.failures).toBe(0);
      expect(result.summary.totalOutput['ingot_iron']).toBe(3);

      // Time should be: 30 + (30*0.8 * 2) = 30 + 24*2 = 30 + 48 = 78
      expect(result.totalTimeSpent).toBeCloseTo(78);
    });

    it('should stop when materials run out', () => {
      // We have 10 ore, 10 coal.
      // Recipe needs 2 ore, 1 coal per item.
      // Max possible = 5 ingots.
      // Request 10.

      const request: BatchRefineRequest = {
        recipe: refiningRecipe,
        batchSize: 10
      };

      const result = processRefiningBatch(mockCrafter, request);

      expect(result.summary.successes).toBe(5);
      expect(result.summary.failures).toBe(1); // The 6th one failed
      expect(result.results.length).toBe(6); // 5 successes + 1 failure
      expect(result.summary.totalOutput['ingot_iron']).toBe(5);
    });

    it('should calculate time efficiency for batches', () => {
      const t1 = calculateBatchTime(100, 1);
      const t2 = calculateBatchTime(100, 2);
      const t10 = calculateBatchTime(100, 10);

      expect(t1).toBe(100);
      expect(t2).toBe(100 + 80); // 180
      expect(t10).toBe(100 + (80 * 9)); // 100 + 720 = 820

      // 10 separate crafts would be 1000.
      // Batch craft is 820. 18% savings.
    });
  });
});
