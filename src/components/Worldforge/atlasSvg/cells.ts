/**
 * @file atlasSvg/cells.ts — Voronoi cell geometry and per-cell readouts for the
 * SVG atlas model (split out of atlasSvg.ts, MOD-3.5, 2026-09-09).
 *
 * The foundation module of the atlasSvg/ folder: polygon points, the shared
 * same-key region merger every overlay is built on, the point→cell lookup, the
 * cell trait readout, and the continuous color-ramp cell fill. water.ts,
 * political.ts and labelsAndGlyphs.ts all sit on top of this one; nothing here
 * imports them back, so the folder stays an acyclic layer.
 *
 * Behavior is unchanged — the function bodies are the original lines verbatim.
 * The one edit is that LAND_THRESHOLD is now exported (it was module-private
 * when every consumer lived in one file) so the sibling modules read the same
 * constant instead of redeclaring it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: components/Worldforge/atlasSvg.ts, components/Worldforge/atlasSvg/labelsAndGlyphs.ts, components/Worldforge/atlasSvg/political.ts, components/Worldforge/atlasSvg/water.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';

export interface AtlasSvgPolygon { points: string; fill: string }
export interface AtlasSvgRegion { d: string; fill: string }
export interface AtlasSvgMarker { x: number; y: number; type?: string }

/** FMG height at or above which a cell is land. */
export const LAND_THRESHOLD = 20;

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
 * Owned point→cell lookup (SP0 T7): the Voronoi cell containing a graph-space
 * point is the cell whose site (`cells.p`) is nearest — no iframe `findCell`.
 * Brute force over cell centers (fine at ~10k cells per click).
 */
export function findCellAtPoint(atlas: FmgAtlasResult, gx: number, gy: number): number {
  const p = atlas.pack.cells.p;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (!c) continue;
    const dx = c[0] - gx;
    const dy = c[1] - gy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export interface CellTraits {
  i: number;
  height: number;
  land: boolean;
  biome?: string;
  state?: string;
  province?: string;
  culture?: string;
  religion?: string;
  /** Cell population (pack.cells.pop), when present. */
  population?: number;
  burg?: { name: string; capital: boolean };
}

/** Owned cell trait readout (SP0 T7) — the native equivalent of the iframe's describeCell. */
export function cellTraits(atlas: FmgAtlasResult, i: number): CellTraits {
  const cells = atlas.pack.cells;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pack = atlas.pack as any;
  const h = cells.h[i];
  const t: CellTraits = { i, height: h, land: h >= LAND_THRESHOLD };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biomeNames = (atlas.biomesData as any)?.name as string[] | undefined;
  if (biomeNames && cells.biome) t.biome = biomeNames[cells.biome[i]];
  const sId = cells.state?.[i];
  if (sId && pack.states?.[sId] && !pack.states[sId].removed) t.state = pack.states[sId].fullName || pack.states[sId].name;
  const pId = cells.province?.[i];
  if (pId && pack.provinces?.[pId] && !pack.provinces[pId].removed) t.province = pack.provinces[pId].fullName || pack.provinces[pId].name;
  const popArr = (cells as { pop?: ArrayLike<number> }).pop;
  if (popArr && popArr[i] > 0) t.population = popArr[i];
  const cuId = cells.culture?.[i];
  if (cuId && pack.cultures?.[cuId]?.i) t.culture = pack.cultures[cuId].name;
  const reId = cells.religion?.[i];
  if (reId && pack.religions?.[reId]?.i) t.religion = pack.religions[reId].name;
  const bId = cells.burg?.[i];
  if (bId && pack.burgs?.[bId] && !pack.burgs[bId].removed) {
    t.burg = { name: pack.burgs[bId].name, capital: !!pack.burgs[bId].capital };
  }
  return t;
}

/**
 * Per-cell continuous color-ramp overlay (Azgaar's "cell fill" pattern — e.g.
 * population/temperature/precipitation). `valueOf(i)` returns the cell's scalar
 * value or null to skip it; values are min/max normalized across included land
 * cells and mapped through `ramp`. Returns one filled polygon per included cell.
 */
export interface CellRampOptions {
  /**
   * Clamp the normalization domain to this central percentile band (0–0.5)
   * before mapping to the ramp. Without it, a handful of outlier cells (e.g.
   * frozen mountain peaks dragging the temperature minimum far below the
   * common range) compress every ordinary cell into one end of the ramp, so
   * the whole map reads as a single colour. Clamping to e.g. 0.02 spreads the
   * common 2nd–98th-percentile range across the full ramp; the rare outliers
   * simply pin to the ends. Population/precipitation pass nothing (their raw
   * spread is already legible).
   */
  clampPercentile?: number;
}

export function buildCellRamp(
  atlas: FmgAtlasResult,
  valueOf: (i: number) => number | null,
  ramp: (t: number) => string,
  opts: CellRampOptions = {},
): AtlasSvgPolygon[] {
  const cells = atlas.pack.cells;
  const n = cells.h.length;
  const vals: Array<number | null> = new Array(n);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = cells.h[i] >= LAND_THRESHOLD ? valueOf(i) : null;
    vals[i] = v;
    if (v != null) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) return [];

  // Percentile-clamp the domain so outliers don't flatten the common range.
  const p = opts.clampPercentile;
  if (p != null && p > 0 && p < 0.5) {
    const sorted = (vals.filter((v) => v != null) as number[]).sort((a, b) => a - b);
    if (sorted.length > 2) {
      const lo = sorted[Math.floor((sorted.length - 1) * p)];
      const hi = sorted[Math.ceil((sorted.length - 1) * (1 - p))];
      if (hi > lo) { min = lo; max = hi; }
    }
  }

  const range = max - min || 1;
  const out: AtlasSvgPolygon[] = [];
  for (let i = 0; i < n; i++) {
    const v = vals[i];
    if (v == null) continue;
    const points = cellPolygonPoints(atlas, i);
    if (!points) continue;
    const t = (v - min) / range;
    out.push({ points, fill: ramp(t < 0 ? 0 : t > 1 ? 1 : t) });
  }
  return out;
}

/** Voronoi cell outlines (Azgaar "cells" layer) — one points string per cell. */
export function buildCellOutlines(atlas: FmgAtlasResult): string[] {
  const out: string[] = [];
  const n = atlas.pack.cells.h.length;
  for (let i = 0; i < n; i++) {
    const points = cellPolygonPoints(atlas, i);
    if (points) out.push(points);
  }
  return out;
}
