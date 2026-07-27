/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 19/07/2026, 23:41:09
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasLayers.tsx, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/StartPointSelection.tsx, components/Worldforge/atlasDraw.ts, components/Worldforge/responsiveAtlasCore.ts, components/Worldforge/responsiveAtlasProtocol.ts, components/Worldforge/settlementDeclutter.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file atlasSvg.ts — pure, DOM-free model builder for the native SVG atlas
 * renderer (Worldforge SP0, iteration #1).
 *
 * Mirrors how `atlasDraw.ts` is a pure canvas core: this module turns an
 * `FmgAtlasResult` into an ordered SVG layer model (ocean, merged terrain,
 * routes, settlements, labels, and overlays) with no React/DOM dependency, so
 * it unit-tests with a stub atlas and runs headless in proof scripts.
 *
 * Land stays merged rather than returning to one polygon per cell. The merge
 * key now includes biome, elevation band, and directional slope, carrying the
 * retiring canvas renderer's modeled color into the canonical SVG path without
 * changing geography, seed determinism, or exact-cell interaction.
 */
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { type DungeonDangerSite } from '../../systems/worldforge/overlays/dangerField';
import { type ReliefBand } from './mountainGlyphs';
/** SVG "x,y x,y ..." points string for a cell's Voronoi polygon (graph coords). */
export declare function cellPolygonPoints(atlas: FmgAtlasResult, i: number): string;
/** Biome fill color for a land cell; neutral grey fallback. */
export declare function biomeFillForCell(atlas: FmgAtlasResult, i: number): string;
export interface AtlasSvgPolygon {
    points: string;
    fill: string;
}
export interface AtlasSvgRegion {
    d: string;
    fill: string;
}
export interface AtlasSvgMarker {
    x: number;
    y: number;
    type?: string;
}
export interface AtlasSvgLayer {
    id: string;
    polygons: AtlasSvgPolygon[];
    regions?: AtlasSvgRegion[];
}
export interface AtlasSvgRoute {
    d: string;
    group: string;
    kind: string;
    opacity: number;
}
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
/** One swatch in a discrete coloring's legend (which color = which named group). */
export interface AtlasLegendEntry {
    name: string;
    color: string;
}
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
    dangerCells?: Array<{
        points: string;
        danger: number;
    }>;
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
export interface AtlasSvgForestGlyphCell {
    d: string;
    tint: string | null;
}
/** One land cell's relief glyphs: band-inked body `d` + white snowcap `snowD`
 * (empty unless the cell is a h >= 80 peak). */
export interface AtlasSvgReliefGlyphCell {
    d: string;
    band: ReliefBand;
    snowD: string;
}
/** One pass mark anchor (map space) — the pass cell's site point. */
export interface AtlasSvgPassMark {
    x: number;
    y: number;
}
/**
 * Merge Voronoi cells sharing a group key into boundary paths — same-key cells
 * fuse (their shared interior edges drop out), killing per-cell facets.
 * `keyOf(i)` returns the group key, or null to exclude the cell (e.g. water).
 * Returns one SVG path `d` per group (multiple `M…Z` subpaths for disjoint
 * pieces / holes), filled by `fillOf(key)`. The renderer fills `evenodd`.
 */
export declare function buildMergedRegions(atlas: FmgAtlasResult, keyOf: (i: number) => string | number | null, fillOf: (key: string | number) => string): AtlasSvgRegion[];
/**
 * Ring distance of every cell from the coast (SP0 T3b). Land cells = 0; water
 * cells = BFS hop count over cell adjacency from the nearest land; water not
 * reachable from land stays -1 (open deep sea). Pure and unit-testable.
 */
export declare function oceanDepthDistance(atlas: FmgAtlasResult): number[];
/**
 * Merged shallow-water depth bands near the coast (SP0 T3b): water cells within
 * `maxBands` rings of land are grouped by ring distance and merged into filled
 * regions (graduated blue, lightest at the coast). Deeper open sea is left to
 * the view's base ocean rect.
 */
export declare function buildOceanDepthBands(atlas: FmgAtlasResult, maxBands?: number): AtlasSvgRegion[];
/**
 * Offset a centerline polyline by per-point half-width into a closed filled
 * ribbon path (SP0 T4). Perpendicular is the central-difference tangent rotated
 * 90°; the path runs up the left offset and back down the right.
 */
export declare function buildRiverRibbon(points: Array<[number, number]>, halfWidths: number[]): string;
/**
 * Rivers as discharge-tapered filled ribbons (SP0 T4) — Azgaar's `#rivers`
 * (filled, no stroke, `#5d97bb`). Width is derived from `sqrt(discharge)` (the
 * flux magnitude; FMG's `width` km field is sub-pixel here), tapering from a
 * thin source to the mouth. `widthScale` tunes the render weight in graph units.
 */
export declare function buildRivers(atlas: FmgAtlasResult, widthScale?: number): AtlasSvgRegion[];
/**
 * Route polylines (SP0 T5, restyled by road-systems Task 8): each route carries
 * its atlas kind + a stroke opacity from the shared routeMapStyle language.
 * Maintained land tiers (highway/road) and sea routes render whole; trails and
 * paths split into constant-visibility segments so forest stretches fade.
 */
export declare function buildRoutes(atlas: FmgAtlasResult): AtlasSvgRoute[];
/**
 * State borders (SP0 T5): segments along edges shared by two LAND cells with
 * different non-zero state ids (each shared edge once). Returned as a path of
 * disconnected `M…L` segments for a dashed stroke — borders are a network, not
 * closed rings, so per-edge segments (not ring-stitching) are correct.
 */
export declare function buildStateBorders(atlas: FmgAtlasResult): string;
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
export declare function buildProvisionRingPath(atlas: FmgAtlasResult, inRangeCellIds: Iterable<number>): string;
/**
 * Burg markers (SP0 T5): live burgs with map coords + a settlement tier. Tier =
 * capital flag, else a population percentile (top 15% city, next 35% town, rest
 * village) so glyph variety tracks the hierarchy regardless of FMG's population
 * units. Zero-population burgs fall through to `village`.
 */
export declare function buildBurgs(atlas: FmgAtlasResult): AtlasSvgBurg[];
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
export interface PlacedLabel extends AtlasSvgLabel {
    sx: number;
    sy: number;
    fontSize: number;
}
/** Map-space label candidates (SP0 T5c): state names + burg names. */
export declare function buildLabels(atlas: FmgAtlasResult): AtlasSvgLabel[];
export interface DeclutterView {
    k: number;
    x: number;
    y: number;
}
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
    bounds?: {
        width: number;
        height: number;
    };
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
export declare function declutterLabels(labels: AtlasSvgLabel[], view: DeclutterView, opts?: DeclutterOptions): PlacedLabel[];
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
export declare function buildForestGlyphs(atlas: FmgAtlasResult): AtlasSvgForestGlyphCell[];
/** Full glyph-layer opacity once zoomed past GLYPH_FULL_ZOOM. */
export declare const FOREST_GLYPH_LAYER_OPACITY = 0.85;
/**
 * Shared zoom ramp for the glyph layer (both renderers): hidden below
 * GLYPH_MIN_ZOOM, then a linear fade-in to FOREST_GLYPH_LAYER_OPACITY at
 * GLYPH_FULL_ZOOM. `view.k` (SVG) and `view.scale` (canvas) share the same
 * screen-px-per-graph-unit semantics, so one ramp serves both. A degenerate
 * (NaN) zoom answers 0 — never leak NaN into CSS or globalAlpha.
 */
export declare function forestGlyphRampOpacity(k: number): number;
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
export declare function buildReliefGlyphs(atlas: FmgAtlasResult): AtlasSvgReliefGlyphCell[];
/** Full relief-glyph layer opacity once zoomed past MOUNTAIN_GLYPH_FULL_ZOOM.
 * A touch stronger than the forest layer so peak ink reads over rock fills. */
export declare const RELIEF_GLYPH_LAYER_OPACITY = 0.9;
/**
 * Shared zoom ramp for the relief-glyph layer (both renderers): the forest ramp
 * shape on the MOUNTAIN glyph knobs, so relief thins in alongside trees. Hidden
 * below MOUNTAIN_GLYPH_MIN_ZOOM, linear fade to RELIEF_GLYPH_LAYER_OPACITY at
 * MOUNTAIN_GLYPH_FULL_ZOOM. A degenerate (NaN) zoom answers 0 — never leak NaN
 * into CSS or globalAlpha.
 */
export declare function reliefGlyphRampOpacity(k: number): number;
/**
 * Pass mark anchors (mountains campaign T9): one point per `pack.passes` cell,
 * read from that cell's site (`pack.cells.p[cellId]`) in map space. Empty for
 * pre-mountains packs (no `pack.passes`). Both renderers draw the paired
 * chevron via `passMarkPath` at these points.
 */
export declare function buildPassMarks(atlas: FmgAtlasResult): AtlasSvgPassMark[];
/**
 * Paired-chevron pass mark (mountains campaign T9): two small `‹ ›`-style ticks
 * flanking (x, y) in map space, vertices pointing outward like a saddle gate.
 * One geometry string, shared by both renderers (SVG `<path d>` and canvas
 * `new Path2D(d)`), so passes read identically. `size` is the chevron arm reach
 * and half-gap in map units.
 */
export declare function passMarkPath(x: number, y: number, size?: number): string;
/**
 * Owned point→cell lookup (SP0 T7): the Voronoi cell containing a graph-space
 * point is the cell whose site (`cells.p`) is nearest — no iframe `findCell`.
 * Brute force over cell centers (fine at ~10k cells per click).
 */
export declare function findCellAtPoint(atlas: FmgAtlasResult, gx: number, gy: number): number;
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
    burg?: {
        name: string;
        capital: boolean;
    };
}
/** Owned cell trait readout (SP0 T7) — the native equivalent of the iframe's describeCell. */
export declare function cellTraits(atlas: FmgAtlasResult, i: number): CellTraits;
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
export declare function buildCellRamp(atlas: FmgAtlasResult, valueOf: (i: number) => number | null, ramp: (t: number) => string, opts?: CellRampOptions): AtlasSvgPolygon[];
/** Voronoi cell outlines (Azgaar "cells" layer) — one points string per cell. */
export declare function buildCellOutlines(atlas: FmgAtlasResult): string[];
/** Point-of-interest markers (Azgaar "markers" layer) at their cell centroids. */
export declare function buildPoiMarkers(atlas: FmgAtlasResult): AtlasSvgMarker[];
/**
 * Cold (glacier/iceberg) cells (Azgaar "ice" layer): any cell whose grid
 * temperature is below `thresholdC`, filled pale ice-blue. Includes water cells
 * (icebergs) as well as frozen land (glaciers).
 */
export declare function buildIceCells(atlas: FmgAtlasResult, thresholdC?: number): AtlasSvgPolygon[];
/** Military regiments (Azgaar "military" layer) as markers; naval flagged via type. */
export declare function buildRegiments(atlas: FmgAtlasResult): AtlasSvgMarker[];
/** Event/danger zone cells (Azgaar "zones" layer): each zone's cells in its color. */
export declare function buildZoneCells(atlas: FmgAtlasResult): AtlasSvgPolygon[];
/**
 * PROTOTYPE danger overlay: per-cell threat polygons (above the safe threshold)
 * with their 0..1 scalar, for the hatch renderer. Derived from world state via
 * `computeDangerField` (zones + terrain), not a static generator layer.
 */
export declare function buildDangerCells(atlas: FmgAtlasResult, dungeonSites?: ReadonlyArray<DungeonDangerSite>): Array<{
    points: string;
    danger: number;
}>;
/**
 * Build the ordered SVG layer model. Ocean = graduated shallow-water depth
 * bands (SP0 T3b) over the view's deep base rect; land = merged per-biome
 * regions (no facets — SP0 T2); rivers = tapered ribbons (T4); routes + burg
 * markers (T5); plus a coastline path (SP0 T3a).
 */
export declare function buildAtlasSvgModel(atlas: FmgAtlasResult, dungeonSites?: ReadonlyArray<DungeonDangerSite>): AtlasSvgModel;
