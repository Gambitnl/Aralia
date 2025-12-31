/**
 * @file src/systems/crafting/__tests__/CookingSystem.test.ts
 * Tests for the CookingSystem and dynamic recipe resolution.
 */
import { describe, it, expect, vi } from 'vitest';
// TODO(lint-intent): 'INGREDIENT_TAGS' is unused in this test; use it in the assertion path or remove it.
import { attemptCooking, CookingRecipe, resolveCookingRecipe, INGREDIENT_TAGS as _INGREDIENT_TAGS } from '../CookingSystem';
import { Crafter } from '../craftingSystem';

// Mock Crafter Helper
const createMockCrafter = (inventoryItems: { itemId: string; quantity: number }[], rollResult: number = 15): Crafter => ({
  id: 'chef',
  name: 'Gordon',
  inventory: inventoryItems,
  rollSkill: vi.fn().mockReturnValue(rollResult)
});

describe('CookingSystem', () => {
  const stewRecipe: CookingRecipe = {
    id: 'stew',
    name: 'Hearty Stew',
    description: 'A filling stew.',
    station: 'campfire',
    recipeType: 'cooking',
    timeMinutes: 30,
    inputs: [
      { tag: 'meat', quantity: 1, consumed: true },
      { tag: 'vegetable', quantity: 2, consumed: true },
      { itemId: 'water_clean', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'meal_stew', quantity: 1, qualityBound: true }
    ],
    skillCheck: {
      skill: 'Cooking',
      dc: 10
    }
  };

  it('should resolve recipe when exact tag matches are present', () => {
    const crafter = createMockCrafter([
      { itemId: 'venison', quantity: 5 }, // 'meat'
      { itemId: 'carrot', quantity: 5 },  // 'vegetable'
      { itemId: 'water_clean', quantity: 5 }
    ]);

    const result = resolveCookingRecipe(crafter, stewRecipe);

    expect(result).not.toBeNull();
    expect(result?.inputs).toHaveLength(3);
    expect(result?.inputs.find(i => i.itemId === 'venison')).toBeDefined();
    expect(result?.inputs.find(i => i.itemId === 'carrot')).toBeDefined();
  });

  it('should resolve recipe with alternative ingredients via tags', () => {
    const crafter = createMockCrafter([
      { itemId: 'raw_beef', quantity: 5 }, // 'meat'
      { itemId: 'potato', quantity: 5 },   // 'vegetable'
      { itemId: 'water_clean', quantity: 5 }
    ]);

    const result = resolveCookingRecipe(crafter, stewRecipe);

    expect(result).not.toBeNull();
    expect(result?.inputs.find(i => i.itemId === 'raw_beef')).toBeDefined();
    expect(result?.inputs.find(i => i.itemId === 'potato')).toBeDefined();
  });

  it('should fail resolution if ingredients are missing', () => {
    const crafter = createMockCrafter([
      { itemId: 'venison', quantity: 5 },
      // Missing vegetable
      { itemId: 'water_clean', quantity: 5 }
    ]);

    const result = resolveCookingRecipe(crafter, stewRecipe);
    expect(result).toBeNull();
  });

  it('should fail resolution if quantity is insufficient', () => {
    const crafter = createMockCrafter([
      { itemId: 'venison', quantity: 1 },
      { itemId: 'carrot', quantity: 1 }, // Recipe needs 2
      { itemId: 'water_clean', quantity: 5 }
    ]);

    const result = resolveCookingRecipe(crafter, stewRecipe);
    expect(result).toBeNull();
  });

  it('should successfully craft a meal using attemptCooking', () => {
    const crafter = createMockCrafter([
      { itemId: 'venison', quantity: 5 },
      { itemId: 'carrot', quantity: 5 },
      { itemId: 'water_clean', quantity: 5 }
    ], 15); // Roll 15 > DC 10

    const result = attemptCooking(crafter, stewRecipe);

    expect(result.success).toBe(true);
    expect(result.outputs[0].itemId).toBe('meal_stew');
    expect(result.consumedMaterials).toHaveLength(3);
    expect(result.consumedMaterials.find(i => i.itemId === 'venison')).toBeDefined();
  });

  it('should fail crafting if materials are missing (wrapper check)', () => {
    const crafter = createMockCrafter([]);
    const result = attemptCooking(crafter, stewRecipe);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Missing ingredients');
  });
});
