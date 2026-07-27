/**
 * @file src/types/crafting.ts
 * Type definitions for the crafting system.
 */
export type CraftingQuality = 'ruined' | 'flawed' | 'standard' | 'masterwork' | 'legendary';
export interface CraftingStats {
    totalCrafted: number;
    successfulCrafts: number;
    failedCrafts: number;
    masterworkCrafts: number;
    legendaryRolls: number;
    ruinedMaterials: number;
    nat20Count: number;
    explosionsSurvived: number;
    recipesDiscovered: number;
    categoryCounts: Record<string, number>;
}
export interface CraftingAchievementUnlock {
    achievementId: string;
    unlockedAt: number;
}
export interface CraftingState {
    /** Current crafter level (1-10) */
    level: number;
    /** Current XP towards next level */
    xp: number;
    /** XP required for next level */
    xpToNextLevel: number;
    /** Bonus modifier to crafting rolls from progression */
    bonusModifier: number;
    /** IDs of recipes the player has discovered/learned (stored as array for serialization) */
    knownRecipes: string[];
    /** Tool proficiencies */
    toolProficiencies: string[];
    /** Crafting statistics */
    stats: CraftingStats;
    /** Unlocked achievements */
    unlockedAchievements: string[];
    /** Current crafting location */
    currentLocation: string;
}
/**
 * Creates the default initial crafting state.
 */
export declare function createInitialCraftingState(toolProficiencies?: string[]): CraftingState;
