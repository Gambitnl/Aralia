/**
 * @file src/systems/crafting/craftingSystem.ts
 * Core logic for crafting items, including recipe validation and execution.
 */
import { Recipe, CraftingResult, QualityOutcome, CraftingQuality } from './types';

/**
 * Interface representing a character capable of crafting.
 * Decoupled from full Character object to allow easier testing and usage.
 */
export interface Crafter {
  id: string;
  name: string;
  inventory: { itemId: string; quantity: number }[];
  /**
   * Callback to roll a skill check.
   * Returns a number representing the total roll (d20 + modifiers).
   */
  rollSkill: (skillName: string) => number;
}

/**
 * Checks if the crafter has the necessary materials for a recipe.
 */
export function canCraft(crafter: Crafter, recipe: Recipe): boolean {
  for (const input of recipe.inputs) {
    const itemInInventory = crafter.inventory.find(i => i.itemId === input.itemId);
    const quantity = itemInInventory ? itemInInventory.quantity : 0;

    if (quantity < input.quantity) {
      return false;
    }
  }
  return true;
}

/**
 * Attempts to craft an item using the provided recipe.
 */
export function attemptCraft(crafter: Crafter, recipe: Recipe): CraftingResult {
  // 1. Validate Materials
  if (!canCraft(crafter, recipe)) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Insufficient materials.'
    };
  }

  // 2. Perform Skill Check (if required)
  let roll = 0;
  let success = true;
  let quality: CraftingQuality = 'standard';
  let materialsLost = false;
  let outcomeMessage = '';
  let quantityMultiplier = 1;
  let itemIdOverride: string | undefined;

  // Default outcomes if none provided
  // Standard logic: Fail < DC, Success >= DC, Superior >= DC+10
  if (recipe.skillCheck) {
    roll = crafter.rollSkill(recipe.skillCheck.skill);
    const dc = recipe.skillCheck.dc;

    // Use custom outcomes if available
    if (recipe.qualityOutcomes && recipe.qualityOutcomes.length > 0) {
      // Sort by threshold descending to find best match
      const outcomes = [...recipe.qualityOutcomes].sort((a, b) => b.threshold - a.threshold);

      let matchedOutcome: QualityOutcome | undefined;
      for (const outcome of outcomes) {
        if (roll >= outcome.threshold) {
          matchedOutcome = outcome;
          break;
        }
      }

      if (matchedOutcome) {
        quality = matchedOutcome.quality;
        success = quality !== 'poor';
        itemIdOverride = matchedOutcome.itemIdOverride;
        quantityMultiplier = matchedOutcome.quantityMultiplier || 1;
        outcomeMessage = matchedOutcome.message || '';

        // If poor quality, assume failure unless recipe says otherwise (usually poor = fail in this system context)
        // actually, let's treat 'poor' as failure for consistency with existing logic unless we want "success but bad quality"
        // But for now, let's stick to: if quality is poor, success is false.
        if (quality === 'poor') {
            success = false;
            materialsLost = true; // Default to losing materials on explicit failure outcome
        }
      } else {
        // Rolled lower than lowest threshold? Assume simple failure.
        success = false;
        quality = 'poor';
        materialsLost = true;
      }

    } else {
      // Default logic
      if (roll < dc) {
        success = false;
        materialsLost = true;
        quality = 'poor';
      } else if (roll >= dc + 10) {
        quality = 'superior';
        outcomeMessage = 'Exceptional craftsmanship!';
      } else {
        quality = 'standard';
      }
    }
  }

  // 3. Determine Outcomes
  const outputs: { itemId: string; quantity: number }[] = [];
  const consumed: { itemId: string; quantity: number }[] = [];

  // Determine consumed materials
  if (success || materialsLost) {
    for (const input of recipe.inputs) {
      if (input.consumed) {
        consumed.push({ itemId: input.itemId, quantity: input.quantity });
      }
    }
  }

  if (success) {
    for (const output of recipe.outputs) {
      const qty = Math.floor(output.quantity * quantityMultiplier);
      const finalItemId = itemIdOverride || output.itemId;

      outputs.push({ itemId: finalItemId, quantity: qty });
    }
  }

  // Construct final message
  let finalMessage = outcomeMessage;
  if (!finalMessage) {
    finalMessage = success
      ? `Successfully crafted ${recipe.name} (${quality}).`
      : `Failed to craft ${recipe.name}. Materials ${materialsLost ? 'lost' : 'preserved'}.`;
  }

  return {
    success,
    quality,
    outputs: success ? outputs : [],
    consumedMaterials: consumed,
    materialsLost: !success && materialsLost,
    message: finalMessage
  };
}
