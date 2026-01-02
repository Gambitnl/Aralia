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
    subtype?: string; // e.g., 'masterwork', 'poison', etc.
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

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================
export const CRAFTING_ACHIEVEMENTS: CraftingAchievement[] = [
    // Progress Achievements
    {
        id: 'first_brew',
        name: 'First Brew',
        description: 'Craft your first item',
        icon: '🧪',
        category: 'progress',
        requirement: { type: 'craft_count', value: 1 },
        reward: { type: 'xp_bonus', value: 25, description: '+25 bonus XP' }
    },
    {
        id: 'apprentice',
        name: 'Apprentice Alchemist',
        description: 'Craft 10 items',
        icon: '📜',
        category: 'progress',
        requirement: { type: 'craft_count', value: 10 },
        reward: { type: 'xp_bonus', value: 5, description: '+5% XP from crafting' }
    },
    {
        id: 'journeyman',
        name: 'Journeyman Crafter',
        description: 'Craft 50 items',
        icon: '⚗️',
        category: 'progress',
        requirement: { type: 'craft_count', value: 50 },
        reward: { type: 'dc_modifier', value: -1, description: '-1 to all crafting DCs' }
    },
    {
        id: 'master_crafter',
        name: 'Master Crafter',
        description: 'Craft 100 items',
        icon: '🏆',
        category: 'progress',
        requirement: { type: 'craft_count', value: 100 },
        reward: { type: 'dc_modifier', value: -2, description: '-2 to all crafting DCs' }
    },
    {
        id: 'grandmaster',
        name: 'Grandmaster Alchemist',
        description: 'Reach crafting level 10',
        icon: '👑',
        category: 'progress',
        requirement: { type: 'level', value: 10 },
        reward: { type: 'title', value: 'Grandmaster Alchemist', description: 'Unlock exclusive title' }
    },

    // Quality Achievements
    {
        id: 'quality_control',
        name: 'Quality Control',
        description: 'Craft 10 Masterwork items',
        icon: '⭐',
        category: 'mastery',
        requirement: { type: 'quality_count', value: 10, subtype: 'masterwork' },
        reward: { type: 'dc_modifier', value: -1, description: '-1 DC for Masterwork chance' }
    },
    {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Craft 25 Masterwork items',
        icon: '💎',
        category: 'mastery',
        requirement: { type: 'quality_count', value: 25, subtype: 'masterwork' },
        reward: { type: 'xp_bonus', value: 10, description: '+10% XP from Masterwork crafts' }
    },
    {
        id: 'legendary_touch',
        name: 'Legendary Touch',
        description: 'Craft 5 Legendary quality items',
        icon: '🌟',
        category: 'mastery',
        requirement: { type: 'quality_count', value: 5, subtype: 'legendary' },
        reward: { type: 'dc_modifier', value: -2, description: '+2 to Nat 20 crafting effects' }
    },

    // Discovery Achievements
    {
        id: 'curious_mind',
        name: 'Curious Mind',
        description: 'Discover your first recipe through experimentation',
        icon: '🔬',
        category: 'discovery',
        requirement: { type: 'discovery', value: 1 },
        reward: { type: 'xp_bonus', value: 50, description: '+50 bonus XP' }
    },
    {
        id: 'mad_scientist',
        name: 'Mad Scientist',
        description: 'Discover 10 recipes through experimentation',
        icon: '🧬',
        category: 'discovery',
        requirement: { type: 'discovery', value: 10 },
        reward: { type: 'dc_modifier', value: -2, description: '-2 DC on experiments' }
    },
    {
        id: 'recipe_collector',
        name: 'Recipe Collector',
        description: 'Learn 20 different recipes',
        icon: '📚',
        category: 'discovery',
        requirement: { type: 'recipe_count', value: 20 },
        reward: { type: 'gold_discount', value: 10, description: '10% discount on research costs' }
    },

    // Category Achievements
    {
        id: 'healer',
        name: 'Healer',
        description: 'Craft 25 potions',
        icon: '💊',
        category: 'special',
        requirement: { type: 'category_count', value: 25, subtype: 'potion' },
        reward: { type: 'dc_modifier', value: -1, description: '-1 DC on healing potions' }
    },
    {
        id: 'poisoner',
        name: 'Poisoner',
        description: 'Craft 25 poisons',
        icon: '💀',
        category: 'special',
        requirement: { type: 'category_count', value: 25, subtype: 'poison' },
        reward: { type: 'gold_discount', value: 20, description: '20% discount at black markets' }
    },
    {
        id: 'bomber',
        name: 'Demolitionist',
        description: 'Craft 25 bombs',
        icon: '💣',
        category: 'special',
        requirement: { type: 'category_count', value: 25, subtype: 'bomb' },
        reward: { type: 'dc_modifier', value: -1, description: '-1 DC on explosives' }
    },

    // Hidden/Special Achievements
    {
        id: 'survivor',
        name: 'Survivor',
        description: 'Survive 10 crafting explosions',
        icon: '🔥',
        category: 'special',
        requirement: { type: 'craft_count', value: 10, subtype: 'explosion_survived' },
        reward: { type: 'dc_modifier', value: -2, description: 'Reduced explosion damage' },
        hidden: true
    },
    {
        id: 'lucky',
        name: 'Lucky',
        description: 'Roll a natural 20 on crafting 3 times',
        icon: '🍀',
        category: 'special',
        requirement: { type: 'quality_count', value: 3, subtype: 'nat20' },
        reward: { type: 'xp_bonus', value: 20, description: '+20% XP from natural 20s' },
        hidden: true
    }
];

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
export function checkAchievementRequirement(
    achievement: CraftingAchievement,
    progression: CrafterProgression,
    stats: ExtendedCraftingStats
): boolean {
    const req = achievement.requirement;

    switch (req.type) {
        case 'craft_count':
            if (req.subtype === 'explosion_survived') {
                return stats.explosionsSurvived >= req.value;
            }
            return stats.totalCrafted >= req.value;

        case 'quality_count':
            if (req.subtype === 'masterwork') {
                return stats.masterworkCrafts >= req.value;
            }
            if (req.subtype === 'legendary') {
                return stats.legendaryRolls >= req.value;
            }
            if (req.subtype === 'nat20') {
                return stats.nat20Count >= req.value;
            }
            return false;

        case 'level':
            return progression.level >= req.value;

        case 'recipe_count':
            return progression.knownRecipes.size >= req.value;

        case 'discovery':
            return stats.recipesDiscovered >= req.value;

        case 'category_count':
            return (stats.categoryCounts[req.subtype || ''] || 0) >= req.value;

        default:
            return false;
    }
}

/**
 * Gets all achievements that are newly unlocked.
 */
export function checkNewAchievements(
    progression: CrafterProgression,
    stats: ExtendedCraftingStats,
    alreadyUnlocked: Set<string>
): CraftingAchievement[] {
    const newlyUnlocked: CraftingAchievement[] = [];

    for (const achievement of CRAFTING_ACHIEVEMENTS) {
        if (alreadyUnlocked.has(achievement.id)) continue;
        if (checkAchievementRequirement(achievement, progression, stats)) {
            newlyUnlocked.push(achievement);
        }
    }

    return newlyUnlocked;
}

/**
 * Calculates total DC modifier from all unlocked achievements.
 */
export function getTotalDCModifier(unlockedAchievements: Set<string>): number {
    let modifier = 0;

    for (const achievement of CRAFTING_ACHIEVEMENTS) {
        if (!unlockedAchievements.has(achievement.id)) continue;
        if (achievement.reward.type === 'dc_modifier') {
            modifier += achievement.reward.value as number;
        }
    }

    return modifier;
}

/**
 * Calculates total XP bonus percentage from all unlocked achievements.
 */
export function getTotalXPBonus(unlockedAchievements: Set<string>): number {
    let bonus = 0;

    for (const achievement of CRAFTING_ACHIEVEMENTS) {
        if (!unlockedAchievements.has(achievement.id)) continue;
        if (achievement.reward.type === 'xp_bonus' && typeof achievement.reward.value === 'number') {
            // Values under 50 are percentages, over are flat bonuses
            if (achievement.reward.value < 50) {
                bonus += achievement.reward.value;
            }
        }
    }

    return bonus;
}

/**
 * Gets achievement progress as a percentage.
 */
export function getAchievementProgress(
    achievement: CraftingAchievement,
    _progression: CrafterProgression,
    stats: ExtendedCraftingStats
): number {
    const req = achievement.requirement;
    let current = 0;

    switch (req.type) {
        case 'craft_count':
            current = stats.totalCrafted;
            break;
        case 'quality_count':
            if (req.subtype === 'masterwork') current = stats.masterworkCrafts;
            else if (req.subtype === 'legendary') current = stats.legendaryRolls;
            break;
        case 'discovery':
            current = stats.recipesDiscovered;
            break;
        // Add more as needed
    }

    return Math.min(100, (current / req.value) * 100);
}

/**
 * Creates default extended stats.
 */
export function createExtendedStats(): ExtendedCraftingStats {
    return {
        totalCrafted: 0,
        successfulCrafts: 0,
        failedCrafts: 0,
        masterworkCrafts: 0,
        legendaryRolls: 0,
        ruinedMaterials: 0,
        nat20Count: 0,
        explosionsSurvived: 0,
        recipesDiscovered: 0,
        categoryCounts: {}
    };
}

/**
 * Updates stats after a crafting attempt.
 */
export function updateStatsAfterCraft(
    stats: ExtendedCraftingStats,
    quality: CraftingQuality,
    category: string,
    isNat20: boolean
): ExtendedCraftingStats {
    const newStats = { ...stats };
    newStats.totalCrafted++;

    if (quality === 'ruined') {
        newStats.failedCrafts++;
        newStats.ruinedMaterials++;
    } else {
        newStats.successfulCrafts++;
    }

    if (quality === 'masterwork') newStats.masterworkCrafts++;
    if (quality === 'legendary') newStats.legendaryRolls++;
    if (isNat20) newStats.nat20Count++;

    // Update category counts
    newStats.categoryCounts = { ...newStats.categoryCounts };
    newStats.categoryCounts[category] = (newStats.categoryCounts[category] || 0) + 1;

    return newStats;
}
