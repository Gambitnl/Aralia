/**
 * @file siteGeometry.ts
 * Convert contained sites into chunk-local placements. Footprint radius is derived
 * from the polygon's extent (grid→meters). The scene turns each placement into a
 * simple box cluster / wall ring; keeping geometry in the scene keeps the worker
 * payload to plain numbers.
 */
import type { ChunkData, ChunkSite } from './types';
import { WORLD3D_CONFIG } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const MIN_RADIUS_M = 8;
// Cap visual placeholder boxes — Voronoi footprints can span hundreds of meters (a full grid cell)
// which puts the camera inside the box. 80m gives a visible town-sized cluster at world scale.
const MAX_RADIUS_M = 80;

export function buildSiteMeshes(data: ChunkData): ChunkSite[] {
  return data.sites.map((s) => {
    const local = gridPointToLocal(s.position.x, s.position.y, data.cx, data.cy);
    let maxR = 0;
    for (const v of s.footprint) {
      const dx = (v.x - s.position.x) * M;
      const dy = (v.y - s.position.y) * M;
      maxR = Math.max(maxR, Math.hypot(dx, dy));
    }
    return {
      id: s.id,
      kind: s.kind,
      localX: local.x,
      localZ: local.z,
      surfaceY: s.surfaceY,
      radius: Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, maxR)),
      walled: s.walled,
    };
  });
}
