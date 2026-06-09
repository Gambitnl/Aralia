/**
 * @file src/systems/crafting/__tests__/ingredientGlossary.test.ts
 * Focused tests for creature-derived glossary rarity handling.
 */
import { describe, it, expect, vi } from 'vitest';

// The glossary reads from module-level data tables, so the test swaps in a
// minimal corpus and keeps the rest of the crafting slice out of scope.
vi.mock('../gatheringData', () => ({
  GATHERABLE_RESOURCES: [],
  Biome: {}
}));

vi.mock('../creatureHarvestData', () => ({
  HARVESTABLE_CREATURES: [
    {
      id: 'missing_cr_beast',
      name: 'Missing CR Beast',
      cr: 'Varies',
      locations: ['Forest'],
      parts: [
        {
          id: 'missing_cr_essence',
          name: 'Missing CR Essence',
          rarity: 'common',
          harvestDC: 10,
          harvestTool: 'knife',
          baseYield: '1d4',
          uses: ['test_recipe']
        }
      ]
    },
    {
      id: 'high_cr_beast',
      name: 'High CR Beast',
      cr: '10',
      challengeRating: 10,
      locations: ['Mountain'],
      parts: [
        {
          id: 'high_cr_essence',
          name: 'High CR Essence',
          rarity: 'rare',
          harvestDC: 20,
          harvestTool: 'alchemists_kit',
          baseYield: '1d4',
          uses: ['test_recipe']
        }
      ]
    }
  ]
}));

vi.mock('../alchemyRecipes', () => ({
  ALL_RECIPES: []
}));

import { buildIngredientGlossary } from '../ingredientGlossary';

describe('ingredientGlossary', () => {
  it('flags creature entries without challengeRating instead of collapsing them to common', () => {
    const glossary = buildIngredientGlossary();
    const missingCrEntry = glossary.find(entry => entry.name === 'Missing CR Essence');

    expect(missingCrEntry).toBeDefined();
    expect(missingCrEntry?.rarity).toBe('unknown');
  });

  it('still classifies creature entries with challengeRating using the existing thresholds', () => {
    const glossary = buildIngredientGlossary();
    const highCrEntry = glossary.find(entry => entry.name === 'High CR Essence');

    expect(highCrEntry).toBeDefined();
    expect(highCrEntry?.rarity).toBe('very_rare');
  });
});
