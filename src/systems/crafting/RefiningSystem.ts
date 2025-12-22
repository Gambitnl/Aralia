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

  // Clone inventory for simulation tracking
  // We use a simple array clone, assuming items are simple objects {itemId, quantity}
  const virtualInventory = crafter.inventory.map(i => ({ ...i }));

  // Create a proxy crafter that uses the virtual inventory
  const virtualCrafter: Crafter = {
    ...crafter,
    inventory: virtualInventory,
    rollSkill: crafter.rollSkill // Reuse the actual roller logic (randomness is fine)
  };

  // Process each item in the batch
  for (let i = 0; i < batchSize; i++) {
    // Check if we still have materials for this iteration using the virtual state
    // attemptCraft calls canCraft which reads inventory
    const result = attemptCraft(virtualCrafter, recipe);

    // If successful or materials lost, we must update our virtual inventory
    // so the next iteration knows we used them.
    if (result.success || result.materialsLost) {
      result.consumedMaterials.forEach(consumed => {
        const item = virtualInventory.find(inv => inv.itemId === consumed.itemId);
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

        // XP Calculation (Simple placeholder)
        totalExperience += (result.experienceGained || (recipe.timeMinutes * 2)); // Default if not in result

    } else {
        failures++;
        // If we ran out of materials mid-batch (e.g. materialsLost was false because check failed), stop.
        if (result.message === 'Insufficient materials.') {
            results.push(result);
            break;
        }
    }

    results.push(result);
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
