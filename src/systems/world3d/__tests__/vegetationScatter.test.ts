import { buildVegetationScatter } from '../vegetationScatter';
import { WORLD3D_CONFIG } from '../config';
import type { ChunkData } from '../types';

it('never emits more instances than MAX_VEGETATION_PER_CHUNK', () => {
  const data: ChunkData = {
    cx: 1, cy: 1, resolution: 32,
    heights: new Float32Array(32 * 32).fill(50),
    biomeIds: new Array(32 * 32).fill('forest'),
    rivers: [], roads: [], sites: [],
  };
  const veg = buildVegetationScatter(data);
  expect(veg.positions.length / 3).toBeLessThanOrEqual(WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK);
});

const chunk = (biome: string): ChunkData => ({
  cx: 2,
  cy: 3,
  resolution: 8,
  heights: new Float32Array(64).fill(40),
  biomeIds: new Array(64).fill(biome),
  rivers: [],
  roads: [],
  sites: [],
});

it('scatters instances on forest chunks', () => {
  const veg = buildVegetationScatter(chunk('forest'));
  expect(veg.positions.length).toBeGreaterThan(0);
  expect(veg.positions.length % 3).toBe(0);
  const instances = veg.positions.length / 3;
  expect(veg.scales).toHaveLength(instances);
  expect(veg.rotations).toHaveLength(instances);
});

it('produces no vegetation on ocean chunks', () => {
  const veg = buildVegetationScatter(chunk('ocean'));
  expect(veg.positions).toHaveLength(0);
});

it('is deterministic for the same chunk coords + data', () => {
  const a = buildVegetationScatter(chunk('forest'));
  const b = buildVegetationScatter(chunk('forest'));
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  expect(Array.from(a.rotations)).toEqual(Array.from(b.rotations));
});

it('reuses cached geometry transforms when chunk payload is identical', () => {
  const first = buildVegetationScatter(chunk('forest'));
  const second = buildVegetationScatter(chunk('forest'));
  expect(second.positions).toBe(first.positions);
  expect(second.scales).toBe(first.scales);
  expect(second.rotations).toBe(first.rotations);
  expect(second.cacheKey).toBe(first.cacheKey);
});

it('invalidates cache entries when vegetated cell data changes', () => {
  const a = chunk('forest');
  const first = buildVegetationScatter(a);

  a.biomeIds[0] = 'ocean';
  const second = buildVegetationScatter(a);

  expect(second.positions).not.toBe(first.positions);
  expect(second.cacheKey).not.toBe(first.cacheKey);
});

// ── Stage 2: the surface gate (WorldClaw) ───────────────────────────────────

import { WORLD3D_CONFIG as CFG, heightToMeters as toM } from '../config';

const RES = 33;

/** A chunk whose heights come from a function of (col, row). */
const terrain = (biome: string, h: (i: number, j: number) => number, cx = 40): ChunkData => {
  const heights = new Float32Array(RES * RES);
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) heights[j * RES + i] = h(i, j);
  return {
    cx, cy: 9, resolution: RES, heights,
    biomeIds: new Array(RES * RES).fill(biome),
    rivers: [], roads: [], sites: [],
  };
};

/** A linear ramp across the chunk whose RENDERED angle is `slopeDeg`. */
const ramp = (slopeDeg: number) => {
  const riseM = Math.tan((slopeDeg * Math.PI) / 180) * CFG.CHUNK_WORLD_SIZE;
  const units = (riseM / (toM(100) - toM(0))) * 100;
  return (i: number) => 40 + units * (i / (RES - 1));
};

it('reports a gate tally on every build', () => {
  const veg = buildVegetationScatter(terrain('forest', () => 45, 41));
  expect(veg.gateStats).toBeDefined();
  expect(veg.gateStats!.considered).toBe(veg.gateStats!.kept + veg.gateStats!.rejected);
});

it('keeps trees on flat and gentle ground', () => {
  for (const [slope, cx] of [[0, 42], [8, 43], [20, 44]] as Array<[number, number]>) {
    const veg = buildVegetationScatter(terrain('forest', ramp(slope), cx));
    expect(veg.gateStats!.rejected).toBe(0);
    expect(veg.positions.length).toBeGreaterThan(0);
  }
});

it('puts NO tree on a cliff face', () => {
  const veg = buildVegetationScatter(terrain('forest', ramp(60), 45));
  expect(veg.gateStats!.considered).toBeGreaterThan(0);
  expect(veg.gateStats!.byReason['too-steep']).toBe(veg.gateStats!.considered);
  expect(veg.positions.length).toBe(0);
});

it('rejects a cliff-edge candidate at the chunk SEAM too (no half-gradient rim)', () => {
  // A clamped edge gradient would halve the slope at i=0 and i=RES-1 and leave
  // a rim of trees along the chunk border.
  const veg = buildVegetationScatter(terrain('forest', ramp(50), 46));
  expect(veg.gateStats!.rejectionRate).toBe(1);
});

it('rejects above the treeline and below the shoreline', () => {
  const high = buildVegetationScatter(terrain('forest', () => 90, 47));
  expect(high.gateStats!.byReason['too-high']).toBe(high.gateStats!.considered);
  const low = buildVegetationScatter(terrain('forest', () => 10, 48));
  expect(low.gateStats!.byReason['too-low']).toBe(low.gateStats!.considered);
});

it('gates a swamp tighter than a forest on the same slope', () => {
  const slope = ramp(20);
  const forest = buildVegetationScatter(terrain('forest', slope, 49));
  const swamp = buildVegetationScatter(terrain('swamp', slope, 50));
  expect(forest.gateStats!.rejectionRate).toBe(0);
  expect(swamp.gateStats!.rejectionRate).toBe(1);
});

it('tilts a tree only slightly toward the normal', () => {
  const veg = buildVegetationScatter(terrain('forest', ramp(20), 51));
  expect(veg.tilts!.length).toBe(veg.positions.length / 3);
  expect(veg.tiltAxes!.length).toBe((veg.positions.length / 3) * 2);
  for (let i = 0; i < veg.tilts!.length; i++) {
    // The forest gate caps the lean at 7 degrees.
    expect(veg.tilts![i]).toBeGreaterThan(0);
    expect(veg.tilts![i]).toBeLessThanOrEqual((7 * Math.PI) / 180 + 1e-9);
    expect(Math.hypot(veg.tiltAxes![i * 2], veg.tiltAxes![i * 2 + 1])).toBeCloseTo(1, 6);
  }
});

it('stands a tree on flat ground perfectly upright', () => {
  const veg = buildVegetationScatter(terrain('forest', () => 45, 52));
  for (const t of veg.tilts!) expect(t).toBe(0);
});

it('sits a tree ON the sloped surface it stands on, not on the lattice vertex', () => {
  // Stage 1 reused the lattice vertex height, so a jittered instance floated
  // above (or sank into) the ground before any slope work.
  const slopeDeg = 20;
  const veg = buildVegetationScatter(terrain('forest', ramp(slopeDeg), 53));
  const riseMPerM = Math.tan((slopeDeg * Math.PI) / 180);
  for (let n = 0; n < veg.positions.length / 3; n++) {
    const x = veg.positions[n * 3];
    const y = veg.positions[n * 3 + 1];
    const expectedGroundM = toM(40) + x * riseMPerM;
    // Below the surface only by the sink depth, never above it.
    expect(y).toBeLessThanOrEqual(expectedGroundM + 0.05);
    expect(expectedGroundM - y).toBeLessThan(1);
  }
});

it('stays deterministic with the gate applied', () => {
  const a = buildVegetationScatter(terrain('forest', ramp(15), 54));
  const b = buildVegetationScatter(terrain('forest', ramp(15), 54));
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  expect(Array.from(a.tilts!)).toEqual(Array.from(b.tilts!));
});
