import { buildTerrainMesh } from '../chunkGeometry';
import type { ChunkData } from '../types';

const chunk = (res: number, biome: string): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: res,
  heights: new Float32Array(res * res).fill(40),
  biomeIds: new Array(res * res).fill(biome),
  rivers: [],
  roads: [],
  sites: [],
});

it('produces a colors buffer parallel to positions', () => {
  const res = 4;
  const mesh = buildTerrainMesh(chunk(res, 'forest'));
  expect(mesh.positions).toHaveLength(res * res * 3);
  expect(mesh.colors).toHaveLength(res * res * 3);
  expect(mesh.indices).toHaveLength((res - 1) * (res - 1) * 6);
});

it('tints forest vertices green-dominant', () => {
  const mesh = buildTerrainMesh(chunk(3, 'forest'));
  const r = mesh.colors[0], g = mesh.colors[1], b = mesh.colors[2];
  expect(g).toBeGreaterThan(r);
  expect(g).toBeGreaterThan(b);
});
