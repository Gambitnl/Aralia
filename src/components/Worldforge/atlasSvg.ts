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
export interface AtlasSvgMarker { x: number; y: number; type?: string }
export interface AtlasSvgLayer { id: string; polygons: AtlasSvgPolygon[]; regions?: AtlasSvgRegion[] }
export interface AtlasSvgRoute { d: string; group: string }
export interface AtlasSvgBurg { x: number; y: number; capital: boolean }
export interface AtlasSvgModel {
  width: number;
  height: number;
  layers: AtlasSvgLayer[];
  coastline?: string;
  rivers?: AtlasSvgRegion[];
  routes?: AtlasSvgRoute[];
  burgs?: AtlasSvgBurg[];
  stateBorders?: string;
  /** Merged per-culture land regions (Azgaar "cultural" overlay; toggle layer). */
  cultureRegions?: AtlasSvgRegion[];
  /** Merged per-religion land regions (Azgaar "religions" overlay; toggle layer). */
  religionRegions?: AtlasSvgRegion[];
  /** Merged per-province land regions (Azgaar "provinces" overlay; toggle layer). */
  provinceRegions?: AtlasSvgRegion[];
  /** Per-cell population color-ramp fills (Azgaar "population" overlay; toggle layer). */
  populationCells?: AtlasSvgPolygon[];
  /** Per-cell temperature color-ramp fills (Azgaar "temperature" overlay; toggle layer). */
  temperatureCells?: AtlasSvgPolygon[];
  /** Per-cell precipitation color-ramp fills (Azgaar "precipitation" overlay; toggle layer). */
  precipitationCells?: AtlasSvgPolygon[];
  /** Voronoi cell outlines, points strings (Azgaar "cells" overlay; toggle layer). */
  cellOutlines?: string[];
  /** Point-of-interest markers (Azgaar "markers" overlay; toggle layer). */
  poiMarkers?: AtlasSvgMarker[];
  /** Cold (glacier/iceberg) cell fills (Azgaar "ice" overlay; toggle layer). */
  iceCells?: AtlasSvgPolygon[];
  /** Event/danger zone cell fills (Azgaar "zones" overlay; toggle layer). */
  zoneCells?: AtlasSvgPolygon[];
  /** Military regiments as markers (Azgaar "military" overlay; toggle layer). */
  regiments?: AtlasSvgMarker[];
  labels?: AtlasSvgLabel[];
}

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
 * Ring distance of every cell from the coast (SP0 T3b). Land cells = 0; water
 * cells = BFS hop count over cell adjacency from the nearest land; water not
 * reachable from land stays -1 (open deep sea). Pure and unit-testable.
 */
export function oceanDepthDistance(atlas: FmgAtlasResult): number[] {
  const cells = atlas.pack.cells;
  const n = cells.h.length;
  const dist = new Array<number>(n).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.h[i] >= LAND_THRESHOLD) { dist[i] = 0; q.push(i); }
  }
  let head = 0;
  while (head < q.length) {
    const c = q[head++];
    const nb = cells.c?.[c];
    if (!nb) continue;
    for (const j of nb) {
      if (dist[j] === -1 && cells.h[j] < LAND_THRESHOLD) {
        dist[j] = dist[c] + 1;
        q.push(j);
      }
    }
  }
  return dist;
}

/** Graduated blue for a depth band: light at the coast (band 1) → deeper blue. */
function depthBandFill(band: number, maxBands: number): string {
  const t = (band - 1) / Math.max(1, maxBands - 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(0x8a, 0x33)},${lerp(0xbe, 0x6e)},${lerp(0xe2, 0xa4)})`;
}

/**
 * Merged shallow-water depth bands near the coast (SP0 T3b): water cells within
 * `maxBands` rings of land are grouped by ring distance and merged into filled
 * regions (graduated blue, lightest at the coast). Deeper open sea is left to
 * the view's base ocean rect.
 */
export function buildOceanDepthBands(atlas: FmgAtlasResult, maxBands = 4): AtlasSvgRegion[] {
  const cells = atlas.pack.cells;
  const dist = oceanDepthDistance(atlas);
  const keyOf = (i: number): number | null =>
    cells.h[i] < LAND_THRESHOLD && dist[i] >= 1 && dist[i] <= maxBands ? dist[i] : null;
  return buildMergedRegions(atlas, keyOf, (k) => depthBandFill(k as number, maxBands));
}

/**
 * Offset a centerline polyline by per-point half-width into a closed filled
 * ribbon path (SP0 T4). Perpendicular is the central-difference tangent rotated
 * 90°; the path runs up the left offset and back down the right.
 */
export function buildRiverRibbon(points: Array<[number, number]>, halfWidths: number[]): string {
  const n = points.length;
  if (n < 2) return '';
  const left: string[] = [];
  const right: string[] = [];
  for (let k = 0; k < n; k++) {
    const prev = points[Math.max(0, k - 1)];
    const nxt = points[Math.min(n - 1, k + 1)];
    let tx = nxt[0] - prev[0];
    let ty = nxt[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const px = -ty;
    const py = tx;
    const h = halfWidths[k];
    left.push(`${+(points[k][0] + px * h).toFixed(1)},${+(points[k][1] + py * h).toFixed(1)}`);
    right.push(`${+(points[k][0] - px * h).toFixed(1)},${+(points[k][1] - py * h).toFixed(1)}`);
  }
  right.reverse();
  return `M${left.join('L')}L${right.join('L')}Z`;
}

/**
 * Rivers as discharge-tapered filled ribbons (SP0 T4) — Azgaar's `#rivers`
 * (filled, no stroke, `#5d97bb`). Width is derived from `sqrt(discharge)` (the
 * flux magnitude; FMG's `width` km field is sub-pixel here), tapering from a
 * thin source to the mouth. `widthScale` tunes the render weight in graph units.
 */
export function buildRivers(atlas: FmgAtlasResult, widthScale = 1): AtlasSvgRegion[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rivers: any[] = (atlas.pack as any).rivers ?? [];
  const out: AtlasSvgRegion[] = [];
  for (const r of rivers) {
    const cellIds: number[] = (r.cells ?? []).filter((c: number) => c >= 0);
    const points = cellIds.map((c) => atlas.pack.cells.p[c]).filter(Boolean) as Array<[number, number]>;
    if (points.length < 2) continue;
    const n = points.length;
    const mouthHalf = Math.max(0.35, Math.sqrt(r.discharge ?? 0) * 0.18 * widthScale);
    const sourceHalf = Math.max(0.3, mouthHalf * 0.28);
    const halfWidths = points.map((_, k) => {
      const t = n > 1 ? k / (n - 1) : 1;
      return sourceHalf + (mouthHalf - sourceHalf) * t;
    });
    const d = buildRiverRibbon(points, halfWidths);
    if (d) out.push({ d, fill: '#5d97bb' });
  }
  return out;
}

/** Route polylines grouped by kind (SP0 T5): roads / trails / searoutes. */
export function buildRoutes(atlas: FmgAtlasResult): AtlasSvgRoute[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes: any[] = (atlas.pack as any).routes ?? [];
  const out: AtlasSvgRoute[] = [];
  for (const r of routes) {
    const pts: Array<[number, number]> = r.points ?? [];
    if (pts.length < 2) continue;
    const d = 'M' + pts.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join('L');
    out.push({ d, group: r.group ?? 'roads' });
  }
  return out;
}

/**
 * State borders (SP0 T5): segments along edges shared by two LAND cells with
 * different non-zero state ids (each shared edge once). Returned as a path of
 * disconnected `M…L` segments for a dashed stroke — borders are a network, not
 * closed rings, so per-edge segments (not ring-stitching) are correct.
 */
export function buildStateBorders(atlas: FmgAtlasResult): string {
  const cells = atlas.pack.cells;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (cells as any).state as ArrayLike<number> | undefined;
  if (!state) return '';
  const verts = atlas.pack.vertices.p;
  const n = cells.h.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.h[i] < LAND_THRESHOLD) continue;
    const si = state[i];
    if (!si) continue;
    const vIds = cells.v[i];
    const nb = cells.c?.[i];
    if (!vIds || !nb) continue;
    for (let e = 0; e < vIds.length; e++) {
      const v1 = vIds[e];
      const v2 = vIds[(e + 1) % vIds.length];
      let j = -1;
      for (const cand of nb) {
        const cv = cells.v[cand];
        if (cv && cv.includes(v1) && cv.includes(v2)) { j = cand; break; }
      }
      if (j <= i) continue; // trace each shared edge once (and skip map border)
      const sj = state[j];
      if (sj && sj !== si && cells.h[j] >= LAND_THRESHOLD) {
        const pa = verts[v1];
        const pb = verts[v2];
        if (pa && pb) parts.push(`M${+pa[0].toFixed(1)},${+pa[1].toFixed(1)}L${+pb[0].toFixed(1)},${+pb[1].toFixed(1)}`);
      }
    }
  }
  return parts.join('');
}

/** Burg markers (SP0 T5): live burgs with map coords + capital flag. */
export function buildBurgs(atlas: FmgAtlasResult): AtlasSvgBurg[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const burgs: any[] = (atlas.pack as any).burgs ?? [];
  const out: AtlasSvgBurg[] = [];
  for (const b of burgs) {
    if (!b || !b.i || b.removed) continue;
    out.push({ x: b.x, y: b.y, capital: !!b.capital });
  }
  return out;
}

export type LabelKind = 'state' | 'capital' | 'town';
export interface AtlasSvgLabel { x: number; y: number; text: string; kind: LabelKind }
/** A placed (decluttered) label in screen space. */
export interface PlacedLabel extends AtlasSvgLabel { sx: number; sy: number; fontSize: number }

/** Map-space label candidates (SP0 T5c): state names + burg names. */
export function buildLabels(atlas: FmgAtlasResult): AtlasSvgLabel[] {
  const out: AtlasSvgLabel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const burgs: any[] = (atlas.pack as any).burgs ?? [];
  for (const b of burgs) {
    if (!b || !b.i || b.removed || !b.name) continue;
    out.push({ x: b.x, y: b.y, text: b.name, kind: b.capital ? 'capital' : 'town' });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const states: any[] = (atlas.pack as any).states ?? [];
  for (const s of states) {
    if (!s || !s.i || s.removed || !s.name) continue;
    const pole = s.pole ?? atlas.pack.cells.p[s.center];
    if (!pole) continue;
    out.push({ x: pole[0], y: pole[1], text: s.fullName || s.name, kind: 'state' });
  }
  return out;
}

const LABEL_FONT: Record<LabelKind, number> = { state: 14, capital: 11, town: 9 };
const LABEL_PRIORITY: Record<LabelKind, number> = { state: 0, capital: 1, town: 2 };

export interface DeclutterView { k: number; x: number; y: number }
export interface DeclutterOptions { capitalMinScale?: number; townMinScale?: number }

/**
 * Zoom-threshold + greedy bbox-collision declutter (SP0 T5c). State labels
 * always show; capitals appear past `capitalMinScale`, towns past
 * `townMinScale`. Higher-priority labels (state > capital > town) claim space
 * first; overlapping lower-priority labels are dropped. Screen-space (constant
 * text size), so positions use the live view transform.
 */
export function declutterLabels(
  labels: AtlasSvgLabel[],
  view: DeclutterView,
  opts: DeclutterOptions = {},
): PlacedLabel[] {
  const capMin = opts.capitalMinScale ?? 1.2;
  const townMin = opts.townMinScale ?? 2.0;
  const visible = labels.filter((l) =>
    l.kind === 'state'
    || (l.kind === 'capital' && view.k >= capMin)
    || (l.kind === 'town' && view.k >= townMin),
  );
  visible.sort((a, b) => LABEL_PRIORITY[a.kind] - LABEL_PRIORITY[b.kind]);
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const out: PlacedLabel[] = [];
  for (const l of visible) {
    const sx = l.x * view.k + view.x;
    const sy = l.y * view.k + view.y;
    const fontSize = LABEL_FONT[l.kind];
    const w = l.text.length * fontSize * 0.55;
    const h = fontSize;
    const box = { x: sx - w / 2, y: sy - h / 2, w, h };
    const hit = placed.some((p) =>
      !(box.x + box.w < p.x || p.x + p.w < box.x || box.y + box.h < p.y || p.y + p.h < box.y),
    );
    if (hit) continue;
    placed.push(box);
    out.push({ ...l, sx, sy, fontSize });
  }
  return out;
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

/** Linear interpolation between two #rrggbb hex colors. */
function lerpHex(a: string, b: string, t: number): string {
  const ai = parseInt(a.slice(1), 16);
  const bi = parseInt(b.slice(1), 16);
  const r = Math.round(((ai >> 16) & 255) + (((bi >> 16) & 255) - ((ai >> 16) & 255)) * t);
  const g = Math.round(((ai >> 8) & 255) + (((bi >> 8) & 255) - ((ai >> 8) & 255)) * t);
  const bl = Math.round((ai & 255) + ((bi & 255) - (ai & 255)) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/** Three-stop color ramp: t in [0,1] → color through c0 → c1 → c2. */
function ramp3(c0: string, c1: string, c2: string): (t: number) => string {
  return (t: number) => (t < 0.5 ? lerpHex(c0, c1, t * 2) : lerpHex(c1, c2, (t - 0.5) * 2));
}

const RAMP_POPULATION = ramp3('#ffffcc', '#fd8d3c', '#800026'); // sparse → dense
const RAMP_TEMPERATURE = ramp3('#2c7bb6', '#ffffbf', '#d7191c'); // cold → hot
const RAMP_PRECIPITATION = ramp3('#f6e8c3', '#80cdc1', '#01665e'); // dry → wet

/**
 * Per-cell continuous color-ramp overlay (Azgaar's "cell fill" pattern — e.g.
 * population/temperature/precipitation). `valueOf(i)` returns the cell's scalar
 * value or null to skip it; values are min/max normalized across included land
 * cells and mapped through `ramp`. Returns one filled polygon per included cell.
 */
export function buildCellRamp(
  atlas: FmgAtlasResult,
  valueOf: (i: number) => number | null,
  ramp: (t: number) => string,
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
  const range = max - min || 1;
  const out: AtlasSvgPolygon[] = [];
  for (let i = 0; i < n; i++) {
    const v = vals[i];
    if (v == null) continue;
    const points = cellPolygonPoints(atlas, i);
    if (!points) continue;
    out.push({ points, fill: ramp((v - min) / range) });
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

/** Point-of-interest markers (Azgaar "markers" layer) at their cell centroids. */
export function buildPoiMarkers(atlas: FmgAtlasResult): AtlasSvgMarker[] {
  const markers = (atlas.pack as { markers?: Array<{ cell?: number; type?: string }> }).markers;
  if (!markers) return [];
  const p = atlas.pack.cells.p;
  const out: AtlasSvgMarker[] = [];
  for (const m of markers) {
    if (m.cell == null) continue;
    const c = p?.[m.cell];
    if (!c) continue;
    out.push({ x: c[0], y: c[1], type: m.type });
  }
  return out;
}

/**
 * Cold (glacier/iceberg) cells (Azgaar "ice" layer): any cell whose grid
 * temperature is below `thresholdC`, filled pale ice-blue. Includes water cells
 * (icebergs) as well as frozen land (glaciers).
 */
export function buildIceCells(atlas: FmgAtlasResult, thresholdC = -5): AtlasSvgPolygon[] {
  const cells = atlas.pack.cells;
  const gArr = (cells as { g?: ArrayLike<number> }).g;
  const tempArr = (atlas as { grid?: { cells?: { temp?: ArrayLike<number> } } }).grid?.cells?.temp;
  if (!gArr || !tempArr) return [];
  const out: AtlasSvgPolygon[] = [];
  for (let i = 0; i < cells.h.length; i++) {
    if ((tempArr[gArr[i]] ?? 0) >= thresholdC) continue;
    const points = cellPolygonPoints(atlas, i);
    if (points) out.push({ points, fill: '#dfeefa' });
  }
  return out;
}

/** Military regiments (Azgaar "military" layer) as markers; naval flagged via type. */
export function buildRegiments(atlas: FmgAtlasResult): AtlasSvgMarker[] {
  const states = (atlas.pack as { states?: Array<{ military?: Array<{ x?: number; y?: number; n?: number }> }> }).states;
  if (!states) return [];
  const out: AtlasSvgMarker[] = [];
  for (const s of states) {
    for (const r of s.military ?? []) {
      if (typeof r.x === 'number' && typeof r.y === 'number') {
        out.push({ x: r.x, y: r.y, type: r.n ? 'naval' : 'land' });
      }
    }
  }
  return out;
}

/** Event/danger zone cells (Azgaar "zones" layer): each zone's cells in its color. */
export function buildZoneCells(atlas: FmgAtlasResult): AtlasSvgPolygon[] {
  const zones = (atlas.pack as { zones?: Array<{ cells?: number[]; color?: string }> }).zones;
  if (!zones) return [];
  const out: AtlasSvgPolygon[] = [];
  for (const z of zones) {
    const fill = z.color ?? '#99000033';
    for (const cell of z.cells ?? []) {
      const points = cellPolygonPoints(atlas, cell);
      if (points) out.push({ points, fill });
    }
  }
  return out;
}

/**
 * Build the ordered SVG layer model. Ocean = graduated shallow-water depth
 * bands (SP0 T3b) over the view's deep base rect; land = merged per-biome
 * regions (no facets — SP0 T2); rivers = tapered ribbons (T4); routes + burg
 * markers (T5); plus a coastline path (SP0 T3a).
 */
export function buildAtlasSvgModel(atlas: FmgAtlasResult): AtlasSvgModel {
  const cells = atlas.pack.cells;
  const isLand = (i: number): boolean => cells.h[i] >= LAND_THRESHOLD;
  const biomeKey = (i: number): number | null => (isLand(i) ? (cells.biome?.[i] ?? -1) : null);
  const fillOf = (key: string | number): string =>
    atlas.biomesData.color[key as number] ?? '#888888';
  const regions = buildMergedRegions(atlas, biomeKey, fillOf);
  // Coastline: the outer boundary of ALL land treated as one group — a single
  // stroked path (SP0 T3a), Azgaar's inked coast. Reuses the same boundary
  // tracer with a constant land key so inter-biome edges drop out.
  const coastline = buildMergedRegions(atlas, (i) => (isLand(i) ? 1 : null), () => '')
    .map((r) => r.d)
    .join('');
  // Cultural overlay (Azgaar's "cultures" layer): merged per-culture land regions,
  // colored from pack.cultures. Off by default in the view (it overlaps biomes).
  const cultures = atlas.pack.cultures;
  const cultureKey = (i: number): number | null => {
    if (!isLand(i)) return null;
    const c = cells.culture?.[i];
    return c && c > 0 ? c : null; // culture 0 = "wildlands" (no overlay)
  };
  const cultureFill = (key: string | number): string =>
    cultures?.[key as number]?.color ?? '#b0a8c0';
  const cultureRegions = cultures ? buildMergedRegions(atlas, cultureKey, cultureFill) : [];
  // Religions overlay (Azgaar's "religions" layer): merged per-religion regions.
  const religions = (atlas.pack as { religions?: Array<{ color?: string }> }).religions;
  const religionKey = (i: number): number | null => {
    if (!isLand(i)) return null;
    const r = (cells as { religion?: number[] }).religion?.[i];
    return r && r > 0 ? r : null; // religion 0 = "no religion"
  };
  const religionFill = (key: string | number): string =>
    religions?.[key as number]?.color ?? '#c0b0a8';
  const religionRegions = religions ? buildMergedRegions(atlas, religionKey, religionFill) : [];
  // Provinces overlay (Azgaar's "provinces" layer): merged per-province regions.
  const provinces = (atlas.pack as { provinces?: Array<{ color?: string }> }).provinces;
  const provinceKey = (i: number): number | null => {
    if (!isLand(i)) return null;
    const p = (cells as { province?: number[] }).province?.[i];
    return p && p > 0 ? p : null; // province 0 = "no province"
  };
  const provinceFill = (key: string | number): string =>
    provinces?.[key as number]?.color ?? '#a8c0b0';
  const provinceRegions = provinces ? buildMergedRegions(atlas, provinceKey, provinceFill) : [];
  // Continuous per-cell ramps (Azgaar population/temperature/precipitation).
  // Population lives on the pack cells; climate lives on the GRID cells, reached
  // via pack.cells.g[i]. Each guards on its source array existing → [] when absent.
  const popArr = (cells as { pop?: ArrayLike<number> }).pop;
  const populationCells = popArr
    ? buildCellRamp(atlas, (i) => (popArr[i] > 0 ? popArr[i] : null), RAMP_POPULATION)
    : [];
  const gArr = (cells as { g?: ArrayLike<number> }).g;
  const gridCells = (atlas as { grid?: { cells?: { temp?: ArrayLike<number>; prec?: ArrayLike<number> } } }).grid?.cells;
  const tempArr = gridCells?.temp;
  const temperatureCells = tempArr && gArr
    ? buildCellRamp(atlas, (i) => tempArr[gArr[i]] ?? null, RAMP_TEMPERATURE)
    : [];
  const precArr = gridCells?.prec;
  const precipitationCells = precArr && gArr
    ? buildCellRamp(atlas, (i) => precArr[gArr[i]] ?? null, RAMP_PRECIPITATION)
    : [];
  return {
    width: atlas.graphWidth,
    height: atlas.graphHeight,
    coastline,
    rivers: buildRivers(atlas),
    routes: buildRoutes(atlas),
    burgs: buildBurgs(atlas),
    stateBorders: buildStateBorders(atlas),
    cultureRegions,
    religionRegions,
    provinceRegions,
    populationCells,
    temperatureCells,
    precipitationCells,
    cellOutlines: buildCellOutlines(atlas),
    poiMarkers: buildPoiMarkers(atlas),
    iceCells: buildIceCells(atlas),
    zoneCells: buildZoneCells(atlas),
    regiments: buildRegiments(atlas),
    labels: buildLabels(atlas),
    layers: [
      { id: 'ocean', polygons: [], regions: buildOceanDepthBands(atlas) },
      { id: 'land', polygons: [], regions },
    ],
  };
}
