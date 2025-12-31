/**
 * @file src/systems/crafting/RefiningSystem.ts
 * System for processing raw materials into refined components (Refining).
 * Focuses on batch processing and efficiency.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Time is an ingredient.
 */
import { Crafter, canCraft } from './craftingSystem';
import { Recipe, CraftingResult, CraftingQuality } from './types';

// Extend the base Recipe type for Refining-specific properties
export interface RefiningRecipe extends Recipe {
  recipeType: 'refine';
  /**
   * Defines how efficient the refining process can be.
   * e.g., "For every 5 points above DC, gain 10% more output".
   */
  yieldBonus?: {
    thresholdStep: number; // e.g., 5
    bonusPercent: number; // e.g., 0.1 (10%)
    maxBonus?: number;    // e.g., 0.5 (50% max bonus)
  };
}

export interface BatchRefineRequest {
  recipe: RefiningRecipe;
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
    bonusYield: Record<string, number>; // How much was "free" due to skill
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
 * Internal helper to calculate yield multiplier based on skill roll.
 */
function calculateYieldMultiplier(roll: number, dc: number, bonus?: RefiningRecipe['yieldBonus']): number {
  if (!bonus || roll <= dc) return 1.0;

  if (bonus.thresholdStep <= 0) {
    // Prevent division by zero or infinite loops if data is malformed
    return 1.0;
  }

  const margin = roll - dc;
  const steps = Math.floor(margin / bonus.thresholdStep);
  if (steps <= 0) return 1.0;

  let rawBonus = steps * bonus.bonusPercent;
  if (bonus.maxBonus) {
    rawBonus = Math.min(rawBonus, bonus.maxBonus);
  }

  return 1.0 + rawBonus;
}

/**
 * Attempts to refine a batch of materials.
 * NOTE: This function does NOT mutate the actual crafter object's inventory permanently.
 * It simulates the batch and returns the result. The caller (Game Loop/Reducer) must apply the changes.
 */
export function processRefiningBatch(crafter: Crafter, request: BatchRefineRequest): BatchRefineResult {
  const { recipe, batchSize } = request;
  const results: CraftingResult[] = [];
  const totalOutput: Record<string, number> = {};
  const bonusYield: Record<string, number> = {};

  let successes = 0;
  let failures = 0;
  let totalExperience = 0;

  // Clone inventory to track usage across the batch
  const virtualInventory = crafter.inventory.map(i => ({ ...i }));
  const inventoryMap = new Map<string, { itemId: string; quantity: number }>();
  virtualInventory.forEach(item => inventoryMap.set(item.itemId, item));

  // Create a proxy crafter
  const virtualCrafter: Crafter = {
    ...crafter,
    inventory: virtualInventory,
    rollSkill: crafter.rollSkill
  };

  // Pre-calculate the skill roll for the ENTIRE batch?
  // We use one roll to determine efficiency and success for the batch action.
  const skillName = recipe.skillCheck?.skill || 'Strength'; // Fallback
  const dc = recipe.skillCheck?.dc || 10;
  const roll = virtualCrafter.rollSkill(skillName);
  const yieldMultiplier = calculateYieldMultiplier(roll, dc, recipe.yieldBonus);

  // Check success once for the whole batch logic base
  const batchSuccess = roll >= dc;

  // Quality determination
  let quality: CraftingQuality = 'standard';
  if (roll >= dc + 10) quality = 'superior';
  if (!batchSuccess) quality = 'poor';

  // Process quantity
  for (let i = 0; i < batchSize; i++) {
    // 1. Validation: Use canCraft to check requirements (materials)
    // NOTE: canCraft only checks materials currently. If it checked tools/stations, this would respect it.
    if (!canCraft(virtualCrafter, recipe)) {
      failures++;
      results.push({
        success: false,
        quality: 'poor',
        outputs: [],
        consumedMaterials: [],
        materialsLost: false,
        message: `Failed to refine batch item ${i + 1}/${batchSize} (insufficient materials)`
      });
      break;
    }

    // 2. Consume Materials
    const consumedThisStep: { itemId: string; quantity: number }[] = [];
    recipe.inputs.forEach(input => {
      if (input.consumed) {
        const invItem = inventoryMap.get(input.itemId);
        if (invItem) {
          invItem.quantity -= input.quantity;
          consumedThisStep.push({ itemId: input.itemId, quantity: input.quantity });
        }
      }
    });

    // 3. Produce Output
    const outputsThisStep: { itemId: string; quantity: number }[] = [];

    if (batchSuccess) {
      successes++;

      recipe.outputs.forEach(out => {
        // Apply Yield Multiplier
        const baseQty = out.quantity;
        const totalQty = Math.floor(baseQty * yieldMultiplier);
        const bonusQty = totalQty - baseQty;

        outputsThisStep.push({ itemId: out.itemId, quantity: totalQty });

        // Track stats
        totalOutput[out.itemId] = (totalOutput[out.itemId] || 0) + totalQty;
        bonusYield[out.itemId] = (bonusYield[out.itemId] || 0) + bonusQty;
      });

      totalExperience += (recipe.timeMinutes * 2); // Restore original XP formula
    } else {
      failures++;
      // On failure, materials are lost (consumed above), no output produced.
    }

    results.push({
      success: batchSuccess,
      quality,
      outputs: outputsThisStep,
      consumedMaterials: consumedThisStep,
      materialsLost: !batchSuccess,
      message: batchSuccess
        ? `Refined batch item ${i+1}/${batchSize}`
        : `Failed to refine batch item ${i+1}/${batchSize}`
    });
  }

  return {
    results,
    totalTimeSpent: calculateBatchTime(recipe.timeMinutes, successes + failures),
    totalExperience,
    summary: {
      successes,
      failures,
      totalOutput,
      bonusYield
    }
  };
}

// TODO(Architect): Integrate `processRefiningBatch` into the UI to allow "Craft All" functionality on the Refining station.
