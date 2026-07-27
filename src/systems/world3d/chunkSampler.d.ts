/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:48:54
 * Dependents: systems/world3d/chunkWorkerCore.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file chunkSampler.ts
 * Slices WorldData into the per-chunk input for geometry: a bilinearly-sampled
 * height subgrid, a per-vertex biome id buffer, the river/road polylines clipped
 * to this chunk, and any sites whose center lies inside the chunk.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkData } from './types';
export declare function sampleChunk(world: WorldData, cx: number, cy: number, resolution: number): ChunkData;
