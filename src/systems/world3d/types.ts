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
  /** Sampled heights (0..100), length resolution*resolution, row-major. */
  heights: Float32Array;
  /** Per-vertex biome id, length resolution*resolution, nearest-neighbor sampled. */
  biomeIds: string[];
  /** River polylines clipped to this chunk (grid space). */
  rivers: ClippedPolyline[];
  /** Road polylines clipped to this chunk (grid space). */
  roads: ClippedPolyline[];
  /** Sites whose center falls within this chunk (grid space). */
  sites: { id: string; kind: 'town' | 'dungeon' | 'ruin' | 'landmark'; position: { x: number; y: number }; footprint: { x: number; y: number }[]; walled: boolean }[];
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
  radius: number;
  walled: boolean;
}

/** Instanced vegetation transforms for a chunk. */
export interface VegetationScatter {
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
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
