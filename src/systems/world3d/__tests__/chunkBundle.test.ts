import { buildChunkBundle } from '../chunkBundle';
import type { ChunkData } from '../types';

const forestChunk = (): ChunkData => ({
  cx: 1,
  cy: 1,
  resolution: 6,
  heights: new Float32Array(36).fill(45),
  biomeIds: new Array(36).fill('forest'),
  rivers: [{ points: [{ x: 0.13, y: 0.14 }, { x: 0.2, y: 0.14 }], width: [0.01, 0.01] }],
  roads: [],
  sites: [],
});

it('assembles a bundle with terrain always present', () => {
  const bundle = buildChunkBundle(forestChunk());
  expect(bundle.cx).toBe(1);
  expect(bundle.cy).toBe(1);
  expect(bundle.terrain.positions.length).toBe(6 * 6 * 3);
  expect(bundle.terrain.colors.length).toBe(6 * 6 * 3);
  expect(bundle.sites).toEqual([]);
});

it('includes water when rivers cross and vegetation on forest', () => {
  const bundle = buildChunkBundle(forestChunk());
  expect(bundle.water).toBeDefined();
  expect(bundle.water!.positions.length).toBeGreaterThan(0);
  expect(bundle.vegetation).toBeDefined();
  expect(bundle.vegetation!.positions.length).toBeGreaterThan(0);
});
