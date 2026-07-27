/**
 * @file src/systems/crafting/creatureHarvestData.ts
 * Definitions for harvestable creature parts used in Poisoner's Kit crafting.
 */
export type CreaturePartRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';
export interface HarvestableCreature {
    id: string;
    name: string;
    cr: string;
    challengeRating?: number;
    locations: string[];
    parts: CreaturePart[];
}
export interface CreaturePart {
    id: string;
    name: string;
    rarity: CreaturePartRarity;
    harvestDC: number;
    harvestTool: 'poisoners_kit' | 'alchemists_kit' | 'knife' | 'none';
    baseYield: string;
    uses: string[];
    description?: string;
    /** Alchemical properties for crafting (defaults to ['inert'] if not specified) */
    properties?: string[];
}
export declare const HARVESTABLE_CREATURES: HarvestableCreature[];
export declare function getCreatureById(id: string): HarvestableCreature | undefined;
export declare function getCreaturesForLocation(location: string): HarvestableCreature[];
