
/**
 * @file src/systems/crafting/gatheringData.ts
 * Definitions for gatherable ingredients, biomes, and rarities based on the Herbalism & Gathering rules.
 */

export type IngredientRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';

export type Biome =
    | 'Arctic'
    | 'Blightshore'
    | 'Coast'
    | 'Desert'
    | 'Feywild'
    | 'Forest'
    | 'Grassland'
    | 'Hill'
    | 'Mountain'
    | 'Savannah'
    | 'Swamp'
    | 'Underdark'
    | 'Underground'
    | 'Underwater'
    | 'Urban'
    | 'Volcano';

export interface GatherableResource {
    id: string;
    name: string;
    rarity: IngredientRarity;
    identifyDC: number; // Nature check DC to spot it
    harvestDC: number; // Herbalism Kit DC to harvest it
    baseYield: string; // Dice notation, e.g., '1d4', '2d6'
    locations: Biome[];
    /** Optional description of the ingredient */
    description?: string;
    /** Alchemical properties for crafting (defaults to ['inert'] if not specified) */
    properties?: string[];
}

export const GATHERABLE_RESOURCES: GatherableResource[] = [
    // Common (DC 10 / 10)
    { id: 'cats_tongue', name: "Cat's Tongue", rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '2d4', locations: ['Forest', 'Grassland'] },
    { id: 'dreamlilly', name: "Dreamlilly", rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '2d6', locations: ['Grassland', 'Coast'] },
    { id: 'gillyweed', name: "Gillyweed", rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '2d4', locations: ['Coast', 'Swamp'] },
    { id: 'morning_dew', name: "Morning Dew", rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '2d6', locations: ['Forest', 'Savannah', 'Grassland'] },
    { id: 'red_amanita', name: "Red Amanita Mushroom", rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '2d4', locations: ['Swamp', 'Forest'] },
    { id: 'rowan_berry', name: "Rowan Berry", rarity: 'common', identifyDC: 10, harvestDC: 5, baseYield: '3d6', locations: ['Grassland', 'Forest'] },

    // Uncommon (DC 15 / 15)
    { id: 'frost_lichen', name: "Frost Lichen", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d6', locations: ['Arctic'] },
    { id: 'lightning_moss', name: "Lightning Moss", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d6', locations: ['Coast', 'Mountain'] },
    { id: 'mandrake_root', name: "Mandrake Root", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d4', locations: ['Underground', 'Underdark'] },
    { id: 'mindflayer_stinkhorn', name: "Mindflayer Stinkhorn", rarity: 'uncommon', identifyDC: 15, harvestDC: 10, baseYield: '1d4', locations: ['Underground', 'Underdark'] },
    { id: 'muroosa_twig', name: "Muroosa Bush Twig", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d6', locations: ['Desert', 'Savannah'] },
    { id: 'nightshade', name: "Nightshade", rarity: 'uncommon', identifyDC: 15, harvestDC: 20, baseYield: '1d6', locations: ['Forest'] },
    { id: 'olisuba_leaf', name: "Olisuba Leaf", rarity: 'uncommon', identifyDC: 15, harvestDC: 10, baseYield: '2d6', locations: ['Forest', 'Grassland'] },
    { id: 'singing_nettle', name: "Singing Nettle", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '2d4', locations: ['Swamp', 'Mountain', 'Forest'] },
    { id: 'sourgrass', name: "Sourgrass", rarity: 'uncommon', identifyDC: 15, harvestDC: 5, baseYield: '2d4', locations: ['Grassland', 'Mountain'] },
    { id: 'theki_root', name: "Theki Root", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d6', locations: ['Swamp'] },
    { id: 'willowshade_fruit', name: "Willowshade Fruit", rarity: 'uncommon', identifyDC: 15, harvestDC: 15, baseYield: '1d8', locations: ['Swamp', 'Coast'] },

    // Rare (DC 20 / 15-20)
    { id: 'ashblossom', name: "Ashblossom", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d6', locations: ['Desert', 'Volcano'] },
    { id: 'black_cap', name: "Black Cap Mushroom", rarity: 'rare', identifyDC: 20, harvestDC: 20, baseYield: '1d4', locations: ['Forest', 'Swamp'] },
    { id: 'black_sap', name: "Black Sap", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d6', locations: ['Blightshore'] }, // "Sites of death" mapped to Blightshore broadly
    { id: 'blight_spores', name: "Blight Spores", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d6', locations: ['Blightshore'] },
    { id: 'death_cap', name: "Death Cap", rarity: 'rare', identifyDC: 20, harvestDC: 20, baseYield: '1d4', locations: ['Forest', 'Swamp'] },
    { id: 'fairy_stool', name: "Fairy Stool", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d4', locations: ['Feywild', 'Forest'] },
    { id: 'hagfinger', name: "Hagfinger", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d4', locations: ['Forest', 'Swamp'] },
    { id: 'moonstalker', name: "Moonstalker", rarity: 'rare', identifyDC: 20, harvestDC: 10, baseYield: '1d4', locations: ['Coast', 'Swamp'] },
    { id: 'pixies_parasol', name: "Pixie's Parasol", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d12', locations: ['Forest', 'Swamp', 'Grassland', 'Mountain', 'Feywild', 'Hill', 'Savannah', 'Urban'] }, // Very widespread
    { id: 'silverthorn', name: "Silverthorn", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d6', locations: ['Arctic', 'Mountain'] },
    { id: 'wolfsbane', name: "Wolfsbane", rarity: 'rare', identifyDC: 20, harvestDC: 15, baseYield: '1d4', locations: ['Mountain'] },
];

export function getResourcesForBiome(biome: Biome): GatherableResource[] {
    return GATHERABLE_RESOURCES.filter(r => r.locations.includes(biome));
}
