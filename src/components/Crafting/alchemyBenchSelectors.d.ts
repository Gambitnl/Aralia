/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 16:13:36
 * Dependents: components/Crafting/AlchemyBenchPanel.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Crafting/alchemyBenchSelectors.ts
 * Pure selector helpers for the alchemy bench.
 *
 * These helpers keep the bench shell focused on tabs, actions, and logging
 * while preserving the current recipe corpus, location rules, and batch
 * preview behavior in a testable boundary.
 */
import { Item, PlayerCharacter } from '../../types';
import { CraftingState } from '../../types/crafting';
import { CraftingTool } from '../../systems/crafting/alchemyRecipes';
import { BatchCraftabilityResult } from '../../systems/crafting/batchCrafting';
import { CraftingLocation, CraftingLocationType } from '../../systems/crafting/craftingLocations';
import { RecipeCraftability, getCraftingSummary } from '../../systems/crafting/craftingEngine';
/**
 * Flattens the same party feat choices the bench already used so the shell can
 * seed and reuse a live crafting state without inventing a parallel tool model.
 */
export declare function collectPartyToolProficiencies(party: PlayerCharacter[]): string[];
/**
 * Builds a complete bench-facing state from either a current save, a partial
 * legacy save, or no crafting state at all.
 *
 * Missing fields inherit the standard game defaults, while every saved value is
 * preserved. Fresh arrays and nested statistics ensure the bench cannot mutate
 * the object owned by the loaded game state. Loader-wide migration remains a
 * separate responsibility of the save service.
 */
export declare function resolveAlchemyBenchCraftingState(craftingState: CraftingState | undefined, partyToolProficiencies: string[]): CraftingState;
/**
 * Filters the precomputed recipe list for the current bench view without
 * changing the ordering or the underlying recipe corpus.
 */
export declare function selectDisplayedAlchemyRecipes(recipes: RecipeCraftability[], filterCraftable: boolean, currentLocation: CraftingLocation): RecipeCraftability[];
/**
 * Computes the visible craft modifier from the lead party member, the current
 * crafting progression bonus, and the location or recipe-specific DC modifier.
 */
export declare function getAlchemyBenchCrafterModifier(party: PlayerCharacter[], bonusModifier: number, currentLocation: CraftingLocation, selectedRecipe: RecipeCraftability | null): number;
export interface BuildAlchemyBenchDerivedStateInput {
    inventory: Item[];
    gold: number;
    party: PlayerCharacter[];
    partyToolProficiencies: string[];
    craftingState: CraftingState;
    selectedTool: CraftingTool | 'all';
    selectedRecipe: RecipeCraftability | null;
    selectedLocation: CraftingLocationType;
    filterCraftable: boolean;
    showUnknown: boolean;
}
export interface AlchemyBenchDerivedState {
    knownRecipesSet: Set<string>;
    currentLocation: CraftingLocation;
    allRecipes: RecipeCraftability[];
    summary: ReturnType<typeof getCraftingSummary>;
    displayedRecipes: RecipeCraftability[];
    batchInfo: BatchCraftabilityResult | null;
    crafterModifier: number;
}
/**
 * Bundles the bench's derived recipe state so the panel can render from one
 * memoized snapshot instead of carrying all selector logic inline.
 */
export declare function buildAlchemyBenchDerivedState(input: BuildAlchemyBenchDerivedStateInput): AlchemyBenchDerivedState;
