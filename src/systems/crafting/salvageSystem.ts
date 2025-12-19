/**
 * @file src/systems/crafting/salvageSystem.ts
 * Logic for salvaging/deconstructing items into raw materials.
 */
import { Crafter } from './craftingSystem';
import { SalvageRule, SalvageResult, CraftingStationType } from './types';
import { Item } from '../../types/items';

/**
 * Attempts to salvage an item into materials.
 *
 * ALCHEMIST PHILOSOPHY: Destruction yields resources, but skill determines yield.
 */
export function attemptSalvage(
  crafter: Crafter,
  item: Item,
  rule: SalvageRule,
  station?: CraftingStationType
): SalvageResult {
  // 1. Validate Station
  if (rule.station && rule.station !== station) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      message: `Requires ${rule.station} to salvage.`
    };
  }

  // 2. Validate Item Match
  if (item.id !== rule.targetItemId) {
     return {
      success: false,
      quality: 'poor',
      outputs: [],
      message: `Rule does not apply to this item.`
    };
  }

  // 3. Skill Check
  let roll = 0;
  let quality: 'poor' | 'standard' | 'superior' | 'masterwork' = 'standard';

  if (rule.skillCheck) {
    roll = crafter.rollSkill(rule.skillCheck.skill);
    const dc = rule.skillCheck.dc;

    if (roll < dc) {
      // Failed check means poor yield (maybe nothing, or just broken scraps)
      quality = 'poor';
    } else if (roll >= dc + 10) {
      quality = 'superior';
    } else if (roll >= dc + 20) {
        quality = 'masterwork'; // Rare perfect salvage
    }
  }

  // 4. Calculate Outputs
  const outputs: { itemId: string; quantity: number }[] = [];

  for (const outcome of rule.outputs) {
    // Chance check
    if (Math.random() > outcome.chance) continue;

    let qty = outcome.quantityMin;

    if (quality === 'poor') {
        // Poor quality: Min quantity, maybe even 0?
        // Let's say poor quality halves the min quantity (floored)
        qty = Math.floor(outcome.quantityMin / 2);
    } else if (quality === 'standard') {
        // Standard: Random between min and max
        qty = Math.floor(Math.random() * (outcome.quantityMax - outcome.quantityMin + 1)) + outcome.quantityMin;
    } else if (quality === 'superior') {
        // Superior: Max quantity
        qty = outcome.quantityMax;
    } else if (quality === 'masterwork') {
        // Masterwork: Max + 1 (if possible/sensible, or just Max)
        qty = outcome.quantityMax + 1;
    }

    if (qty > 0) {
        outputs.push({ itemId: outcome.itemId, quantity: qty });
    }
  }

  // If poor quality resulted in 0 items, message reflects that
  if (quality === 'poor' && outputs.length === 0) {
      return {
          success: false,
          quality,
          outputs: [],
          message: `Salvage failed; the item was destroyed without yielding usable material.`
      };
  }

  return {
      success: true,
      quality,
      outputs,
      message: `Successfully salvaged ${item.name}.`
  };
}

// TODO(Alchemist): Integrate with UI/Inventory context menu to allow right-click -> salvage
