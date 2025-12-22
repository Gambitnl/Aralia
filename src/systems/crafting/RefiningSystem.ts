/**
 * @file src/systems/crafting/RefiningSystem.ts
 * System for processing raw materials into refined components (Refining).
 * Focuses on batch processing and efficiency.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Time is an ingredient.
 */
import { Crafter, attemptCraft } from './craftingSystem';
import { Recipe, CraftingResult } from './types';

export interface BatchRefineRequest {
  recipe: Recipe;
  batchSize: number;
}

export interface BatchRefineResult {
  results: CraftingResult[];
  totalTimeSpent: number;
  totalExperience: number;
  summary: {
    successes: number;
    failures: number;
    totalOutput: Record<string, number>; // itemId -> quantity
  };
}

/**
 * Calculates the time modifier for batch processing.
 * Larger batches might be slightly more efficient per unit due to setup time amortization.
 */
export function calculateBatchTime(baseTime: number, batchSize: number): number {
  // First item takes full time. Subsequent items take 80% time (simulating hot forge, rhythm, etc.)
  if (batchSize <= 1) return baseTime * batchSize;
  return baseTime + (baseTime * 0.8 * (batchSize - 1));
}

/**
 * Attempts to refine a batch of materials.
 * NOTE: This function does NOT mutate the actual crafter object's inventory permanently.
 * It simulates the batch and returns the result. The caller (Game Loop/Reducer) must apply the changes.
 * However, to ensure the loop logic works (checking materials for the 2nd item),
 * we track a local 'virtual' inventory state.
 */
export function processRefiningBatch(crafter: Crafter, request: BatchRefineRequest): BatchRefineResult {
  const { recipe, batchSize } = request;
  const results: CraftingResult[] = [];
  const totalOutput: Record<string, number> = {};
  let successes = 0;
  let failures = 0;
  let totalExperience = 0;

  // Optimize lookups with a Map (O(1) vs O(N))
  // We need to keep the original array structure for the virtualCrafter interface,
  // but we can use the map for quick updates and then sync back if needed,
  // OR just assume the virtualCrafter.inventory references the objects we modify.
  // BUT: Crafter.inventory is an array.

  // Strategy: Clone the array deep enough to modify quantities.
  const virtualInventory = crafter.inventory.map(i => ({ ...i }));

  // Create a Map for O(1) access to these same objects
  const inventoryMap = new Map<string, { itemId: string; quantity: number }>();
  virtualInventory.forEach(item => inventoryMap.set(item.itemId, item));

  // Create a proxy crafter that uses the virtual inventory
  const virtualCrafter: Crafter = {
    ...crafter,
    inventory: virtualInventory,
    rollSkill: crafter.rollSkill // Reuse the actual roller logic
  };

  // Process each item in the batch
  for (let i = 0; i < batchSize; i++) {
    const result = attemptCraft(virtualCrafter, recipe);

    // Add result unconditionally first (simplifies flow)
    results.push(result);

    // If successful or materials lost, update virtual inventory
    if (result.success || result.materialsLost) {
      result.consumedMaterials.forEach(consumed => {
        const item = inventoryMap.get(consumed.itemId);
        if (item) {
          item.quantity -= consumed.quantity;
        }
      });
    }

    if (result.success) {
        successes++;

        // Track outputs
        result.outputs.forEach(out => {
            totalOutput[out.itemId] = (totalOutput[out.itemId] || 0) + out.quantity;
        });

        // XP Calculation
        totalExperience += (result.experienceGained || (recipe.timeMinutes * 2));

    } else {
        failures++;
        // Stop on critical resource failure
        if (result.message === 'Insufficient materials.') {
            break;
        }
    }
  }

  return {
    results,
    totalTimeSpent: calculateBatchTime(recipe.timeMinutes, results.length),
    totalExperience,
    summary: {
      successes,
      failures,
      totalOutput
    }
  };
}

// TODO(Architect): Integrate `processRefiningBatch` into the UI to allow "Craft All" functionality on the Refining station.
