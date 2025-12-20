
import { describe, it, expect, vi } from 'vitest';
import { attemptCraft, Crafter } from '../craftingSystem';
import { Recipe } from '../types';

describe('craftingSystem', () => {
  const mockCrafter: Crafter = {
    id: 'crafter-1',
    name: 'Test Crafter',
    inventory: [
      { itemId: 'iron_ingot', quantity: 5 },
      { itemId: 'leather_strip', quantity: 2 },
      { itemId: 'herb_rare', quantity: 1 }
    ],
    rollSkill: vi.fn()
  };

  const basicRecipe: Recipe = {
    id: 'sword-1',
    name: 'Iron Sword',
    description: 'A basic sword',
    station: 'forge',
    timeMinutes: 60,
    inputs: [
      { itemId: 'iron_ingot', quantity: 2, consumed: true },
      { itemId: 'leather_strip', quantity: 1, consumed: true }
    ],
    outputs: [
      { itemId: 'iron_sword', quantity: 1 }
    ],
    skillCheck: {
      skill: 'Smithing',
      dc: 10
    }
  };

  it('should craft successfully when materials are present and roll is sufficient', () => {
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(15); // > DC 10

    const result = attemptCraft(mockCrafter, basicRecipe);

    expect(result.success).toBe(true);
    expect(result.quality).toBe('standard');
    expect(result.outputs).toEqual([{ itemId: 'iron_sword', quantity: 1 }]);
    expect(result.consumedMaterials).toHaveLength(2);
  });

  it('should fail when materials are missing', () => {
    const poorCrafter = { ...mockCrafter, inventory: [] };
    const result = attemptCraft(poorCrafter, basicRecipe);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient materials');
  });

  it('should fail and consume materials on poor roll (default logic)', () => {
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(5); // < DC 10

    const result = attemptCraft(mockCrafter, basicRecipe);

    expect(result.success).toBe(false);
    expect(result.quality).toBe('poor');
    expect(result.materialsLost).toBe(true);
    expect(result.consumedMaterials).toHaveLength(2); // Materials consumed
  });

  it('should produce superior quality on high roll (default logic)', () => {
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(20); // >= DC 10 + 10

    const result = attemptCraft(mockCrafter, basicRecipe);

    expect(result.success).toBe(true);
    expect(result.quality).toBe('superior');
  });

  describe('Custom Quality Outcomes', () => {
    const complexRecipe: Recipe = {
      ...basicRecipe,
      id: 'potion-1',
      name: 'Healing Potion',
      skillCheck: { skill: 'Alchemy', dc: 10 },
      qualityOutcomes: [
        { threshold: 20, quality: 'masterwork', quantityMultiplier: 2, message: 'Double batch!' },
        { threshold: 15, quality: 'superior', itemIdOverride: 'potion_greater' },
        { threshold: 10, quality: 'standard' },
        { threshold: 0, quality: 'poor' } // Fallback
      ]
    };

    it('should use quantity multiplier for masterwork result', () => {
      vi.mocked(mockCrafter.rollSkill).mockReturnValue(22); // >= 20

      const result = attemptCraft(mockCrafter, complexRecipe);

      expect(result.success).toBe(true);
      expect(result.quality).toBe('masterwork');
      expect(result.outputs[0].quantity).toBe(2); // 1 * 2
      expect(result.message).toBe('Double batch!');
    });

    it('should override item ID for superior result', () => {
      vi.mocked(mockCrafter.rollSkill).mockReturnValue(16); // >= 15

      const result = attemptCraft(mockCrafter, complexRecipe);

      expect(result.success).toBe(true);
      expect(result.quality).toBe('superior');
      expect(result.outputs[0].itemId).toBe('potion_greater');
    });

    // Fix complex recipe output for clarity
    const correctComplexRecipe: Recipe = {
        ...complexRecipe,
        outputs: [{ itemId: 'potion_healing', quantity: 1 }]
    };

    it('should correctly output standard item', () => {
        vi.mocked(mockCrafter.rollSkill).mockReturnValue(12); // >= 10
        const result = attemptCraft(mockCrafter, correctComplexRecipe);
        expect(result.outputs[0].itemId).toBe('potion_healing');
    });

    it('should fail on poor result defined in outcomes', () => {
       vi.mocked(mockCrafter.rollSkill).mockReturnValue(5); // < 10, so it hits threshold 0 -> poor

       const result = attemptCraft(mockCrafter, correctComplexRecipe);

       expect(result.success).toBe(false); // quality 'poor' -> success false
       expect(result.quality).toBe('poor');
    });
  });
});
