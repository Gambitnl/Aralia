/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 16:55:13
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file siteGeometry.ts
 * Convert contained sites into chunk-local placements.
 *
 * Keep the town/dungeon/ruin footprint intentionally small and readable at world
 * scale. Voronoi-derived extents can be enormous for grid-space sites and
 * frequently trigger back-face culling, so this file uses a bounded visual
 * scale with kind/population-driven variation.
 */
import type { ChunkData, ChunkSite } from './types';
export declare function buildSiteMeshes(data: ChunkData): ChunkSite[];
