/**
 * @file src/systems/crafting/__tests__/craftingSystem.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { attemptCraft, canCraft, Crafter } from '../craftingSystem';
import { Recipe } from '../types';

describe('Crafting System', () => {
  const mockRecipe: Recipe = {
    id: 'test_potion',
    name: 'Test Potion',
    description: 'Test',
    station: 'alchemy_bench',
    timeMinutes: 30,
    skillCheck: { skill: 'Alchemy', dc: 15 },
    inputs: [
      { itemId: 'herb', quantity: 2, consumed: true },
      { itemId: 'bottle', quantity: 1, consumed: true },
      { itemId: 'spoon', quantity: 1, consumed: false }
    ],
    outputs: [
      { itemId: 'potion', quantity: 1 }
    ]
  };

  const createMockCrafter = (inventory: {itemId: string, quantity: number}[], rollResult: number): Crafter => ({
    id: 'c1',
    name: 'Crafter',
    inventory,
    rollSkill: vi.fn().mockReturnValue(rollResult)
  });

  it('validates sufficient materials correctly', () => {
    const crafter = createMockCrafter([
      { itemId: 'herb', quantity: 5 },
      { itemId: 'bottle', quantity: 1 },
      { itemId: 'spoon', quantity: 1 }
    ], 20);

    expect(canCraft(crafter, mockRecipe)).toBe(true);
  });

  it('validates insufficient materials correctly', () => {
    const crafter = createMockCrafter([
      { itemId: 'herb', quantity: 1 }, // Need 2
      { itemId: 'bottle', quantity: 1 },
      { itemId: 'spoon', quantity: 1 }
    ], 20);

    expect(canCraft(crafter, mockRecipe)).toBe(false);
  });

  it('consumes materials on success', () => {
    const crafter = createMockCrafter([
      { itemId: 'herb', quantity: 5 },
      { itemId: 'bottle', quantity: 5 },
      { itemId: 'spoon', quantity: 1 }
    ], 16); // Roll 16 > DC 15

    const result = attemptCraft(crafter, mockRecipe);

    expect(result.success).toBe(true);
    // Consumed: 2 herbs, 1 bottle. Spoon not consumed.
    expect(result.consumedMaterials).toHaveLength(2);
    expect(result.consumedMaterials).toContainEqual({ itemId: 'herb', quantity: 2 });
    expect(result.consumedMaterials).toContainEqual({ itemId: 'bottle', quantity: 1 });
    expect(result.outputs).toContainEqual({ itemId: 'potion', quantity: 1 });
  });

  it('fails and consumes materials on failed skill check', () => {
    const crafter = createMockCrafter([
      { itemId: 'herb', quantity: 5 },
      { itemId: 'bottle', quantity: 5 },
      { itemId: 'spoon', quantity: 1 }
    ], 5); // Roll 5 < DC 15

    const result = attemptCraft(crafter, mockRecipe);

    expect(result.success).toBe(false);
    expect(result.materialsLost).toBe(true);
    // Should still list consumed materials because they were lost
    expect(result.consumedMaterials).toHaveLength(2);
    expect(result.outputs).toHaveLength(0);
  });

  it('produces superior quality on high roll', () => {
    const crafter = createMockCrafter([
      { itemId: 'herb', quantity: 5 },
      { itemId: 'bottle', quantity: 5 },
      { itemId: 'spoon', quantity: 1 }
    ], 25); // Roll 25 >= DC 15 + 10

    const result = attemptCraft(crafter, mockRecipe);
    expect(result.success).toBe(true);
    expect(result.quality).toBe('superior');
  });
});
