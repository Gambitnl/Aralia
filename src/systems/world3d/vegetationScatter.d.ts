/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:34:47
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file vegetationScatter.ts
 * Deterministic instanced vegetation. For each vertex on a vegetated biome, emit
 * one instance with hash-jittered local offset, scale, and Y-rotation. Water and
 * tundra/desert vertices are skipped. Pure: randomness comes from a coordinate hash.
 */
import type { ChunkData, VegetationScatter } from './types';
export declare function buildVegetationScatter(data: ChunkData): VegetationScatter;
