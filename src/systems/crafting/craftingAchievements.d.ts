/**
 * @file src/systems/crafting/craftingAchievements.ts
 * Crafting achievement system - tracks milestones and grants rewards.
 */
import { CrafterProgression, CraftingQuality } from './crafterProgression';
export interface CraftingAchievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'progress' | 'mastery' | 'discovery' | 'special';
    requirement: AchievementRequirement;
    reward: AchievementReward;
    hidden?: boolean;
}
export interface AchievementRequirement {
    type: 'craft_count' | 'quality_count' | 'level' | 'recipe_count' | 'discovery' | 'category_count';
    value: number;
    subtype?: string;
}
export interface AchievementReward {
    type: 'xp_bonus' | 'dc_modifier' | 'gold_discount' | 'title' | 'recipe';
    value: number | string;
    description: string;
}
export interface AchievementProgress {
    unlockedAchievements: Set<string>;
    activeRewards: AchievementReward[];
}
export declare const CRAFTING_ACHIEVEMENTS: CraftingAchievement[];
/**
 * Extended stats for tracking achievement progress.
 */
export interface ExtendedCraftingStats {
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
/**
 * Checks if an achievement requirement is met.
 */
export declare function checkAchievementRequirement(achievement: CraftingAchievement, progression: CrafterProgression, stats: ExtendedCraftingStats): boolean;
/**
 * Gets all achievements that are newly unlocked.
 */
export declare function checkNewAchievements(progression: CrafterProgression, stats: ExtendedCraftingStats, alreadyUnlocked: Set<string>): CraftingAchievement[];
/**
 * Calculates total DC modifier from all unlocked achievements.
 */
export declare function getTotalDCModifier(unlockedAchievements: Set<string>): number;
/**
 * Calculates total XP bonus percentage from all unlocked achievements.
 */
export declare function getTotalXPBonus(unlockedAchievements: Set<string>): number;
/**
 * Gets achievement progress as a percentage.
 */
export declare function getAchievementProgress(achievement: CraftingAchievement, _progression: CrafterProgression, stats: ExtendedCraftingStats): number;
/**
 * Creates default extended stats.
 */
export declare function createExtendedStats(): ExtendedCraftingStats;
/**
 * Updates stats after a crafting attempt.
 */
export declare function updateStatsAfterCraft(stats: ExtendedCraftingStats, quality: CraftingQuality, category: string, isNat20: boolean): ExtendedCraftingStats;
