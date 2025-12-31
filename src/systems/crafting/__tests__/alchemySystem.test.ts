
import { describe, it, expect } from 'vitest';
import { attemptAlchemy, getReagentProperties } from '../alchemySystem';
import { Crafter } from '../craftingSystem';
import { Item, ItemType } from '../../../types/items';

// Mock Items
const RED_ROOT: Item = {
  id: 'herb_red_root',
  name: 'Red Root',
  description: 'A healing herb',
  type: ItemType.CraftingMaterial
};

const BLUE_LEAF: Item = {
  id: 'herb_blue_leaf',
  name: 'Blue Leaf',
  description: 'A reactive leaf',
  type: ItemType.CraftingMaterial
};
// TODO(lint-intent): 'DUST_GLOW' is unused in this test; use it in the assertion path or remove it.
const _DUST_GLOW: Item = {
  id: 'dust_glow',
  name: 'Glow Dust',
  description: 'Glowing dust',
  type: ItemType.CraftingMaterial
};

// Mock Crafter
const createMockCrafter = (rollResult: number): Crafter => ({
  id: 'player_1',
  name: 'Alchemist Bob',
  inventory: [],
  rollSkill: () => rollResult
});

describe('AlchemySystem', () => {
  describe('getReagentProperties', () => {
    it('should return properties from database overrides', () => {
      const props = getReagentProperties(RED_ROOT);
      expect(props).toContain('curative');
      expect(props).toContain('binding');
    });

    it('should return properties from item tags if available', () => {
      const customItem: Item = {
        ...RED_ROOT,
        id: 'custom_herb',
        properties: ['toxic']
      };
      const props = getReagentProperties(customItem);
      expect(props).toEqual(['toxic']);
    });

    it('should fallback to inert', () => {
        const unknownItem: Item = {
            ...RED_ROOT,
            id: 'unknown_rock',
            properties: []
        };
        const props = getReagentProperties(unknownItem);
        expect(props).toEqual(['inert']);
    });
  });

  describe('attemptAlchemy', () => {
    it('should create a healing potion from 2 curative items', () => {
      const crafter = createMockCrafter(18); // High roll (DC is 12 + 4 = 16)
      const reagents = [RED_ROOT, RED_ROOT]; // 2x Curative

      const result = attemptAlchemy(crafter, reagents);

      expect(result.success).toBe(true);
      expect(result.outputs).toEqual([{ itemId: 'potion_healing', quantity: 1 }]);
      expect(result.outcomeType).toBe('success');
    });

    it('should produce sludge for mismatched items', () => {
      const crafter = createMockCrafter(15);
      const reagents = [RED_ROOT, BLUE_LEAF]; // Curative + Reactive = ?

      const result = attemptAlchemy(crafter, reagents);

      expect(result.success).toBe(false);
      expect(result.outcomeType).toBe('sludge');
    });

    it('should fail if skill check is low', () => {
      const crafter = createMockCrafter(2); // Low roll
      const reagents = [RED_ROOT, RED_ROOT]; // Valid recipe

      const result = attemptAlchemy(crafter, reagents);

      expect(result.success).toBe(false);
      expect(result.outcomeType).toBe('sludge'); // Ruined it
      expect(result.materialsLost).toBe(true);
    });

    it('should detect volatile combinations', () => {
        const crafter = createMockCrafter(20); // High roll to survive volatility
        // Red Root (Curative) + Blue Leaf (Reactive) + Red Root (Curative)
        // 2 Curative = Potion, but Reactive makes it volatile
        const reagents = [RED_ROOT, RED_ROOT, BLUE_LEAF];

        const result = attemptAlchemy(crafter, reagents);

        expect(result.outcomeType).toBe('volatile');
        expect(result.success).toBe(true); // "Success" but volatile
    });

    it('should handle critical success', () => {
        const crafter = createMockCrafter(30); // Super high (DC 16 + 10 margin = 26 needed)
        const reagents = [RED_ROOT, RED_ROOT];

        const result = attemptAlchemy(crafter, reagents);

        expect(result.quality).toBe('superior');
        expect(result.outputs).toEqual([{ itemId: 'potion_healing', quantity: 2 }]);
    });
  });
});
