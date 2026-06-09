// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:34:47
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file vegetationScatter.ts
 * Deterministic instanced vegetation. For each vertex on a vegetated biome, emit
 * one instance with hash-jittered local offset, scale, and Y-rotation. Water and
 * tundra/desert vertices are skipped. Pure: randomness comes from a coordinate hash.
 */
import type { ChunkData, VegetationScatter } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const VEGETATION_SCATTER_CACHE_VERSION = 1;
const VEGETATION_SCATTER_CACHE_MAX_ENTRIES = 256;

const VEGETATED = new Set(['forest', 'jungle', 'plains', 'grassland', 'wetland', 'swamp']);
// Keep a bounded cache of stable scatter payloads.
const VEGETATION_CACHE = new Map<string, VegetationScatter>();

const F32_BYTES = new ArrayBuffer(4);
const F32_VIEW = new DataView(F32_BYTES);

function pushHash(hash: number, value: number): number {
  hash ^= value;
  hash = Math.imul(hash, 0x9e3779b9);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function hashChunkForVegetation(data: ChunkData): string {
  let h1 = 0x9e3779b9 + (data.cx << 1);
  let h2 = 0x85ebca6b + (data.cy << 1);
  const mix = (value: number): void => {
    h1 = pushHash(h1, value);
    h2 = pushHash(h2, value + 0x7ed55d16);
  };

  mix(WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK);
  mix(WORLD3D_CONFIG.CHUNK_WORLD_SIZE);
  mix(WORLD3D_CONFIG.VERTICAL_EXAGGERATION);
  mix(WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M);
  mix(data.cx);
  mix(data.cy);
  mix(data.resolution);
  mix(data.heights.length);
  mix(VEGETATED.size);

  for (let i = 0; i < data.heights.length; i++) {
    F32_VIEW.setFloat32(0, data.heights[i] ?? 0, true);
    mix(F32_VIEW.getUint32(0, true));
  }

  for (const biome of data.biomeIds) {
    mix(biome.length);
    for (let i = 0; i < biome.length; i++) {
      mix(biome.charCodeAt(i));
    }
  }

  return `v${VEGETATION_SCATTER_CACHE_VERSION}|${h1.toString(16)}|${h2.toString(16)}`;
}

function buildVegetationScatterUncached(data: ChunkData, cacheKey: string): VegetationScatter {
  const res = data.resolution;
  const positions: number[] = [];
  const scales: number[] = [];
  const rotations: number[] = [];

  let capped = false;
  for (let j = 0; j < res && !capped; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      const biome = data.biomeIds[idx];
      if (!VEGETATED.has(biome)) continue;

      const gate = hash01(data.cx * 73856093 + i, data.cy * 19349663 + j, 1);
      if (gate < 0.5) continue;

      // Perf guard: never exceed the per-chunk instance cap.
      if (positions.length / 3 >= WORLD3D_CONFIG.MAX_VEGETATION_PER_CHUNK) {
        capped = true;
        break;
      }

      const tx = res === 1 ? 0 : i / (res - 1);
      const tz = res === 1 ? 0 : j / (res - 1);
      const jx = (hash01(i, j, data.cx) - 0.5) * (S / res);
      const jz = (hash01(i, j, data.cy) - 0.5) * (S / res);
      const x = tx * S + jx;
      const z = tz * S + jz;
      const y = heightToMeters(data.heights[idx] ?? 0);

      positions.push(x, y, z);
      scales.push(0.7 + hash01(i, j, 7) * 0.8);
      rotations.push(hash01(i, j, 11) * Math.PI * 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
    cacheKey,
  };
}

function enforceVegetationScatterCacheLimit(): void {
  if (VEGETATION_CACHE.size <= VEGETATION_SCATTER_CACHE_MAX_ENTRIES) return;
  const oldestKey = VEGETATION_CACHE.keys().next().value;
  if (oldestKey) VEGETATION_CACHE.delete(oldestKey);
}

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1442695041, 1597334677) ^ (c | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

export function buildVegetationScatter(data: ChunkData): VegetationScatter {
  // Bounded cache key ensures unchanged chunk payloads reuse buffers while
  // differing payloads still recompute deterministically.
  const key = hashChunkForVegetation(data);
  const cached = VEGETATION_CACHE.get(key);
  if (cached) {
    // Re-queue the key to keep LRU-most-recently-used entries fresh.
    VEGETATION_CACHE.delete(key);
    VEGETATION_CACHE.set(key, cached);
    return cached;
  }

  const fresh = buildVegetationScatterUncached(data, key);
  VEGETATION_CACHE.set(key, fresh);
  enforceVegetationScatterCacheLimit();
  return fresh;
}
