/**
 * @file src/systems/crafting/alchemySystem.ts
 * Experimental alchemy system allowing property-based ingredient mixing.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Failure teaches.
 */
import { Item } from '../../types/items';
import { Crafter } from './craftingSystem';
import { CraftingResult } from './types';
export type ReagentProperty = 'curative' | 'reactive' | 'toxic' | 'binding' | 'concentrated' | 'inert';
export type AlchemicalProperty = ReagentProperty | 'psionic' | 'ethereal' | 'luminous';
export interface AlchemyReagent {
    itemId: string;
    properties: ReagentProperty[];
    power: number;
}
export type AlchemyOutcomeType = 'success' | 'volatile' | 'sludge' | 'discovery';
export interface AlchemyResult extends CraftingResult {
    outcomeType: AlchemyOutcomeType;
    discoveredProperties: string[];
}
export interface AlchemyRecipe {
    /** Minimum counts of properties required */
    requirements: Partial<Record<ReagentProperty, number>>;
    /** Output item ID */
    outputItemId: string;
    /** Base success message */
    successMessage: string;
    /** If true, presence of 'reactive' property makes result volatile */
    reactivityMakesVolatile?: boolean;
}
export declare const REAGENT_DATABASE: Record<string, ReagentProperty[]>;
/**
 * Analyzes an item to determine its alchemical properties.
 */
export declare function getReagentProperties(item: Item): ReagentProperty[];
/**
 * Attempts to mix reagents to create an alchemical effect.
 * Unlike standard crafting, this does not require a recipe ID.
 * It derives the result from the combined properties of the inputs.
 */
export declare function attemptAlchemy(crafter: Crafter, reagents: Item[]): AlchemyResult;
