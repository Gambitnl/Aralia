import { describe, it, expect } from 'vitest';
import {
  landSpeedFactor, landDanger, routeVisibility, navDC, navCause,
  buildRouteCellTiers, climbFactorFor,
} from '../routeTerrain';
import {
  BIOME_SPEED_FACTOR, ROAD_TIER_SPEED, ROAD_TIER_DANGER_MULT,
} from '../roadTunables';

describe('landSpeedFactor', () => {
  it('grades off-road speed by biome (forest slower than plains)', () => {
    expect(landSpeedFactor('Grassland', null)).toBe(1.0);
    expect(landSpeedFactor('Temperate deciduous forest', null)).toBe(0.75);
    expect(landSpeedFactor('Wetland', null)).toBe(0.45);
    expect(landSpeedFactor('', null)).toBe(1.0); // unknown biome = open ground
  });
  it('highway and road ignore the biome penalty entirely', () => {
    expect(landSpeedFactor('Temperate rainforest', 'highway')).toBe(ROAD_TIER_SPEED.highway);
    expect(landSpeedFactor('Wetland', 'road')).toBe(ROAD_TIER_SPEED.road);
  });
  it('trail softens half the biome penalty, path softens a quarter', () => {
    // trail through deciduous forest: 1.1 * lerp(0.75, 1, 0.5) = 1.1 * 0.875
    expect(landSpeedFactor('Temperate deciduous forest', 'trail')).toBeCloseTo(1.1 * 0.875, 10);
    // path through deciduous forest: 1.0 * lerp(0.75, 1, 0.25) = 0.8125
    expect(landSpeedFactor('Temperate deciduous forest', 'path')).toBeCloseTo(0.8125, 10);
  });
  it('a road is never slower than walking the same biome off-road', () => {
    for (const biome of Object.keys(BIOME_SPEED_FACTOR)) {
      for (const tier of ['highway', 'road', 'trail', 'path'] as const) {
        expect(landSpeedFactor(biome, tier)).toBeGreaterThanOrEqual(landSpeedFactor(biome, null));
      }
    }
  });
});

describe('landDanger', () => {
  it('keeps the existing biome baseline off-road', () => {
    expect(landDanger('Grassland', null)).toBe(0.2);
    expect(landDanger('Glacier', null)).toBe(0.6);
    expect(landDanger('', null)).toBe(0.25); // default
  });
  it('scales danger down by tier (busier road = safer)', () => {
    expect(landDanger('Grassland', 'highway')).toBeCloseTo(0.2 * ROAD_TIER_DANGER_MULT.highway, 10);
    expect(landDanger('Grassland', 'path')).toBeCloseTo(0.2 * ROAD_TIER_DANGER_MULT.path, 10);
  });
});

// Edge-level climb cost (2026-07-11 mountains): ascents slow travel far more
// than descents, and engineered tiers soften the grade (switchbacks) BEFORE
// the rate applies — the asymmetry that makes passes the fast way through.
describe('climbFactorFor (2026-07-11 mountains)', () => {
  it('flat ground costs nothing, on or off a route', () => {
    expect(climbFactorFor(0, null)).toBe(1);
    expect(climbFactorFor(0, 'highway')).toBe(1);
  });

  it('climbing costs ~3× more than descending the same slope (asymmetry)', () => {
    expect(climbFactorFor(10, null)).toBeCloseTo(1 / 1.5, 6);    // +10h ascent ≈ 0.667
    expect(climbFactorFor(-10, null)).toBeCloseTo(1 / 1.15, 6);  // −10h descent ≈ 0.870
    expect(climbFactorFor(10, null)).toBeLessThan(climbFactorFor(-10, null));
  });

  it('engineered grades soften Δh: maintained tiers halve it, trails 3/4, paths feel it all', () => {
    expect(climbFactorFor(10, 'highway')).toBeCloseTo(1 / 1.25, 6); // Δh 10 → 5 → 0.8
    expect(climbFactorFor(10, 'road')).toBeCloseTo(1 / 1.25, 6);    // roads grade like highways
    expect(climbFactorFor(10, 'trail')).toBeCloseTo(1 / 1.375, 6);  // Δh 10 → 7.5
    expect(climbFactorFor(10, 'path')).toBeCloseTo(climbFactorFor(10, null), 10); // no engineering
  });

  it('softening applies on descents too (graded roads brake less)', () => {
    expect(climbFactorFor(-10, 'road')).toBeCloseTo(1 / 1.075, 6); // Δh −10 → −5
  });
});

describe('routeVisibility / navDC / navCause', () => {
  it('paths fade in forest and vanish in deep forest', () => {
    expect(routeVisibility('Grassland', 'path')).toBe('visible');
    expect(routeVisibility('Temperate deciduous forest', 'path')).toBe('faint');
    expect(routeVisibility('Taiga', 'path')).toBe('overgrown');
  });
  it('trails fade only in deep forest; roads and highways never fade', () => {
    expect(routeVisibility('Temperate deciduous forest', 'trail')).toBe('visible');
    expect(routeVisibility('Tropical rainforest', 'trail')).toBe('faint');
    expect(routeVisibility('Tropical rainforest', 'road')).toBe('visible');
    expect(routeVisibility('Taiga', 'highway')).toBe('visible');
  });
  it('navigation DC ladder: maintained roads 0; paths climb with forest density', () => {
    expect(navDC('Grassland', 'highway')).toBe(0);
    expect(navDC('Taiga', 'road')).toBe(0);
    expect(navDC('Grassland', 'trail')).toBe(0);
    expect(navDC('Temperate rainforest', 'trail')).toBe(5);
    expect(navDC('Grassland', 'path')).toBe(5);
    expect(navDC('Temperate deciduous forest', 'path')).toBe(8);
    expect(navDC('Taiga', 'path')).toBe(12);
    // Off-road keeps today's values: open 5, difficult 15.
    expect(navDC('Grassland', null)).toBe(5);
    expect(navDC('Wetland', null)).toBe(15);
  });
  it('names the cause for player-facing messaging', () => {
    expect(navCause('Grassland', 'road')).toBe('road');
    expect(navCause('Temperate deciduous forest', 'path')).toBe('faint-path');
    expect(navCause('Wetland', null)).toBe('wilds');
  });
});

describe('buildRouteCellTiers', () => {
  it('reads generated routes that carry only points (the inert-roads bug)', () => {
    const pack = {
      routes: [
        { group: 'roads', points: [[0, 0, 10], [1, 0, 11], [2, 0, 12]] },
        { group: 'trails', points: [[0, 1, 12], [1, 1, 13]] },
      ],
    };
    const tiers = buildRouteCellTiers(pack);
    expect(tiers.get(10)).toBe('road');
    expect(tiers.get(13)).toBe('trail');
    // Overlap keeps the better tier: cell 12 is on both a road and a trail.
    expect(tiers.get(12)).toBe('road');
  });
  it('maps every land group and ignores searoutes', () => {
    const pack = {
      routes: [
        { group: 'highways', points: [[0, 0, 1]] },
        { group: 'paths', points: [[0, 0, 2]] },
        { group: 'searoutes', points: [[0, 0, 3]] },
        { group: 'roads', cells: [4] }, // legacy `cells` shape still honored
      ],
    };
    const tiers = buildRouteCellTiers(pack);
    expect(tiers.get(1)).toBe('highway');
    expect(tiers.get(2)).toBe('path');
    expect(tiers.has(3)).toBe(false);
    expect(tiers.get(4)).toBe('road');
  });
});
