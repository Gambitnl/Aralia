/**
 * @file atlasTravelGraph.ts — adapt a Worldforge FMG atlas to a `TravelGraph`.
 *
 * Lets the generic route planner (`systems/travel/routePlanning.ts`) pathfind
 * over the atlas Voronoi cells: neighbors from `pack.cells.c`, centroids from
 * `pack.cells.p`, passability from land height, and speed/danger/navigation from
 * the shared road-terrain core (`routeTerrain.ts`) — route tiers graded by FMG
 * group (highway/road/trail/path) with biome-graded off-road travel.
 *
 * Pure: no React/DOM. All gameplay-feel numbers live in `roadTunables.ts`.
 * milesPerUnit converts graph units → miles so travel time is realistic.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
import type { TravelTerrain, TransportOption } from '../../../types/travel';
import {
  buildRouteCellTiers, landSpeedFactor, landDanger, navDC, navCause, climbFactorFor,
  type RouteTier,
} from './routeTerrain';
import { OFFROAD_NAV_DC_DIFFICULT } from './roadTunables';
import { lookupForAtlas } from '../forests/forestKindForCell';
import { FOREST_NAV_DC_BUMP } from '../forests/forestTunables';
import { HIGHLAND_NAV_DC_BUMP, RANGE_MIN_H, PEAK_MIN_H } from '../mountains/mountainTunables';

/** Where a transport can go: land mounts/carts, water boats, or flying (both). */
export type TravelMobility = 'land' | 'water' | 'air';

/** Derive mobility from a transport option (vehicle.type drives water/air; else land). */
export function transportMobility(transport?: TransportOption | null): TravelMobility {
  const t = transport?.vehicle?.type;
  if (t === 'water' || t === 'air') return t;
  return 'land';
}

const LAND_THRESHOLD = 20;
const KM_TO_MILES = 0.621371;

// Biome speed/danger tables and the difficult-biome set moved to roadTunables.ts
// (single source of truth); this file consumes them through routeTerrain.ts.

type Packish = {
  cells: { c?: number[][]; p?: Array<[number, number]>; h?: ArrayLike<number>; biome?: ArrayLike<number> };
  routes?: Array<{ group?: string; cells?: number[]; points?: number[][] }>;
};

/**
 * Nearest land cell to `start` (BFS over neighbors), so a route can begin from
 * land even when the player's mapped atlas cell is sea/coastal — the integration
 * mismatch where the grid says "on land" but the FMG height says water. Returns
 * `start` if it is already land or no land is found within the search budget.
 */
export function nearestLandCell(atlas: FmgAtlasResult, start: number, maxVisited = 4000): number {
  const cells = (atlas.pack as unknown as Packish).cells;
  const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= LAND_THRESHOLD;
  if (isLand(start)) return start;
  const seen = new Set<number>([start]);
  const queue: number[] = [start];
  let visited = 0;
  while (queue.length && visited < maxVisited) {
    const cur = queue.shift()!;
    visited++;
    for (const nb of cells.c?.[cur] ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      if (isLand(nb)) return nb;
      queue.push(nb);
    }
  }
  return start;
}

/** All cell ids that lie on a LAND route (any tier). Kept for callers that only
 * need membership; graded consumers use buildRouteCellTiers directly. */
export function buildRoadCells(atlas: FmgAtlasResult): Set<number> {
  return new Set(buildRouteCellTiers(atlas.pack as unknown as Packish).keys());
}

/** Graph-unit → mile scale: from Azgaar `distanceScale` (km/unit) if present, else a continent-sized default. */
export function atlasMilesPerUnit(atlas: FmgAtlasResult): number {
  const ds = (atlas as unknown as { distanceScale?: number }).distanceScale;
  if (ds && ds > 0) return ds * KM_TO_MILES;
  return 3000 / (atlas.graphWidth || 1000); // fallback: ~3000-mile-wide world
}

export interface AtlasTravelGraphOptions {
  /** Where the chosen transport can travel: land (default) / water / air. */
  mobility?: TravelMobility;
}

/**
 * Build a `TravelGraph` over the atlas Voronoi cells, scoped to the transport's
 * mobility: land travel uses land cells (route-tier/biome grading), water travel
 * uses sea/lake cells, and flying (air) can cross both, ignoring terrain. This is
 * what stops a land mount from crossing the sea — or lets a flying mount cross it.
 */
export function buildAtlasTravelGraph(atlas: FmgAtlasResult, opts: AtlasTravelGraphOptions = {}): TravelGraph {
  const cells = (atlas.pack as unknown as Packish).cells;
  const tiers = buildRouteCellTiers(atlas.pack as unknown as Packish);
  const mobility = opts.mobility ?? 'land';
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= LAND_THRESHOLD;
  const passable = (c: number): boolean => {
    if (!cells.p?.[c]) return false;
    if (mobility === 'air') return true;          // flying crosses land + water
    return mobility === 'water' ? !isLand(c) : isLand(c);
  };
  // Route tiers only matter on foot/hoof — no roads at sea, and flight skips them.
  const tierOf = (c: number): RouteTier | null => (mobility === 'land' ? tiers.get(c) ?? null : null);
  return {
    neighbors: (c) => cells.c?.[c] ?? [],
    position: (c) => {
      const p = cells.p?.[c];
      return p ? [p[0], p[1]] : [0, 0];
    },
    terrain: (c): TravelTerrain => {
      if (mobility !== 'land') return 'open';      // no roads at sea; flight ignores terrain
      const tier = tierOf(c);
      if (tier === 'highway' || tier === 'road') return 'road';
      if (tier === 'trail') return 'trail';
      return navDC(biomeName(c), null) >= 15 ? 'difficult' : 'open';
    },
    passable,
    speedFactor: (c) => (mobility === 'land' ? landSpeedFactor(biomeName(c), tierOf(c)) : 1),
    // Relief costs time only on foot/hoof — water has no grades and flight
    // ignores them — so non-land mobility keeps a constant factor of 1 (the
    // member stays present, mirroring how speedFactor handles mobility).
    // The destination cell's tier softens the grade: engineered roads
    // switchback up a slope a trackless cell takes face-on.
    climbFactor: (from, to) => (mobility === 'land'
      ? climbFactorFor((cells.h?.[to] ?? 0) - (cells.h?.[from] ?? 0), tierOf(to))
      : 1),
    danger: (c) => (mobility === 'land' ? landDanger(biomeName(c), tierOf(c))
                                        : landDanger(biomeName(c), null)),
  };
}

/**
 * Per-cell getting-lost info for navDrift: DC + player-facing cause. Bump
 * order is fixed: base tier/biome ladder → elevation (2026-07-11 mountains:
 * OFF-ROUTE cells only — trackless crag country h >= PEAK_MIN_H is at least
 * difficult wilderness regardless of biome, bump-then-floor
 * max(dc + HIGHLAND_NAV_DC_BUMP, 15); the highland band below adds
 * HIGHLAND_NAV_DC_BUMP; a graded route keeps its ladder, that is what passes
 * are FOR) → haunted/fey named forests LAST (2026-07-11 forests campaign:
 * +FOREST_NAV_DC_BUMP on any losable cell — but a maintained road, dc 0,
 * never starts losing travelers). The cause is never changed by the bumps.
 */
export function buildNavInfoFn(
  atlas: FmgAtlasResult,
): (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' } {
  const cells = (atlas.pack as unknown as Packish).cells;
  const tiers = buildRouteCellTiers(atlas.pack as unknown as Packish);
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  const forestKind = lookupForAtlas(atlas); // built once per atlas (WeakMap-shared)
  return (c) => {
    const tier = tiers.get(c) ?? null;
    let dc = navDC(biomeName(c), tier);
    if (!tier) {
      // Crag rule is bump-then-floor (controller ruling, monotonicity): the
      // highland bump applies through the h >= PEAK_MIN_H hand-off, so a
      // difficult biome reads max(15+3, 15) = 18 above the band edge exactly
      // as at h 69 — the DC never drops as the ground gets higher.
      const h = cells.h?.[c] ?? 0;
      if (h >= PEAK_MIN_H) dc = Math.max(dc + HIGHLAND_NAV_DC_BUMP, OFFROAD_NAV_DC_DIFFICULT);
      else if (h >= RANGE_MIN_H) dc += HIGHLAND_NAV_DC_BUMP;
    }
    if (dc > 0) {
      const kind = forestKind(c);
      if (kind === 'haunted' || kind === 'fey') dc += FOREST_NAV_DC_BUMP;
    }
    return { dc, cause: navCause(biomeName(c), tier) };
  };
}
