// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 04:31:32
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { gridPointToLocal } from './coords';

const MIN_RADIUS_M = 8;
const MAX_RADIUS_M = 30;
const MAX_POPULATION_FOR_SCALING = 5000;
const POPULATION_BONUS_M = 8;
const BASE_RADIUS_BY_KIND: Record<ChunkSite['kind'], number> = {
  town: 16,
  dungeon: 9,
  ruin: 9,
  landmark: 11,
};

function clampRadius(radius: number): number {
  return Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, radius));
}

function estimateTownRadius(population: number | undefined): number {
  if (typeof population !== 'number' || !Number.isFinite(population) || population <= 0) {
    return BASE_RADIUS_BY_KIND.town;
  }
  const normalized =
    Math.min(MAX_POPULATION_FOR_SCALING, Math.max(0, population)) / MAX_POPULATION_FOR_SCALING;
  return BASE_RADIUS_BY_KIND.town + normalized * POPULATION_BONUS_M;
}

function estimateRadius(site: ChunkData['sites'][number]): number {
  if (site.kind === 'town') {
    return estimateTownRadius(site.population);
  }
  return BASE_RADIUS_BY_KIND[site.kind];
}

export function buildSiteMeshes(data: ChunkData): ChunkSite[] {
  return data.sites.map((s) => {
    const local = gridPointToLocal(s.position.x, s.position.y, data.cx, data.cy);
    return {
      id: s.id,
      kind: s.kind,
      localX: local.x,
      localZ: local.z,
      surfaceY: s.surfaceY,
      population: s.population,
      radius: clampRadius(estimateRadius(s)),
      walled: s.walled,
    };
  });
}
