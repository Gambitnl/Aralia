/**
 * @file src/systems/crafting/__tests__/EnchantingSystem.test.ts
 * Tests for the Enchanting System mechanics.
 */
import { describe, it, expect } from 'vitest';
import { attemptEnchant, EnchantingResult } from '../EnchantingSystem';
import { Recipe } from '../types';
import { Crafter } from '../craftingSystem';

// Mocks
const mockCrafter = (skillRoll: number): Crafter => ({
  id: 'mage_1',
  name: 'Test Mage',
  inventory: [
    { itemId: 'dagger_iron', quantity: 1 },
    { itemId: 'dust_arcane', quantity: 10 },
    { itemId: 'gem_ruby', quantity: 1 }
  ],
  rollSkill: () => skillRoll
});

const mockRecipe: Recipe = {
  id: 'enchant_dagger_plus_one',
  name: 'Enchant Dagger +1',
  description: 'Test',
  station: 'enchanters_table',
  recipeType: 'enchant',
  timeMinutes: 60,
  skillCheck: { skill: 'Arcana', dc: 15 },
  inputs: [
    { itemId: 'dagger_iron', quantity: 1, consumed: true }, // Base Item
    { itemId: 'dust_arcane', quantity: 5, consumed: true }  // Catalyst
  ],
  outputs: [
    { itemId: 'dagger_plus_one', quantity: 1 }
  ]
};

describe('Enchanting System', () => {
  it('should successfully enchant an item when roll >= DC', () => {
    const result = attemptEnchant(mockCrafter(16), mockRecipe);

    expect(result.success).toBe(true);
    expect(result.criticalFailure).toBe(false);
    // Should produce output
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].itemId).toBe('dagger_plus_one');
    // Should consume all inputs
    expect(result.consumedMaterials).toHaveLength(2); // Dagger + Dust
  });

  it('should fail but save base item on standard failure (Roll < DC but > DC-5)', () => {
    // DC 15. Roll 12 is a fail, but not critical (15-5=10).
    const result = attemptEnchant(mockCrafter(12), mockRecipe);

    expect(result.success).toBe(false);
    expect(result.criticalFailure).toBe(false);
    expect(result.materialsLost).toBe(true); // Still lost something

    // Convention check: First item (Dagger) saved, others consumed
    expect(result.consumedMaterials).toHaveLength(1);
    expect(result.consumedMaterials[0].itemId).toBe('dust_arcane');
  });

  it('should critically fail and destroy base item on bad roll (Roll <= DC-5)', () => {
    // DC 15. Roll 5 is <= 10. Critical Fail.
    const result = attemptEnchant(mockCrafter(5), mockRecipe);

    expect(result.success).toBe(false);
    expect(result.criticalFailure).toBe(true);
    expect(result.message).toContain('Critical Failure');

    // Everything consumed (Dagger + Dust)
    expect(result.consumedMaterials).toHaveLength(2);
    expect(result.consumedMaterials.find(i => i.itemId === 'dagger_iron')).toBeDefined();
  });

  it('should prevent enchanting if materials are missing', () => {
    const poorCrafter = { ...mockCrafter(20), inventory: [] };
    const result = attemptEnchant(poorCrafter, mockRecipe);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient');
  });
});
