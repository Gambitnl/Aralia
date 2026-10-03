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
 *
 * TWO STAGES since the surface-gate wave. Stage 1 picks candidates from the
 * biome mask at the target density (the original pass). Stage 2 reads the LOCAL
 * surface under each candidate with a `SurfaceProbe`, then REJECTS it or FITS it
 * to the ground. Without stage 2 a tree stood on a cliff face.
 *
 * The probe reads the RENDERED surface — `heightToMeters` including vertical
 * exaggeration — because that is the ground the player sees a tree stand on.
 * Every gate number below is therefore expressed in RENDERED feet through
 * `renderedFeet()`, never in raw world units.
 */
import type { ChunkData, VegetationScatter } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import {
  FEET_PER_METER,
  fitToSurface,
  makeGridSurfaceProbe,
  makeSurfaceGateTally,
  rejectReasonFor,
  type SurfaceGate,
  type SurfaceGateStats,
} from '../worldforge/terrain/surfaceProbe';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
// Bumped when the surface gate landed: cached payloads predate the gate and
// would otherwise serve un-gated scatter forever.
// v3: Remy's swept gate values (forest 42 deg / treeline 82, other six scaled)
// plus the tilt-sign fix. A v2 payload carries the old gates and the backward
// lean, so it must never be served after this change.
// v4: every instance now carries the BIOME it grew on (`biomeCodes` +
// `biomeTable`). A v3 payload has no biome channel at all, so the grown-tree
// renderer cannot read it — serving one would either throw or silently render
// nothing, and both are worse than rebuilding the scatter.
const VEGETATION_SCATTER_CACHE_VERSION = 4;
const VEGETATION_SCATTER_CACHE_MAX_ENTRIES = 256;

// `forest_floor` is the leaf-litter tint a forest window's `grass` ground now
// carries; it is the SAME growable surface `grassland` was, so leaving it out
// would strip scatter from exactly the cells that should be most overgrown.
const VEGETATED = new Set([
  'forest',
  'forest_floor',
  'jungle',
  'plains',
  'grassland',
  'wetland',
  'swamp',
]);
// Keep a bounded cache of stable scatter payloads.
const VEGETATION_CACHE = new Map<string, VegetationScatter>();

// ── Stage 2: the per-species surface gate ───────────────────────────────────

/** A world height (0..100) as RENDERED feet, exaggeration included. */
function renderedFeet(worldHeight: number): number {
  return heightToMeters(worldHeight) * FEET_PER_METER;
}

/** Degrees to radians — gate angles read better as degrees in this table. */
function deg(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Per-biome tree tolerance. A tree grows toward the sky, so `maxTiltRad` stays
 * small: it follows the ground only enough to look rooted. Slope limits differ
 * by species — a swamp tree needs near-flat wet ground, a conifer takes a hill.
 *
 * WARNING: these numbers are LOOK values for the exaggerated render, not real
 * grades. Slopes are measured through `renderedFeet()`, which carries
 * VERTICAL_EXAGGERATION = 12, so a 42 degree gate is a 3.9 degree real
 * hillside. Change the exaggeration and every value here silently changes
 * meaning. Re-run the sweep before you trust them again.
 *
 * Remy set the forest pair from a rendered sweep on 2026-08-12: slope 42, tree-
 * line 82. The other six keep their intended relationship to forest, scaled by
 * the same ratios (slope x1.2, treeline x1.051) rather than swept separately.
 * Sweep images: `.agent/scratch/veg-sweep-slope.png` and `-treeline.png`.
 */
const TREE_GATES: Readonly<Record<string, SurfaceGate>> = {
  forest: {
    minElevationFt: renderedFeet(21),
    maxElevationFt: renderedFeet(82), // treeline — Remy, 2026-08-12
    maxSlopeRad: deg(42),
    maxTiltRad: deg(7),
    baseRadiusFt: 3,
    slopeScaleFloor: 0.7,
  },
  forest_floor: {
    minElevationFt: renderedFeet(21),
    maxElevationFt: renderedFeet(82),
    maxSlopeRad: deg(42),
    maxTiltRad: deg(7),
    baseRadiusFt: 3,
    slopeScaleFloor: 0.7,
  },
  jungle: {
    minElevationFt: renderedFeet(21),
    maxElevationFt: renderedFeet(65),
    maxSlopeRad: deg(36),
    maxTiltRad: deg(6),
    baseRadiusFt: 3.5,
    slopeScaleFloor: 0.75,
  },
  plains: {
    minElevationFt: renderedFeet(21),
    maxElevationFt: renderedFeet(74),
    maxSlopeRad: deg(34),
    maxTiltRad: deg(5),
    baseRadiusFt: 2.5,
    slopeScaleFloor: 0.75,
  },
  grassland: {
    minElevationFt: renderedFeet(21),
    maxElevationFt: renderedFeet(74),
    maxSlopeRad: deg(34),
    maxTiltRad: deg(5),
    baseRadiusFt: 2.5,
    slopeScaleFloor: 0.75,
  },
  // Wet ground pools; a marsh tree cannot stand on a bank.
  wetland: {
    minElevationFt: renderedFeet(19),
    maxElevationFt: renderedFeet(47),
    maxSlopeRad: deg(14),
    maxTiltRad: deg(4),
    baseRadiusFt: 2.5,
    slopeScaleFloor: 0.8,
  },
  swamp: {
    minElevationFt: renderedFeet(19),
    maxElevationFt: renderedFeet(47),
    maxSlopeRad: deg(14),
    maxTiltRad: deg(4),
    baseRadiusFt: 2.5,
    slopeScaleFloor: 0.8,
  },
};

/**
 * The probe for one chunk: the chunk's own height grid, converted to RENDERED
 * feet once, then read as a bilinear field. Built ONCE per scatter build and
 * baked into the instance buffers. Never sampled per frame.
 */
function makeChunkSurfaceProbe(data: ChunkData) {
  const res = data.resolution;
  const elevationsFt = new Float32Array(res * res);
  for (let i = 0; i < elevationsFt.length; i++) {
    elevationsFt[i] = renderedFeet(data.heights[i] ?? 0);
  }
  // Chunk-local X grows with the column index and Z with the row index, exactly
  // as the candidate loop maps (i, j) to (x, z) below.
  const spacingFt = (S / Math.max(1, res - 1)) * FEET_PER_METER;
  return makeGridSurfaceProbe({
    elevationsFt,
    cols: res,
    rows: res,
    cellSizeXFt: spacingFt,
    cellSizeZFt: spacingFt,
  });
}

/** Last gate tally per chunk key — instrumentation, read by tests and devtools. */
const LAST_GATE_STATS = new Map<string, SurfaceGateStats>();

/** Rejection stats for the most recent build of a chunk. Undefined = never built. */
export function vegetationGateStatsFor(cacheKey: string): SurfaceGateStats | undefined {
  return LAST_GATE_STATS.get(cacheKey);
}

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
  const tilts: number[] = [];
  const tiltAxes: number[] = [];
  // Per-instance biome (grown-tree wave). This grid path already knows the
  // biome of every candidate vertex — it gates on it — so carrying it out
  // costs one byte per tree and removes the palette-color guess downstream.
  const biomeTable: string[] = [];
  const biomeIndexOf = new Map<string, number>();
  const biomeCodes: number[] = [];
  const codeFor = (biome: string): number => {
    const hit = biomeIndexOf.get(biome);
    if (hit !== undefined) return hit;
    const next = biomeTable.length;
    biomeTable.push(biome);
    biomeIndexOf.set(biome, next);
    return next;
  };
  const tally = makeSurfaceGateTally();
  // A 1x1 chunk has no gradient to read, so stage 2 cannot run on it.
  const probe = res >= 2 ? makeChunkSurfaceProbe(data) : null;

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

      // ── Stage 2: read the surface, then reject or fit ──────────────────
      const speciesGate = TREE_GATES[biome];
      if (!probe || !speciesGate) {
        // No gradient (1x1 chunk) or no authored gate for this biome: the
        // candidate cannot be judged, so it is not counted as gated either.
        positions.push(x, heightToMeters(data.heights[idx] ?? 0), z);
        scales.push(0.7 + hash01(i, j, 7) * 0.8);
        rotations.push(hash01(i, j, 11) * Math.PI * 2);
        tilts.push(0);
        tiltAxes.push(1, 0);
        biomeCodes.push(codeFor(biome));
        continue;
      }

      const sample = probe.sampleAt(x * FEET_PER_METER, z * FEET_PER_METER);
      const reason = rejectReasonFor(sample, speciesGate, hash01(i, j, 23));
      tally.note(reason);
      if (reason !== null) continue;

      const fit = fitToSurface(sample, speciesGate);
      // The probe's bilinear elevation is the surface at the JITTERED point,
      // which the old code missed — it reused the lattice vertex height, so a
      // jittered instance already floated before any slope work.
      const y = fit.elevationFt / FEET_PER_METER - fit.sinkFt / FEET_PER_METER;

      positions.push(x, y, z);
      scales.push((0.7 + hash01(i, j, 7) * 0.8) * fit.scaleMultiplier);
      rotations.push(hash01(i, j, 11) * Math.PI * 2);
      tilts.push(fit.tiltRad);
      tiltAxes.push(fit.tiltAxis[0], fit.tiltAxis[1]);
      biomeCodes.push(codeFor(biome));
    }
  }

  const stats = tally.stats();
  LAST_GATE_STATS.set(cacheKey, stats);

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
    tilts: new Float32Array(tilts),
    tiltAxes: new Float32Array(tiltAxes),
    biomeCodes: new Uint8Array(biomeCodes),
    biomeTable,
    gateStats: stats,
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
