/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:54
 * Dependents: App.tsx, useGameInitialization.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file mapService.ts
 * This service module handles the generation of the world map for Aralia RPG.
 */
import { MapData, Location, Biome } from '../types';
/**
 * Generates a world map with biomes and links to predefined locations.
 * @param {number} rows - Number of rows in the map grid.
 * @param {number} cols - Number of columns in the map grid.
 * @param {Record<string, Location>} locations - Predefined game locations.
 * @param {Record<string, Biome>} biomes - Available biome types.
 * @param {number} worldSeed - The seed for the pseudo-random number generator.
 * @returns {MapData} The generated map data.
 */
export declare function generateMap(rows: number, cols: number, locations: Record<string, Location>, biomes: Record<string, Biome>, worldSeed: number): MapData;
