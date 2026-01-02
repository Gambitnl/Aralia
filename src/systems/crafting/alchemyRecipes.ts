/**
 * @file src/systems/crafting/alchemyRecipes.ts
 * Complete recipe definitions for Alchemy, Herbalism, and Poisoner's Kit crafting.
 * Based on the PDF source material.
 */

export type RecipeRarity = 'common' | 'uncommon' | 'rare' | 'very_rare';
export type CraftingTool = 'alchemist_supplies' | 'herbalism_kit' | 'poisoners_kit';

export interface RecipeIngredient {
    itemId: string;
    quantity: number;
    name?: string; // For display purposes
}

export interface CraftingRecipe {
    id: string;
    name: string;
    description: string;
    rarity: RecipeRarity;
    craftingDC: number;
    craftingDays: number;
    goldCost: number; // Generic materials cost in GP
    ingredients: RecipeIngredient[];
    outputItemId: string;
    outputQuantity: number;
    toolRequired: CraftingTool;
    category: 'potion' | 'oil' | 'poison' | 'bomb' | 'utility' | 'ink';
}

// ============================================================================
// COMMON RECIPES (DC 10, 1 workday, 25 GP)
// ============================================================================
const COMMON_RECIPES: CraftingRecipe[] = [
    {
        id: 'alchemists_fire',
        name: "Alchemist's Fire",
        description: 'Thrown (20ft). Hit: 1d4 fire damage at start of turn. DC 10 Dex to extinguish.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'fire_elemental_ember', quantity: 1, name: 'Fire Elemental Ember' },
            { itemId: 'oil_flask', quantity: 1, name: 'Flask of Oil' }
        ],
        outputItemId: 'alchemists_fire',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'bomb'
    },
    {
        id: 'smokebomb',
        name: 'Smokebomb',
        description: 'Thrown (30ft). Heavily obscured (10ft radius), lightly obscured (+5ft) for 1 min.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'air_elemental_wisp', quantity: 1, name: 'Air Elemental Wisp' },
            { itemId: 'ashblossom', quantity: 1, name: 'Ashblossom' }
        ],
        outputItemId: 'smokebomb',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'bomb'
    },
    {
        id: 'blasting_powder',
        name: 'Blasting Powder',
        description: 'Explodes when ignited (5ft radius). DC 13 Dex save or 3d6 bludgeoning.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'ashblossom', quantity: 1, name: 'Ashblossom' },
            { itemId: 'charcoal', quantity: 1, name: 'Charcoal' }
        ],
        outputItemId: 'blasting_powder',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'bomb'
    },
    {
        id: 'potion_of_climbing',
        name: 'Potion of Climbing',
        description: 'Gain climb speed equal to walk speed for 1 hour. Advantage on Athletics (Climb).',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'giant_wolf_spider_hair', quantity: 1, name: 'Giant Wolf Spider Hair' },
            { itemId: 'earth_elemental_dust', quantity: 1, name: 'Earth Elemental Dust' }
        ],
        outputItemId: 'potion_of_climbing',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_swimming',
        name: 'Potion of Swimming',
        description: 'Gain swim speed equal to walk speed for 1 hour. Advantage on Athletics (Swim).',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'quipper_scale', quantity: 3, name: 'Quipper Scale' },
            { itemId: 'water_elemental_droplet', quantity: 1, name: 'Water Elemental Droplet' }
        ],
        outputItemId: 'potion_of_swimming',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'vial_of_acid',
        name: 'Vial of Acid',
        description: 'Thrown (20ft). Hit: 2d6 acid damage.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'gray_ooze_residue', quantity: 1, name: 'Gray Ooze Residue' },
            { itemId: 'crawler_mucus', quantity: 1, name: 'Crawler Mucus' }
        ],
        outputItemId: 'vial_of_acid',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'bomb'
    },
    // Herbalism Kit Common Recipes
    {
        id: 'healing_salve',
        name: 'Healing Salve',
        description: 'Apply to heal 2d4+2 HP. Takes 1 action.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'cats_tongue', quantity: 2, name: "Cat's Tongue" },
            { itemId: 'red_amanita', quantity: 1, name: 'Red Amanita Mushroom' }
        ],
        outputItemId: 'healing_salve',
        outputQuantity: 1,
        toolRequired: 'herbalism_kit',
        category: 'potion'
    },
    {
        id: 'antitoxin',
        name: 'Antitoxin',
        description: 'Advantage on saves vs poison for 1 hour.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'rowan_berry', quantity: 2, name: 'Rowan Berry' }
        ],
        outputItemId: 'antitoxin',
        outputQuantity: 1,
        toolRequired: 'herbalism_kit',
        category: 'potion'
    },
    // Poisoner's Kit Common Recipes
    {
        id: 'basic_poison',
        name: 'Basic Poison',
        description: 'Coat weapon. Hit: DC 10 Con save or 1d4 poison damage. Lasts 1 min.',
        rarity: 'common',
        craftingDC: 10,
        craftingDays: 1,
        goldCost: 25,
        ingredients: [
            { itemId: 'nightshade', quantity: 1, name: 'Nightshade' }
        ],
        outputItemId: 'basic_poison',
        outputQuantity: 1,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    }
];

// ============================================================================
// UNCOMMON RECIPES (DC 15, 3 workdays, 100 GP)
// ============================================================================
const UNCOMMON_RECIPES: CraftingRecipe[] = [
    {
        id: 'oil_of_slipperiness',
        name: 'Oil of Slipperiness',
        description: 'Freedom of Movement (8h) when applied to self, or Grease effect (10ft square, 8h).',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'oil_flask', quantity: 1, name: 'Flask of Oil' },
            { itemId: 'crawler_mucus', quantity: 1, name: 'Crawler Mucus' },
            { itemId: 'amphibian_saliva', quantity: 1, name: 'Amphibian Saliva' }
        ],
        outputItemId: 'oil_of_slipperiness',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'oil'
    },
    {
        id: 'potion_of_animal_friendship',
        name: 'Potion of Animal Friendship',
        description: 'Cast Animal Friendship (DC 13) at will for 1 hour.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'cats_tongue', quantity: 1, name: "Cat's Tongue" },
            { itemId: 'quipper_scale', quantity: 1, name: 'Quipper Scale' }
        ],
        outputItemId: 'potion_of_animal_friendship',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_fire_breath',
        name: 'Potion of Fire Breath',
        description: 'Bonus action exhale fire (30ft). DC 13 Dex save for 4d6 fire damage. 3 uses or 1h.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'ashblossom', quantity: 1, name: 'Ashblossom' },
            { itemId: 'remorhaz_ichor', quantity: 1, name: 'Remorhaz Ichor' }
        ],
        outputItemId: 'potion_of_fire_breath',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_growth',
        name: 'Potion of Growth',
        description: 'Enlarge effect for 1d4 hours (no concentration).',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'sourgrass', quantity: 1, name: 'Sourgrass' },
            { itemId: 'rowan_berry', quantity: 1, name: 'Rowan Berry' },
            { itemId: 'giant_wolf_spider_hair', quantity: 1, name: 'Giant Wolf Spider Hair' }
        ],
        outputItemId: 'potion_of_growth',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_waterbreathing',
        name: 'Potion of Waterbreathing',
        description: 'Breathe underwater for 1 hour.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'gillyweed', quantity: 1, name: 'Gillyweed' },
            { itemId: 'hagfinger', quantity: 1, name: 'Hagfinger' }
        ],
        outputItemId: 'potion_of_waterbreathing',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_healing_greater',
        name: 'Potion of Greater Healing',
        description: 'Heal 4d4+4 HP.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'cats_tongue', quantity: 3, name: "Cat's Tongue" },
            { itemId: 'red_amanita', quantity: 2, name: 'Red Amanita Mushroom' }
        ],
        outputItemId: 'potion_of_healing_greater',
        outputQuantity: 1,
        toolRequired: 'herbalism_kit',
        category: 'potion'
    },
    // Poisoner's Uncommon
    {
        id: 'serpent_venom_poison',
        name: 'Serpent Venom (Poison)',
        description: 'Injury. DC 11 Con save or take 3d6 poison damage.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'serpents_venom', quantity: 2, name: "Serpent's Venom" }
        ],
        outputItemId: 'serpent_venom_poison',
        outputQuantity: 3,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    },
    {
        id: 'truth_serum',
        name: 'Truth Serum',
        description: 'Ingested. DC 11 Con save or cannot lie for 1 hour.',
        rarity: 'uncommon',
        craftingDC: 15,
        craftingDays: 3,
        goldCost: 100,
        ingredients: [
            { itemId: 'mandrake_root', quantity: 1, name: 'Mandrake Root' },
            { itemId: 'mindflayer_stinkhorn', quantity: 1, name: 'Mindflayer Stinkhorn' }
        ],
        outputItemId: 'truth_serum',
        outputQuantity: 1,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    }
];

// ============================================================================
// RARE RECIPES (DC 20, 10 workdays, 500 GP)
// ============================================================================
const RARE_RECIPES: CraftingRecipe[] = [
    {
        id: 'invisible_ink',
        name: 'Invisible Ink',
        description: 'Only visible with magic or mild acid.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'pixies_parasol', quantity: 1, name: "Pixie's Parasol" },
            { itemId: 'ink', quantity: 1, name: 'Ink' }
        ],
        outputItemId: 'invisible_ink',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'ink'
    },
    {
        id: 'midnight_oil',
        name: 'Midnight Oil',
        description: 'Light source (5ft bright/5ft dim) for 8h. Resting in light gives Long Rest benefits.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'oil_flask', quantity: 1, name: 'Flask of Oil' },
            { itemId: 'pixies_parasol', quantity: 1, name: "Pixie's Parasol" }
        ],
        outputItemId: 'midnight_oil',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'oil'
    },
    {
        id: 'oil_of_dragons_bane',
        name: "Oil of Dragon's Bane",
        description: 'Coats 1 weapon or 3 ammo. +6d6 damage vs Dragons for 1 hour.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'dragons_blood', quantity: 1, name: "Dragon's Blood" },
            { itemId: 'wyvern_poison', quantity: 1, name: 'Wyvern Poison' }
        ],
        outputItemId: 'oil_of_dragons_bane',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'oil'
    },
    {
        id: 'potion_of_gaseous_form',
        name: 'Potion of Gaseous Form',
        description: 'Gaseous Form effect for 1 hour (no concentration).',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'ectoplasm', quantity: 1, name: 'Ectoplasm' },
            { itemId: 'singing_nettle', quantity: 1, name: 'Singing Nettle' }
        ],
        outputItemId: 'potion_of_gaseous_form',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'oil_of_etherealness',
        name: 'Oil of Etherealness',
        description: 'Etherealness effect for 1 hour. Takes 10 minutes to apply.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'ectoplasm', quantity: 1, name: 'Ectoplasm' },
            { itemId: 'oil_flask', quantity: 1, name: 'Flask of Oil' }
        ],
        outputItemId: 'oil_of_etherealness',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'oil'
    },
    {
        id: 'potion_of_clairvoyance',
        name: 'Potion of Clairvoyance',
        description: 'Clairvoyance effect (as the spell).',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'morning_dew', quantity: 1, name: 'Morning Dew' },
            { itemId: 'mandrake_root', quantity: 1, name: 'Mandrake Root' }
        ],
        outputItemId: 'potion_of_clairvoyance',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_diminution',
        name: 'Potion of Diminution',
        description: 'Reduce effect for 1d4 hours (no concentration).',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'pixies_parasol', quantity: 1, name: "Pixie's Parasol" },
            { itemId: 'moonstalker', quantity: 1, name: 'Moonstalker' }
        ],
        outputItemId: 'potion_of_diminution',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_heroism',
        name: 'Potion of Heroism',
        description: '10 Temp HP and Bless effect (no concentration) for 1 hour.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'hagfinger', quantity: 1, name: 'Hagfinger' },
            { itemId: 'cats_tongue', quantity: 1, name: "Cat's Tongue" }
        ],
        outputItemId: 'potion_of_heroism',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_mind_reading',
        name: 'Potion of Mind Reading',
        description: 'Detect Thoughts (DC 13) as the spell.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'mindflayer_stinkhorn', quantity: 1, name: 'Mindflayer Stinkhorn' },
            { itemId: 'moonstalker', quantity: 1, name: 'Moonstalker' }
        ],
        outputItemId: 'potion_of_mind_reading',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_healing_superior',
        name: 'Potion of Superior Healing',
        description: 'Heal 8d4+8 HP.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'cats_tongue', quantity: 5, name: "Cat's Tongue" },
            { itemId: 'red_amanita', quantity: 3, name: 'Red Amanita Mushroom' },
            { itemId: 'hagfinger', quantity: 1, name: 'Hagfinger' }
        ],
        outputItemId: 'potion_of_healing_superior',
        outputQuantity: 1,
        toolRequired: 'herbalism_kit',
        category: 'potion'
    },
    // Poisoner's Rare
    {
        id: 'drow_poison',
        name: 'Drow Poison',
        description: 'Injury. DC 13 Con save or Poisoned + Unconscious for 1 hour.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'drider_venom', quantity: 1, name: 'Drider Venom' },
            { itemId: 'nightshade', quantity: 2, name: 'Nightshade' }
        ],
        outputItemId: 'drow_poison',
        outputQuantity: 3,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    },
    {
        id: 'midnight_tears',
        name: 'Midnight Tears',
        description: 'Ingested. No effect until midnight, then DC 17 Con or 9d6 poison.',
        rarity: 'rare',
        craftingDC: 20,
        craftingDays: 10,
        goldCost: 500,
        ingredients: [
            { itemId: 'ankheg_ichor', quantity: 1, name: 'Ankheg Ichor' },
            { itemId: 'nightshade', quantity: 3, name: 'Nightshade' }
        ],
        outputItemId: 'midnight_tears',
        outputQuantity: 1,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    }
];

// ============================================================================
// VERY RARE RECIPES (DC 25, 30 workdays, 1000 GP)
// ============================================================================
const VERY_RARE_RECIPES: CraftingRecipe[] = [
    {
        id: 'oil_of_sharpness',
        name: 'Oil of Sharpness',
        description: 'Coats weapon or 5 ammo. +3 bonus to attack and damage for 1 hour.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'ankheg_ichor', quantity: 1, name: 'Ankheg Ichor' },
            { itemId: 'silverthorn', quantity: 1, name: 'Silverthorn' }
        ],
        outputItemId: 'oil_of_sharpness',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'oil'
    },
    {
        id: 'potion_of_flying',
        name: 'Potion of Flying',
        description: 'Fly speed equals walk speed (hover) for 1 hour.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'air_elemental_wisp', quantity: 1, name: 'Air Elemental Wisp' },
            { itemId: 'singing_nettle', quantity: 1, name: 'Singing Nettle' }
        ],
        outputItemId: 'potion_of_flying',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_invisibility',
        name: 'Potion of Invisibility',
        description: 'Invisible for 1 hour. Ends if you attack or cast.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'skulk_fingernail', quantity: 1, name: 'Skulk Fingernail' },
            { itemId: 'fairy_stool', quantity: 1, name: 'Fairy Stool' }
        ],
        outputItemId: 'potion_of_invisibility',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_longevity',
        name: 'Potion of Longevity',
        description: 'Physical age reduced by 1d6+6 years (min 13). 10% cumulative chance of aging.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'imp_heart', quantity: 1, name: 'Imp Heart' },
            { itemId: 'red_amanita', quantity: 1, name: 'Red Amanita Mushroom' }
        ],
        outputItemId: 'potion_of_longevity',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_speed',
        name: 'Potion of Speed',
        description: 'Haste effect for 1 minute (no concentration).',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'eagle_claw', quantity: 4, name: 'Eagle Claw' },
            { itemId: 'lightning_moss', quantity: 1, name: 'Lightning Moss' }
        ],
        outputItemId: 'potion_of_speed',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_truesight',
        name: 'Potion of Truesight',
        description: 'Truesight for 1 hour.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'fairy_stool', quantity: 1, name: 'Fairy Stool' },
            { itemId: 'nothic_tears', quantity: 1, name: 'Nothic Tears' }
        ],
        outputItemId: 'potion_of_truesight',
        outputQuantity: 1,
        toolRequired: 'alchemist_supplies',
        category: 'potion'
    },
    {
        id: 'potion_of_healing_supreme',
        name: 'Potion of Supreme Healing',
        description: 'Heal 10d4+20 HP.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'cats_tongue', quantity: 8, name: "Cat's Tongue" },
            { itemId: 'red_amanita', quantity: 5, name: 'Red Amanita Mushroom' },
            { itemId: 'hagfinger', quantity: 2, name: 'Hagfinger' },
            { itemId: 'pixies_parasol', quantity: 1, name: "Pixie's Parasol" }
        ],
        outputItemId: 'potion_of_healing_supreme',
        outputQuantity: 1,
        toolRequired: 'herbalism_kit',
        category: 'potion'
    },
    // Poisoner's Very Rare
    {
        id: 'purple_worm_poison_crafted',
        name: 'Purple Worm Poison',
        description: 'Injury. DC 19 Con save or 12d6 poison damage.',
        rarity: 'very_rare',
        craftingDC: 25,
        craftingDays: 30,
        goldCost: 1000,
        ingredients: [
            { itemId: 'purple_worm_poison', quantity: 2, name: 'Purple Worm Poison' }
        ],
        outputItemId: 'purple_worm_poison_vial',
        outputQuantity: 5,
        toolRequired: 'poisoners_kit',
        category: 'poison'
    }
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================
export const ALL_RECIPES: CraftingRecipe[] = [
    ...COMMON_RECIPES,
    ...UNCOMMON_RECIPES,
    ...RARE_RECIPES,
    ...VERY_RARE_RECIPES
];

export function getRecipeById(id: string): CraftingRecipe | undefined {
    return ALL_RECIPES.find(r => r.id === id);
}

export function getRecipesByTool(tool: CraftingTool): CraftingRecipe[] {
    return ALL_RECIPES.filter(r => r.toolRequired === tool);
}

export function getRecipesByRarity(rarity: RecipeRarity): CraftingRecipe[] {
    return ALL_RECIPES.filter(r => r.rarity === rarity);
}

export function getRecipesByCategory(category: CraftingRecipe['category']): CraftingRecipe[] {
    return ALL_RECIPES.filter(r => r.category === category);
}

/**
 * Gets the research cost and time for learning a new recipe by rarity.
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
