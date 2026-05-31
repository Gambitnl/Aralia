/**
 * @file vegetationScatter.ts
 * Deterministic instanced vegetation. For each vertex on a vegetated biome, emit
 * one instance with hash-jittered local offset, scale, and Y-rotation. Water and
 * tundra/desert vertices are skipped. Pure: randomness comes from a coordinate hash.
 */
import type { ChunkData, VegetationScatter } from './types';
import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const MAX_H = WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M;

const VEGETATED = new Set(['forest', 'jungle', 'plains', 'grassland', 'wetland', 'swamp']);

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1442695041, 1597334677) ^ (c | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

export function buildVegetationScatter(data: ChunkData): VegetationScatter {
  const res = data.resolution;
  const positions: number[] = [];
  const scales: number[] = [];
  const rotations: number[] = [];

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      const biome = data.biomeIds[idx];
      if (!VEGETATED.has(biome)) continue;

      const gate = hash01(data.cx * 73856093 + i, data.cy * 19349663 + j, 1);
      if (gate < 0.5) continue;

      const tx = res === 1 ? 0 : i / (res - 1);
      const tz = res === 1 ? 0 : j / (res - 1);
      const jx = (hash01(i, j, data.cx) - 0.5) * (S / res);
      const jz = (hash01(i, j, data.cy) - 0.5) * (S / res);
      const x = tx * S + jx;
      const z = tz * S + jz;
      const y = (data.heights[idx] / 100) * MAX_H;

      positions.push(x, y, z);
      scales.push(0.7 + hash01(i, j, 7) * 0.8);
      rotations.push(hash01(i, j, 11) * Math.PI * 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
  };
}
