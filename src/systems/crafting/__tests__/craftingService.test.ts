import { describe, it, expect, vi } from 'vitest';
import { attemptCraft, checkMaterials } from '../craftingService';
import { Recipe } from '../../../types/crafting';
import { PlayerCharacter } from '../../../types/character';
import { Item, ItemType } from '../../../types/items';

// Mocks
const mockIronBar: Item = {
  id: 'iron_bar',
  name: 'Iron Bar',
  description: 'A bar of iron',
  type: ItemType.CraftingMaterial
};

const mockWood: Item = {
  id: 'wood',
  name: 'Wood',
  description: 'A piece of wood',
  type: ItemType.CraftingMaterial
};

const mockRecipe: Recipe = {
  id: 'iron_sword_recipe',
  name: 'Iron Sword',
  description: 'Simple iron sword',
  category: 'smithing',
  timeMinutes: 60,
  inputs: [
    { itemId: 'iron_bar', quantity: 2, consumed: true },
    { itemId: 'wood', quantity: 1, consumed: true }
  ],
  outputs: [
    { itemId: 'iron_sword', quantity: 1, qualityFromRoll: true }
  ],
  skillCheck: {
    skill: 'athletics', // Using athletics as a proxy for smithing strength for this test
    difficultyClass: 15
  }
};

const mockCrafter = {
  skills: [],
  abilityScores: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
  proficiencyBonus: 2
} as unknown as PlayerCharacter;

vi.mock('../../../utils/statUtils', () => ({
  getSkillModifierValue: () => 5 // Mock +5 modifier
}));

vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn()
}));

import { rollDice } from '../../../utils/combatUtils';

describe('Crafting System', () => {

  describe('checkMaterials', () => {
    it('should return true when all materials are present', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [
        { ...mockIronBar, quantity: 5 },
        { ...mockWood, quantity: 2 }
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return false when materials are missing', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [
        { ...mockIronBar, quantity: 1 }, // Need 2
        { ...mockWood, quantity: 2 }
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(false);
      expect(result.missing).toContain('iron_bar (Need 2, Have 1)');
    });
  });

  describe('attemptCraft', () => {
    it('should fail if materials are missing', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [];
      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing materials');
    });

    it('should succeed on good roll', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [
        { ...mockIronBar, quantity: 2 },
        { ...mockWood, quantity: 1 }
      ];

      // DC 15. Modifier +5. Roll needs to be 10+.
      vi.mocked(rollDice).mockReturnValue(12); // Total 17

      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(true);
      expect(result.itemsCreated[0].itemId).toBe('iron_sword');
      expect(result.materialsConsumed).toHaveLength(2);
    });

    it('should fail on bad roll', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [
        { ...mockIronBar, quantity: 2 },
        { ...mockWood, quantity: 1 }
      ];

      // DC 15. Modifier +5. Roll needs to be 10+.
      vi.mocked(rollDice).mockReturnValue(2); // Total 7

      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Crafting failed');
      // Should lose some materials
      expect(result.materialsConsumed.length).toBeGreaterThan(0);
    });

    it('should crit on high roll', () => {
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const inventory: unknown[] = [
        { ...mockIronBar, quantity: 2 },
        { ...mockWood, quantity: 1 }
      ];

      // DC 15. Modifier +5. Crit needs +10 over DC (25+). Roll 20 + 5 = 25.
      vi.mocked(rollDice).mockReturnValue(20);

      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Critical success');
      expect(result.quality).toBe('rare');
    });
  });
});
