/**
 * @file atlasSvg.ts — pure, DOM-free model builder for the native SVG atlas
 * renderer (Worldforge SP0, iteration #1).
 *
 * Mirrors how `atlasDraw.ts` is a pure canvas core: this module turns an
 * `FmgAtlasResult` into an ordered SVG layer model (ocean + per-cell land
 * polygons) with no React/DOM dependency, so it unit-tests with a stub atlas
 * and runs headless in the proof script.
 *
 * SP0 T2: land renders as merged per-biome regions (cells fused along shared
 * interior edges → no facets). Depth contours, rivers, routes, labels, filters,
 * marker and cell-pick are later SP0 tasks (T3+).
 */
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';

/** SVG "x,y x,y ..." points string for a cell's Voronoi polygon (graph coords). */
export function cellPolygonPoints(atlas: FmgAtlasResult, i: number): string {
  const vIds = atlas.pack.cells.v[i];
  if (!vIds) return '';
  const out: string[] = [];
  for (const vid of vIds) {
    const p = atlas.pack.vertices.p[vid];
    if (p) out.push(`${+p[0].toFixed(1)},${+p[1].toFixed(1)}`);
  }
  return out.join(' ');
}

/** Biome fill color for a land cell; neutral grey fallback. */
export function biomeFillForCell(atlas: FmgAtlasResult, i: number): string {
  const idx = atlas.pack.cells.biome?.[i];
  if (idx == null) return '#888888';
  return atlas.biomesData.color[idx] ?? '#888888';
}

export interface AtlasSvgPolygon { points: string; fill: string }
export interface AtlasSvgRegion { d: string; fill: string }
export interface AtlasSvgLayer { id: string; polygons: AtlasSvgPolygon[]; regions?: AtlasSvgRegion[] }
export interface AtlasSvgModel { width: number; height: number; layers: AtlasSvgLayer[] }

const LAND_THRESHOLD = 20;

/**
 * Merge Voronoi cells sharing a group key into boundary paths — same-key cells
 * fuse (their shared interior edges drop out), killing per-cell facets.
 * `keyOf(i)` returns the group key, or null to exclude the cell (e.g. water).
 * Returns one SVG path `d` per group (multiple `M…Z` subpaths for disjoint
 * pieces / holes), filled by `fillOf(key)`. The renderer fills `evenodd`.
 */
export function buildMergedRegions(
  atlas: FmgAtlasResult,
  keyOf: (i: number) => string | number | null,
  fillOf: (key: string | number) => string,
): AtlasSvgRegion[] {
  const cells = atlas.pack.cells;
  const n = cells.h.length;
  const groupEdges = new Map<string | number, Array<[number, number]>>();

  for (let i = 0; i < n; i++) {
    const key = keyOf(i);
    if (key == null) continue;
    const vIds = cells.v[i];
    if (!vIds || vIds.length < 3) continue;
    const neighbors = cells.c?.[i];
    for (let e = 0; e < vIds.length; e++) {
      const v1 = vIds[e];
      const v2 = vIds[(e + 1) % vIds.length];
      // The cell across this edge is the adjacent cell whose vertex list holds
      // both endpoints. Boundary edge = no such neighbor (map border) or that
      // neighbor belongs to a different group.
      let acrossKey: string | number | null = null;
      let hasNeighbor = false;
      if (neighbors) {
        for (const j of neighbors) {
          const jv = cells.v[j];
          if (jv && jv.includes(v1) && jv.includes(v2)) {
            acrossKey = keyOf(j);
            hasNeighbor = true;
            break;
          }
        }
      }
      if (!hasNeighbor || acrossKey !== key) {
        let arr = groupEdges.get(key);
        if (!arr) groupEdges.set(key, (arr = []));
        arr.push([v1, v2]);
      }
    }
  }

  const out: AtlasSvgRegion[] = [];
  for (const [key, edges] of groupEdges) {
    const d = stitchEdgesToPath(atlas, edges);
    if (d) out.push({ d, fill: fillOf(key) });
  }
  return out;
}

/** Stitch directed boundary edges (v1→v2) into closed `M…L…Z` subpaths. */
function stitchEdgesToPath(atlas: FmgAtlasResult, edges: Array<[number, number]>): string {
  const next = new Map<number, number[]>();
  for (const [a, b] of edges) {
    let arr = next.get(a);
    if (!arr) next.set(a, (arr = []));
    arr.push(b);
  }
  const verts = atlas.pack.vertices.p;
  const maxSteps = edges.length + 4;
  const parts: string[] = [];
  for (const [start] of next) {
    while (next.get(start)?.length) {
      const ring: number[] = [];
      let cur = start;
      let guard = 0;
      while (guard++ < maxSteps) {
        const nx = next.get(cur);
        if (!nx || !nx.length) break;
        ring.push(cur);
        cur = nx.pop()!;
        if (cur === start) break;
      }
      if (ring.length >= 3) {
        const pts: string[] = [];
        for (const v of ring) {
          const p = verts[v];
          if (p) pts.push(`${+p[0].toFixed(1)},${+p[1].toFixed(1)}`);
        }
        if (pts.length >= 3) parts.push('M' + pts.join('L') + 'Z');
      }
    }
  }
  return parts.join('');
}

/**
 * Build the ordered SVG layer model. Land is rendered as merged per-biome
 * regions (no Voronoi facets — SP0 T2); ocean is a flat rect drawn by the view.
 */
export function buildAtlasSvgModel(atlas: FmgAtlasResult): AtlasSvgModel {
  const cells = atlas.pack.cells;
  const keyOf = (i: number): number | null =>
    cells.h[i] >= LAND_THRESHOLD ? (cells.biome?.[i] ?? -1) : null;
  const fillOf = (key: string | number): string =>
    atlas.biomesData.color[key as number] ?? '#888888';
  const regions = buildMergedRegions(atlas, keyOf, fillOf);
  return {
    width: atlas.graphWidth,
    height: atlas.graphHeight,
    layers: [
      { id: 'ocean', polygons: [] },
      { id: 'land', polygons: [], regions },
    ],
  };
}
