
import { describe, it, expect, vi } from 'vitest';
import { attemptSalvage } from '../salvageSystem';
import { SalvageRule } from '../types';
import { Item, ItemType } from '../../../types/items';
import { Crafter } from '../craftingSystem';

describe('SalvageSystem', () => {
  const mockCrafter: Crafter = {
    id: 'c1',
    name: 'Smithy',
    inventory: [],
    rollSkill: vi.fn(),
  };

  const mockItem: Item = {
    id: 'iron_dagger',
    name: 'Iron Dagger',
    description: 'A rusty dagger.',
    type: ItemType.Weapon,
  };

  const mockRule: SalvageRule = {
    id: 'salvage_iron_dagger',
    targetItemId: 'iron_dagger',
    station: 'forge',
    timeMinutes: 30,
    skillCheck: {
      skill: 'Smith\'s Tools',
      dc: 12
    },
    outputs: [
      { itemId: 'ingot_iron', quantityMin: 1, quantityMax: 1, chance: 1.0 },
      { itemId: 'leather_scrap', quantityMin: 1, quantityMax: 2, chance: 0.5 }
    ]
  };

  it('fails if station is incorrect', () => {
    const result = attemptSalvage(mockCrafter, mockItem, mockRule, 'workbench');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Requires forge');
  });

  it('fails if item ID does not match rule', () => {
    const wrongItem = { ...mockItem, id: 'wrong_id' };
    const result = attemptSalvage(mockCrafter, wrongItem, mockRule, 'forge');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Rule does not apply');
  });

  it('yields poor results on failed skill check', () => {
    // Roll 5 vs DC 12 -> Fail
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(5);

    const result = attemptSalvage(mockCrafter, mockItem, mockRule, 'forge');

    // Expect failure or poor quality
    // In our logic, if outputs > 0, it's success:true but quality:poor.
    // However, if qtyMin is 1, poor quality halves it to 0 (floor(1/2)=0).
    // So output should be 0, and function returns success:false.

    expect(result.quality).toBe('poor');
    expect(result.outputs).toHaveLength(0);
    expect(result.success).toBe(false);
  });

  it('yields standard results on success', () => {
    // Roll 15 vs DC 12 -> Success
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(15);

    // Mock random to ensure consistent output for the chance-based item
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // Pass chance check (0.1 < 0.5)

    const result = attemptSalvage(mockCrafter, mockItem, mockRule, 'forge');

    expect(result.success).toBe(true);
    expect(result.quality).toBe('standard');
    expect(result.outputs.some(o => o.itemId === 'ingot_iron')).toBe(true);
  });

  it('yields superior results on critical success', () => {
    // Roll 25 vs DC 12 -> Superior (> DC+10)
    vi.mocked(mockCrafter.rollSkill).mockReturnValue(25);

    const result = attemptSalvage(mockCrafter, mockItem, mockRule, 'forge');

    expect(result.success).toBe(true);
    expect(result.quality).toBe('superior');
    // Superior grants Max quantity
    const iron = result.outputs.find(o => o.itemId === 'ingot_iron');
    expect(iron?.quantity).toBe(1);
  });
});
