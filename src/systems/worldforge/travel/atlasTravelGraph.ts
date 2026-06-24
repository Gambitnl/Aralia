/**
 * @file atlasTravelGraph.ts — adapt a Worldforge FMG atlas to a `TravelGraph`.
 *
 * Lets the generic route planner (`systems/travel/routePlanning.ts`) pathfind
 * over the atlas Voronoi cells: neighbors from `pack.cells.c`, centroids from
 * `pack.cells.p`, terrain from roads (`pack.routes[].cells`) + biome, passability
 * from land height, and a per-cell danger baseline from biome (halved on roads).
 *
 * Pure: no React/DOM. Biome→terrain/danger tables are deliberately simple; tune
 * later. milesPerUnit converts graph units → miles so travel time is realistic.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
import type { TravelTerrain } from '../../../types/travel';

const LAND_THRESHOLD = 20;
const KM_TO_MILES = 0.621371;

/** Biomes that count as difficult terrain (half travel speed off-road). */
const DIFFICULT_BIOMES = new Set<string>([
  'Hot desert', 'Cold desert', 'Tropical rainforest', 'Temperate rainforest',
  'Taiga', 'Tundra', 'Glacier', 'Wetland',
]);

/** Wilderness danger baseline per biome (0..1); roads halve it. */
const BIOME_DANGER: Record<string, number> = {
  'Hot desert': 0.5, 'Cold desert': 0.45, 'Tropical rainforest': 0.55, 'Temperate rainforest': 0.4,
  'Taiga': 0.4, 'Tundra': 0.45, 'Glacier': 0.6, 'Wetland': 0.5,
  'Savanna': 0.3, 'Grassland': 0.2, 'Tropical seasonal forest': 0.35, 'Temperate deciduous forest': 0.3,
};
const DEFAULT_DANGER = 0.25;

type Packish = {
  cells: { c?: number[][]; p?: Array<[number, number]>; h?: ArrayLike<number>; biome?: ArrayLike<number> };
  routes?: Array<{ cells?: number[] }>;
};

/** All cell ids that lie on a road/route (terrain = road there). */
export function buildRoadCells(atlas: FmgAtlasResult): Set<number> {
  const set = new Set<number>();
  for (const r of ((atlas.pack as unknown as Packish).routes ?? [])) {
    for (const c of r.cells ?? []) set.add(c);
  }
  return set;
}

/** Graph-unit → mile scale: from Azgaar `distanceScale` (km/unit) if present, else a continent-sized default. */
export function atlasMilesPerUnit(atlas: FmgAtlasResult): number {
  const ds = (atlas as unknown as { distanceScale?: number }).distanceScale;
  if (ds && ds > 0) return ds * KM_TO_MILES;
  return 3000 / (atlas.graphWidth || 1000); // fallback: ~3000-mile-wide world
}

export interface AtlasTravelGraphOptions {
  /** Precomputed road cells (defaults to buildRoadCells). */
  roadCells?: Set<number>;
}

/** Build a `TravelGraph` over the atlas's land Voronoi cells. */
export function buildAtlasTravelGraph(atlas: FmgAtlasResult, opts: AtlasTravelGraphOptions = {}): TravelGraph {
  const cells = (atlas.pack as unknown as Packish).cells;
  const roadCells = opts.roadCells ?? buildRoadCells(atlas);
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  return {
    neighbors: (c) => cells.c?.[c] ?? [],
    position: (c) => {
      const p = cells.p?.[c];
      return p ? [p[0], p[1]] : [0, 0];
    },
    terrain: (c): TravelTerrain => (roadCells.has(c) ? 'road' : (DIFFICULT_BIOMES.has(biomeName(c)) ? 'difficult' : 'open')),
    passable: (c) => (cells.h?.[c] ?? 0) >= LAND_THRESHOLD,
    danger: (c) => {
      const base = BIOME_DANGER[biomeName(c)] ?? DEFAULT_DANGER;
      return roadCells.has(c) ? base * 0.5 : base;
    },
  };
}
