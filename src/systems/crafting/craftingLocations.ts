/**
 * @file src/systems/crafting/craftingLocations.ts
 * Location-based crafting bonuses and requirements.
 */
import { CraftingTool, RecipeRarity } from './alchemyRecipes';

export type CraftingLocationType =
    | 'field'
    | 'campsite'
    | 'workshop'
    | 'alchemy_lab'
    | 'apothecary'
    | 'wizards_tower'
    | 'black_market';

export interface CraftingLocation {
    id: CraftingLocationType;
    name: string;
    description: string;
    icon: string;
    dcModifier: number;
    timeModifier: number; // Multiplier (1.0 = normal, 0.5 = half time)
    maxRarity: RecipeRarity;
    allowedTools: CraftingTool[];
    bonuses: LocationBonus[];
    requirements?: LocationRequirement[];
}

export interface LocationBonus {
    type: 'quality_chance' | 'yield_bonus' | 'failure_reduction' | 'category_dc';
    value: number;
    category?: string; // For category-specific bonuses
    description: string;
}

export interface LocationRequirement {
    type: 'gold' | 'reputation' | 'quest';
    value: number | string;
}

// ============================================================================
// LOCATION DEFINITIONS
// ============================================================================
export const CRAFTING_LOCATIONS: Record<CraftingLocationType, CraftingLocation> = {
    field: {
        id: 'field',
        name: 'In the Field',
        description: 'Crafting on the go with limited resources. Higher failure risk.',
        icon: '🏕️',
        dcModifier: 5,
        timeModifier: 1.5,
        maxRarity: 'common',
        allowedTools: ['herbalism_kit', 'poisoners_kit'],
        bonuses: []
    },

    campsite: {
        id: 'campsite',
        name: 'Campsite',
        description: 'A proper campfire and some basic equipment. Manageable for simple recipes.',
        icon: '⛺',
        dcModifier: 2,
        timeModifier: 1.25,
        maxRarity: 'uncommon',
        allowedTools: ['herbalism_kit', 'alchemist_supplies', 'poisoners_kit'],
        bonuses: [
            { type: 'category_dc', value: -1, category: 'potion', description: '-1 DC for potions' }
        ]
    },

    workshop: {
        id: 'workshop',
        name: 'Basic Workshop',
        description: 'A town workshop with standard equipment. Suitable for most recipes.',
        icon: '🔧',
        dcModifier: 0,
        timeModifier: 1.0,
        maxRarity: 'rare',
        allowedTools: ['herbalism_kit', 'alchemist_supplies', 'poisoners_kit'],
        bonuses: [
            { type: 'failure_reduction', value: 10, description: '10% chance to salvage failed crafts' }
        ]
    },

    alchemy_lab: {
        id: 'alchemy_lab',
        name: 'Alchemy Laboratory',
        description: 'A fully equipped lab with rare reagents and precision tools.',
        icon: '⚗️',
        dcModifier: -2,
        timeModifier: 0.75,
        maxRarity: 'very_rare',
        allowedTools: ['alchemist_supplies'],
        bonuses: [
            { type: 'quality_chance', value: 10, description: '+10% Masterwork chance' },
            { type: 'failure_reduction', value: 20, description: '20% chance to salvage failed crafts' }
        ],
        requirements: [
            { type: 'gold', value: 50 } // Rental fee
        ]
    },

    apothecary: {
        id: 'apothecary',
        name: 'Apothecary Shop',
        description: 'Specialized in herbalism with access to rare plants.',
        icon: '🌿',
        dcModifier: -2,
        timeModifier: 0.75,
        maxRarity: 'very_rare',
        allowedTools: ['herbalism_kit'],
        bonuses: [
            { type: 'quality_chance', value: 15, description: '+15% Masterwork chance on healing items' },
            { type: 'category_dc', value: -2, category: 'potion', description: '-2 DC for potions' },
            { type: 'yield_bonus', value: 1, description: '+1 to healing potion yields' }
        ],
        requirements: [
            { type: 'gold', value: 25 }
        ]
    },

    wizards_tower: {
        id: 'wizards_tower',
        name: "Wizard's Tower",
        description: 'Arcane energies enhance your crafting to legendary levels.',
        icon: '🏰',
        dcModifier: -3,
        timeModifier: 0.5,
        maxRarity: 'very_rare',
        allowedTools: ['alchemist_supplies', 'herbalism_kit'],
        bonuses: [
            { type: 'quality_chance', value: 20, description: '+20% Masterwork chance' },
            { type: 'category_dc', value: -3, category: 'utility', description: '-3 DC for utility items' }
        ],
        requirements: [
            { type: 'gold', value: 100 },
            { type: 'reputation', value: 'wizards_guild_respected' }
        ]
    },

    black_market: {
        id: 'black_market',
        name: 'Black Market Den',
        description: 'Shady operations, but perfect for poisons and illicit substances.',
        icon: '🌑',
        dcModifier: -2,
        timeModifier: 0.75,
        maxRarity: 'very_rare',
        allowedTools: ['poisoners_kit'],
        bonuses: [
            { type: 'quality_chance', value: 15, description: '+15% Masterwork chance on poisons' },
            { type: 'category_dc', value: -3, category: 'poison', description: '-3 DC for poisons' },
            { type: 'yield_bonus', value: 2, description: '+2 to poison yields' }
        ],
        requirements: [
            { type: 'reputation', value: 'thieves_guild_member' }
        ]
    }
};

/**
 * Gets the available crafting locations for the current game state.
 */
export function getAvailableLocations(
    currentBiome: string,
    isInTown: boolean,
    playerReputation: Record<string, string> = {},
    playerGold: number = 0
): CraftingLocation[] {
    const locations: CraftingLocation[] = [];

    // Field is always available
    locations.push(CRAFTING_LOCATIONS.field);

    // Campsite available in wilderness
    if (!isInTown) {
        locations.push(CRAFTING_LOCATIONS.campsite);
    }

    // Town locations
    if (isInTown) {
        locations.push(CRAFTING_LOCATIONS.workshop);

        // Lab if can afford
        if (playerGold >= 50) {
            locations.push(CRAFTING_LOCATIONS.alchemy_lab);
        }

        // Apothecary if can afford
        if (playerGold >= 25) {
            locations.push(CRAFTING_LOCATIONS.apothecary);
        }

        // Wizard's tower if reputation
        if (playerReputation['wizards_guild'] === 'respected' && playerGold >= 100) {
            locations.push(CRAFTING_LOCATIONS.wizards_tower);
        }

        // Black market if reputation
        if (playerReputation['thieves_guild'] === 'member') {
            locations.push(CRAFTING_LOCATIONS.black_market);
        }
    }

    return locations;
}

/**
 * Calculates the effective DC modifier for a specific recipe at a location.
 */
export function calculateLocationModifier(
    location: CraftingLocation,
    recipeCategory: string
): number {
    let modifier = location.dcModifier;

    // Apply category-specific bonuses
    for (const bonus of location.bonuses) {
        if (bonus.type === 'category_dc' && bonus.category === recipeCategory) {
            modifier += bonus.value;
        }
    }

    return modifier;
}

/**
 * Checks if a recipe rarity can be crafted at a location.
 */
export function canCraftRarityAtLocation(
    location: CraftingLocation,
    rarity: RecipeRarity
): boolean {
    const rarityOrder: RecipeRarity[] = ['common', 'uncommon', 'rare', 'very_rare'];
    const maxIndex = rarityOrder.indexOf(location.maxRarity);
    const recipeIndex = rarityOrder.indexOf(rarity);
    return recipeIndex <= maxIndex;
}

/**
 * Checks if a tool can be used at a location.
 */
export function canUseToolAtLocation(
    location: CraftingLocation,
    tool: CraftingTool
): boolean {
    return location.allowedTools.includes(tool);
}

/**
 * Gets the quality chance bonus from a location.
 */
export function getQualityChanceBonus(location: CraftingLocation): number {
    for (const bonus of location.bonuses) {
        if (bonus.type === 'quality_chance') {
            return bonus.value;
        }
    }
    return 0;
}

/**
 * Gets the yield bonus from a location for a category.
 */
export function getYieldBonus(location: CraftingLocation, category: string): number {
    for (const bonus of location.bonuses) {
        if (bonus.type === 'yield_bonus') {
            // If no category specified, applies to all
            if (!bonus.category || bonus.category === category) {
                return bonus.value;
            }
        }
    }
    return 0;
}
