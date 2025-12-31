
import { describe, it, expect } from 'vitest';
import { attemptScribe, canScribe, ScribingRequest } from '../ScribingSystem';
import { Crafter } from '../craftingSystem';

describe('ScribingSystem', () => {
  const mockCrafter: Crafter = {
    id: 'wizard_1',
    name: 'Gale',
    inventory: [
      { itemId: 'parchment', quantity: 5 },
      { itemId: 'currency_gold', quantity: 1000 }
    ],
    rollSkill: (skill) => {
      if (skill === 'Arcana') return 15; // Average roll
      return 10;
    }
  };

  const fireboltRequest: ScribingRequest = {
    spellId: 'firebolt',
    spellLevel: 0,
    spellName: 'Firebolt'
  };

  const fireballRequest: ScribingRequest = {
    spellId: 'fireball',
    spellLevel: 3,
    spellName: 'Fireball'
  };

  it('validates sufficient materials', () => {
    // Level 0 cost: 25gp. Crafter has 1000.
    expect(canScribe(mockCrafter, fireboltRequest)).toBe(true);

    // Level 3 cost: 250gp. Crafter has 1000.
    expect(canScribe(mockCrafter, fireballRequest)).toBe(true);
  });

  it('fails validation if missing parchment', () => {
    const poorCrafter = { ...mockCrafter, inventory: [{ itemId: 'currency_gold', quantity: 1000 }] };
    expect(canScribe(poorCrafter, fireboltRequest)).toBe(false);
  });

  it('fails validation if missing gold', () => {
    const poorCrafter = { ...mockCrafter, inventory: [{ itemId: 'parchment', quantity: 5 }] };
    expect(canScribe(poorCrafter, fireboltRequest)).toBe(false);
  });

  it('consumes materials on success', () => {
    const result = attemptScribe(mockCrafter, fireboltRequest);
    expect(result.success).toBe(true);
    expect(result.consumedMaterials).toHaveLength(2);

    // Check gold consumption (25 for lvl 0)
    const gold = result.consumedMaterials.find(i => i.itemId === 'currency_gold');
    expect(gold?.quantity).toBe(25);

    // Check parchment consumption
    const parchment = result.consumedMaterials.find(i => i.itemId === 'parchment');
    expect(parchment?.quantity).toBe(1);

    expect(result.outputs[0].itemId).toBe('scroll_firebolt');
  });

  it('consumes materials on failure', () => {
    const clumsyCrafter = {
        ...mockCrafter,
        rollSkill: () => 1 // Natural 1
    };

    // DC for lvl 0 is 10. Roll 1 fails.
    const result = attemptScribe(clumsyCrafter, fireboltRequest);
    expect(result.success).toBe(false);
    expect(result.outputs).toHaveLength(0);
    expect(result.consumedMaterials).toHaveLength(2); // Still consumed
  });
});
