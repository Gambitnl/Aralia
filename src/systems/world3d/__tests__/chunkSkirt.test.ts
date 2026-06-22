/**
 * @file chunkSkirt.test.ts
 * @description Regression coverage for the per-LOD skirt geometry (W3D-G10 / T7).
 * Mixed-resolution chunks (full/mid/low) sample the heightfield at different
 * densities; a downward perimeter skirt hides the crack between neighbors. These
 * tests lock the skirt's vertex/triangle counts, its downward offset, and that
 * every LOD tier carries one so any seam is covered.
 */

import {
  buildPlaceholderHeightfield,
  buildTerrainMesh,
  skirtVertexCount,
  skirtTriangleCount,
  terrainVertexCount,
} from '../chunkGeometry';
import { WORLD3D_CONFIG, heightToMeters, resolutionForLod } from '../config';
import type { ChunkData } from '../types';

const flatChunk = (resolution: number, height: number): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution,
  heights: new Float32Array(resolution * resolution).fill(height),
  biomeIds: new Array(resolution * resolution).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('appends the expected skirt vertex and triangle counts when skirtDepth > 0', () => {
  const res = 5;
  const depth = 50;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 30), { skirtDepth: depth });
  expect(geo.positions.length / 3).toBe(res * res + skirtVertexCount(res));
  expect(geo.indices.length).toBe(((res - 1) * (res - 1) * 2 + skirtTriangleCount(res)) * 3);
});

it('drops each skirt vertex exactly skirtDepth below its source edge vertex', () => {
  const res = 4;
  const depth = 50;
  const height = 20;
  const geo = buildPlaceholderHeightfield(flatChunk(res, height), { skirtDepth: depth });
  const base = res * res;
  const topY = heightToMeters(height);
  for (let k = 0; k < skirtVertexCount(res); k++) {
    const o = (base + k) * 3;
    // Lowered by exactly skirtDepth (flat chunk → all edges at topY).
    expect(geo.positions[o + 1]).toBeCloseTo(topY - depth);
    // Skirt vertices live on the chunk perimeter (x or z on an edge).
    const x = geo.positions[o];
    const z = geo.positions[o + 2];
    const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
    const onEdge = x === 0 || x === S || z === 0 || z === S;
    expect(onEdge).toBe(true);
  }
});

it('every LOD tier produces a skirted mesh whose skirt clears the seam depth', () => {
  // Build a chunk at each tier's resolution. A flat chunk has zero relief, so the
  // adaptive skirt depth collapses to SKIRT_MIN_DEPTH_M — a known, checkable value.
  const tiers = ['full', 'mid', 'low'] as const;
  let prevBaseVerts = Infinity;
  for (const tier of tiers) {
    const res = resolutionForLod(tier);
    const mesh = buildTerrainMesh(flatChunk(res, 40));
    // Carries a skirt.
    expect(mesh.positions.length / 3).toBe(terrainVertexCount(res, true));
    // Coarser tiers have strictly fewer base vertices (the whole point of LOD).
    expect(res * res).toBeLessThan(prevBaseVerts);
    prevBaseVerts = res * res;
    // Skirt bottom sits at least SKIRT_MIN_DEPTH_M below the (flat) surface, so a
    // neighbor at any tier can't leave a visible gap above the skirt wall.
    const surfaceY = heightToMeters(40);
    let minY = Infinity;
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      minY = Math.min(minY, mesh.positions[v * 3 + 1]);
    }
    expect(surfaceY - minY).toBeGreaterThanOrEqual(WORLD3D_CONFIG.SKIRT_MIN_DEPTH_M - 1e-6);
  }
});
