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

// XP thresholds for each level
const LEVEL_XP_THRESHOLDS = [
    0,     // Level 1
    100,   // Level 2
    250,   // Level 3
    500,   // Level 4
    1000,  // Level 5
    2000,  // Level 6
    3500,  // Level 7
    5500,  // Level 8
    8000,  // Level 9
    12000  // Level 10
];

// XP rewards for crafting actions
export const XP_REWARDS = {
    common_success: 10,
    uncommon_success: 25,
    rare_success: 50,
    very_rare_success: 100,
    masterwork_bonus: 15,
    legendary_bonus: 50,
    discovery: 30,
    failure: 5 // Still learn from mistakes
};

// Starting recipes per tool (3 common recipes each)
const STARTING_RECIPES: Record<string, string[]> = {
    'alchemist_supplies': ['alchemists_fire', 'smokebomb', 'vial_of_acid'],
    'herbalism_kit': ['healing_salve', 'antitoxin', 'potion_of_climbing'],
    'poisoners_kit': ['basic_poison', 'serpent_venom_poison', 'truth_serum']
};

/**
 * Creates a new crafter progression with default values.
 */
export function createCrafterProgression(toolProficiencies: string[] = []): CrafterProgression {
    const knownRecipes = new Set<string>();

    // Add starting recipes based on tool proficiencies
    for (const tool of toolProficiencies) {
        const normalizedTool = tool.toLowerCase().replace(/[''\s]/g, '_');
        const startingRecipes = STARTING_RECIPES[normalizedTool] || [];
        startingRecipes.forEach(r => knownRecipes.add(r));
    }

    return {
        level: 1,
        xp: 0,
        xpToNextLevel: LEVEL_XP_THRESHOLDS[1],
        bonusModifier: 0,
        knownRecipes,
        toolProficiencies: new Set(toolProficiencies),
        stats: {
            totalCrafted: 0,
            successfulCrafts: 0,
            failedCrafts: 0,
            masterworkCrafts: 0,
            legendaryRolls: 0,
            ruinedMaterials: 0
        }
    };
}

/**
 * Calculates the XP needed for a specific level.
 */
export function getXpForLevel(level: number): number {
    return LEVEL_XP_THRESHOLDS[Math.min(level - 1, LEVEL_XP_THRESHOLDS.length - 1)];
}

/**
 * Calculates the bonus modifier for a given level.
 */
export function getBonusForLevel(level: number): number {
    // +1 at level 3, +2 at level 5, +3 at level 7, +4 at level 9, +5 at level 10
    if (level >= 10) return 5;
    if (level >= 9) return 4;
    if (level >= 7) return 3;
    if (level >= 5) return 2;
    if (level >= 3) return 1;
    return 0;
}

/**
 * Adds XP to progression and handles level ups.
 */
export function addCraftingXP(progression: CrafterProgression, amount: number): CrafterProgression {
    let newXp = progression.xp + amount;
    let newLevel = progression.level;

    // Check for level up (max level 10)
    while (newLevel < 10 && newXp >= LEVEL_XP_THRESHOLDS[newLevel]) {
        newXp -= LEVEL_XP_THRESHOLDS[newLevel];
        newLevel++;
    }

    return {
        ...progression,
        xp: newXp,
        level: newLevel,
        xpToNextLevel: newLevel < 10 ? LEVEL_XP_THRESHOLDS[newLevel] : 0,
        bonusModifier: getBonusForLevel(newLevel)
    };
}

/**
 * Determines crafting quality based on roll vs DC.
 */
export function determineCraftingQuality(
    roll: number,
    dc: number,
    isNat20: boolean,
    isNat1: boolean
): QualityResult {
    // Natural 20 = Legendary (double output)
    if (isNat20) {
        return {
            quality: 'legendary',
            effectMultiplier: 1.5,
            durationMultiplier: 1.5,
            quantityMultiplier: 2,
            description: 'Legendary! Your masterful technique produces exceptional results.'
        };
    }

    // Natural 1 = Always ruined
    if (isNat1) {
        return {
            quality: 'ruined',
            effectMultiplier: 0,
            durationMultiplier: 0,
            quantityMultiplier: 0,
            description: 'Critical failure! The materials are completely ruined.'
        };
    }

    const difference = roll - dc;

    if (difference < -5) {
        return {
            quality: 'ruined',
            effectMultiplier: 0,
            durationMultiplier: 0,
            quantityMultiplier: 0,
            description: 'Ruined! Materials are destroyed beyond use.'
        };
    } else if (difference < 0) {
        return {
            quality: 'flawed',
            effectMultiplier: 0.5,
            durationMultiplier: 0.5,
            quantityMultiplier: 1,
            description: 'Flawed. The result is usable but at reduced effectiveness.'
        };
    } else if (difference < 5) {
        return {
            quality: 'standard',
            effectMultiplier: 1,
            durationMultiplier: 1,
            quantityMultiplier: 1,
            description: 'Standard quality.'
        };
    } else {
        return {
            quality: 'masterwork',
            effectMultiplier: 1.5,
            durationMultiplier: 1.5,
            quantityMultiplier: 1,
            description: 'Masterwork! Enhanced potency and duration.'
        };
    }
}

/**
 * Learns a new recipe if not already known.
 */
export function learnRecipe(progression: CrafterProgression, recipeId: string): CrafterProgression {
    if (progression.knownRecipes.has(recipeId)) {
        return progression;
    }

    const newKnownRecipes = new Set(progression.knownRecipes);
    newKnownRecipes.add(recipeId);

    // Also grant discovery XP
    return addCraftingXP({
        ...progression,
        knownRecipes: newKnownRecipes
    }, XP_REWARDS.discovery);
}

/**
 * Gets the research cost and time for learning a new recipe.
 */
export function getResearchCost(rarity: string): { gold: number; days: number } {
    switch (rarity) {
        case 'common': return { gold: 50, days: 1 };
        case 'uncommon': return { gold: 250, days: 5 };
        case 'rare': return { gold: 500, days: 10 };
        case 'very_rare': return { gold: 1000, days: 30 };
        default: return { gold: 100, days: 3 };
    }
}

/**
 * Serializes progression for saving to game state.
 */
export function serializeProgression(progression: CrafterProgression): unknown {
    return {
        ...progression,
        knownRecipes: Array.from(progression.knownRecipes),
        toolProficiencies: Array.from(progression.toolProficiencies)
    };
}

/**
 * Deserializes progression from saved game state.
 */
export function deserializeProgression(data: unknown): CrafterProgression {
    const raw = data as {
        level: number;
        xp: number;
        xpToNextLevel: number;
        bonusModifier: number;
        knownRecipes: string[];
        toolProficiencies: string[];
        stats: CraftingStats;
    };

    return {
        level: raw.level || 1,
        xp: raw.xp || 0,
        xpToNextLevel: raw.xpToNextLevel || LEVEL_XP_THRESHOLDS[1],
        bonusModifier: raw.bonusModifier || 0,
        knownRecipes: new Set(raw.knownRecipes || []),
        toolProficiencies: new Set(raw.toolProficiencies || []),
        stats: raw.stats || {
            totalCrafted: 0,
            successfulCrafts: 0,
            failedCrafts: 0,
            masterworkCrafts: 0,
            legendaryRolls: 0,
            ruinedMaterials: 0
        }
    };
}
