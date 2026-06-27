import { describe, expect, it } from 'vitest';

import {
  RATIONS_ITEM_ID,
  WATER_ITEM_ID,
  daysOfFood,
  daysOfWater,
  resourceDays,
  dailyNeed,
  foodRangeDays,
  tripDaysFromMinutes,
  provisionStatusForTrip,
  terrainBurnFactor,
  meanBurnMultiplier,
  bindingRangeDays,
  provisionStatusMulti,
} from '../provisioning';
import type { Item } from '@/types/items';

/**
 * Tests for the travel-provisioning foundation.
 *
 * The first accepted slice only proves inventory-to-ration-day counting. Later
 * slices can add daily need, trip range, and UI gating without changing this
 * contract.
 */

function ration(quantity?: number): Item {
  return {
    id: RATIONS_ITEM_ID,
    name: 'Rations',
    description: '',
    type: 'food_drink',
    ...(quantity === undefined ? {} : { quantity }),
  } as Item;
}

describe('daysOfFood', () => {
  it('sums ration-days across all rations stacks in inventory', () => {
    expect(daysOfFood([ration(3), ration(2)])).toBe(5);
  });

  it('ignores non-ration items', () => {
    const sword = { id: 'sword', name: 'Sword', description: '', type: 'weapon' } as Item;

    expect(daysOfFood([ration(4), sword])).toBe(4);
  });

  it('treats a ration stack with no quantity as 1 day', () => {
    expect(daysOfFood([ration()])).toBe(1);
  });

  it('is 0 for an empty inventory', () => {
    expect(daysOfFood([])).toBe(0);
  });
});

describe('dailyNeed', () => {
  it('is one ration per consumer at full rations', () => {
    expect(dailyNeed(4, 'full')).toBe(4);
  });

  it('halves consumption (rounded up) on half rations', () => {
    expect(dailyNeed(4, 'half')).toBe(2);
    expect(dailyNeed(3, 'half')).toBe(2); // ceil(1.5)
  });

  it('is 0 for an empty party (defensive — no gate)', () => {
    expect(dailyNeed(0, 'full')).toBe(0);
  });
});

describe('foodRangeDays', () => {
  it('is days of food divided by per-day need, floored', () => {
    expect(foodRangeDays(10, 4, 'full')).toBe(2); // floor(10/4)
    expect(foodRangeDays(10, 4, 'half')).toBe(5); // floor(10/2)
  });

  it('is Infinity when there are no consumers', () => {
    expect(foodRangeDays(0, 0, 'full')).toBe(Infinity);
  });
});

describe('tripDaysFromMinutes', () => {
  it('rounds partial days up to whole travel-days', () => {
    expect(tripDaysFromMinutes(60)).toBe(1); // 1h -> 1 day
    expect(tripDaysFromMinutes(24 * 60)).toBe(1); // exactly 1 day
    expect(tripDaysFromMinutes(25 * 60)).toBe(2); // spills into day 2
  });

  it('is 0 for a zero-length trip', () => {
    expect(tripDaysFromMinutes(0)).toBe(0);
  });
});

describe('provisionStatusForTrip', () => {
  const opts = (tripDays: number, days: number, consumers: number, mode: 'full' | 'half' = 'full') =>
    provisionStatusForTrip({ tripDays, daysOfFood: days, consumers, mode });

  it('is in range when food covers the whole trip', () => {
    expect(opts(2, 10, 4)).toEqual({
      inRange: true,
      shortfallDays: 0,
      severity: 'none',
      foodRangeDays: 2,
      tripDays: 2,
    });
  });

  it('flags a minor shortfall (<= one third of the trip)', () => {
    const s = opts(6, 10, 2); // range 5, trip 6 -> short 1 of 6
    expect(s.inRange).toBe(false);
    expect(s.shortfallDays).toBe(1);
    expect(s.severity).toBe('minor');
  });

  it('flags a major shortfall (> one third of the trip)', () => {
    const s = opts(6, 2, 2); // range 1, trip 6 -> short 5 of 6
    expect(s.inRange).toBe(false);
    expect(s.shortfallDays).toBe(5);
    expect(s.severity).toBe('major');
  });

  it('never gates an empty party', () => {
    const s = opts(9, 0, 0);
    expect(s.inRange).toBe(true);
    expect(s.severity).toBe('none');
  });

  it('never gates a zero-day trip', () => {
    expect(opts(0, 0, 4).inRange).toBe(true);
  });
});

// ── v1.1 extensions ────────────────────────────────────────────────────────

function water(quantity?: number): Item {
  return {
    id: WATER_ITEM_ID,
    name: 'Waterskin (1 day)',
    description: '',
    type: 'food_drink',
    ...(quantity === undefined ? {} : { quantity }),
  } as Item;
}

describe('resourceDays / daysOfWater (E1: generic resource)', () => {
  it('counts ration-days for an arbitrary resource id', () => {
    expect(resourceDays([water(3), water(2)], WATER_ITEM_ID)).toBe(5);
  });

  it('daysOfWater ignores food and vice-versa', () => {
    const inv = [ration(4), water(2)];
    expect(daysOfFood(inv)).toBe(4);
    expect(daysOfWater(inv)).toBe(2);
  });
});

describe('dailyNeed with terrain burn multiplier (E2)', () => {
  it('raises per-day need by the burn multiplier, rounded up', () => {
    expect(dailyNeed(4, 'full', 1.5)).toBe(6); // 4 * 1.5
    expect(dailyNeed(3, 'full', 1.2)).toBe(4); // ceil(3.6)
  });

  it('defaults to a 1× multiplier (back-compat)', () => {
    expect(dailyNeed(4, 'full')).toBe(4);
  });
});

describe('foodRangeDays with burn multiplier (E2)', () => {
  it('shrinks range as terrain burns more per day', () => {
    expect(foodRangeDays(12, 4, 'full', 1.5)).toBe(2); // need 6/day -> floor(12/6)
  });
});

describe('terrainBurnFactor (E2)', () => {
  it('burns more food on difficult terrain', () => {
    expect(terrainBurnFactor('road', 'food')).toBe(1);
    expect(terrainBurnFactor('difficult', 'food')).toBe(1.5);
  });

  it('burns more water on open and difficult terrain', () => {
    expect(terrainBurnFactor('open', 'water')).toBeGreaterThan(1);
    expect(terrainBurnFactor('difficult', 'water')).toBeGreaterThan(
      terrainBurnFactor('open', 'water'),
    );
  });
});

describe('meanBurnMultiplier (E2)', () => {
  it('time-weights the per-step burn factors', () => {
    // 1 day at 1.0 and 1 day at 2.0 -> 1.5
    expect(meanBurnMultiplier([{ minutes: 1440, burn: 1 }, { minutes: 1440, burn: 2 }])).toBe(1.5);
  });

  it('is 1 for an empty route (defensive)', () => {
    expect(meanBurnMultiplier([])).toBe(1);
  });
});

describe('bindingRangeDays (E1: binding resource)', () => {
  it('returns the smaller range and names the binding resource', () => {
    const r = bindingRangeDays(4, 'full', [
      { resource: 'food', days: 20 }, // range 5
      { resource: 'water', days: 8 }, // range 2  <-- binds
    ]);
    expect(r.rangeDays).toBe(2);
    expect(r.binding).toBe('water');
  });

  it('honors per-resource burn multipliers', () => {
    const r = bindingRangeDays(4, 'full', [
      { resource: 'food', days: 20, burnMultiplier: 1 }, // range 5
      { resource: 'water', days: 20, burnMultiplier: 2 }, // need 8/day -> range 2 binds
    ]);
    expect(r.rangeDays).toBe(2);
    expect(r.binding).toBe('water');
  });
});

describe('provisionStatusMulti (E1 + R1)', () => {
  it('gates on the binding resource', () => {
    const s = provisionStatusMulti({
      tripDays: 4,
      consumers: 4,
      mode: 'full',
      supplies: [
        { resource: 'food', days: 40 }, // range 10
        { resource: 'water', days: 8 }, // range 2 binds
      ],
    });
    expect(s.inRange).toBe(false);
    expect(s.foodRangeDays).toBe(2);
    expect(s.binding).toBe('water');
    expect(s.shortfallDays).toBe(2);
  });
});
