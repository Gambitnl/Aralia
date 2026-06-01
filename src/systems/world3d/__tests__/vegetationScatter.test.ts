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
