// @dependencies-start
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
// @dependencies-end

/**
 * @file src/components/Crafting/alchemyBenchSelectors.ts
 * Pure selector helpers for the alchemy bench.
 *
 * These helpers keep the bench shell focused on tabs, actions, and logging
 * while preserving the current recipe corpus, location rules, and batch
 * preview behavior in a testable boundary.
 */
import { Item, PlayerCharacter } from '../../types';
import { CraftingState, createInitialCraftingState } from '../../types/crafting';
import { CraftingTool } from '../../systems/crafting/alchemyRecipes';
import {
    BatchCraftabilityResult,
    calculateBatchCraftability
} from '../../systems/crafting/batchCrafting';
import {
    CRAFTING_LOCATIONS,
    CraftingLocation,
    CraftingLocationType,
    calculateLocationModifier,
    canCraftRarityAtLocation
} from '../../systems/crafting/craftingLocations';
import {
    RecipeCraftability,
    getAllRecipeCraftability,
    getCraftingSummary
} from '../../systems/crafting/craftingEngine';

/**
 * Flattens the same party feat choices the bench already used so the shell can
 * seed and reuse a live crafting state without inventing a parallel tool model.
 */
export function collectPartyToolProficiencies(party: PlayerCharacter[]): string[] {
    const proficiencies: string[] = [];

    for (const character of party) {
        if (!character.featChoices) {
            continue;
        }

        Object.values(character.featChoices).forEach(choice => {
            if (choice.selectedTools) {
                proficiencies.push(...choice.selectedTools);
            }
        });
    }

    return proficiencies;
}

// ============================================================================
// Saved Crafting-State Boundary
// ============================================================================
// Save files can outlive additions to CraftingState. This section gives the
// Alchemy Bench a complete read-only view without pretending to migrate the save.
// ============================================================================

/**
 * Builds a complete bench-facing state from either a current save, a partial
 * legacy save, or no crafting state at all.
 *
 * Missing fields inherit the standard game defaults, while every saved value is
 * preserved. Fresh arrays and nested statistics ensure the bench cannot mutate
 * the object owned by the loaded game state. Loader-wide migration remains a
 * separate responsibility of the save service.
 */
export function resolveAlchemyBenchCraftingState(
    craftingState: CraftingState | undefined,
    partyToolProficiencies: string[]
): CraftingState {
    const defaultState = createInitialCraftingState(partyToolProficiencies);

    // A new game still receives the canonical starter recipes and tool choices.
    if (!craftingState) {
        return defaultState;
    }

    // A loaded JSON save can be missing fields even though current TypeScript
    // callers see CraftingState. Merge each nested collection separately so a
    // partial `stats` object cannot erase newer counters or category tracking.
    const savedStats = craftingState.stats ?? defaultState.stats;

    return {
        ...defaultState,
        ...craftingState,
        knownRecipes: [...(craftingState.knownRecipes ?? defaultState.knownRecipes)],
        toolProficiencies: [
            ...(craftingState.toolProficiencies ?? defaultState.toolProficiencies)
        ],
        unlockedAchievements: [
            ...(craftingState.unlockedAchievements ?? defaultState.unlockedAchievements)
        ],
        stats: {
            ...defaultState.stats,
            ...savedStats,
            categoryCounts: {
                ...defaultState.stats.categoryCounts,
                ...(savedStats.categoryCounts ?? {})
            }
        }
    };
}

/**
 * Filters the precomputed recipe list for the current bench view without
 * changing the ordering or the underlying recipe corpus.
 */
export function selectDisplayedAlchemyRecipes(
    recipes: RecipeCraftability[],
    filterCraftable: boolean,
    currentLocation: CraftingLocation
): RecipeCraftability[] {
    let displayedRecipes = recipes;

    if (filterCraftable) {
        displayedRecipes = displayedRecipes.filter(recipe => recipe.canCraft);
    }

    return displayedRecipes.filter(recipe =>
        canCraftRarityAtLocation(currentLocation, recipe.recipe.rarity)
    );
}

/**
 * Computes the visible craft modifier from the lead party member, the current
 * crafting progression bonus, and the location or recipe-specific DC modifier.
 */
export function getAlchemyBenchCrafterModifier(
    party: PlayerCharacter[],
    bonusModifier: number,
    currentLocation: CraftingLocation,
    selectedRecipe: RecipeCraftability | null
): number {
    if (party.length === 0) {
        return 2;
    }

    const leadCrafter = party[0];
    const proficiencyBonus = leadCrafter.proficiencyBonus || 2;
    const intelligenceModifier = Math.floor(((leadCrafter.abilityScores?.Intelligence || 10) - 10) / 2);
    const locationModifier = selectedRecipe
        ? calculateLocationModifier(currentLocation, selectedRecipe.recipe.category)
        : currentLocation.dcModifier;

    return proficiencyBonus + intelligenceModifier + bonusModifier - locationModifier;
}

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
export function buildAlchemyBenchDerivedState(
    input: BuildAlchemyBenchDerivedStateInput
): AlchemyBenchDerivedState {
    const knownRecipesSet = new Set(input.craftingState.knownRecipes);
    const currentLocation = CRAFTING_LOCATIONS[input.selectedLocation];
    const filterTool = input.selectedTool === 'all' ? undefined : input.selectedTool;

    const allRecipes = getAllRecipeCraftability(
        input.inventory,
        input.gold,
        input.partyToolProficiencies,
        filterTool,
        knownRecipesSet,
        input.showUnknown
    );

    const summary = getCraftingSummary(
        input.inventory,
        input.gold,
        input.partyToolProficiencies,
        knownRecipesSet
    );

    const displayedRecipes = selectDisplayedAlchemyRecipes(
        allRecipes,
        input.filterCraftable,
        currentLocation
    );

    const batchInfo = input.selectedRecipe
        ? calculateBatchCraftability(input.selectedRecipe.recipe, input.inventory, input.gold)
        : null;

    const crafterModifier = getAlchemyBenchCrafterModifier(
        input.party,
        input.craftingState.bonusModifier,
        currentLocation,
        input.selectedRecipe
    );

    return {
        knownRecipesSet,
        currentLocation,
        allRecipes,
        summary,
        displayedRecipes,
        batchInfo,
        crafterModifier
    };
}
