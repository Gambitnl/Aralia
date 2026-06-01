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

export const WORLD3D_CONFIG = {
  /** World-space edge length of one chunk, in meters. */
  CHUNK_WORLD_SIZE: 128,
  /** How many world meters one WorldData grid cell spans. Must be a multiple of CHUNK_WORLD_SIZE. */
  METERS_PER_CELL: 1024,
  /** Vertices per chunk edge for the placeholder heightfield (Plan 3 refines per-LOD). */
  HEIGHTFIELD_RESOLUTION: 16,
  /** WorldData height (0..100) maps linearly to [0, MAX_TERRAIN_HEIGHT_M] meters. */
  MAX_TERRAIN_HEIGHT_M: 150,
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
