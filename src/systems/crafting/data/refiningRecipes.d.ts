/**
 * @file src/systems/crafting/data/refiningRecipes.ts
 * Refining recipes: raw materials -> refined components.
 * Consumed by the dedicated Refining & Enchanting panel via processRefiningBatch.
 * Every item id must exist in ALL_ITEMS (see src/data/craftingMaterials.ts).
 */
import { RefiningRecipe } from '../RefiningSystem';
export declare const REFINING_RECIPES: RefiningRecipe[];
