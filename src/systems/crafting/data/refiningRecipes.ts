/**
 * @file src/systems/crafting/data/refiningRecipes.ts
 * Refining recipes: raw materials -> refined components.
 * Consumed by the dedicated Refining & Enchanting panel via processRefiningBatch.
 * Every item id must exist in ALL_ITEMS (see src/data/craftingMaterials.ts).
 */
import { RefiningRecipe } from '../RefiningSystem';

export const REFINING_RECIPES: RefiningRecipe[] = [
  {
    id: 'refine_iron_ingot',
    name: 'Smelt Iron Ingot',
    description: 'Roast iron ore in the forge and hammer out the slag, leaving a clean bar of workable iron.',
    recipeType: 'refine',
    station: 'forge',
    timeMinutes: 30,
    skillCheck: { skill: "Smith's Tools", dc: 10 },
    inputs: [
      { itemId: 'iron_ore', quantity: 2, consumed: true },
    ],
    outputs: [
      { itemId: 'iron_ingot', quantity: 1 },
    ],
    yieldBonus: { thresholdStep: 5, bonusPercent: 0.1, maxBonus: 0.5 },
  },
  {
    id: 'refine_silver_ingot',
    name: 'Smelt Silver Ingot',
    description: 'Silver melts low but burns easily — a careful smelt yields a gleaming bar fit for enchantment.',
    recipeType: 'refine',
    station: 'forge',
    timeMinutes: 40,
    skillCheck: { skill: "Smith's Tools", dc: 12 },
    inputs: [
      { itemId: 'silver_ore', quantity: 2, consumed: true },
    ],
    outputs: [
      { itemId: 'silver_ingot', quantity: 1 },
    ],
    yieldBonus: { thresholdStep: 5, bonusPercent: 0.1, maxBonus: 0.5 },
  },
  {
    id: 'refine_leather_strips',
    name: 'Cut Leather Strips',
    description: 'Scrape, tan, and cut a raw hide into supple strips for grips and bindings.',
    recipeType: 'refine',
    station: 'tannery',
    timeMinutes: 45,
    skillCheck: { skill: 'Survival', dc: 10 },
    inputs: [
      { itemId: 'raw_hide', quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: 'leather_strip', quantity: 2 },
    ],
    yieldBonus: { thresholdStep: 5, bonusPercent: 0.25, maxBonus: 0.5 },
  },
  {
    id: 'refine_arcane_dust',
    name: 'Grind Arcane Dust',
    description: 'Crush a rough ruby in a warded mortar. The gem is lost, but its latent magic survives as dust.',
    recipeType: 'refine',
    station: 'enchanters_table',
    timeMinutes: 20,
    skillCheck: { skill: 'Arcana', dc: 12 },
    inputs: [
      { itemId: 'gem_ruby', quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: 'dust_arcane', quantity: 3 },
    ],
    yieldBonus: { thresholdStep: 5, bonusPercent: 0.34, maxBonus: 0.67 },
  },
];
