import type { Texture } from 'three/webgpu';
type N = any;
export interface TerrainColorNodeParams {
    /** Per-tile terrain-type DataTexture (R = type index 0–7), NearestFilter. */
    typeTex: Texture;
    mapWidth: number;
    mapHeight: number;
    /** Canopy dapple strength: forest 1.0, swamp 0.45, else 0. */
    dapple: number;
}
/**
 * Build the terrain ALBEDO node (before baked lighting is multiplied in): the
 * full procedural color pipeline — per-type palette, organic edge blending,
 * slope-exposed rock, and shoreline wet banks + canopy dapple.
 */
export declare function buildTerrainAlbedoNode(p: TerrainColorNodeParams): N;
/** The flat world normal node reused by the scene for baked lighting on terrain. */
export declare function terrainFlatNormalNode(): N;
export {};
