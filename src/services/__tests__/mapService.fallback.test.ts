/**
 * @file mapService.fallback.test.ts
 * @description Integration proof for worldsim-service WSS-004 remediation. Forces the Azgaar
 * generation path to throw so `generateMap` takes its real legacy fallback, then asserts the
 * produced world is NOT a flat pancake: heights vary (biome-derived relief) and provenance is
 * recorded. This exercises the exact production defect path end-to-end.
 */

import { describe, it, expect, vi } from 'vitest';

// Force the primary path to fail so generateMap falls back to the legacy generator.
vi.mock('../azgaarDerivedMapService', () => ({
  generateAzgaarDerivedMap: () => {
    throw new Error('forced azgaar failure (test)');
  },
}));

import { generateMap } from '../mapService';
import { BIOMES } from '../../constants';

describe('generateMap legacy fallback (WSS-004 remediation)', () => {
  it('produces a heightfield with relief (not a flat constant) and records provenance', () => {
    const map = generateMap(24, 32, {}, BIOMES, 13579);

    expect(map.worldData).toBeDefined();
    expect(map.generation?.source).toBe('legacy-fallback');
    expect(map.generation?.reason).toMatch(/forced azgaar failure/);

    const heights = map.worldData!.heights;
    const distinct = new Set(heights).size;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    // Empirical numbers surfaced in test output as evidence.
    // eslint-disable-next-line no-console
    console.log(
      `[WSS-004 proof] legacy-fallback heights: distinct=${distinct} min=${min} max=${max} cells=${heights.length}`,
    );

    expect(distinct).toBeGreaterThan(1); // the defect was a single constant value (30)
    expect(max).toBeGreaterThan(min);
  });

  it('legacy fallback is deterministic for a given seed', () => {
    const a = generateMap(20, 20, {}, BIOMES, 24680);
    const b = generateMap(20, 20, {}, BIOMES, 24680);
    expect(a.worldData!.heights).toEqual(b.worldData!.heights);
  });
});
