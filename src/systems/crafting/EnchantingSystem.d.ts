/**
 * @file src/systems/crafting/EnchantingSystem.ts
 * Specific logic for the Enchanting system, extending standard crafting.
 * Includes "Critical Failure" mechanics as per Alchemist design.
 */
import { Recipe, CraftingResult } from './types';
import { Crafter } from './craftingSystem';
/**
 * Result specific to enchanting, potentially including side effects.
 */
export interface EnchantingResult extends CraftingResult {
    /** If true, the base item was destroyed or cursed due to critical failure. */
    criticalFailure: boolean;
    /** Description of the magical backlash, if any. */
    backlashEffect?: string;
}
/**
 * Attempts to enchant an item using the provided recipe.
 * Implements strict "Essence Consumption" and "Critical Failure" rules.
 */
export declare function attemptEnchant(crafter: Crafter, recipe: Recipe): EnchantingResult;
