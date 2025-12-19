/**
 * @file src/systems/crafting/data/recipes.ts
 * Initial set of crafting recipes.
 */
import { Recipe } from '../types';

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'potion_healing_basic',
    name: 'Basic Healing Potion',
    description: 'A standard red potion that heals minor wounds.',
    station: 'alchemy_bench',
    recipeType: 'craft',
    timeMinutes: 60,
    skillCheck: {
      skill: 'Herbalism Kit',
      dc: 12
    },
    inputs: [
      { itemId: 'herb_red_root', quantity: 2, consumed: true },
      { itemId: 'vial_glass', quantity: 1, consumed: true },
      { itemId: 'water_purified', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'potion_healing', quantity: 1, qualityBound: true }
    ]
  },
  {
    id: 'iron_dagger',
    name: 'Iron Dagger',
    description: 'A simple iron dagger.',
    station: 'forge',
    recipeType: 'craft',
    timeMinutes: 120,
    skillCheck: {
      skill: 'Smith\'s Tools',
      dc: 10
    },
    inputs: [
      { itemId: 'ingot_iron', quantity: 1, consumed: true },
      { itemId: 'leather_strip', quantity: 1, consumed: true },
      { itemId: 'tool_hammer', quantity: 1, consumed: false } // Tool not consumed
    ],
    outputs: [
      { itemId: 'dagger_iron', quantity: 1 }
    ]
  },
  // --- SALVAGE RECIPES ---
  {
    id: 'salvage_iron_dagger',
    name: 'Scrap Iron Dagger',
    description: 'Carefully disassemble an iron dagger to recover materials.',
    station: 'workbench', // or disassembler
    recipeType: 'salvage',
    timeMinutes: 30,
    skillCheck: {
      skill: 'Smith\'s Tools',
      dc: 12 // Harder to get good materials out than to just smash it
    },
    inputs: [
      { itemId: 'dagger_iron', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'ingot_iron', quantity: 1, qualityBound: true }, // Recover the ingot? Or shards?
      // Let's say normally you get 1 ingot on success.
    ]
  }
];
