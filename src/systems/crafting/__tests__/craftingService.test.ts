import { describe, it, expect, vi } from 'vitest';
import { attemptCraft, checkMaterials, calculateCraftingExperience, getCraftingCheckAbility, getCraftingTier } from '../craftingService';
import { Recipe } from '../types';
import { PlayerCharacter } from '../../../types/character';
import { Item, ItemType, InventoryEntry } from '../../../types/items';
import { BLESSING_EFFECTS } from '../../../data/religion/blessings';
import { XP_REWARDS } from '../crafterProgression';

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

const mockExactMatchItem: Item = {
  id: 'exact_match_component',
  name: 'Exact Match Component',
  description: 'A test item that only proves ID-based matching.',
  type: ItemType.Note,
  category: 'legacy-only'
};

const mockTypedMaterial: Item = {
  id: 'typed_material_shard',
  name: 'Typed Material Shard',
  description: 'A test item that matches by item type.',
  type: ItemType.CraftingMaterial
};

const mockCategorizedMaterial: Item = {
  id: 'categorized_bundle',
  name: 'Categorized Bundle',
  description: 'A test item that matches by category.',
  type: ItemType.Consumable,
  category: 'herb_bundle'
};

const mockRecipe: Recipe = {
  id: 'iron_sword_recipe',
  name: 'Iron Sword',
  description: 'Simple iron sword',
  station: 'forge',
  timeMinutes: 60,
  inputs: [
    { itemId: 'iron_bar', quantity: 2, consumed: true },
    { itemId: 'wood', quantity: 1, consumed: true }
  ],
  outputs: [
    { itemId: 'iron_sword', quantity: 1 }
  ],
  skillCheck: {
    skill: 'athletics', // Using athletics as a proxy for smithing strength for this test
    dc: 15
  } as unknown as Recipe['skillCheck']
};

const createCrafter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
  skills: [],
  statusEffects: [],
  finalAbilityScores: { Strength: 20, Dexterity: 10, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  level: 1,
  proficiencyBonus: 2,
  modifiers: { advantage: [], disadvantage: [], bonuses: [] },
  ...overrides
} as unknown as PlayerCharacter);

const mockCrafter = createCrafter();

// attemptCraft now rolls through the shared ability-check resolver, which uses the
// combat dice engine. Mock that one module so the d20 stays deterministic.
vi.mock('../../dice/rollers', () => ({
  rollDice: vi.fn()
}));

import { rollDice } from '../../dice/rollers';

const fullInventory = (): InventoryEntry[] => [
  { ...mockIronBar, quantity: 2 },
  { ...mockWood, quantity: 1 }
];

describe('Crafting System', () => {

  describe('checkMaterials', () => {
    it('should return true when all materials are present', () => {
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 5 },
        { ...mockWood, quantity: 2 }
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    // Keep the strict ID path separate so future fallback changes do not blur it.
    it('should still match exact item IDs even when other metadata differs', () => {
      const inventory: InventoryEntry[] = [
        { ...mockExactMatchItem, quantity: 2 }
      ];

      const result = checkMaterials(inventory, [
        { itemId: mockExactMatchItem.id, quantity: 2, consumed: true }
      ]);

      expect(result.hasMaterials).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    // Legacy recipe data can name a broad type or category, but only after exact IDs miss.
    it('should match by item type or category when exact IDs are absent', () => {
      const inventory: InventoryEntry[] = [
        { ...mockTypedMaterial, quantity: 2 } as InventoryEntry,
        { ...mockCategorizedMaterial, quantity: 1 } as InventoryEntry
      ];

      const result = checkMaterials(inventory, [
        { itemId: ItemType.CraftingMaterial, quantity: 2, consumed: true },
        { itemId: 'herb_bundle', quantity: 1, consumed: true }
      ]);

      expect(result.hasMaterials).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return false when materials are missing', () => {
      const inventory: InventoryEntry[] = [
        { ...mockIronBar, quantity: 1 },
        { ...mockWood, quantity: 2 }
      ];

      const result = checkMaterials(inventory, mockRecipe.inputs);
      expect(result.hasMaterials).toBe(false);
      expect(result.missing).toContain('iron_bar (Need 2, Have 1)');
    });
  });

  describe('attemptCraft', () => {
    it('should fail if materials are missing', () => {
      const inventory: InventoryEntry[] = [];
      const result = attemptCraft(mockCrafter, mockRecipe, inventory);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing materials');
    });

    it('should succeed on good roll', () => {
      // DC 15. Strength 20 gives +5 and the crafter is not proficient. Roll 12 -> 17.
      vi.mocked(rollDice).mockReturnValue(12);

      const result = attemptCraft(mockCrafter, mockRecipe, fullInventory());

      expect(result.success).toBe(true);
      const outputs = result.outputs;
      expect(outputs[0]?.itemId).toBe('iron_sword');
      const consumed = result.consumedMaterials;
      expect(consumed).toHaveLength(2);
    });

    it('should fail on bad roll', () => {
      // DC 15. Modifier +5. Roll 2 -> 7.
      vi.mocked(rollDice).mockReturnValue(2);

      const result = attemptCraft(mockCrafter, mockRecipe, fullInventory());

      expect(result.success).toBe(false);
      expect(result.message).toContain('Crafting failed');
      // Should lose some materials
      const consumed = result.consumedMaterials;
      expect(consumed.length).toBeGreaterThan(0);
    });

    it('should crit on high roll', () => {
      // DC 15. Crit needs DC+10 (25+). Roll 20 + 5 = 25.
      vi.mocked(rollDice).mockReturnValue(20);

      const result = attemptCraft(mockCrafter, mockRecipe, fullInventory());

      expect(result.success).toBe(true);
      expect(result.message).toContain('Critical success');
      // CraftingService bumps crit quality to masterwork on DC+10.
      expect(result.quality).toBe('masterwork');
    });
  });

  // agora-0a28: a blessing must reach the craft roll, not merely sit on the sheet.
  describe('divine blessings on craft checks', () => {
    it("adds Artisan's Touch to the craft total, turning a one-point miss into a success", () => {
      // DC 15, Strength +5, roll 9 -> 14 without the blessing, 16 with it.
      vi.mocked(rollDice).mockReturnValue(9);

      const unblessed = attemptCraft(createCrafter(), mockRecipe, fullInventory());
      expect(unblessed.success).toBe(false);

      const blessed = createCrafter({
        statusEffects: [BLESSING_EFFECTS['blessing_artisans_touch'].effect] as unknown as PlayerCharacter['statusEffects']
      });
      const result = attemptCraft(blessed, mockRecipe, fullInventory());

      expect(result.success).toBe(true);
    });

    it('does not let an unrelated blessing touch the craft total', () => {
      vi.mocked(rollDice).mockReturnValue(9);

      const blessed = createCrafter({
        statusEffects: [BLESSING_EFFECTS['blessing_minor'].effect] as unknown as PlayerCharacter['statusEffects']
      });

      expect(attemptCraft(blessed, mockRecipe, fullInventory()).success).toBe(false);
    });
  });

  // agora-b7a9: XP comes from the tier the DC names, not from elapsed minutes.
  describe('crafting experience', () => {
    it('reads the tier from the DC ladder the recipe corpus uses', () => {
      expect(getCraftingTier(10)).toBe('common');
      expect(getCraftingTier(15)).toBe('uncommon');
      expect(getCraftingTier(20)).toBe('rare');
      expect(getCraftingTier(25)).toBe('very_rare');
    });

    it('awards the tier base, a masterwork bonus, and failure XP', () => {
      expect(calculateCraftingExperience({ dc: 10, success: true, quality: 'standard' }))
        .toBe(XP_REWARDS.common_success);
      expect(calculateCraftingExperience({ dc: 20, success: true, quality: 'standard' }))
        .toBe(XP_REWARDS.rare_success);
      expect(calculateCraftingExperience({ dc: 20, success: true, quality: 'masterwork' }))
        .toBe(XP_REWARDS.rare_success + XP_REWARDS.masterwork_bonus);
      expect(calculateCraftingExperience({ dc: 25, success: false, quality: 'poor' }))
        .toBe(XP_REWARDS.failure);
    });

    it('no longer scales XP with recipe time', () => {
      vi.mocked(rollDice).mockReturnValue(12);

      const quick = attemptCraft(mockCrafter, { ...mockRecipe, timeMinutes: 5 }, fullInventory());
      const slow = attemptCraft(mockCrafter, { ...mockRecipe, timeMinutes: 600 }, fullInventory());

      expect(quick.experienceGained).toBe(slow.experienceGained);
      expect(quick.experienceGained).toBe(XP_REWARDS.uncommon_success);
    });

    it('still awards learning XP on a failed craft', () => {
      vi.mocked(rollDice).mockReturnValue(2);

      const result = attemptCraft(mockCrafter, mockRecipe, fullInventory());
      expect(result.success).toBe(false);
      expect(result.experienceGained).toBe(XP_REWARDS.failure);
    });
  });

  describe('check ability resolution', () => {
    it('uses the named skill ability when the recipe names a real skill', () => {
      expect(getCraftingCheckAbility(mockRecipe)).toBe('Strength');
      expect(getCraftingCheckAbility({
        ...mockRecipe,
        skillCheck: { skill: 'Arcana', dc: 15 }
      })).toBe('Intelligence');
    });

    it("uses the station's ability when the recipe names a tool kit", () => {
      expect(getCraftingCheckAbility({
        ...mockRecipe,
        station: 'alchemy_bench',
        skillCheck: { skill: "Alchemist's Supplies", dc: 15 }
      })).toBe('Intelligence');
      expect(getCraftingCheckAbility({
        ...mockRecipe,
        station: 'loom',
        skillCheck: { skill: "Weaver's Tools", dc: 12 }
      })).toBe('Dexterity');
    });
  });
});
