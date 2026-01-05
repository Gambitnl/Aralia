import { describe, it, expect, vi } from 'vitest';
import { attemptCraft, checkMaterials } from '../craftingService';
import { Recipe } from '../types';
import { PlayerCharacter } from '../../../types/character';
import { Item, ItemType, InventoryEntry } from '../../../types/items';

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
  // TODO(2026-01-03 pass 4 Codex-CLI): station set to forge for test coverage; align with real recipe data if added.
  station: 'forge',
  timeMinutes: 60,
  inputs: [
    { itemId: 'iron_bar', quantity: 2, consumed: true },
    { itemId: 'wood', quantity: 1, consumed: true }
  ],
  outputs: [
    // TODO(2026-01-03 pass 4 Codex-CLI): qualityFromRoll cast until output typing captures roll-dependent quality.
    { itemId: 'iron_sword', quantity: 1 } as unknown as Recipe['outputs'][number]
  ],
  skillCheck: {
    skill: 'athletics', // Using athletics as a proxy for smithing strength for this test
    dc: 15
  } as unknown as Recipe['skillCheck']
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
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 5 } as InventoryEntry,
        { ...mockWood, quantity: 2 } as InventoryEntry
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return false when materials are missing', () => {
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 1 } as InventoryEntry, // Need 2
        { ...mockWood, quantity: 2 } as InventoryEntry
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(false);
      expect(result.missing).toContain('iron_bar (Need 2, Have 1)');
    });
  });

  describe('attemptCraft', () => {
    it('should fail if materials are missing', () => {
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [];
      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing materials');
    });

    it('should succeed on good roll', () => {
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 2 } as InventoryEntry,
        { ...mockWood, quantity: 1 } as InventoryEntry
      ];

      // DC 15. Modifier +5. Roll needs to be 10+.
      vi.mocked(rollDice).mockReturnValue(12); // Total 17

      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(true);
      const crafted = result as unknown as typeof result & {
        itemsCreated?: { itemId: string }[];
        materialsConsumed?: { itemId: string; quantity: number }[];
      };
      // TODO(2026-01-03 pass 4 Codex-CLI): itemsCreated/materialsConsumed legacy expectations; using outputs/consumedMaterials while wiring test shape.
      const outputs = crafted.itemsCreated ?? crafted.outputs;
      expect(outputs[0]?.itemId).toBe('iron_sword');
      const consumed = crafted.materialsConsumed ?? crafted.consumedMaterials;
      expect(consumed).toHaveLength(2);
    });

    it('should fail on bad roll', () => {
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 2 } as InventoryEntry,
        { ...mockWood, quantity: 1 } as InventoryEntry
      ];

      // DC 15. Modifier +5. Roll needs to be 10+.
      vi.mocked(rollDice).mockReturnValue(2); // Total 7

      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Crafting failed');
      // Should lose some materials
      const consumed = (result as unknown as { materialsConsumed?: { quantity: number }[]; consumedMaterials?: { quantity: number }[] }).materialsConsumed ?? (result as { consumedMaterials: { quantity: number }[] }).consumedMaterials;
      expect(consumed.length).toBeGreaterThan(0);
    });

    it('should crit on high roll', () => {
      // TODO(2026-01-03 pass 4 Codex-CLI): inventory cast to InventoryEntry[] placeholder for test.
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 2 } as InventoryEntry,
        { ...mockWood, quantity: 1 } as InventoryEntry
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
