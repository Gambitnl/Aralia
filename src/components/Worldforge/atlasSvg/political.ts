/**
 * @file atlasSvg/political.ts — routes, borders, settlements and the overlay
 * layers keyed off world state (split out of atlasSvg.ts, MOD-3.5, 2026-09-09).
 *
 * Routes and their visibility styling, state borders, the travel provisioning
 * ring, burg markers and their tiers, military regiments, event zones, and the
 * prototype danger field. Bodies are the original lines verbatim.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: components/Worldforge/atlasSvg.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';
import { computeDangerField, dangerCellsAbove, type DungeonDangerSite } from '../../../systems/worldforge/overlays/dangerField';
import { routeVisibility } from '../../../systems/worldforge/travel/routeTerrain';
import { groupToKind, routeOpacity, segmentRouteByVisibility } from '../routeMapStyle';
import {
  LAND_THRESHOLD,
  cellPolygonPoints,
  type AtlasSvgMarker,
  type AtlasSvgPolygon,
} from './cells';

export interface AtlasSvgRoute { d: string; group: string; kind: string; opacity: number }

/** Settlement hierarchy tier — drives which glyph the atlas draws for a burg. */
export type BurgTier = 'capital' | 'city' | 'town' | 'village';
export interface AtlasSvgBurg {
  /** Exact canonical FMG burg id; display filtering must never replace it. */
  id: number;
  x: number;
  y: number;
  capital: boolean;
  tier: BurgTier;
  /** Burg name + its FMG cell index — used by the atlas town-hover info panel. */
  name?: string;
  cell?: number;
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
    // Carry the source id and cell through the pure render model. GG-40 hides
    // detail by view, never by manufacturing replacement settlement records.
    out.push({ id: b.i, x: b.x, y: b.y, capital, tier, name: b.name, cell: b.cell });
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
