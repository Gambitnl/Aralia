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
    const site: ChunkSite = {
      id: s.id,
      kind: s.kind,
      localX: local.x,
      localZ: local.z,
      surfaceY: s.surfaceY,
      population: s.population,
      radius: clampRadius(estimateRadius(s)),
      walled: s.walled,
      colorHex: s.colorHex,
      unlabeled: s.unlabeled,
      markerOnly: s.markerOnly,
    };

    // Oriented-box footprint (Worldforge ground mode, 2026-06-11): a
    // 4-corner quad becomes a rotated building box sized by its actual
    // edges - replacing the uniform kind-radius cube. Corners share the
    // grid->local conversion, so the box lands exactly on the plot.
    if (s.footprint && s.footprint.length === 4) {
      const c = s.footprint.map((p) => gridPointToLocal(p.x, p.y, data.cx, data.cy));
      const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4;
      const cz = (c[0].z + c[1].z + c[2].z + c[3].z) / 4;
      const e1x = c[1].x - c[0].x;
      const e1z = c[1].z - c[0].z;
      const e2x = c[3].x - c[0].x;
      const e2z = c[3].z - c[0].z;
      site.localX = cx;
      site.localZ = cz;
      site.boxWidth = Math.max(1, Math.hypot(e1x, e1z));
      site.boxDepth = Math.max(1, Math.hypot(e2x, e2z));
      site.boxHeight = Math.max(2, s.heightM ?? 4);
      // three.js rotates counter-clockwise around +Y; atan2 of the frontage
      // edge gives the box yaw so its width axis follows the street.
      site.rotationY = -Math.atan2(e1z, e1x);
      // Street side: corners 0-1 (the frontage edge) sit toward the street,
      // e2 points away from it. The cross product's sign tells which local-Z
      // face e2 maps to after the yaw — the door goes on the opposite face.
      const cross = e1x * e2z - e1z * e2x;
      site.doorZSign = cross >= 0 ? -1 : 1;
    }

    return site;
  });
}


