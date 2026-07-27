/**
 * @file wallGeometry.ts
 * Build vertical wall meshes along clipped town wall-ring polylines (Worldforge
 * Option B). Where roadGeometry lays a flat ribbon on the ground, this extrudes
 * each segment UPWARD into a two-sided stone barrier: bottom edge at the terrain
 * surface, top edge at WALL_HEIGHT_M above it. Mirrors roadGeometry's segment
 * walk so the two stay structurally parallel.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
/** Wall meshes carry per-vertex colors so WallPiece renders with `vertexColors`. */
type WallMesh = ChunkGeometryArrays & {
    colors: Float32Array;
};
export declare function buildWallMesh(data: ChunkData): WallMesh;
export {};
