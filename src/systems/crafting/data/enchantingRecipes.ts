/**
 * @file src/systems/crafting/data/enchantingRecipes.ts
 * Enchanting recipes for the system.
 */
import { Recipe } from '../types';

// Item ids resolve against ALL_ITEMS: 'dagger', 'silver_ring', and
// 'ring_of_protection' are long-standing catalog items; the materials live in
// src/data/craftingMaterials.ts. (The original draft referenced 'dagger_iron' /
// 'ring_silver_plain' ids that never existed in the item registry.)
export const ENCHANTING_RECIPES: Recipe[] = [
  {
    id: 'enchant_dagger_plus_one',
    name: 'Enchant Dagger +1',
    description: 'Imbue a simple dagger with arcane energy to enhance its edge.',
    station: 'enchanters_table',
    recipeType: 'enchant',
    timeMinutes: 240, // 4 hours
    skillCheck: {
      skill: 'Arcana',
      dc: 15
    },
    // Convention: First input is the Base Item (saved on standard fail).
    inputs: [
      { itemId: 'dagger', quantity: 1, consumed: true },
      { itemId: 'dust_arcane', quantity: 5, consumed: true },
      { itemId: 'gem_ruby', quantity: 1, consumed: true } // Focus
    ],
    outputs: [
      { itemId: 'dagger_plus_one', quantity: 1, qualityBound: true }
    ]
  },
  {
    id: 'enchant_protection_ring',
    name: 'Ring of Protection',
    description: 'Bind defensive wards into a silver ring.',
    station: 'enchanters_table',
    recipeType: 'enchant',
    timeMinutes: 480, // 8 hours
    skillCheck: {
      skill: 'Arcana',
      dc: 18
    },
    inputs: [
      { itemId: 'silver_ring', quantity: 1, consumed: true },
      { itemId: 'essence_earth', quantity: 2, consumed: true },
      { itemId: 'parchment_warding', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'ring_of_protection', quantity: 1 }
    ]
  }
];
