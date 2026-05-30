/**
 * @file types.ts
 * @description Shared types for the 3D world streaming system.
 *
 * Why this is built this way:
 * - ChunkCoord simplifies coordinate math.
 * - ChunkGeometryArrays uses typed arrays (Float32Array and Uint32Array) to allow transferability,
 *   enabling zero-copy message transfers from Web Workers to the main thread.
 * - ChunkLoader provides an abstract producer interface so streaming can run in-worker or in-process (tests).
 */

/** Integer chunk coordinate on the chunk grid. */
export interface ChunkCoord {
  cx: number;
  cy: number;
}

/**
 * The slice of WorldData needed to build one chunk's geometry.
 * Plan 3 extends this with intersecting rivers/roads and contained sites.
 */
export interface ChunkData {
  cx: number;
  cy: number;
  /** Vertices per edge (square grid). */
  resolution: number;
  /** Sampled heights (0..100), length resolution*resolution, row-major (z-major, x-minor). */
  heights: Float32Array;
}

/** Transferable geometry buffers for a chunk mesh, local to the chunk origin. */
export interface ChunkGeometryArrays {
  /** 3 floats (x,y,z) per vertex, local-space (chunk origin at 0,0). */
  positions: Float32Array;
  /** Triangle indices into positions. */
  indices: Uint32Array;
  /** 3 floats per vertex. */
  normals: Float32Array;
}

/** LOD tier for a loaded chunk, by chunk-distance from the camera. */
export type LodTier = 'full' | 'mid' | 'low' | 'culled';

/** Async producer of chunk geometry. Worker-backed in production, inline in tests. */
export type ChunkLoader = (cx: number, cy: number) => Promise<ChunkGeometryArrays>;

/** A chunk currently held in memory by the streamer. */
export interface LoadedChunk {
  cx: number;
  cy: number;
  geometry: ChunkGeometryArrays;
  lod: LodTier;
}
