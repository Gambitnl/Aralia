import { buildTerrainMesh, terrainVertexCount, skirtTriangleCount } from '../chunkGeometry';
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

it('produces a colors buffer parallel to positions (including the skirt)', () => {
  const res = 4;
  const mesh = buildTerrainMesh(chunk(res, 'forest'));
  // Terrain meshes carry a perimeter skirt by default to hide mixed-LOD seams.
  const verts = terrainVertexCount(res, true);
  expect(mesh.positions).toHaveLength(verts * 3);
  expect(mesh.colors).toHaveLength(verts * 3);
  expect(mesh.indices).toHaveLength(((res - 1) * (res - 1) * 2 + skirtTriangleCount(res)) * 3);
});

it('omits the skirt when skirtDepth is 0', () => {
  const res = 4;
  const mesh = buildTerrainMesh(chunk(res, 'forest'), { skirtDepth: 0 });
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

it('uses precomputed per-vertex biome colors when available', () => {
  const res = 4;
  const data = chunk(res, 'plains');
  const override = new Float32Array([
    0.1, 0.2, 0.3,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
    1.0, 0.9, 0.8,

    0.1, 0.2, 0.3,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
    1.0, 0.9, 0.8,

    0.1, 0.2, 0.3,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
    1.0, 0.9, 0.8,

    0.1, 0.2, 0.3,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
    1.0, 0.9, 0.8,
  ]);
  const mesh = buildTerrainMesh({ ...data, biomeColors: override });
  expect(mesh.colors.slice(0, 3)).toEqual(new Float32Array([0.1, 0.2, 0.3]));
  expect(mesh.colors[3]).toBeCloseTo(0.4);
  // Last *base* vertex color (skirt colors are appended after the base grid).
  expect(mesh.colors[res * res * 3 - 1]).toBeCloseTo(0.8);
});
