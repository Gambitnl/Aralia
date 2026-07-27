/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/06/2026, 00:45:39
 * Dependents: services/mapService.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file builds the Azgaar-derived world map used by the main map generator.
 *
 * It turns a world seed into an Azgaar-like heightfield, biome grid, climate layers,
 * atlas river mask, and the matching WorldData snapshot consumed by 3D/world systems.
 * The WSS-005a bridge starts here because this is where the canonical Azgaar feature
 * hints are first available before they are passed into the world-sim artifact.
 */
import { Biome, Location, MapData } from '../types';
export declare function generateAzgaarDerivedMap(rows: number, cols: number, locations: Record<string, Location>, biomes: Record<string, Biome>, worldSeed: number): MapData;
