import { describe, it, expect } from 'vitest';
import { provisionWeight, inventoryWeight, encumbranceSpeedFactor } from '../provisionEncumbrance';
import { RATIONS_ITEM_ID, WATER_ITEM_ID } from '../provisioning';
import type { Item } from '@/types/items';

/**
 * E3 — food/water weight ↔ encumbrance ↔ travel speed.
 *
 * Lives in its own module (not provisioning.ts) so Fork 3 can build it without
 * touching files other live sessions are concurrently editing on the shared tree.
 */
const ration = (q: number, weight = 2): Item =>
  ({ id: RATIONS_ITEM_ID, name: 'Rations', description: '', type: 'food_drink', quantity: q, weight }) as Item;
const water = (q: number, weight = 5): Item =>
  ({ id: WATER_ITEM_ID, name: 'Waterskin', description: '', type: 'food_drink', quantity: q, weight }) as Item;
const sword = { id: 'sword', name: 'Sword', description: '', type: 'weapon', weight: 3 } as Item;

describe('provisionWeight', () => {
  it('sums rations + water weight scaled by stack, excluding other gear', () => {
    expect(provisionWeight([ration(4), water(3), sword])).toBe(4 * 2 + 3 * 5); // 23
  });
  it('treats missing weight as 0 and missing quantity as 1', () => {
    expect(provisionWeight([{ id: RATIONS_ITEM_ID, name: 'R', description: '', type: 'food_drink' } as Item])).toBe(0);
  });
});

describe('inventoryWeight', () => {
  it('totals every item including non-provisions', () => {
    expect(inventoryWeight([ration(2), sword])).toBe(2 * 2 + 3); // 7
  });
});

describe('encumbranceSpeedFactor', () => {
  it('is full speed within the encumbered threshold', () => {
    expect(encumbranceSpeedFactor(40, 75, 150)).toBe(1);
  });
  it('drops to two-thirds when encumbered', () => {
    expect(encumbranceSpeedFactor(100, 75, 150)).toBeCloseTo(2 / 3, 5);
  });
  it('drops to one-third when heavily encumbered', () => {
    expect(encumbranceSpeedFactor(200, 75, 150)).toBeCloseTo(1 / 3, 5);
  });
  it('never gates when capacity is unknown (zero thresholds)', () => {
    expect(encumbranceSpeedFactor(200, 0, 0)).toBe(1);
  });
});
