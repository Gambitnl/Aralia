/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:34:15
 * Dependents: ThreeDModal.tsx, contextUtils.ts, spatial/index.ts, submapUtils.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Lightweight deterministic hash used throughout submap generation. Exported so
 * other procedural generators (like the village layout system) can build
 * seeded RNG helpers without re-implementing the hash algorithm.
 */
export declare const simpleHash: (worldSeed: number, worldX: number, worldY: number, biomeSeedText: string, submapX: number, submapY: number, seedSuffix: string) => number;
/**
 * Creates a deterministic PRNG that mirrors how submaps seed their randomness.
 * The generator feeds incrementing indices into the shared hash to avoid
 * synchronisation between different systems while still remaining perfectly
 * repeatable for a given world coordinate + seed tuple.
 */
export declare const createSeededRandom: (worldSeed: number, parentWorldMapCoords: {
    x: number;
    y: number;
}, biomeSeedText: string, seedLabel: string) => (() => number);
interface SubmapTileInfo {
    effectiveTerrainType: string;
    isImpassable: boolean;
}
/**
 * Calculates the deterministic terrain type and properties of a single submap tile.
 *
 * WHY:
 * This is the "God Function" for the submap system. It is used by:
 * 1. The Renderer (to know which sprite to draw: grass, road, water).
 * 2. The Physics/Movement system (to know if a tile is walkable).
 * 3. The Interaction system (to know if you are standing on a 'village_area').
 *
 * It must be stateless and purely functional so it returns the exact same result
 * for the same seed/coordinates every time, allowing us to "generate" the map
 * on the fly without storing millions of tiles in the DB.
 *
 * @param worldSeed - The global seed for the entire game world.
 * @param parentWorldMapCoords - The X/Y of the world map tile we are inside.
 * @param currentWorldBiomeId - The biome of the world map tile.
 * @param submapDimensions - The size of the local grid.
 * @param targetSubmapCoords - The specific X/Y of the tile we are querying.
 * @returns Object containing the terrain type (string) and collision flag (boolean).
 */
export declare function getSubmapTileInfo(worldSeed: number, parentWorldMapCoords: {
    x: number;
    y: number;
}, currentWorldBiomeId: string, submapDimensions: {
    rows: number;
    cols: number;
}, targetSubmapCoords: {
    x: number;
    y: number;
}): SubmapTileInfo;
export {};
