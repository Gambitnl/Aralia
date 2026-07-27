/**
 * @file src/systems/crafting/craftingSystem.ts
 * Core logic for crafting items, including recipe validation and execution.
 */
import { Recipe, CraftingResult } from './types';
/**
 * Interface representing a character capable of crafting.
 * Decoupled from full Character object to allow easier testing and usage.
 */
export interface Crafter {
    id: string;
    name: string;
    inventory: {
        itemId: string;
        quantity: number;
    }[];
    /**
     * Callback to roll a skill check.
     * Returns a number representing the total roll (d20 + modifiers).
     */
    rollSkill: (skillName: string) => number;
}
/**
 * Checks if the crafter has the necessary materials for a recipe.
 */
export declare function canCraft(crafter: Crafter, recipe: Recipe): boolean;
/**
 * Attempts to craft an item using the provided recipe.
 */
export declare function attemptCraft(crafter: Crafter, recipe: Recipe): CraftingResult;
