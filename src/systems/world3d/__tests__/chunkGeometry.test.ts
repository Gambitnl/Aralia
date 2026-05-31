import { buildPlaceholderHeightfield } from '../chunkGeometry';
import type { ChunkData } from '../types';
import { WORLD3D_CONFIG } from '../config';

const flatChunk = (resolution: number, height: number): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution,
  heights: new Float32Array(resolution * resolution).fill(height),
});

it('produces res*res vertices and (res-1)^2*2 triangles', () => {
  const res = 4;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 0));
  expect(geo.positions).toHaveLength(res * res * 3);
  expect(geo.normals).toHaveLength(res * res * 3);
  expect(geo.indices).toHaveLength((res - 1) * (res - 1) * 6);
});

it('spreads vertices across the chunk world size on x and z', () => {
  const res = 3;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 0));
  // Last vertex x should be CHUNK_WORLD_SIZE; first should be 0.
  const lastIdx = (res * res - 1) * 3;
  expect(geo.positions[0]).toBeCloseTo(0); // x of vertex 0
  expect(geo.positions[lastIdx]).toBeCloseTo(WORLD3D_CONFIG.CHUNK_WORLD_SIZE); // x of last vertex
});

it('maps height 0..100 to 0..MAX_TERRAIN_HEIGHT_M on the y axis', () => {
  const res = 2;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 100));
  // Every vertex y should equal MAX_TERRAIN_HEIGHT_M.
  for (let v = 0; v < res * res; v++) {
    expect(geo.positions[v * 3 + 1]).toBeCloseTo(WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M);
  }
});

it('a flat field yields upward (+Y) normals', () => {
  const res = 4;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 30));
  for (let v = 0; v < res * res; v++) {
    expect(geo.normals[v * 3 + 1]).toBeGreaterThan(0.9); // dominant +Y
  }
});
