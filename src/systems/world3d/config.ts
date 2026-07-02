/**
 * @file config.ts
 * @description Central tunables for the 3D streamed world. Keep all magic numbers here so the
 * coordinate math, sampler, LOD, and streamer stay in agreement.
 *
 * Why this is built this way:
 * - Establishing CHUNK_WORLD_SIZE and METERS_PER_CELL cleanly relates the three.js world units
 *   to WorldData cell indices.
 * - LOAD_RADIUS and UNLOAD_RADIUS are configured with hysteresis to prevent thrashing
 *   (loading and unloading the same chunk repeatedly) when a player stands exactly on a chunk boundary.
 * - MAX_CONCURRENT_LOADS throttles requests to prevent the Web Worker pool from saturating CPU/main thread.
 */

import type { LodTier } from './types';

export const WORLD3D_CONFIG = {
  /** World-space edge length of one chunk, in meters. */
  CHUNK_WORLD_SIZE: 128,
  /** How many world meters one WorldData grid cell spans. Must be a multiple of CHUNK_WORLD_SIZE. */
  METERS_PER_CELL: 1024,
  /** Vertices per chunk edge for the placeholder heightfield (Plan 3 refines per-LOD). */
  HEIGHTFIELD_RESOLUTION: 17,
  /**
   * Per-LOD-tier mesh resolution (vertices per chunk edge). Distant chunks use
   * a coarser grid so the GPU/worker cost drops with distance (W3D-G10 / T7).
   * `full` matches HEIGHTFIELD_RESOLUTION; `mid`/`low` step down. `culled` is
   * unreachable today (see W3D-G13) but kept defined for completeness.
   *
   * INVARIANT (seam weld): every tier's segment count (res − 1) must be a
   * multiple of 4, the coarsest tier's segment count. Chunk border heights are
   * welded onto the piecewise-linear curve through the 5 anchor vertices all
   * tiers then share (see edgeWeld.ts), which is what keeps neighboring chunks
   * of ANY tier mix watertight. 16/8/4 segments nest; 15 (the old full=16) did
   * not, and the resulting T-junction cracks showed as a grid of dark/white
   * slivers between chunks.
   */
  LOD_RESOLUTION: {
    full: 17,
    mid: 9,
    low: 5,
    culled: 5,
  },
  /**
   * Minimum downward skirt depth in world meters. Each rendered terrain chunk
   * drops a vertical skirt around its perimeter so cracks between neighbors of
   * different mesh resolution are hidden behind the skirt wall instead of
   * showing the void. The actual depth is max(this, the chunk's own relief) so
   * it always covers the worst-case seam without being needlessly deep.
   */
  SKIRT_MIN_DEPTH_M: 40,
  /** WorldData height (0..100) maps linearly to [0, MAX_TERRAIN_HEIGHT_M] meters (before exaggeration). */
  MAX_TERRAIN_HEIGHT_M: 150,
  /**
   * Vertical exaggeration applied to the height→meters mapping. The raw world height range
   * (MAX_TERRAIN_HEIGHT_M=150m) is tiny relative to METERS_PER_CELL (1024m), so unexaggerated
   * terrain reads as a flat plane from the default near-horizontal camera — hiding the rivers,
   * roads, and town boxes the engine already builds. Exaggerating Y makes relief legible.
   * Keep this purely in the height→meters mapping (`heightToMeters`) so water/road ribbons,
   * which read terrain height, stay locked to the surface.
   */
  VERTICAL_EXAGGERATION: 12,
  /** Chunks within this Chebyshev radius of the camera chunk are loaded. */
  LOAD_RADIUS: 4,
  /** Chunks beyond this Chebyshev radius are unloaded (>= LOAD_RADIUS for hysteresis). */
  UNLOAD_RADIUS: 6,
  /** Max chunk loads in flight at once (throttles the worker pool). */
  MAX_CONCURRENT_LOADS: 4,
  /** Hard cap on vegetation instances emitted per chunk (perf guard). */
  MAX_VEGETATION_PER_CHUNK: 60,
  /** Whether the streamed world casts/receives real-time shadows (off = much cheaper). */
  STREAMED_WORLD_SHADOWS: false,
} as const;

/** Derived: number of chunks spanning one grid cell along each axis. */
export const CHUNKS_PER_CELL = WORLD3D_CONFIG.METERS_PER_CELL / WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/**
 * Maps a WorldData height (0..100) to world-space meters on the Y axis, with vertical
 * exaggeration applied. This is the single source of truth for the height→meters mapping:
 * the terrain heightfield, river water ribbons, and road ribbons MUST all route through it so
 * the ribbons stay welded to the terrain surface (otherwise they float off it when exaggeration
 * changes). Pure and deterministic.
 */
export function heightToMeters(height: number): number {
  return (
    (height / 100) *
    WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M *
    WORLD3D_CONFIG.VERTICAL_EXAGGERATION
  );
}

/**
 * Mesh resolution (vertices per chunk edge) for a given LOD tier. This is the
 * single source of truth the chunk loaders use to honor the requested tier
 * carried through the loader contract (W3D-G10 / T7). Falls back to the full
 * resolution when no tier is supplied so callers that don't request a tier keep
 * the previous behavior.
 */
export function resolutionForLod(lod?: LodTier): number {
  if (!lod) return WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
  return WORLD3D_CONFIG.LOD_RESOLUTION[lod] ?? WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
}
