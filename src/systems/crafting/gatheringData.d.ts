/**
 * @file src/systems/crafting/gatheringData.ts
 * Definitions for gatherable ingredients, biomes, and rarities based on the Herbalism & Gathering rules.
 */
export type IngredientRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';
export type Biome = 'Arctic' | 'Blightshore' | 'Coast' | 'Desert' | 'Feywild' | 'Forest' | 'Grassland' | 'Hill' | 'Mountain' | 'Savannah' | 'Swamp' | 'Underdark' | 'Underground' | 'Underwater' | 'Urban' | 'Volcano';
export interface GatherableResource {
    id: string;
    name: string;
    rarity: IngredientRarity;
    identifyDC: number;
    harvestDC: number;
    baseYield: string;
    locations: Biome[];
    /** Optional description of the ingredient */
    description?: string;
    /** Alchemical properties for crafting (defaults to ['inert'] if not specified) */
    properties?: string[];
}
export declare const GATHERABLE_RESOURCES: GatherableResource[];
export declare function getResourcesForBiome(biome: Biome): GatherableResource[];
