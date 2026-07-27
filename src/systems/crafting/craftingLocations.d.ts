/**
 * @file src/systems/crafting/craftingLocations.ts
 * Location-based crafting bonuses and requirements.
 */
import { CraftingTool, RecipeRarity } from './alchemyRecipes';
export type CraftingLocationType = 'field' | 'campsite' | 'workshop' | 'alchemy_lab' | 'apothecary' | 'wizards_tower' | 'black_market';
export interface CraftingLocation {
    id: CraftingLocationType;
    name: string;
    description: string;
    icon: string;
    dcModifier: number;
    timeModifier: number;
    maxRarity: RecipeRarity;
    allowedTools: CraftingTool[];
    bonuses: LocationBonus[];
    requirements?: LocationRequirement[];
}
export interface LocationBonus {
    type: 'quality_chance' | 'yield_bonus' | 'failure_reduction' | 'category_dc';
    value: number;
    category?: string;
    description: string;
}
export interface LocationRequirement {
    type: 'gold' | 'reputation' | 'quest';
    value: number | string;
}
export declare const CRAFTING_LOCATIONS: Record<CraftingLocationType, CraftingLocation>;
/**
 * Gets the available crafting locations for the current game state.
 */
export declare function getAvailableLocations(currentBiome: string, isInTown: boolean, playerReputation?: Record<string, string>, playerGold?: number): CraftingLocation[];
/**
 * Calculates the effective DC modifier for a specific recipe at a location.
 */
export declare function calculateLocationModifier(location: CraftingLocation, recipeCategory: string): number;
/**
 * Checks if a recipe rarity can be crafted at a location.
 */
export declare function canCraftRarityAtLocation(location: CraftingLocation, rarity: RecipeRarity): boolean;
/**
 * Checks if a tool can be used at a location.
 */
export declare function canUseToolAtLocation(location: CraftingLocation, tool: CraftingTool): boolean;
/**
 * Gets the quality chance bonus from a location.
 */
export declare function getQualityChanceBonus(location: CraftingLocation): number;
/**
 * Gets the yield bonus from a location for a category.
 */
export declare function getYieldBonus(location: CraftingLocation, category: string): number;
