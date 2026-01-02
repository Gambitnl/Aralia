/**
 * @file src/systems/crafting/creatureHarvestData.ts
 * Definitions for harvestable creature parts used in Poisoner's Kit crafting.
 */

export type CreaturePartRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';

export interface HarvestableCreature {
    id: string;
    name: string;
    cr: string; // Challenge Rating as string (legacy)
    challengeRating?: number; // Numeric challenge rating for calculations
    locations: string[]; // Where they can be found
    parts: CreaturePart[];
}

export interface CreaturePart {
    id: string;
    name: string;
    rarity: CreaturePartRarity;
    harvestDC: number; // Poisoner's Kit or specified tool DC
    harvestTool: 'poisoners_kit' | 'alchemists_kit' | 'knife' | 'none';
    baseYield: string; // Dice notation
    uses: string[]; // Recipe IDs this is used in
    description?: string;
    /** Alchemical properties for crafting (defaults to ['inert'] if not specified) */
    properties?: string[];
}

export const HARVESTABLE_CREATURES: HarvestableCreature[] = [
    // Common Creatures
    {
        id: 'giant_poisonous_snake',
        name: 'Giant Poisonous Snake',
        cr: '1/4',
        locations: ['Desert', 'Forest', 'Grassland', 'Swamp', 'Underdark', 'Urban'],
        parts: [{
            id: 'serpents_venom',
            name: "Serpent's Venom",
            rarity: 'common',
            harvestDC: 10,
            harvestTool: 'poisoners_kit',
            baseYield: '1d3',
            uses: ['philter_of_love'],
            description: 'A creature hit with a weapon coated in this venom must succeed on a DC 11 Con save, taking 10 (3d6) poison damage on a failed save.'
        }]
    },
    {
        id: 'giant_wolf_spider',
        name: 'Giant Wolf Spider',
        cr: '1/4',
        locations: ['Coast', 'Desert', 'Forest', 'Grassland', 'Hill'],
        parts: [{
            id: 'giant_wolf_spider_hair',
            name: 'Giant Wolf Spider Hair',
            rarity: 'common',
            harvestDC: 10,
            harvestTool: 'knife',
            baseYield: '1d8',
            uses: ['potion_of_climbing']
        }]
    },
    {
        id: 'quipper',
        name: 'Quipper',
        cr: '0',
        locations: ['Underwater'],
        parts: [{
            id: 'quipper_scale',
            name: 'Quipper Scale',
            rarity: 'common',
            harvestDC: 5,
            harvestTool: 'knife',
            baseYield: '1d4',
            uses: ['potion_of_animal_friendship', 'potion_of_swimming']
        }]
    },

    // Uncommon Creatures
    {
        id: 'ankheg',
        name: 'Ankheg',
        cr: '2',
        locations: ['Forest', 'Grassland'],
        parts: [{
            id: 'ankheg_ichor',
            name: 'Ankheg Ichor',
            rarity: 'uncommon',
            harvestDC: 15,
            harvestTool: 'poisoners_kit',
            baseYield: '1d4',
            uses: ['oil_of_sharpness', 'midnight_tears'],
            description: 'Paralyzing mucus. DC 13 Con save or Poisoned + Paralyzed for 1 minute.'
        }]
    },
    {
        id: 'carrion_crawler',
        name: 'Carrion Crawler',
        cr: '2',
        locations: ['Underdark', 'Swamp', 'Urban'],
        parts: [{
            id: 'crawler_mucus',
            name: 'Crawler Mucus',
            rarity: 'uncommon',
            harvestDC: 20,
            harvestTool: 'poisoners_kit',
            baseYield: '1d4',
            uses: ['potion_of_resistance_acid', 'vial_of_acid', 'oil_of_slipperiness'],
            description: 'DC 13 Con save or Poisoned + Paralyzed for 1 minute.'
        }]
    },
    {
        id: 'giant_toad',
        name: 'Giant Toad',
        cr: '1',
        locations: ['Coast', 'Desert', 'Forest', 'Swamp', 'Underdark'],
        parts: [{
            id: 'amphibian_saliva',
            name: 'Amphibian Saliva',
            rarity: 'uncommon',
            harvestDC: 15,
            harvestTool: 'poisoners_kit',
            baseYield: '1d4',
            uses: ['potion_of_resistance_force', 'oil_of_slipperiness']
        }]
    },
    {
        id: 'eagle',
        name: 'Eagle',
        cr: '0',
        locations: ['Coast', 'Grassland', 'Hill', 'Mountain'],
        parts: [{
            id: 'eagle_claw',
            name: 'Eagle Claw',
            rarity: 'uncommon',
            harvestDC: 10,
            harvestTool: 'knife',
            baseYield: '1d8',
            uses: ['potion_of_speed']
        }]
    },
    {
        id: 'ghost',
        name: 'Ghost',
        cr: '4',
        locations: ['Underdark', 'Urban'],
        parts: [{
            id: 'ectoplasm',
            name: 'Ectoplasm',
            rarity: 'uncommon',
            harvestDC: 15,
            harvestTool: 'alchemists_kit',
            baseYield: '1d4',
            uses: ['potion_of_gaseous_form', 'oil_of_etherealness']
        }]
    },
    {
        id: 'gray_ooze',
        name: 'Gray Ooze',
        cr: '1/2',
        locations: ['Underdark'],
        parts: [{
            id: 'gray_ooze_residue',
            name: 'Gray Ooze Residue',
            rarity: 'uncommon',
            harvestDC: 15,
            harvestTool: 'alchemists_kit',
            baseYield: '1d4',
            uses: ['vial_of_acid']
        }]
    },
    {
        id: 'nothic',
        name: 'Nothic',
        cr: '2',
        locations: ['Underdark', 'Urban'],
        parts: [{
            id: 'nothic_tears',
            name: 'Nothic Tears',
            rarity: 'uncommon',
            harvestDC: 15,
            harvestTool: 'none',
            baseYield: '1d4',
            uses: ['potion_of_truesight'],
            description: 'When used as eyedrops, provides 1d4 hours of darkvision.'
        }]
    },
    {
        id: 'skulk',
        name: 'Skulk',
        cr: '1/2',
        locations: ['Coast', 'Forest', 'Swamp', 'Underdark', 'Urban'],
        parts: [{
            id: 'skulk_fingernail',
            name: 'Skulk Fingernail',
            rarity: 'uncommon',
            harvestDC: 10,
            harvestTool: 'knife',
            baseYield: '1d10',
            uses: ['potion_of_invisibility']
        }]
    },

    // Rare Creatures
    {
        id: 'drider',
        name: 'Drider',
        cr: '6',
        locations: ['Underdark'],
        parts: [{
            id: 'drider_venom',
            name: 'Drider Venom',
            rarity: 'rare',
            harvestDC: 15,
            harvestTool: 'poisoners_kit',
            baseYield: '1d6',
            uses: ['drow_poison']
        }]
    },
    {
        id: 'remorhaz',
        name: 'Remorhaz',
        cr: '11',
        locations: ['Arctic'],
        parts: [{
            id: 'remorhaz_ichor',
            name: 'Remorhaz Ichor',
            rarity: 'rare',
            harvestDC: 20,
            harvestTool: 'alchemists_kit',
            baseYield: '3d6',
            uses: ['potion_of_fire_breath']
        }]
    },
    {
        id: 'imp',
        name: 'Imp',
        cr: '1',
        locations: ['Varies'],
        parts: [{
            id: 'imp_heart',
            name: 'Imp Heart',
            rarity: 'rare',
            harvestDC: 15,
            harvestTool: 'knife',
            baseYield: '1',
            uses: ['potion_of_longevity']
        }]
    },
    {
        id: 'true_dragon',
        name: 'True Dragon',
        cr: 'Varies',
        locations: ['Varies'],
        parts: [{
            id: 'dragons_blood',
            name: "Dragon's Blood",
            rarity: 'rare',
            harvestDC: 10,
            harvestTool: 'knife',
            baseYield: '1d8',
            uses: ['oil_of_dragons_bane']
        }]
    },
    {
        id: 'giant',
        name: 'Giant',
        cr: 'Varies',
        locations: ['Varies'],
        parts: [{
            id: 'giants_fingernail',
            name: "Giant's Fingernail",
            rarity: 'rare',
            harvestDC: 10,
            harvestTool: 'knife',
            baseYield: '7',
            uses: ['potion_of_giant_strength']
        }]
    },
    {
        id: 'wyvern',
        name: 'Wyvern',
        cr: '6',
        locations: ['Hill', 'Mountain'],
        parts: [{
            id: 'wyvern_poison',
            name: 'Wyvern Poison',
            rarity: 'rare',
            harvestDC: 15,
            harvestTool: 'poisoners_kit',
            baseYield: '1d8',
            uses: ['oil_of_dragons_bane', 'water_of_death'],
            description: 'DC 15 Con save, taking 24 (7d6) poison damage on a failed save.'
        }]
    },

    // Very Rare Creatures
    {
        id: 'purple_worm',
        name: 'Purple Worm',
        cr: '15',
        locations: ['Desert', 'Underdark'],
        parts: [{
            id: 'purple_worm_poison',
            name: 'Purple Worm Poison',
            rarity: 'very_rare',
            harvestDC: 20,
            harvestTool: 'poisoners_kit',
            baseYield: '1d8',
            uses: ['deathsleep'],
            description: 'DC 19 Con save, taking 42 (12d6) poison damage on a failed save.'
        }]
    }
];

export function getCreatureById(id: string): HarvestableCreature | undefined {
    return HARVESTABLE_CREATURES.find(c => c.id === id);
}

export function getCreaturesForLocation(location: string): HarvestableCreature[] {
    return HARVESTABLE_CREATURES.filter(c =>
        c.locations.includes(location) || c.locations.includes('Varies')
    );
}
