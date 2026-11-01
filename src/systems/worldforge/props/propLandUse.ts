/** Keep an object's intended use tied to its source home or working place.
 * These limits govern first placement only. They do not assign legal ownership
 * or grant access, and established objects never migrate through this helper. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:20:26
 * Dependents: systems/worldforge/bridge/groundProps.ts, systems/worldforge/props/propGenerationSource.ts, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { clearsRuralHomeReservations } from '../town/ruralHomesteadArtifacts';
import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { PropAffiliation, PropInstance } from './propSchema';
import { footprintBounds, footprintFitsLot, validFootprint, type FootprintPoint, type FootprintBounds } from './propFootprint';
import { FEET_PER_METER, makeFlatSurfaceProbe, type SurfaceProbe } from '../terrain/surfaceProbe';

type Point = { x: number; z: number };
export interface PropLandConstraint {
  issue?: string;
  /** Conservative rejection only; exact source-land containment still decides. */
  bounds?: FootprintBounds;
  contains: (xM: number, zM: number, radiusM: number) => boolean;
  /** Fresh placement checks the actual oriented hull rather than its broad-phase disc. */
  containsHull: (hull: readonly FootprintPoint[]) => boolean;
  /** A dock supplies its actual rendered deck top, not the seabed below it. */
  surface?: SurfaceProbe;
}

export function isPropAffiliation(value: unknown): value is PropAffiliation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<PropAffiliation> & { xM?: number; zM?: number; radiusM?: number };
  if (typeof a.id !== 'string' || !a.id.trim()) return false;
  if (a.kind === 'building' || a.kind === 'dock') return true;
  return (a.kind === 'court' || a.kind === 'market') && [a.xM, a.zM, a.radiusM].every(Number.isFinite) && (a.radiusM ?? 0) > 0;
}

function boundaryDistance(p: Point, polygon: readonly Point[]): number {
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2)) : 0;
    distance = Math.min(distance, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return distance;
}
function inside(p: Point, polygon: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
const refused = (issue: string): PropLandConstraint => ({ issue, contains: () => false, containsHull: () => false });
function polygonConstraint(polygon: readonly Point[] | undefined, issue: string): PropLandConstraint {
  if (!polygon || polygon.length < 3 || polygon.some(p => ![p.x, p.z].every(Number.isFinite))
    || Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a.x * b.z - b.x * a.z; }, 0)) < 1e-8) return refused(issue);
  return { bounds: footprintBounds(polygon), contains: (xM, zM, radiusM) => Number.isFinite(radiusM) && radiusM > 0
    && inside({ x: xM, z: zM }, polygon) && boundaryDistance({ x: xM, z: zM }, polygon) >= radiusM + .05,
    containsHull: hull => footprintFitsLot(hull, polygon),
  };
}

/** Resolve the known emission source, never the nearest building. A missing
 * source lot is a refusal, rather than permission to borrow a neighbor's land. */
function sourceLandConstraint(ground: GroundWorld, prop: PropInstance): PropLandConstraint {
  const a = prop.affiliation;
  if (a === undefined) return { contains: () => true, containsHull: validFootprint };
  if (!isPropAffiliation(a)) return refused('invalid-affiliation');
  if (a.kind === 'building') {
    const buildings = ground.buildings.filter(b => b.id === a.id);
    if (buildings.length !== 1) return refused('unknown-serving-building');
    return polygonConstraint(buildings[0].propParcelM, 'missing-serving-parcel');
  }
  if (a.kind === 'dock') {
    const match = /^deck:(\d+)$/.exec(a.id), deck = match ? ground.decks?.[Number(match[1])] : undefined;
    if (!deck || deck.kind !== 'dock' || !Number.isFinite(deck.topY)) return refused('unknown-serving-dock');
    const land = polygonConstraint(deck.cornersM, 'invalid-serving-dock');
    return land.issue ? land : { ...land, surface: makeFlatSurfaceProbe(deck.topY * FEET_PER_METER) };
  }
  // Court receipts and the existing market anchor carry their own area at
  // emission. Keeping the entire model inside it preserves the shared use.
  return { bounds: {minX:a.xM-a.radiusM,maxX:a.xM+a.radiusM,minZ:a.zM-a.radiusM,maxZ:a.zM+a.radiusM},
    contains: (xM, zM, radiusM) => Number.isFinite(radiusM) && radiusM > 0
    && Math.hypot(xM - a.xM, zM - a.zM) + radiusM + .05 <= a.radiusM,
    containsHull: hull => validFootprint(hull)&&hull.every(p=>Math.hypot(p.x-a.xM,p.z-a.zM)+.05<=a.radiusM),
  };
}

/** Fresh props respect the same source yards and full-width tracks as farms.
 * Coordinates return to canonical feet before the existing polygon query.
 * This path is used by prospective placement, never to move accepted props. */
export function propLandConstraint(ground: GroundWorld, prop: PropInstance): PropLandConstraint {
  const land = sourceLandConstraint(ground, prop);
  const towns = (ground.townPlans ?? []).filter(town => town.plan.ruralSources);
  if (land.issue || !towns.length) return land;
  const origin = ground.boundsFeet;
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return refused('missing-rural-projection');
  const reservationsClear = (hull: readonly FootprintPoint[]): boolean => {
    if (!validFootprint(hull)) return false;
    const feetHull = hull.map(point => ({x: origin.x + point.x / .3048, z: origin.y + point.z / .3048}));
    return towns.every(town => {
      const sources = town.plan.ruralSources!;
      if (sources.layoutRecipe !== 'rural-family-v1' || sources.homesteads.version !== 1) return false;
      const own = prop.affiliation?.kind === 'building'
        ? sources.homesteads.sites.filter(site => prop.affiliation!.id === 'wf-plot-' + town.burgId + '-' + site.plotId) : [];
      if (own.length > 1) return false;
      return clearsRuralHomeReservations(feetHull, sources, 0, own[0]?.plotId);
    });
  };
  return {...land,
    containsHull: hull => land.containsHull(hull) && reservationsClear(hull),
    contains: (xM, zM, radiusM) => land.contains(xM,zM,radiusM)
      && Number.isFinite(radiusM) && radiusM > 0
      && reservationsClear([{x:xM-radiusM,z:zM-radiusM},{x:xM+radiusM,z:zM-radiusM},
        {x:xM+radiusM,z:zM+radiusM},{x:xM-radiusM,z:zM+radiusM}]),
  };
}
