/**
 * @file src/data/gatherableItems.ts
 * Item definitions for all gatherable ingredients used in Alchemy/Herbalism/Poisoner systems.
 * These items can be added to inventory via ADD_ITEM action.
 */
import { Item, ItemRarity } from '../types';

export const GATHERABLE_ITEMS: Record<string, Item> = {
    // ============ COMMON FLORA ============
    cats_tongue: {
        id: 'cats_tongue',
        name: "Cat's Tongue",
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A mid-sized plant with purple/white flower bundles. Used in healing and restorative potions.',
        value: 5,
        weight: 0.1,
        properties: ['curative', 'binding'],
        rarity: ItemRarity.Common
    },
    dreamlilly: {
        id: 'dreamlilly',
        name: 'Dreamlilly',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A white, silvery flower with an intoxicating smell. Creates psychoactive liquids.',
        value: 5,
        weight: 0.1,
        properties: ['toxic', 'inert'],
        rarity: ItemRarity.Common
    },
    gillyweed: {
        id: 'gillyweed',
        name: 'Gillyweed',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Emerald green kelp covered in tiny air bubbles. Essential for waterbreathing potions.',
        value: 5,
        weight: 0.1,
        properties: ['binding', 'inert'],
        rarity: ItemRarity.Common
    },
    morning_dew: {
        id: 'morning_dew',
        name: 'Morning Dew',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Dried leaves from a special bush. Used in teas and restorative medicine.',
        value: 5,
        weight: 0.1,
        properties: ['curative', 'concentrated'],
        rarity: ItemRarity.Common
    },
    red_amanita: {
        id: 'red_amanita',
        name: 'Red Amanita Mushroom',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A red-capped mushroom. Poisonous raw but essential for healing potions when processed.',
        value: 5,
        weight: 0.1,
        properties: ['curative', 'toxic'],
        rarity: ItemRarity.Common
    },
    rowan_berry: {
        id: 'rowan_berry',
        name: 'Rowan Berry',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Small red berries from the rowan tree, revered by druids for purifying properties.',
        value: 5,
        weight: 0.1,
        properties: ['curative', 'binding'],
        rarity: ItemRarity.Common
    },

    // ============ UNCOMMON FLORA ============
    frost_lichen: {
        id: 'frost_lichen',
        name: 'Frost Lichen',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Blindingly white lichen that grows on arctic rocks.',
        value: 10,
        weight: 0.1,
        properties: ['inert', 'binding'],
        rarity: ItemRarity.Uncommon
    },
    lightning_moss: {
        id: 'lightning_moss',
        name: 'Lightning Moss',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Light blue moss that grows where lightning has struck. Gives off static when touched.',
        value: 10,
        weight: 0.1,
        properties: ['reactive', 'concentrated'],
        rarity: ItemRarity.Uncommon
    },
    mandrake_root: {
        id: 'mandrake_root',
        name: 'Mandrake Root',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A twisted pale root resembling a humanoid infant. Poisonous when ingested.',
        value: 10,
        weight: 0.2,
        properties: ['toxic', 'binding'],
        rarity: ItemRarity.Uncommon
    },
    mindflayer_stinkhorn: {
        id: 'mindflayer_stinkhorn',
        name: 'Mindflayer Stinkhorn',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A purple fungus with tentacle-like stalks that smells of rotting flesh.',
        value: 10,
        weight: 0.1,
        properties: ['toxic', 'concentrated'],
        rarity: ItemRarity.Uncommon
    },
    nightshade: {
        id: 'nightshade',
        name: 'Nightshade',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'An inky black flower with purple stalk. Highly toxic.',
        value: 10,
        weight: 0.1,
        properties: ['toxic', 'reactive'],
        rarity: ItemRarity.Uncommon
    },
    sourgrass: {
        id: 'sourgrass',
        name: 'Sourgrass',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Green long-bladed grass with a pungent smell. Can induce nausea.',
        value: 10,
        weight: 0.1,
        properties: ['curative', 'inert'],
        rarity: ItemRarity.Uncommon
    },

    // ============ RARE FLORA ============
    ashblossom: {
        id: 'ashblossom',
        name: 'Ashblossom',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A tiny bright red flower with yellow center, found in hot environments. Deals fire damage when ingested.',
        value: 50,
        weight: 0.1,
        properties: ['reactive', 'toxic'],
        rarity: ItemRarity.Rare
    },
    fairy_stool: {
        id: 'fairy_stool',
        name: 'Fairy Stool',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Small pink mushroom found in fairy rings. Causes blindness and vivid hallucinations.',
        value: 50,
        weight: 0.1,
        properties: ['reactive', 'concentrated'],
        rarity: ItemRarity.Rare
    },
    hagfinger: {
        id: 'hagfinger',
        name: 'Hagfinger',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'Pale, sickly green tubers resembling long fingers. Strong aroma when dried and ground.',
        value: 50,
        weight: 0.2,
        properties: ['binding', 'inert'],
        rarity: ItemRarity.Rare
    },
    pixies_parasol: {
        id: 'pixies_parasol',
        name: "Pixie's Parasol",
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'A tiny bioluminescent mushroom with bright blue cap. Key ingredient in invisibility magic.',
        value: 50,
        weight: 0.1,
        properties: ['reactive', 'concentrated'],
        rarity: ItemRarity.Rare
    },
    wolfsbane: {
        id: 'wolfsbane',
        name: 'Wolfsbane',
        type: 'reagent',
        category: 'Herbalism Ingredient',
        description: 'White-grey flower that blooms only on full moons. Repels canines and lycanthropes.',
        value: 50,
        weight: 0.1,
        properties: ['toxic', 'reactive'],
        rarity: ItemRarity.Rare
    },

    // ============ CREATURE PARTS ============
    serpents_venom: {
        id: 'serpents_venom',
        name: "Serpent's Venom",
        type: 'reagent',
        category: 'Creature Part',
        description: 'Poison harvested from a giant poisonous snake. DC 11 Con save or 3d6 poison damage.',
        value: 5,
        weight: 0.1,
        properties: ['toxic'],
        rarity: ItemRarity.Common
    },
    crawler_mucus: {
        id: 'crawler_mucus',
        name: 'Crawler Mucus',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Paralyzing mucus from a carrion crawler. DC 13 Con save or Poisoned + Paralyzed.',
        value: 10,
        weight: 0.1,
        properties: ['toxic', 'binding'],
        rarity: ItemRarity.Uncommon
    },
    ankheg_ichor: {
        id: 'ankheg_ichor',
        name: 'Ankheg Ichor',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Acidic ichor from an ankheg. Used in corrosive and sharpening oils.',
        value: 10,
        weight: 0.1,
        properties: ['reactive', 'concentrated'],
        rarity: ItemRarity.Uncommon
    },
    ectoplasm: {
        id: 'ectoplasm',
        name: 'Ectoplasm',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Ethereal residue from a ghost. Used in gaseous and etherealness potions.',
        value: 10,
        weight: 0.1,
        properties: ['inert', 'binding'],
        rarity: ItemRarity.Uncommon
    },
    drider_venom: {
        id: 'drider_venom',
        name: 'Drider Venom',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Potent venom from a drider. Essential for crafting Drow Poison.',
        value: 50,
        weight: 0.1,
        properties: ['toxic', 'concentrated'],
        rarity: ItemRarity.Rare
    },
    dragons_blood: {
        id: 'dragons_blood',
        name: "Dragon's Blood",
        type: 'reagent',
        category: 'Creature Part',
        description: 'Blood from a true dragon. Extremely valuable for dragon-bane weapons.',
        value: 50,
        weight: 0.2,
        properties: ['reactive', 'concentrated'],
        rarity: ItemRarity.Rare
    },
    wyvern_poison: {
        id: 'wyvern_poison',
        name: 'Wyvern Poison',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Deadly venom from a wyvern. DC 15 Con save or 7d6 poison damage.',
        value: 50,
        weight: 0.1,
        properties: ['toxic', 'reactive'],
        rarity: ItemRarity.Rare
    },
    purple_worm_poison: {
        id: 'purple_worm_poison',
        name: 'Purple Worm Poison',
        type: 'reagent',
        category: 'Creature Part',
        description: 'Extremely deadly venom from a purple worm. DC 19 Con save or 12d6 poison damage.',
        value: 150,
        weight: 0.1,
        properties: ['toxic', 'concentrated'],
        rarity: ItemRarity.VeryRare
    }
};

