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
import { getTerrainKey, getTerrainColor } from './terrainColor';
import type { ForestKind } from '../../systems/worldforge/forests/forestClusters';
import {
  FOREST_LABEL_FONT_MAX,
  FOREST_LABEL_FONT_MIN,
  FOREST_LABEL_FULL_SIZE_CELLS,
  FOREST_LABEL_MIN_ZOOM,
  FOREST_MIN_CELLS,
  GLYPH_FULL_ZOOM,
  GLYPH_MIN_ZOOM,
} from '../../systems/worldforge/forests/forestTunables';
import {
  MOUNTAIN_GLYPH_FULL_ZOOM,
  MOUNTAIN_GLYPH_MIN_ZOOM,
  PEAK_LABEL_FONT,
  PEAK_LABEL_MIN_ZOOM,
  PEAK_LABEL_PRIORITY,
  RANGE_LABEL_FONT_MAX,
  RANGE_LABEL_FONT_MIN,
  RANGE_LABEL_FULL_SIZE_CELLS,
  RANGE_LABEL_MIN_ZOOM,
  RANGE_LABEL_PRIORITY,
  RANGE_MIN_CELLS,
} from '../../systems/worldforge/mountains/mountainTunables';
import { computeDangerField, dangerCellsAbove, type DungeonDangerSite } from '../../systems/worldforge/overlays/dangerField';
import { routeVisibility } from '../../systems/worldforge/travel/routeTerrain';
import { cellGlyphs, forestTint, glyphPath } from './forestGlyphs';
import {
  cellReliefGlyphs,
  reliefBandForHeight,
  reliefGlyphCapPath,
  reliefGlyphPath,
  type ReliefBand,
} from './mountainGlyphs';
import { groupToKind, routeOpacity, segmentRouteByVisibility } from './routeMapStyle';

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
export interface AtlasSvgRoute { d: string; group: string; kind: string; opacity: number }
/** Settlement hierarchy tier — drives which glyph the atlas draws for a burg. */
export type BurgTier = 'capital' | 'city' | 'town' | 'village';
export interface AtlasSvgBurg {
  x: number;
  y: number;
  capital: boolean;
  tier: BurgTier;
  /** Burg name + its FMG cell index — used by the atlas town-hover info panel. */
  name?: string;
  cell?: number;
}
/** One swatch in a discrete coloring's legend (which color = which named group). */
export interface AtlasLegendEntry { name: string; color: string }
export interface AtlasSvgModel {
  width: number;
  height: number;
  layers: AtlasSvgLayer[];
  coastline?: string;
  rivers?: AtlasSvgRegion[];
  routes?: AtlasSvgRoute[];
  burgs?: AtlasSvgBurg[];
  stateBorders?: string;
  /** Merged per-state land regions (political coloring). */
  stateRegions?: AtlasSvgRegion[];
  /** Merged per-culture land regions (Azgaar "cultural" overlay; toggle layer). */
  cultureRegions?: AtlasSvgRegion[];
  /** Merged per-religion land regions (Azgaar "religions" overlay; toggle layer). */
  religionRegions?: AtlasSvgRegion[];
  /** Merged per-province land regions (Azgaar "provinces" overlay; toggle layer). */
  provinceRegions?: AtlasSvgRegion[];
  /** Named color keys for the discrete colorings (drives the legend swatches). */
  stateLegend?: AtlasLegendEntry[];
  cultureLegend?: AtlasLegendEntry[];
  religionLegend?: AtlasLegendEntry[];
  provinceLegend?: AtlasLegendEntry[];
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
  /**
   * PROTOTYPE: per-cell threat scalar (0..1) for cells above the safe threshold,
   * derived from zones + terrain. Rendered as a danger HATCH that blends over the
   * active coloring (not a replacement fill). See dangerField.ts.
   */
  dangerCells?: Array<{ points: string; danger: number }>;
  /** Military regiments as markers (Azgaar "military" overlay; toggle layer). */
  regiments?: AtlasSvgMarker[];
  labels?: AtlasSvgLabel[];
  /**
   * Forest tree glyphs (forests campaign T6): ONE entry per NAMED-forest cell —
   * all that cell's glyph paths concatenated into a single `d`, tinted by the
   * forest's kind (null = ordinary, keep the plain glyph green). Only cells in
   * a `pack.forests` cluster stamp; anonymous copses stay plain fill.
   */
  forestGlyphs?: AtlasSvgForestGlyphCell[];
  /**
   * Mountain relief glyphs (mountains campaign T9): ONE entry per LAND cell in
   * a relief band (h >= 50) — height-truth, NOT range-gated, so the SVG map
   * finally shows elevation everywhere the canvas grey-lift does. Renders UNDER
   * the forest glyphs (a forested hill shows trees over its chevron). `d` is
   * the band-inked body; `snowD` is the WHITE snowcap sub-path (only on
   * h >= 80 peaks, else '').
   */
  reliefGlyphs?: AtlasSvgReliefGlyphCell[];
  /**
   * Pass marks (mountains campaign T9): one paired-chevron anchor per
   * `pack.passes` cell, in map space. Drawn in the routes layer (passes sit ON
   * routes) and NOT zoom-hidden — passes are load-bearing wayfinding.
   */
  passMarks?: AtlasSvgPassMark[];
}

/** One named-forest cell's concatenated glyph paths + its kind tint. */
export interface AtlasSvgForestGlyphCell { d: string; tint: string | null }

/** One land cell's relief glyphs: band-inked body `d` + white snowcap `snowD`
 * (empty unless the cell is a h >= 80 peak). */
export interface AtlasSvgReliefGlyphCell { d: string; band: ReliefBand; snowD: string }

/** One pass mark anchor (map space) — the pass cell's site point. */
export interface AtlasSvgPassMark { x: number; y: number }

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
  // Return translucent rgba color to let the radial gradient ocean backdrop shine through.
  return `rgba(${lerp(0x8a, 0x33)},${lerp(0xbe, 0x6e)},${lerp(0xe2, 0xa4)},0.45)`;
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
    // Match Azgaar's river weight: the flux term is min(flux^0.7 / FLUX_FACTOR,
    // MAX_FLUX_WIDTH) — i.e. CAPPED, not an unbounded sqrt(discharge), so big
    // rivers stay delicate threads instead of fat slashes. Half-widths here, so
    // the rendered ribbon diameter is ~2× these values.
    const FLUX_FACTOR = 500;
    const MAX_FLUX_HALF = 0.9; // cap on the flux contribution to half-width (graph units)
    const flux = r.discharge ?? 0;
    const mouthHalf = (0.18 + Math.min(Math.pow(flux, 0.7) / FLUX_FACTOR, MAX_FLUX_HALF)) * widthScale;
    const sourceHalf = Math.max(0.1, mouthHalf * 0.25);
    const halfWidths = points.map((_, k) => {
      const t = n > 1 ? k / (n - 1) : 1;
      return sourceHalf + (mouthHalf - sourceHalf) * t;
    });
    const d = buildRiverRibbon(points, halfWidths);
    if (d) out.push({ d, fill: '#5d97bb' });
  }
  return out;
}

/**
 * Route polylines (SP0 T5, restyled by road-systems Task 8): each route carries
 * its atlas kind + a stroke opacity from the shared routeMapStyle language.
 * Maintained land tiers (highway/road) and sea routes render whole; trails and
 * paths split into constant-visibility segments so forest stretches fade.
 */
export function buildRoutes(atlas: FmgAtlasResult): AtlasSvgRoute[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pack: any = atlas.pack as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes: any[] = pack.routes ?? [];
  const names: string[] | undefined = atlas.biomesData?.name;
  const biomeOf = (cellId: number): string => names?.[pack.cells?.biome?.[cellId] ?? -1] ?? '';
  const toPath = (pts: number[][]): string =>
    'M' + pts.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join('L');
  const out: AtlasSvgRoute[] = [];
  for (const r of routes) {
    const pts: number[][] = r.points ?? [];
    if (pts.length < 2) continue;
    const group: string = r.group ?? 'roads';
    const kind = groupToKind(group);
    if (kind === 'searoute' || kind === 'highway' || kind === 'road') {
      // Maintained (or sea) routes never fade — one segment, full polyline.
      out.push({ d: toPath(pts), group, kind, opacity: routeOpacity(kind, 'visible') });
      continue;
    }
    const tier = kind; // 'trail' | 'path'
    for (const seg of segmentRouteByVisibility(pts, (c) => routeVisibility(biomeOf(c), tier))) {
      if (seg.points.length < 2) continue; // trailing boundary-only run draws nothing
      out.push({ d: toPath(seg.points), group, kind, opacity: routeOpacity(kind, seg.visibility) });
    }
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

/**
 * Provisioning ring (travel logistics): the boundary contour of the in-range
 * cell set — the cells the party can reach before its binding resource (food or
 * water) runs out. Extracted exactly like state borders: an edge is on the ring
 * iff the cell across it is NOT in range (or there is no cell across it — the map
 * edge). Edges shared by two in-range cells are interior and excluded, so the
 * result is one clean outline rather than a mesh of every cell perimeter.
 *
 * Returned as a path of disconnected `M…L` segments for a stroked (glowing)
 * contour. Each ring edge is single-sided (its other cell is out of range), so
 * no per-edge dedup is needed.
 */
export function buildProvisionRingPath(atlas: FmgAtlasResult, inRangeCellIds: Iterable<number>): string {
  const cells = atlas.pack.cells;
  const verts = atlas.pack.vertices.p;
  const inRange = inRangeCellIds instanceof Set ? inRangeCellIds : new Set<number>(inRangeCellIds);
  if (inRange.size === 0) return '';
  const parts: string[] = [];
  for (const i of inRange) {
    const vIds = cells.v[i];
    if (!vIds) continue;
    const nb = cells.c?.[i];
    for (let e = 0; e < vIds.length; e++) {
      const v1 = vIds[e];
      const v2 = vIds[(e + 1) % vIds.length];
      // The cell across this edge shares both its endpoints.
      let j = -1;
      for (const cand of nb ?? []) {
        const cv = cells.v[cand];
        if (cv && cv.includes(v1) && cv.includes(v2)) { j = cand; break; }
      }
      // On the ring when there is no cell across (map edge) or it is out of range.
      if (j >= 0 && inRange.has(j)) continue;
      const pa = verts[v1];
      const pb = verts[v2];
      if (pa && pb) parts.push(`M${+pa[0].toFixed(1)},${+pa[1].toFixed(1)}L${+pb[0].toFixed(1)},${+pb[1].toFixed(1)}`);
    }
  }
  return parts.join('');
}

/**
 * Burg markers (SP0 T5): live burgs with map coords + a settlement tier. Tier =
 * capital flag, else a population percentile (top 15% city, next 35% town, rest
 * village) so glyph variety tracks the hierarchy regardless of FMG's population
 * units. Zero-population burgs fall through to `village`.
 */
export function buildBurgs(atlas: FmgAtlasResult): AtlasSvgBurg[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const burgs: any[] = (atlas.pack as any).burgs ?? [];
  const live = burgs.filter((b) => b && b.i && !b.removed);
  const nonCapPops = live
    .filter((b) => !b.capital)
    .map((b) => b.population ?? 0)
    .sort((a, b) => a - b);
  const pctl = (f: number): number =>
    nonCapPops.length ? nonCapPops[Math.min(nonCapPops.length - 1, Math.floor(f * nonCapPops.length))] : 0;
  const cityCut = pctl(0.85);
  const townCut = pctl(0.5);
  const out: AtlasSvgBurg[] = [];
  for (const b of live) {
    const capital = !!b.capital;
    const pop = b.population ?? 0;
    const tier: BurgTier = capital
      ? 'capital'
      : pop > 0 && pop >= cityCut ? 'city'
      : pop > 0 && pop >= townCut ? 'town'
      : 'village';
    out.push({ x: b.x, y: b.y, capital, tier, name: b.name, cell: b.cell });
  }
  return out;
}

export type LabelKind = 'state' | 'capital' | 'town' | 'forest' | 'range' | 'peak';
export interface AtlasSvgLabel {
  x: number;
  y: number;
  text: string;
  kind: LabelKind;
  /** Per-label size override (screen px). buildLabels sets it on forest and
   * range labels (area-scaled); absent = the kind's LABEL_FONT default, so
   * state/capital/town/peak labels are untouched. */
  fontSize?: number;
}
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
  // Named forests (forests campaign T4) — one label at each forest's pole of
  // inaccessibility. Absent pre-forests packs simply add nothing. Font size
  // is area-scaled (rulings 2026-07-11): lerp MIN→MAX as the cluster grows
  // from FOREST_MIN_CELLS to FOREST_LABEL_FULL_SIZE_CELLS, so vast elderwoods
  // read bigger than roadside woods.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forests: any[] = (atlas.pack as any).forests ?? [];
  for (const f of forests) {
    if (!f || !f.name || !f.pole) continue;
    const t = Math.min(1, Math.max(0,
      (f.cells.length - FOREST_MIN_CELLS) / (FOREST_LABEL_FULL_SIZE_CELLS - FOREST_MIN_CELLS)));
    const fontSize = Math.round(
      FOREST_LABEL_FONT_MIN + (FOREST_LABEL_FONT_MAX - FOREST_LABEL_FONT_MIN) * t);
    out.push({ x: f.pole[0], y: f.pole[1], text: f.name, kind: 'forest', fontSize });
  }
  // Named mountain ranges (mountains T3) — one label at each range's pole of
  // inaccessibility, the forests pattern exactly: font size lerps MIN→MAX as
  // the cluster grows from RANGE_MIN_CELLS to RANGE_LABEL_FULL_SIZE_CELLS, so
  // continental spines read bigger than lone massifs. Pre-mountains packs
  // (no pack.ranges) add nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranges: any[] = (atlas.pack as any).ranges ?? [];
  for (const r of ranges) {
    if (!r || !r.name || !r.pole) continue;
    const t = Math.min(1, Math.max(0,
      (r.cells.length - RANGE_MIN_CELLS) / (RANGE_LABEL_FULL_SIZE_CELLS - RANGE_MIN_CELLS)));
    const fontSize = Math.round(
      RANGE_LABEL_FONT_MIN + (RANGE_LABEL_FONT_MAX - RANGE_LABEL_FONT_MIN) * t);
    out.push({ x: r.pole[0], y: r.pole[1], text: r.name, kind: 'range', fontSize });
  }
  // Named peaks (mountains T3) — "▲ Name" at the peak's own cell point (peaks
  // carry no pole; cells.p is the same FMG-px source the state fallback uses).
  // No fontSize override: the flat PEAK_LABEL_FONT kind default applies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const peaks: any[] = (atlas.pack as any).peaks ?? [];
  for (const pk of peaks) {
    if (!pk || !pk.name) continue;
    const pt = atlas.pack.cells.p[pk.cellId];
    if (!pt) continue;
    out.push({ x: pt[0], y: pt[1], text: `▲ ${pk.name}`, kind: 'peak' });
  }
  return out;
}

// Per-kind DEFAULT font sizes. Forest and range labels normally arrive from
// buildLabels with a per-label area-scaled `fontSize` (MIN→MAX by cluster
// cell count); this table is the fallback for any label without that
// override. Peaks are flat PEAK_LABEL_FONT on purpose — landmarks, not banners.
const LABEL_FONT: Record<LabelKind, number> = {
  state: 14, capital: 11, town: 9, forest: FOREST_LABEL_FONT_MIN,
  range: RANGE_LABEL_FONT_MIN, peak: PEAK_LABEL_FONT,
};
// Declutter rank — lower claims space first. Forest moved 3 → 4 when ranges
// took 3 (mountains T3, rulings 2026-07-11): ranges outrank woods, both stay
// below towns, peaks rank last. The literal 4 supersedes forestTunables'
// FOREST_LABEL_PRIORITY (still 3 there) — this table is the live ladder.
const LABEL_PRIORITY: Record<LabelKind, number> = {
  state: 0, capital: 1, town: 2, range: RANGE_LABEL_PRIORITY, forest: 4, peak: PEAK_LABEL_PRIORITY,
};

export interface DeclutterView { k: number; x: number; y: number }
export interface DeclutterOptions {
  capitalMinScale?: number;
  townMinScale?: number;
  /** Zoom below which forest name labels hide (defaults to the forest
   * tunables' FOREST_LABEL_MIN_ZOOM, 1.5 — between capitals and towns). */
  forestMinScale?: number;
  /** Zoom below which range name labels hide (defaults to the mountain
   * tunables' RANGE_LABEL_MIN_ZOOM, 1.2 — macro geography names itself
   * alongside capitals, earlier than forests). */
  rangeMinScale?: number;
  /** Zoom below which peak labels hide (defaults to the mountain tunables'
   * PEAK_LABEL_MIN_ZOOM, 2.2 — lean-all-the-way-in landmarks, past towns). */
  peakMinScale?: number;
  /**
   * Visible viewport size (screen space). When supplied, each placed label is
   * clamped so its text bbox stays fully inside `[0,width] × [0,height]` — a
   * label whose anchor sits near (or past) an edge is nudged inward instead of
   * being clipped ("…epiet Empire" at the left edge, WM4). Omit to keep the
   * original un-clamped behaviour (used by the unit tests).
   */
  bounds?: { width: number; height: number };
  /**
   * Extra padding (screen px) added around every label's collision box, so
   * labels are spaced apart rather than allowed to touch. Defaults to 2.
   */
  pad?: number;
  /**
   * Maximum number of labels to keep after priority sorting and collision
   * checks. Small map panes use this to avoid filling the viewport with state
   * names before the player has zoomed in.
   */
  maxLabels?: number;
}

/**
 * Vertical gap (screen px) between a non-state label's anchor and its rendered
 * baseline. Burg names are drawn BELOW their point (the glyph sits above the
 * name) — the renderer applies this same offset, so the collision box must use
 * it too or two near-vertical burgs collide on paper but overlap on screen.
 */
const LABEL_RENDER_DY: Record<LabelKind, number> = {
  state: 0, capital: 15, town: 15, forest: 0, range: 0, peak: 0,
};

/**
 * Zoom-threshold + greedy bbox-collision declutter (SP0 T5c). State labels
 * always show; capitals appear past `capitalMinScale`, ranges past
 * `rangeMinScale`, forests past `forestMinScale`, towns past `townMinScale`,
 * peaks past `peakMinScale`. Higher-priority labels
 * (state > capital > town > range > forest > peak) claim space first;
 * overlapping lower-priority labels are dropped. Screen-space (constant text
 * size), so positions use the live view transform.
 *
 * The collision box mirrors the renderer's vertical offset and adds a small pad
 * so labels read with breathing room, and (when `bounds` is given) every kept
 * label is clamped inside the viewport so none clip at the map edges (WM4).
 */
export function declutterLabels(
  labels: AtlasSvgLabel[],
  view: DeclutterView,
  opts: DeclutterOptions = {},
): PlacedLabel[] {
  const capMin = opts.capitalMinScale ?? 1.2;
  const townMin = opts.townMinScale ?? 2.0;
  const forestMin = opts.forestMinScale ?? FOREST_LABEL_MIN_ZOOM;
  const rangeMin = opts.rangeMinScale ?? RANGE_LABEL_MIN_ZOOM;
  const peakMin = opts.peakMinScale ?? PEAK_LABEL_MIN_ZOOM;
  const pad = opts.pad ?? 2;
  const bounds = opts.bounds;
  const maxLabels = opts.maxLabels ?? Infinity;
  const visible = labels.filter((l) =>
    l.kind === 'state'
    || (l.kind === 'capital' && view.k >= capMin)
    || (l.kind === 'town' && view.k >= townMin)
    || (l.kind === 'forest' && view.k >= forestMin)
    || (l.kind === 'range' && view.k >= rangeMin)
    || (l.kind === 'peak' && view.k >= peakMin),
  );
  visible.sort((a, b) => LABEL_PRIORITY[a.kind] - LABEL_PRIORITY[b.kind]);
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const out: PlacedLabel[] = [];
  for (const l of visible) {
    const fontSize = l.fontSize ?? LABEL_FONT[l.kind];
    const w = l.text.length * fontSize * 0.55;
    const h = fontSize;
    // Anchor, then clamp the CENTER so the (half-width, half-height) bbox — at
    // the rendered baseline (LABEL_RENDER_DY) — stays inside the viewport.
    let sx = l.x * view.k + view.x;
    let sy = l.y * view.k + view.y;
    const renderDy = LABEL_RENDER_DY[l.kind];
    if (bounds) {
      const halfW = w / 2;
      // Only clamp when the label actually fits; for a label wider than the
      // viewport, left-align it so the start is readable rather than centering
      // it off both edges.
      if (w <= bounds.width) {
        sx = Math.min(Math.max(sx, halfW + pad), bounds.width - halfW - pad);
      } else {
        sx = halfW + pad;
      }
      const top = renderDy - h;        // baseline-relative top of the glyph box
      const bottom = renderDy;          // ~baseline
      sy = Math.min(Math.max(sy, pad - top), bounds.height - pad - bottom);
    }
    // Collision box at the RENDERED position (includes the baseline offset + pad).
    const box = {
      x: sx - w / 2 - pad,
      y: sy + renderDy - h - pad,
      w: w + pad * 2,
      h: h + pad * 2,
    };
    const hit = placed.some((p) =>
      !(box.x + box.w < p.x || p.x + p.w < box.x || box.y + box.h < p.y || p.y + p.h < box.y),
    );
    if (hit) continue;
    placed.push(box);
    out.push({ ...l, sx, sy, fontSize });
    if (out.length >= maxLabels) break;
  }
  return out;
}

/**
 * Forest tree glyphs (forests campaign T6): per-cell glyph stamps for every
 * cell of every NAMED forest (`pack.forests` clusters only — anonymous copses
 * keep the plain biome fill, so the map stays calm and the layer stays cheap).
 *
 * One entry per forest cell: all that cell's deterministic glyph paths
 * (forestGlyphs.cellGlyphs → glyphPath) concatenated into one `d` string,
 * plus the forest's kind tint (null for ordinary). Cells whose polygons are
 * degenerate or whose biome stamps nothing are skipped rather than emitted
 * empty. BOTH renderers consume this function — the SVG model folds it in
 * below, the canvas rebuilds the identical data via the same call — so the
 * two maps cannot disagree on where trees stand.
 */
export function buildForestGlyphs(atlas: FmgAtlasResult): AtlasSvgForestGlyphCell[] {
  const forests =
    (atlas.pack as { forests?: Array<{ cells: number[]; kind: ForestKind }> }).forests ?? [];
  if (forests.length === 0) return [];
  const cells = atlas.pack.cells;
  const verts = atlas.pack.vertices.p;
  const out: AtlasSvgForestGlyphCell[] = [];
  for (const forest of forests) {
    const tint = forestTint(forest.kind);
    for (const cellId of forest.cells) {
      const vIds = cells.v[cellId];
      if (!vIds || vIds.length < 3) continue;
      const poly: Array<[number, number]> = [];
      for (const vid of vIds) {
        const p = verts[vid];
        if (p) poly.push([p[0], p[1]]);
      }
      if (poly.length < 3) continue;
      const biomeIndex = cells.biome?.[cellId] ?? -1;
      let d = '';
      for (const g of cellGlyphs(cellId, poly, biomeIndex, atlas.biomesData, forest.kind)) {
        d += glyphPath(g.g, g.x, g.y, g.s);
      }
      if (d) out.push({ d, tint });
    }
  }
  return out;
}

/** Full glyph-layer opacity once zoomed past GLYPH_FULL_ZOOM. */
export const FOREST_GLYPH_LAYER_OPACITY = 0.85;

/**
 * Shared zoom ramp for the glyph layer (both renderers): hidden below
 * GLYPH_MIN_ZOOM, then a linear fade-in to FOREST_GLYPH_LAYER_OPACITY at
 * GLYPH_FULL_ZOOM. `view.k` (SVG) and `view.scale` (canvas) share the same
 * screen-px-per-graph-unit semantics, so one ramp serves both. A degenerate
 * (NaN) zoom answers 0 — never leak NaN into CSS or globalAlpha.
 */
export function forestGlyphRampOpacity(k: number): number {
  if (!(k >= GLYPH_MIN_ZOOM)) return 0; // also catches NaN
  if (k >= GLYPH_FULL_ZOOM) return FOREST_GLYPH_LAYER_OPACITY;
  return FOREST_GLYPH_LAYER_OPACITY * ((k - GLYPH_MIN_ZOOM) / (GLYPH_FULL_ZOOM - GLYPH_MIN_ZOOM));
}

/**
 * Mountain relief glyphs (mountains campaign T9): the twin of buildForestGlyphs
 * for elevation. For EVERY land cell whose height falls in a relief band
 * (`reliefBandForHeight` non-null ⇒ h >= 50) — height-truth, NOT range-gated:
 * ranges give NAMES, glyphs read raw elevation, so the SVG map shows relief
 * everywhere. One entry per cell: all that cell's deterministic relief glyphs
 * (cellReliefGlyphs → reliefGlyphPath) concatenated into a single band-inked
 * `d`, plus a SEPARATE white `snowD` holding ONLY the snowcap sub-paths of its
 * h >= 80 peaks (built from `reliefGlyphCapPath`, the clean split — the cap
 * never lands in `d`, so the renderer inks the body dark and the cap white with
 * no double-stroke). Degenerate polygons are skipped. BOTH renderers consume
 * this — the SVG model folds it in, the canvas rebuilds the identical data —
 * so the two maps cannot disagree on where mountains stand.
 */
export function buildReliefGlyphs(atlas: FmgAtlasResult): AtlasSvgReliefGlyphCell[] {
  const cells = atlas.pack.cells;
  const verts = atlas.pack.vertices.p;
  const n = cells.h.length;
  const out: AtlasSvgReliefGlyphCell[] = [];
  for (let cellId = 0; cellId < n; cellId++) {
    const h = cells.h[cellId];
    const band = reliefBandForHeight(h); // null below the hill line (h < 50)
    if (!band) continue;
    const vIds = cells.v[cellId];
    if (!vIds || vIds.length < 3) continue;
    const poly: Array<[number, number]> = [];
    for (const vid of vIds) {
      const p = verts[vid];
      if (p) poly.push([p[0], p[1]]);
    }
    if (poly.length < 3) continue;
    let d = '';
    let snowD = '';
    for (const g of cellReliefGlyphs(cellId, poly, h, band)) {
      // Body strokes with snowTip=false so the cap stays OUT of `d`; the cap
      // (when this glyph is a snow-tipped peak) goes only into snowD.
      d += reliefGlyphPath(g.band, g.x, g.y, g.s, false);
      if (g.snowTip) snowD += reliefGlyphCapPath(g.x, g.y, g.s);
    }
    if (d) out.push({ d, band, snowD });
  }
  return out;
}

/** Full relief-glyph layer opacity once zoomed past MOUNTAIN_GLYPH_FULL_ZOOM.
 * A touch stronger than the forest layer so peak ink reads over rock fills. */
export const RELIEF_GLYPH_LAYER_OPACITY = 0.9;

/**
 * Shared zoom ramp for the relief-glyph layer (both renderers): the forest ramp
 * shape on the MOUNTAIN glyph knobs, so relief thins in alongside trees. Hidden
 * below MOUNTAIN_GLYPH_MIN_ZOOM, linear fade to RELIEF_GLYPH_LAYER_OPACITY at
 * MOUNTAIN_GLYPH_FULL_ZOOM. A degenerate (NaN) zoom answers 0 — never leak NaN
 * into CSS or globalAlpha.
 */
export function reliefGlyphRampOpacity(k: number): number {
  if (!(k >= MOUNTAIN_GLYPH_MIN_ZOOM)) return 0; // also catches NaN
  if (k >= MOUNTAIN_GLYPH_FULL_ZOOM) return RELIEF_GLYPH_LAYER_OPACITY;
  return (
    RELIEF_GLYPH_LAYER_OPACITY *
    ((k - MOUNTAIN_GLYPH_MIN_ZOOM) / (MOUNTAIN_GLYPH_FULL_ZOOM - MOUNTAIN_GLYPH_MIN_ZOOM))
  );
}

/**
 * Pass mark anchors (mountains campaign T9): one point per `pack.passes` cell,
 * read from that cell's site (`pack.cells.p[cellId]`) in map space. Empty for
 * pre-mountains packs (no `pack.passes`). Both renderers draw the paired
 * chevron via `passMarkPath` at these points.
 */
export function buildPassMarks(atlas: FmgAtlasResult): AtlasSvgPassMark[] {
  const passes =
    (atlas.pack as { passes?: Array<{ cellId: number }> }).passes ?? [];
  if (passes.length === 0) return [];
  const p = atlas.pack.cells.p;
  const out: AtlasSvgPassMark[] = [];
  for (const pass of passes) {
    const pt = p?.[pass.cellId];
    if (!pt) continue;
    out.push({ x: pt[0], y: pt[1] });
  }
  return out;
}

/**
 * Paired-chevron pass mark (mountains campaign T9): two small `‹ ›`-style ticks
 * flanking (x, y) in map space, vertices pointing outward like a saddle gate.
 * One geometry string, shared by both renderers (SVG `<path d>` and canvas
 * `new Path2D(d)`), so passes read identically. `size` is the chevron arm reach
 * and half-gap in map units.
 */
export function passMarkPath(x: number, y: number, size = 2): string {
  const g = size; // half-gap from the anchor to each chevron's inner edge
  const a = size; // chevron arm reach (both directions from the vertex)
  const ff = (v: number): string => {
    const r = Math.round(v * 100) / 100;
    return String(r === 0 ? 0 : r);
  };
  return (
    // Left chevron ‹ — vertex at (x-g-a), arms opening right toward the anchor.
    `M${ff(x - g)} ${ff(y - a)}L${ff(x - g - a)} ${ff(y)}L${ff(x - g)} ${ff(y + a)}` +
    // Right chevron › — vertex at (x+g+a), arms opening left toward the anchor.
    `M${ff(x + g)} ${ff(y - a)}L${ff(x + g + a)} ${ff(y)}L${ff(x + g)} ${ff(y + a)}`
  );
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
 * PROTOTYPE danger overlay: per-cell threat polygons (above the safe threshold)
 * with their 0..1 scalar, for the hatch renderer. Derived from world state via
 * `computeDangerField` (zones + terrain), not a static generator layer.
 */
export function buildDangerCells(
  atlas: FmgAtlasResult,
  dungeonSites?: ReadonlyArray<DungeonDangerSite>,
): Array<{ points: string; danger: number }> {
  // Pillar 2, Task 8: pass live dungeon-site states so UNCLEARED dungeons bump
  // the overlay around their cells. Omitting `dungeonSites` reproduces the
  // pre-Task-8 field exactly (the field's dungeon term is flag-gated).
  const field = computeDangerField(atlas, dungeonSites ? { dungeonSites } : {});
  const out: Array<{ points: string; danger: number }> = [];
  for (const { i, danger } of dangerCellsAbove(field)) {
    const points = cellPolygonPoints(atlas, i);
    if (points) out.push({ points, danger });
  }
  return out;
}

/**
 * Build the ordered SVG layer model. Ocean = graduated shallow-water depth
 * bands (SP0 T3b) over the view's deep base rect; land = merged per-biome
 * regions (no facets — SP0 T2); rivers = tapered ribbons (T4); routes + burg
 * markers (T5); plus a coastline path (SP0 T3a).
 */
export function buildAtlasSvgModel(
  atlas: FmgAtlasResult,
  dungeonSites?: ReadonlyArray<DungeonDangerSite>,
): AtlasSvgModel {
  const cells = atlas.pack.cells;
  const isLand = (i: number): boolean => cells.h[i] >= LAND_THRESHOLD;
  // Merge regions using a combined key: biome + elevation bucket + NW slope bucket
  // to avoid emitting individual polygons per cell while capturing rich terrain details.
  const regions = buildMergedRegions(
    atlas,
    (i) => getTerrainKey(atlas, i),
    (key) => getTerrainColor(atlas, key as string),
  );
  // Coastline: the outer boundary of ALL land treated as one group — a single
  // stroked path (SP0 T3a), Azgaar's inked coast. Reuses the same boundary
  // tracer with a constant land key so inter-biome edges drop out.
  const coastline = buildMergedRegions(atlas, (i) => (isLand(i) ? 1 : null), () => '')
    .map((r) => r.d)
    .join('');
  // Build a discrete coloring (merged regions) AND its legend (the distinct
  // named color-keys that actually appear on the map), in one pass. The legend
  // lists only groups with land here, sorted by name, so the swatch key matches
  // what's drawn. Returns [] / [] when the source layer is absent.
  const discreteOverlay = (
    keyOf: (i: number) => number | null,
    fillOf: (key: number) => string,
    nameOf: (key: number) => string,
  ): { regions: AtlasSvgRegion[]; legend: AtlasLegendEntry[] } => {
    const regions = buildMergedRegions(atlas, keyOf, (k) => fillOf(k as number));
    const seen = new Map<number, AtlasLegendEntry>();
    for (let i = 0; i < cells.h.length; i++) {
      const k = keyOf(i);
      if (k == null || seen.has(k)) continue;
      seen.set(k, { name: nameOf(k), color: fillOf(k) });
    }
    const legend = [...seen.values()].filter((e) => e.name).sort((a, b) => a.name.localeCompare(b.name));
    return { regions, legend };
  };

  // Political overlay: merged per-state land regions, colored from pack.states.
  const states = (atlas.pack as { states?: Array<{ color?: string; name?: string; fullName?: string; removed?: boolean }> }).states;
  const stateColorPalette = ['#d98880', '#85c1e9', '#82e0aa', '#f8c471', '#bb8fce', '#76d7c4', '#f7dc6f', '#e59866', '#aeb6bf', '#f0a3c8'];
  const { regions: stateRegions, legend: stateLegend } = states
    ? discreteOverlay(
        (i) => {
          if (!isLand(i)) return null;
          const s = (cells as { state?: number[] }).state?.[i];
          return s && s > 0 && !states[s]?.removed ? s : null; // state 0 = neutrals
        },
        (key) => states[key]?.color ?? stateColorPalette[key % stateColorPalette.length],
        (key) => states[key]?.fullName || states[key]?.name || `State ${key}`,
      )
    : { regions: [], legend: [] };

  // Cultural overlay (Azgaar's "cultures" layer): merged per-culture land regions,
  // colored from pack.cultures. Off by default in the view (it overlaps biomes).
  const cultures = atlas.pack.cultures as Array<{ color?: string; name?: string }> | undefined;
  const { regions: cultureRegions, legend: cultureLegend } = cultures
    ? discreteOverlay(
        (i) => {
          if (!isLand(i)) return null;
          const c = cells.culture?.[i];
          return c && c > 0 ? c : null; // culture 0 = "wildlands" (no overlay)
        },
        (key) => cultures[key]?.color ?? '#b0a8c0',
        (key) => cultures[key]?.name || `Culture ${key}`,
      )
    : { regions: [], legend: [] };
  // Religions overlay (Azgaar's "religions" layer): merged per-religion regions.
  const religions = (atlas.pack as { religions?: Array<{ color?: string; name?: string }> }).religions;
  const { regions: religionRegions, legend: religionLegend } = religions
    ? discreteOverlay(
        (i) => {
          if (!isLand(i)) return null;
          const r = (cells as { religion?: number[] }).religion?.[i];
          return r && r > 0 ? r : null; // religion 0 = "no religion"
        },
        (key) => religions[key]?.color ?? '#c0b0a8',
        (key) => religions[key]?.name || `Religion ${key}`,
      )
    : { regions: [], legend: [] };
  // Provinces overlay (Azgaar's "provinces" layer): merged per-province regions.
  const provinces = (atlas.pack as { provinces?: Array<{ color?: string; name?: string; fullName?: string }> }).provinces;
  const { regions: provinceRegions, legend: provinceLegend } = provinces
    ? discreteOverlay(
        (i) => {
          if (!isLand(i)) return null;
          const p = (cells as { province?: number[] }).province?.[i];
          return p && p > 0 ? p : null; // province 0 = "no province"
        },
        (key) => provinces[key]?.color ?? '#a8c0b0',
        (key) => provinces[key]?.fullName || provinces[key]?.name || `Province ${key}`,
      )
    : { regions: [], legend: [] };
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
    ? buildCellRamp(atlas, (i) => tempArr[gArr[i]] ?? null, RAMP_TEMPERATURE, { clampPercentile: 0.02 })
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
    forestGlyphs: buildForestGlyphs(atlas),
    reliefGlyphs: buildReliefGlyphs(atlas),
    passMarks: buildPassMarks(atlas),
    burgs: buildBurgs(atlas),
    stateBorders: buildStateBorders(atlas),
    stateRegions,
    cultureRegions,
    religionRegions,
    provinceRegions,
    stateLegend,
    cultureLegend,
    religionLegend,
    provinceLegend,
    populationCells,
    temperatureCells,
    precipitationCells,
    cellOutlines: buildCellOutlines(atlas),
    poiMarkers: buildPoiMarkers(atlas),
    iceCells: buildIceCells(atlas),
    zoneCells: buildZoneCells(atlas),
    dangerCells: buildDangerCells(atlas, dungeonSites),
    regiments: buildRegiments(atlas),
    labels: buildLabels(atlas),
    layers: [
      { id: 'ocean', polygons: [], regions: buildOceanDepthBands(atlas) },
      { id: 'land', polygons: [], regions },
    ],
  };
}
