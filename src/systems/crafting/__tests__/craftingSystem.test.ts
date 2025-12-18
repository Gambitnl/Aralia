
import { describe, it, expect } from 'vitest';
import { attemptCraft, validateMaterials } from '../craftingSystem';
import { Recipe } from '../types';

describe('Crafting System', () => {
  const basicRecipe: Recipe = {
    id: 'potion_healing',
    name: 'Healing Potion',
    description: 'A basic healing potion',
    inputs: [
      { itemId: 'herb_healing', quantity: 2, consumed: true },
      { itemId: 'vial_glass', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'potion_healing', quantity: 1, qualityFromRoll: false }
    ],
    timeMinutes: 60,
    skillCheck: {
      skill: 'herbalism_kit',
      difficultyClass: 12
    }
  };

  describe('validateMaterials', () => {
    it('should return valid if all materials are present', () => {
      const inventory = [
        { itemId: 'herb_healing', quantity: 5 },
        { itemId: 'vial_glass', quantity: 5 }
      ];
      const result = validateMaterials(inventory, basicRecipe);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return invalid if materials are missing', () => {
        const inventory = [
            { itemId: 'herb_healing', quantity: 1 }, // Need 2
            { itemId: 'vial_glass', quantity: 5 }
        ];
        const result = validateMaterials(inventory, basicRecipe);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('herb_healing');
    });
  });

  describe('attemptCraft', () => {
    it('should fail and lose materials on critical failure (roll <= DC - 10)', () => {
        // DC 12. Roll 2. 2 <= 2.
        const result = attemptCraft(basicRecipe, 2);
        expect(result.success).toBe(false);
        expect(result.materialsLost).toBe(true);
        expect(result.quality).toBe('poor');
    });

    it('should fail but save materials on standard failure (roll < DC)', () => {
        // DC 12. Roll 10.
        const result = attemptCraft(basicRecipe, 10);
        expect(result.success).toBe(false);
        expect(result.materialsLost).toBe(false);
    });

    it('should succeed with standard quality on success (roll >= DC)', () => {
        // DC 12. Roll 15.
        const result = attemptCraft(basicRecipe, 15);
        expect(result.success).toBe(true);
        expect(result.quality).toBe('standard');
        expect(result.outputs).toBeDefined();
        expect(result.outputs?.[0].quantity).toBe(1);
    });

    it('should succeed with superior quality on critical success (roll >= DC + 10)', () => {
        // DC 12. Roll 22.
        // Note: The example logic in attemptCraft doubles quantity for qualityFromRoll=true,
        // but our basicRecipe has it false. Let's update recipe for this test or check logic.
        // Wait, logic says: quantity * (o.qualityFromRoll ? 2 : 1).
        // So for basicRecipe it will still be 1 unless we change the recipe.

        const qualityRecipe = { ...basicRecipe, outputs: [{ itemId: 'potion_healing', quantity: 1, qualityFromRoll: true }] };

        const result = attemptCraft(qualityRecipe, 22);
        expect(result.success).toBe(true);
        expect(result.quality).toBe('superior');
        expect(result.outputs?.[0].quantity).toBe(2);
    });
  });
});
