/**
 * @file submapTravelGraph.ts — adapt an SP1 `SubmapModel` to a `TravelGraph`.
 *
 * Brings the submap drill tiers (region / local / locale) into the same travel
 * system as the atlas: the route planner can plan fastest routes over a submap's
 * Voronoi cells. Cell adjacency is derived from shared polygon edges (the model
 * doesn't store a neighbor list); terrain/danger come from each cell's sub-biome.
 *
 * Pure: no React/DOM. Cell ids are indices into `model.cells`.
 */
import type { SubmapModel, SubmapCell, Pt } from '../submap/submapEngine';
import type { TravelGraph } from '../../travel/routePlanning';
import type { TravelTerrain } from '../../../types/travel';

/** Sub-biomes that travel as difficult terrain (half speed). */
const DIFFICULT_SUBBIOMES = new Set<string>([
  'Wetland', 'Glacier', 'Tundra', 'Taiga', 'Tropical rainforest', 'Temperate rainforest',
  'Hot desert', 'Cold desert',
]);
const SUBBIOME_DANGER: Record<string, number> = {
  Wetland: 0.45, Glacier: 0.6, Tundra: 0.45, Taiga: 0.4,
  'Tropical rainforest': 0.5, 'Temperate rainforest': 0.4,
  'Hot desert': 0.5, 'Cold desert': 0.45, Grassland: 0.2, Savanna: 0.3,
};
const DEFAULT_SUBBIOME_DANGER = 0.25;

/** Vertex-mean centroid (inside convex Voronoi cells). */
function centroid(poly: Pt[]): Pt {
  let x = 0, y = 0;
  for (const [px, py] of poly) { x += px; y += py; }
  return [x / poly.length, y / poly.length];
}

/** Order-independent rounded key for an undirected polygon edge. */
function edgeKey(a: Pt, b: Pt): string {
  const ax = Math.round(a[0] * 100), ay = Math.round(a[1] * 100);
  const bx = Math.round(b[0] * 100), by = Math.round(b[1] * 100);
  return ax < bx || (ax === bx && ay <= by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

/** Adjacency for submap cells: two cells neighbor iff they share a polygon edge. */
export function buildSubmapAdjacency(cells: SubmapCell[]): number[][] {
  const edgeOwners = new Map<string, number[]>();
  cells.forEach((c, i) => {
    const p = c.polygon;
    for (let j = 0; j < p.length; j++) {
      const k = edgeKey(p[j], p[(j + 1) % p.length]);
      const arr = edgeOwners.get(k);
      if (arr) arr.push(i); else edgeOwners.set(k, [i]);
    }
  });
  const adj: number[][] = cells.map(() => []);
  for (const owners of edgeOwners.values()) {
    if (owners.length < 2) continue;
    for (let a = 0; a < owners.length; a++) {
      for (let b = a + 1; b < owners.length; b++) {
        adj[owners[a]].push(owners[b]);
        adj[owners[b]].push(owners[a]);
      }
    }
  }
  return adj.map((a) => Array.from(new Set(a)));
}

/** Build a `TravelGraph` over a submap's Voronoi cells (ids = indices into model.cells). */
export function buildSubmapTravelGraph(model: SubmapModel): TravelGraph {
  const adj = buildSubmapAdjacency(model.cells);
  const centroids = model.cells.map((c) => centroid(c.polygon));
  const biomeOf = (i: number): string => model.cells[i]?.biome ?? model.biome ?? '';
  return {
    neighbors: (c) => adj[c] ?? [],
    position: (c) => centroids[c] ?? [0, 0],
    terrain: (c): TravelTerrain => (DIFFICULT_SUBBIOMES.has(biomeOf(c)) ? 'difficult' : 'open'),
    passable: () => true, // a submap is local land within the parent cell
    danger: (c) => SUBBIOME_DANGER[biomeOf(c)] ?? DEFAULT_SUBBIOME_DANGER,
  };
}
