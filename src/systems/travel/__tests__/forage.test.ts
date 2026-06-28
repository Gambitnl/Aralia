import { describe, it, expect } from 'vitest';
import { SeededRandom } from '@/utils/random';
import {
  forageProfileForBiome,
  computeForageYield,
  resolveForage,
  forage,
  MAX_FORAGE_DAYS,
  type ForageProfile,
} from '../forage';

/**
 * R2 — biome-yield forage loop. A Survival (Wisdom) check vs a biome-yield DC
 * produces 0..N resource-days scaled by margin + party size, at a time cost, with
 * a bad-forage hazard roll (poisonous find → a condition, or a wasted outing).
 *
 * The yield + hazard math is a PURE core (`resolveForage` takes the two dice as
 * arguments) so it is exhaustively testable without guessing RNG seeds; `forage`
 * just rolls the dice and delegates.
 */

// A controllable profile for wiring tests (real biomes covered separately).
const profile = (over: Partial<ForageProfile> = {}): ForageProfile => ({
  foodDC: 12,
  waterDC: 14,
  foodAbundance: 2,
  waterAbundance: 2,
  hazardThreshold: 0, // no hazard unless a test asks for it
  ...over,
});

describe('forageProfileForBiome', () => {
  it('makes desert harsher than forest for finding food', () => {
    const desert = forageProfileForBiome('Hot desert');
    const forest = forageProfileForBiome('Temperate deciduous forest');
    expect(desert.foodDC).toBeGreaterThan(forest.foodDC);
    expect(desert.foodAbundance).toBeLessThanOrEqual(forest.foodAbundance);
  });

  it('makes desert especially harsh for finding water', () => {
    expect(forageProfileForBiome('Hot desert').waterDC).toBeGreaterThan(
      forageProfileForBiome('Temperate deciduous forest').waterDC,
    );
  });

  it('falls back to a sane default for an unknown biome name', () => {
    const p = forageProfileForBiome('Nonsense Biome');
    expect(p.foodDC).toBeGreaterThan(0);
    expect(p.waterDC).toBeGreaterThan(0);
  });
});

describe('computeForageYield (pure)', () => {
  it('is the base abundance plus one day per 5 points of margin', () => {
    expect(computeForageYield(0, 2, 1)).toBe(2); // margin 0 → just abundance (solo)
    expect(computeForageYield(5, 2, 1)).toBe(3); // +1 day for 5 margin
    expect(computeForageYield(10, 2, 1)).toBe(4);
  });

  it('rewards more foragers (party size)', () => {
    expect(computeForageYield(0, 2, 4)).toBeGreaterThan(computeForageYield(0, 2, 1));
  });

  it('never exceeds the per-attempt cap', () => {
    expect(computeForageYield(100, 5, 8)).toBe(MAX_FORAGE_DAYS);
  });

  it('guarantees at least one day on a clean success even in a barren biome', () => {
    expect(computeForageYield(0, 0, 1)).toBe(1);
  });
});

describe('resolveForage (pure core)', () => {
  it('yields food on a successful check with no hazard', () => {
    const out = resolveForage(15, 20, { resource: 'food', biome: 'x', partySize: 1, survivalModifier: 2 }, profile());
    // total 17 vs DC 12 → success, margin 5 → abundance 2 + 1
    expect(out.check.success).toBe(true);
    expect(out.check.margin).toBe(5);
    expect(out.resourceDaysGained).toBe(3);
    expect(out.hazard).toBeNull();
  });

  it('yields nothing and no poison on a failed check (the wasted time is the cost)', () => {
    const out = resolveForage(3, 20, { resource: 'food', biome: 'x', partySize: 1, survivalModifier: 0 }, profile());
    expect(out.check.success).toBe(false);
    expect(out.resourceDaysGained).toBe(0);
    expect(out.hazard).toBeNull();
  });

  it('returns a tainted find (0 days) when a hazard roll trips on a success', () => {
    const out = resolveForage(18, 1, { resource: 'food', biome: 'x', partySize: 4, survivalModifier: 3 }, profile({ hazardThreshold: 5 }));
    expect(out.check.success).toBe(true);
    expect(out.resourceDaysGained).toBe(0);
    expect(out.hazard).toBe('tainted');
  });

  it('returns a wasted outing when a hazard roll trips on a failure', () => {
    const out = resolveForage(2, 1, { resource: 'food', biome: 'x', partySize: 1, survivalModifier: 0 }, profile({ hazardThreshold: 5 }));
    expect(out.check.success).toBe(false);
    expect(out.resourceDaysGained).toBe(0);
    expect(out.hazard).toBe('wasted');
  });

  it('uses the water DC + water abundance when foraging for water', () => {
    const out = resolveForage(14, 20, { resource: 'water', biome: 'x', partySize: 1, survivalModifier: 0 }, profile({ waterDC: 14, waterAbundance: 1 }));
    expect(out.check.dc).toBe(14);
    expect(out.check.success).toBe(true);
    expect(out.resourceDaysGained).toBe(1); // abundance 1, margin 0
  });

  it('costs more time in a harsher (higher-DC) biome', () => {
    const easy = resolveForage(20, 20, { resource: 'food', biome: 'x', partySize: 1, survivalModifier: 0 }, profile({ foodDC: 8 }));
    const hard = resolveForage(20, 20, { resource: 'food', biome: 'x', partySize: 1, survivalModifier: 0 }, profile({ foodDC: 18 }));
    expect(hard.timeCostMinutes).toBeGreaterThan(easy.timeCostMinutes);
    expect(easy.timeCostMinutes).toBeGreaterThan(0);
  });
});

describe('forage (rng wrapper)', () => {
  it('is deterministic for the same seed', () => {
    const attempt = { resource: 'food' as const, biome: 'Grassland', partySize: 3, survivalModifier: 4 };
    const a = forage(attempt, new SeededRandom(12345));
    const b = forage(attempt, new SeededRandom(12345));
    expect(a).toEqual(b);
  });

  it('rolls a d20 in [1,20] for the check', () => {
    const out = forage({ resource: 'food', biome: 'Grassland', partySize: 1, survivalModifier: 0 }, new SeededRandom(7));
    expect(out.check.d20).toBeGreaterThanOrEqual(1);
    expect(out.check.d20).toBeLessThanOrEqual(20);
  });
});
