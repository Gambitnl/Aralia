/**
 * @file terrainTileMapping.ts
 * Small hit-testing helpers for the terrain mesh.
 *
 * The 3D terrain click path needs one place to turn a raycast hit into a tile
 * coordinate. Keeping that math in a separate utility makes the boundary
 * behavior testable without mounting the whole renderer, while preserving the
 * component-level click flow in TerrainMesh.tsx.
 */
export interface TerrainHitPoint {
    x: number;
    y?: number;
    z: number;
}
export interface TerrainMapDimensions {
    width: number;
    height: number;
}
export interface TerrainTileCoordinates {
    x: number;
    y: number;
}
export interface TerrainTileResolutionOptions {
    sampleHeight?: (tileX: number, tileZ: number) => number;
}
/**
 * Convert a terrain hit point, already expressed in tile units, into the tile
 * coordinate used by battle-map data.
 *
 * The point comes from the raycast intersection on the 3D terrain mesh. We keep
 * the floor math, but clamp the result so tiny floating-point drift at the edges
 * cannot drop a click outside the playable grid.
 */
export declare function resolveTerrainTileCoordinates(hitPoint: TerrainHitPoint, dimensions: TerrainMapDimensions, options?: TerrainTileResolutionOptions): TerrainTileCoordinates | null;
