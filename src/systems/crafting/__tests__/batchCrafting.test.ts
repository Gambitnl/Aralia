import { describe, expect, it } from 'vitest';
import type { Item } from '../../../types';
import type { CraftingRecipe } from '../alchemyRecipes';
import { checkRecipeCraftability } from '../craftingEngine';
import { calculateBatchCraftability, DEFAULT_BATCH_CONFIG } from '../batchCrafting';

const stackedInventory: Item[] = [
  {
    id: 'rowan_berry',
    name: 'Rowan Berry',
    description: 'A single stacked inventory row used to prove quantity-aware counting.',
    quantity: 5,
    type: 'reagent'
  }
];

// Keep the recipe fixture small so the regression only exercises the quantity math.
const stackedQuantityRecipe: CraftingRecipe = {
  id: 'stacked_quantity_regression',
  name: 'Stacked Quantity Tonic',
  description: 'Regression fixture for stacked reagent craftability.',
  rarity: 'common',
  craftingDC: 10,
  craftingDays: 1,
  goldCost: 1,
  ingredients: [
    {
      itemId: 'rowan_berry',
      quantity: 2,
      name: 'Rowan Berry'
    }
  ],
  outputItemId: 'stacked_quantity_tonic',
  outputQuantity: 1,
  toolRequired: 'alchemist_supplies',
  category: 'potion'
};

describe('crafting quantity-aware helpers', () => {
  it('counts one stacked inventory row by its real quantity for recipe craftability', () => {
    const craftability = checkRecipeCraftability(
      stackedQuantityRecipe,
      stackedInventory,
      1,
      ["Alchemist's Supplies"]
    );

    expect(craftability.canCraft).toBe(true);
    expect(craftability.hasAllIngredients).toBe(true);
    expect(craftability.ingredientStatuses).toEqual([
      {
        itemId: 'rowan_berry',
        name: 'Rowan Berry',
        required: 2,
        available: 5,
        isSatisfied: true
      }
    ]);
  });

  it('uses stacked quantity when calculating the batch craftable maximum', () => {
    const batchCraftability = calculateBatchCraftability(
      stackedQuantityRecipe,
      stackedInventory,
      10,
      { ...DEFAULT_BATCH_CONFIG }
    );

    expect(batchCraftability.maxCraftable).toBe(2);
    expect(batchCraftability.batchSizes).toHaveLength(3);
    expect(batchCraftability.batchSizes[1]).toMatchObject({
      quantity: 2,
      ingredientsSatisfied: true
    });
    expect(batchCraftability.batchSizes[2]).toMatchObject({
      quantity: 3,
      ingredientsSatisfied: false
    });
  });
});
