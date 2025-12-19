
import { describe, it, expect } from 'vitest';
import { attemptSalvage } from '../salvageSystem';
import { Recipe } from '../types';
import { Crafter } from '../craftingSystem';

// Mock Crafter
const mockCrafter = (inventory: { itemId: string; quantity: number }[], rollResult: number): Crafter => ({
  id: 'test-crafter',
  name: 'Bob the Breaker',
  inventory,
  rollSkill: () => rollResult
});

const salvageRecipe: Recipe = {
  id: 'salvage_sword',
  name: 'Salvage Sword',
  description: 'Break sword',
  station: 'workbench',
  recipeType: 'salvage',
  timeMinutes: 10,
  skillCheck: { skill: 'Strength', dc: 10 },
  inputs: [{ itemId: 'sword_iron', quantity: 1, consumed: true }],
  outputs: [{ itemId: 'ingot_iron', quantity: 1 }]
};

describe('Salvage System', () => {
  it('should successfully salvage an item when skill check passes', () => {
    const crafter = mockCrafter([{ itemId: 'sword_iron', quantity: 1 }], 15); // Roll 15 > DC 10
    const result = attemptSalvage(crafter, salvageRecipe);

    expect(result.success).toBe(true);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].itemId).toBe('ingot_iron');
    expect(result.consumedMaterials).toHaveLength(1);
    expect(result.consumedMaterials[0].itemId).toBe('sword_iron');
  });

  it('should fail and destroy item when skill check fails', () => {
    const crafter = mockCrafter([{ itemId: 'sword_iron', quantity: 1 }], 5); // Roll 5 < DC 10
    const result = attemptSalvage(crafter, salvageRecipe);

    expect(result.success).toBe(false);
    expect(result.outputs).toHaveLength(0); // No materials back
    expect(result.consumedMaterials).toHaveLength(1); // Item still consumed!
    expect(result.materialsLost).toBe(true);
  });

  it('should reject wrong recipe type', () => {
    const craftRecipe: Recipe = { ...salvageRecipe, recipeType: 'craft' };
    const crafter = mockCrafter([{ itemId: 'sword_iron', quantity: 1 }], 15);
    const result = attemptSalvage(crafter, craftRecipe);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid recipe type');
  });

  it('should handle missing items', () => {
    const crafter = mockCrafter([], 15);
    const result = attemptSalvage(crafter, salvageRecipe);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Missing item');
  });
});
