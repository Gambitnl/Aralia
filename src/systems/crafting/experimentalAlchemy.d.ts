import { AlchemicalProperty } from './alchemySystem';
export type ExperimentOutcome = 'discovery' | 'partial_success' | 'inert_mixture' | 'minor_explosion' | 'toxic_cloud' | 'wild_magic' | 'mutation';
export interface ExperimentResult {
    outcome: ExperimentOutcome;
    success: boolean;
    message: string;
    discoveredRecipe?: string;
    damage?: {
        amount: number;
        type: string;
    };
    condition?: {
        effect: string;
        duration: number;
    };
    outputItem?: {
        itemId: string;
        quantity: number;
    };
    xpGained: number;
}
export interface IngredientProperties {
    itemId: string;
    name: string;
    properties: AlchemicalProperty[];
}
/**
 * Gets the alchemical properties of an ingredient.
 */
export declare function getIngredientProperties(itemId: string): AlchemicalProperty[];
/**
 * Combines properties from multiple ingredients.
 */
export declare function combineProperties(ingredients: string[]): AlchemicalProperty[];
/**
 * Attempts experimental alchemy - mixing ingredients without a known recipe.
 */
export declare function attemptExperiment(ingredients: string[], crafterModifier: number, knownRecipes: Set<string>): ExperimentResult;
/**
 * Gets a description of what might happen with certain property combinations.
 * Used for UI hints.
 */
export declare function getPropertyHint(properties: AlchemicalProperty[]): string;
