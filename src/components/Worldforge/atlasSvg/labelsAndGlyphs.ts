/**
 * @file atlasSvg/labelsAndGlyphs.ts — everything the atlas writes or stamps on
 * top of the map (split out of atlasSvg.ts, MOD-3.5, 2026-09-09).
 *
 * Label candidates and the zoom-threshold + collision declutter, the forest and
 * relief glyph builders with their shared zoom ramps, pass marks and their
 * paired-chevron geometry, and the point-of-interest markers. Both the SVG and
 * the canvas renderer consume the glyph builders, so this module is the single
 * source of where trees, mountains and passes are drawn. Bodies are the
 * original lines verbatim.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: components/Worldforge/atlasSvg.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';
import type { ForestKind } from '../../../systems/worldforge/forests/forestClusters';
import {
  FOREST_LABEL_FONT_MAX,
  FOREST_LABEL_FONT_MIN,
  FOREST_LABEL_FULL_SIZE_CELLS,
  FOREST_LABEL_MIN_ZOOM,
  FOREST_MIN_CELLS,
  GLYPH_FULL_ZOOM,
  GLYPH_MIN_ZOOM,
} from '../../../systems/worldforge/forests/forestTunables';
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
} from '../../../systems/worldforge/mountains/mountainTunables';
import { cellGlyphs, forestTint, glyphPath } from '../forestGlyphs';
import {
  cellReliefGlyphs,
  reliefBandForHeight,
  reliefGlyphCapPath,
  reliefGlyphPath,
  type ReliefBand,
} from '../mountainGlyphs';
import type { AtlasSvgMarker } from './cells';

/** One named-forest cell's concatenated glyph paths + its kind tint. */
export interface AtlasSvgForestGlyphCell { d: string; tint: string | null }

/** One land cell's relief glyphs: band-inked body `d` + white snowcap `snowD`
 * (empty unless the cell is a h >= 80 peak). */
export interface AtlasSvgReliefGlyphCell { d: string; band: ReliefBand; snowD: string }

/** One pass mark anchor (map space) — the pass cell's site point. */
export interface AtlasSvgPassMark { x: number; y: number }

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
/** Screen-space shape that labels must avoid, normally a visible burg glyph. */
export interface LabelObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional anchor lets a burg name ignore its own marker, but no other one. */
  anchorX?: number;
  anchorY?: number;
}
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
  /** Already-painted screen-space shapes that labels must not materially cover. */
  obstacles?: ReadonlyArray<LabelObstacle>;
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
  const obstacles = opts.obstacles ?? [];
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
    // Georgia's mixed-case average is wider than the old 0.55 estimate. The
    // conservative width keeps long state names inside the rendered viewport.
    const w = l.text.length * fontSize * 0.62;
    const h = fontSize;
    // Keep the exact geographic pole as the first candidate. Any accepted
    // candidate is later clamped so its full box stays inside the viewport.
    const anchorX = l.x * view.k + view.x;
    const anchorY = l.y * view.k + view.y;
    const renderDy = LABEL_RENDER_DY[l.kind];
    // Nudging exists only to route macro labels around painted settlements.
    // Without marker obstacles, the established priority ladder still drops a
    // lower-priority label instead of moving it away from its true feature.
    const canNudge = obstacles.length > 0
      && (l.kind === 'state' || l.kind === 'range' || l.kind === 'forest');
    const verticalStep = h + pad * 2 + 6;
    const horizontalStep = Math.min(36, w / 3);
    const offsets = canNudge
      ? [[0, 0], [0, -verticalStep], [0, verticalStep], [-horizontalStep, 0], [horizontalStep, 0]]
      : [[0, 0]];
    let accepted: { sx: number; sy: number; box: { x: number; y: number; w: number; h: number } } | null = null;

    // Try the true pole first, then small cartographic offsets. This keeps state
    // names available without painting them over capitals or other labels.
    for (const [offsetX, offsetY] of offsets) {
      let sx = anchorX + offsetX;
      let sy = anchorY + offsetY;
      if (bounds) {
        const halfW = w / 2;
        sx = w <= bounds.width
          ? Math.min(Math.max(sx, halfW + pad), bounds.width - halfW - pad)
          : halfW + pad;
        const top = renderDy - h;
        const bottom = renderDy;
        sy = Math.min(Math.max(sy, pad - top), bounds.height - pad - bottom);
      }
      const box = {
        x: sx - w / 2 - pad,
        y: sy + renderDy - h - pad,
        w: w + pad * 2,
        h: h + pad * 2,
      };
      const hitPlacedLabel = placed.some((other) =>
        !(box.x + box.w < other.x || other.x + other.w < box.x
          || box.y + box.h < other.y || other.y + other.h < box.y),
      );
      const hitSettlement = obstacles.some((obstacle) => {
        const ownMarker = (l.kind === 'capital' || l.kind === 'town')
          && obstacle.anchorX != null
          && obstacle.anchorY != null
          && Math.abs(obstacle.anchorX - anchorX) < 0.5
          && Math.abs(obstacle.anchorY - anchorY) < 0.5;
        if (ownMarker) return false;
        return !(box.x + box.w < obstacle.x || obstacle.x + obstacle.w < box.x
          || box.y + box.h < obstacle.y || obstacle.y + obstacle.h < box.y);
      });
      if (!hitPlacedLabel && !hitSettlement) {
        accepted = { sx, sy, box };
        break;
      }
    }
    if (!accepted) continue;
    placed.push(accepted.box);
    out.push({ ...l, sx: accepted.sx, sy: accepted.sy, fontSize });
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
