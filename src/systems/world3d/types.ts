// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 08/06/2026, 13:48:54
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/createWorkerChunkLoader.ts, components/World3D/useChunkStreaming.ts, components/World3D/vegetationInstanceMatrices.ts, systems/world3d/chunkBundle.ts, systems/world3d/chunkGeometry.ts, systems/world3d/chunkManager.ts, systems/world3d/chunkSampler.ts, systems/world3d/chunkStreamer.ts, systems/world3d/chunkWorkerCore.ts, systems/world3d/coords.ts, systems/world3d/lod.ts, systems/world3d/polylineClip.ts, systems/world3d/roadGeometry.ts, systems/world3d/siteGeometry.ts, systems/world3d/vegetationScatter.ts, systems/world3d/waterGeometry.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 * Plan 3 extends this with intersecting rivers/roads/lakes and contained sites.
 */
export interface ChunkData {
  cx: number;
  cy: number;
  /** Vertices per edge (square grid). */
  resolution: number;
  /** Sampled heights (0..100), length resolution*resolution, row-major. */
  heights: Float32Array;
  /** Per-vertex biome id, length resolution*resolution, nearest-neighbor sampled. */
  biomeIds: string[];
  /**
   * Optional per-vertex RGB biome tint (0..1), precomputed as blended samples.
   * Existing callers that only need nearest biome IDs can keep using `biomeIds`.
   */
  biomeColors?: Float32Array;
  /** River polylines clipped to this chunk (grid space). */
  rivers: ClippedPolyline[];
  /** Road polylines clipped to this chunk (grid space). */
  roads: ClippedPolyline[];
  /**
   * Lake polygons clipped to this chunk (grid space) with a shared flat water surface.
   * Lakes are filled meshes, not ribbons, so the builder can triangulate them directly.
   */
  lakes?: { points: { x: number; y: number }[]; surfaceY: number }[];
  /** Sites whose center falls within this chunk (grid space). */
  sites: {
    id: string;
    kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
    position: { x: number; y: number };
    footprint: { x: number; y: number }[];
    walled: boolean;
    population?: number;
    surfaceY: number;
  }[];
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

/** Terrain mesh: heightfield geometry plus per-vertex RGB for biome tinting. */
export interface TerrainMesh extends ChunkGeometryArrays {
  /** 3 floats (r,g,b) per vertex, parallel to positions. */
  colors: Float32Array;
}

/** A polyline (grid-space) clipped to a chunk, carrying per-point width in grid units. */
export interface ClippedPolyline {
  points: { x: number; y: number }[];
  /** Width in grid units, one per point (length === points.length). */
  width: number[];
}

/** A site contained in a chunk, with chunk-local placement for geometry. */
export interface ChunkSite {
  id: string;
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
  localX: number;
  localZ: number;
  /** Surface Y in world-space meters (heightToMeters applied), matching terrain exaggeration. */
  surfaceY: number;
  population?: number;
  radius: number;
  walled: boolean;
}

/** Instanced vegetation transforms for a chunk. */
export interface VegetationScatter {
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  /**
   * Stable payload fingerprint for the chunk that produced these buffers.
   * The renderer uses this to skip rewriting instance matrices when a worker
   * hands back a fresh wrapper for the same vegetation scatter payload.
   */
  cacheKey: string;
}

/** The full set of meshes for one chunk. terrain is always present; the rest optional. */
export interface ChunkMeshBundle {
  cx: number;
  cy: number;
  terrain: TerrainMesh;
  water?: ChunkGeometryArrays;
  roads?: ChunkGeometryArrays;
  sites: ChunkSite[];
  vegetation?: VegetationScatter;
}

/** Async producer of a chunk's full mesh bundle. Worker-backed in production, inline in tests. */
export type ChunkLoader = (cx: number, cy: number) => Promise<ChunkMeshBundle>;

/** A chunk currently held in memory by the streamer. */
export interface LoadedChunk {
  cx: number;
  cy: number;
  bundle: ChunkMeshBundle;
  lod: LodTier;
}
