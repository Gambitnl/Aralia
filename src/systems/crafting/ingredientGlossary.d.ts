/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:48:54
 * Dependents: components/Crafting/IngredientGlossaryPanel.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/crafting/ingredientGlossary.ts
 * Ingredient glossary - comprehensive data for all gatherable ingredients.
 */
import { Biome } from './gatheringData';
import { CraftingRecipe } from './alchemyRecipes';
export interface IngredientEntry {
    id: string;
    name: string;
    source: 'flora' | 'creature' | 'purchased';
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'unknown';
    locations: string[];
    harvestDC?: number;
    toolRequired?: string;
    usedInRecipes: string[];
    properties: string[];
    icon: string;
}
/**
 * Builds the complete ingredient glossary from all data sources.
 */
export declare function buildIngredientGlossary(): IngredientEntry[];
/**
 * Finds all recipes that use a specific ingredient.
 */
export declare function findRecipesUsingIngredient(itemId: string): string[];
/**
 * Searches the glossary by name, property, or location.
 */
export declare function searchGlossary(glossary: IngredientEntry[], query: string): IngredientEntry[];
/**
 * Filters glossary by source type.
 */
export declare function filterBySource(glossary: IngredientEntry[], source: 'flora' | 'creature' | 'purchased' | 'all'): IngredientEntry[];
/**
 * Filters glossary by rarity.
 */
export declare function filterByRarity(glossary: IngredientEntry[], rarity: string | 'all'): IngredientEntry[];
/**
 * Filters glossary to show only ingredients the player is missing.
 */
export declare function filterMissing(glossary: IngredientEntry[], inventory: {
    id: string;
}[]): IngredientEntry[];
/**
 * Gets ingredient entries needed for a specific recipe.
 */
export declare function getIngredientsForRecipe(glossary: IngredientEntry[], recipe: CraftingRecipe): (IngredientEntry | undefined)[];
/**
 * Gets a formatted tooltip for an ingredient.
 */
export declare function getIngredientTooltip(entry: IngredientEntry): string;
/**
 * Groups ingredients by their primary property.
 */
export declare function groupByProperty(glossary: IngredientEntry[]): Record<string, IngredientEntry[]>;
/**
 * Gets biome-specific ingredients for a player's current location.
 */
export declare function getIngredientsForBiome(glossary: IngredientEntry[], biome: Biome): IngredientEntry[];
