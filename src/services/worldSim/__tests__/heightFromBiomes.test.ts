/**
 * @file heightFromBiomes.test.ts
 * Deterministic biome→elevation heightfield (worldsim-service WSS-004 remediation).
 */

import { describe, it, expect } from 'vitest';
import { heightFromBiomes } from '../heightFromBiomes';
import { SEA_LEVEL } from '../constants';

describe('heightFromBiomes', () => {
  it('returns one height per cell (row-major, length cols*rows)', () => {
    const cols = 5;
    const rows = 4;
    const biomeIds = new Array(cols * rows).fill('plains');
    const heights = heightFromBiomes(biomeIds, cols, rows, 1);
    expect(heights).toHaveLength(cols * rows);
  });

  it('produces variance even for a single-biome world (not a flat constant)', () => {
    const cols = 8;
    const rows = 8;
    const biomeIds = new Array(cols * rows).fill('plains');
    const heights = heightFromBiomes(biomeIds, cols, rows, 42);
    expect(new Set(heights).size).toBeGreaterThan(1);
  });

  it('correlates with biome elevation bands: aquatic < low < mid < high', () => {
    const cols = 1;
    const rows = 4;
    // ocean=aquatic, plains=low, highland_plateau=mid, mountain_alpine=high
    const biomeIds = ['ocean', 'plains_prairie', 'highland_plateau', 'mountain_alpine'];
    const [ocean, plains, plateau, mountain] = heightFromBiomes(biomeIds, cols, rows, 7);
    expect(ocean).toBeLessThan(plains);
    expect(plains).toBeLessThan(plateau);
    expect(plateau).toBeLessThan(mountain);
  });

  it('places aquatic biomes below sea level and land biomes above it', () => {
    const cols = 1;
    const rows = 2;
    const [ocean, plains] = heightFromBiomes(['ocean', 'plains_prairie'], cols, rows, 3);
    expect(ocean).toBeLessThan(SEA_LEVEL);
    expect(plains).toBeGreaterThanOrEqual(SEA_LEVEL);
  });

  it('is deterministic for a given seed and varies with the seed', () => {
    const cols = 6;
    const rows = 6;
    const biomeIds = new Array(cols * rows).fill('forest_temperate');
    const a = heightFromBiomes(biomeIds, cols, rows, 100);
    const b = heightFromBiomes(biomeIds, cols, rows, 100);
    const c = heightFromBiomes(biomeIds, cols, rows, 200);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('falls back to the low band for unknown biome ids', () => {
    const heights = heightFromBiomes(['totally-not-a-biome'], 1, 1, 5);
    expect(heights[0]).toBeGreaterThanOrEqual(SEA_LEVEL);
    expect(heights[0]).toBeLessThan(40);
  });

  it('clamps all heights to the 0..100 range', () => {
    const biomeIds = ['ocean', 'mountain_alpine', 'plains', 'wetland_bog'];
    const heights = heightFromBiomes(biomeIds, 4, 1, 9);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(100);
    }
  });
});
