/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:30:57
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file waterGeometry.ts
 * Build visible water surfaces for clipped rivers and lake polygons. Ground
 * rivers arrive with a loader-computed waterline that crossings can query too,
 * so this file renders that shared truth instead of hiding a second guessed
 * ribbon beneath the carved bed. Legacy continent rivers keep their previous
 * terrain-following fallback. Output is chunk-local.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
export declare function buildWaterMesh(data: ChunkData): ChunkGeometryArrays;
