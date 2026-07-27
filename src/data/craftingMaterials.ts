/**
 * @file src/data/craftingMaterials.ts
 * Item definitions for the Refining & Enchanting loop (crafting G5).
 *
 * Refining turns raw materials (ores, hides, gems) into refined components
 * (ingots, leather, arcane dust); Enchanting consumes those components plus a
 * base item. Every id referenced by REFINING_RECIPES / ENCHANTING_RECIPES must
 * exist here or elsewhere in ALL_ITEMS, or ADD_ITEM will drop the output.
 *
 * 'iron_ore' and 'silver_ore' were already granted by travel mining events
 * (src/data/travelEvents.ts) without a backing item definition — defining them
 * here also makes those event rewards real.
 */
import { Item, ItemRarity } from '../types/index.js';

export const CRAFTING_MATERIALS: Record<string, Item> = {
    // ============ RAW MATERIALS (refining inputs) ============
    iron_ore: {
        id: 'iron_ore',
        name: 'Iron Ore',
        icon: '🪨',
        type: 'reagent',
        category: 'Raw Material',
        description: 'A rough chunk of iron-bearing rock. Smelt it at a forge to draw out the metal.',
        value: 2,
        weight: 2,
        rarity: ItemRarity.Common,
    },
    silver_ore: {
        id: 'silver_ore',
        name: 'Silver Ore',
        icon: '🪨',
        type: 'reagent',
        category: 'Raw Material',
        description: 'Pale veins of silver run through this stone. Prized by smiths and enchanters alike.',
        value: 8,
        weight: 2,
        rarity: ItemRarity.Common,
    },
    raw_hide: {
        id: 'raw_hide',
        name: 'Raw Hide',
        icon: '🟫',
        type: 'reagent',
        category: 'Raw Material',
        description: 'An untreated animal hide. Tanning and cutting yields workable leather strips.',
        value: 3,
        weight: 3,
        rarity: ItemRarity.Common,
    },
    gem_ruby: {
        id: 'gem_ruby',
        name: 'Rough Ruby',
        icon: '💎',
        type: 'reagent',
        category: 'Raw Material',
        description: 'An uncut ruby. Serves as an enchanting focus, or can be ground into arcane dust.',
        value: 50,
        weight: 0.1,
        rarity: ItemRarity.Uncommon,
    },

    // ============ REFINED COMPONENTS (refining outputs) ============
    iron_ingot: {
        id: 'iron_ingot',
        name: 'Iron Ingot',
        icon: '🧱',
        type: 'reagent',
        category: 'Refined Component',
        description: 'A bar of smelted iron, ready for the anvil.',
        value: 6,
        weight: 1,
        rarity: ItemRarity.Common,
    },
    silver_ingot: {
        id: 'silver_ingot',
        name: 'Silver Ingot',
        icon: '🥈',
        type: 'reagent',
        category: 'Refined Component',
        description: 'A gleaming bar of refined silver. Holds enchantment better than baser metals.',
        value: 20,
        weight: 1,
        rarity: ItemRarity.Common,
    },
    leather_strip: {
        id: 'leather_strip',
        name: 'Leather Strip',
        icon: '🪢',
        type: 'reagent',
        category: 'Refined Component',
        description: 'A supple strip of tanned leather, used for grips, bindings, and armor work.',
        value: 2,
        weight: 0.2,
        rarity: ItemRarity.Common,
    },
    dust_arcane: {
        id: 'dust_arcane',
        name: 'Arcane Dust',
        icon: '✨',
        type: 'reagent',
        category: 'Refined Component',
        description: 'Shimmering powder ground from gemstones. The essential fuel of enchantment.',
        value: 15,
        weight: 0.05,
        rarity: ItemRarity.Uncommon,
    },

    // ============ ENCHANTING SUPPLIES ============
    essence_earth: {
        id: 'essence_earth',
        name: 'Earth Essence',
        icon: '🟤',
        type: 'reagent',
        category: 'Enchanting Supply',
        description: 'Condensed elemental earth. Anchors protective wards into rings and armor.',
        value: 40,
        weight: 0.1,
        rarity: ItemRarity.Uncommon,
    },
    parchment_warding: {
        id: 'parchment_warding',
        name: 'Warding Parchment',
        icon: '📜',
        type: 'reagent',
        category: 'Enchanting Supply',
        description: 'Vellum inscribed with a lattice of warding sigils, consumed when binding protective magic.',
        value: 25,
        weight: 0.1,
        rarity: ItemRarity.Uncommon,
    },

    // ============ ENCHANTED OUTPUTS ============
    dagger_plus_one: {
        id: 'dagger_plus_one',
        name: '+1 Dagger',
        icon: '🗡️',
        type: 'weapon',
        category: 'Simple Melee',
        slot: 'MainHand',
        damageDice: '1d4+1',
        damageType: 'Piercing',
        properties: ['Finesse', 'Light', 'Thrown'],
        description: 'A dagger humming with arcane energy. Its edge never dulls.',
        weight: 1,
        cost: '250 GP',
        rarity: ItemRarity.Uncommon,
        mastery: 'Nick',
    },
};
