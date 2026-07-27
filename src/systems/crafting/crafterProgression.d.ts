/**
 * @file src/systems/crafting/crafterProgression.ts
 * Crafter skill progression system - tracks XP, level, and recipe discovery.
 */
export interface CrafterProgression {
    /** Current crafter level (1-10) */
    level: number;
    /** Current XP towards next level */
    xp: number;
    /** XP required for next level */
    xpToNextLevel: number;
    /** Bonus modifier to crafting rolls from progression */
    bonusModifier: number;
    /** IDs of recipes the player has discovered/learned */
    knownRecipes: Set<string>;
    /** Tool proficiencies (e.g., "Alchemist's Supplies") */
    toolProficiencies: Set<string>;
    /** Crafting statistics */
    stats: CraftingStats;
}
export interface CraftingStats {
    totalCrafted: number;
    successfulCrafts: number;
    failedCrafts: number;
    masterworkCrafts: number;
    legendaryRolls: number;
    ruinedMaterials: number;
}
export type CraftingQuality = 'ruined' | 'flawed' | 'standard' | 'masterwork' | 'legendary';
export interface QualityResult {
    quality: CraftingQuality;
    effectMultiplier: number;
    durationMultiplier: number;
    quantityMultiplier: number;
    description: string;
}
export declare const XP_REWARDS: {
    common_success: number;
    uncommon_success: number;
    rare_success: number;
    very_rare_success: number;
    masterwork_bonus: number;
    legendary_bonus: number;
    discovery: number;
    failure: number;
};
/**
 * Creates a new crafter progression with default values.
 */
export declare function createCrafterProgression(toolProficiencies?: string[]): CrafterProgression;
/**
 * Calculates the XP needed for a specific level.
 */
export declare function getXpForLevel(level: number): number;
/**
 * Calculates the bonus modifier for a given level.
 */
export declare function getBonusForLevel(level: number): number;
/**
 * Adds XP to progression and handles level ups.
 */
export declare function addCraftingXP(progression: CrafterProgression, amount: number): CrafterProgression;
/**
 * Determines crafting quality based on roll vs DC.
 */
export declare function determineCraftingQuality(roll: number, dc: number, isNat20: boolean, isNat1: boolean): QualityResult;
/**
 * Learns a new recipe if not already known.
 */
export declare function learnRecipe(progression: CrafterProgression, recipeId: string): CrafterProgression;
/**
 * Gets the research cost and time for learning a new recipe.
 */
export declare function getResearchCost(rarity: string): {
    gold: number;
    days: number;
};
/**
 * Serializes progression for saving to game state.
 */
export declare function serializeProgression(progression: CrafterProgression): unknown;
/**
 * Deserializes progression from saved game state.
 */
export declare function deserializeProgression(data: unknown): CrafterProgression;
