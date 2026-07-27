/**
 * @file src/systems/crafting/salvageSystem.ts
 * Logic for salvaging/disassembling items into materials.
 * ALCHEMIST PHILOSOPHY: Destruction should cost resources (the item) and failure teaches (loss of materials).
 */
import { Recipe, CraftingResult } from './types';
import { Crafter } from './craftingSystem';
/**
 * Attempts to salvage an item using the provided recipe.
 *
 * Salvage Rules:
 * - Input item is ALWAYS consumed (it's being broken down).
 * - Success: Returns materials (outputs).
 * - Failure: Returns nothing (scrap), item is lost.
 * - Critical Success: Returns materials + potential bonus (implemented as superior quality for now).
 */
export declare function attemptSalvage(crafter: Crafter, recipe: Recipe): CraftingResult;
