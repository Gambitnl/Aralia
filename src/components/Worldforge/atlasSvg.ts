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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasLayers.tsx, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/StartPointSelection.tsx, components/Worldforge/atlasDraw.ts, components/Worldforge/responsiveAtlasCore.ts, components/Worldforge/responsiveAtlasProtocol.ts, components/Worldforge/settlementDeclutter.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * MOD-3.5 (2026-09-09): the 1404-line original was cut into four topic
 * modules under atlasSvg/ — cells.ts (geometry, region merge, cell traits,
 * color ramps), water.ts (depth bands, rivers, ice), political.ts (routes,
 * borders, burgs, regiments, zones, danger) and labelsAndGlyphs.ts (labels,
 * declutter, forest/relief glyphs, pass marks, POI markers).
 *
 * This file keeps the top-level orchestrator buildAtlasSvgModel, the model
 * types it returns, and a re-export barrel, so every existing import from
 * '.../atlasSvg' keeps working unchanged and no call site moved. The barrel
 * is an EXPLICIT name list rather than export *, so the public surface stays
 * a reviewable list — the same 51 names the pre-split file exported.
 */
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { getTerrainKey, getTerrainColor } from './terrainColor';
import type { DungeonDangerSite } from '../../systems/worldforge/overlays/dangerField';
import {
  LAND_THRESHOLD,
  buildCellOutlines,
  buildCellRamp,
  buildMergedRegions,
  type AtlasSvgMarker,
  type AtlasSvgPolygon,
  type AtlasSvgRegion,
} from './atlasSvg/cells';
import { buildIceCells, buildOceanDepthBands, buildRivers } from './atlasSvg/water';
import {
  buildBurgs,
  buildDangerCells,
  buildRegiments,
  buildRoutes,
  buildStateBorders,
  buildZoneCells,
  type AtlasSvgBurg,
  type AtlasSvgRoute,
} from './atlasSvg/political';
import {
  buildForestGlyphs,
  buildLabels,
  buildPassMarks,
  buildPoiMarkers,
  buildReliefGlyphs,
  type AtlasSvgForestGlyphCell,
  type AtlasSvgLabel,
  type AtlasSvgPassMark,
  type AtlasSvgReliefGlyphCell,
} from './atlasSvg/labelsAndGlyphs';

// --- Barrel: the pre-split public surface, re-exported from its new home. ---
export {
  biomeFillForCell,
  buildCellOutlines,
  buildCellRamp,
  buildMergedRegions,
  cellPolygonPoints,
  cellTraits,
  findCellAtPoint,
} from './atlasSvg/cells';
export type { CellRampOptions, CellTraits, AtlasSvgMarker, AtlasSvgPolygon, AtlasSvgRegion } from './atlasSvg/cells';
export {
  buildIceCells,
  buildOceanDepthBands,
  buildRiverRibbon,
  buildRivers,
  oceanDepthDistance,
} from './atlasSvg/water';
export {
  buildBurgs,
  buildDangerCells,
  buildProvisionRingPath,
  buildRegiments,
  buildRoutes,
  buildStateBorders,
  buildZoneCells,
} from './atlasSvg/political';
export type { AtlasSvgBurg, AtlasSvgRoute, BurgTier } from './atlasSvg/political';
export {
  FOREST_GLYPH_LAYER_OPACITY,
  RELIEF_GLYPH_LAYER_OPACITY,
  buildForestGlyphs,
  buildLabels,
  buildPassMarks,
  buildPoiMarkers,
  buildReliefGlyphs,
  declutterLabels,
  forestGlyphRampOpacity,
  passMarkPath,
  reliefGlyphRampOpacity,
} from './atlasSvg/labelsAndGlyphs';
export type {
  AtlasSvgForestGlyphCell,
  AtlasSvgLabel,
  AtlasSvgPassMark,
  AtlasSvgReliefGlyphCell,
  DeclutterOptions,
  DeclutterView,
  LabelKind,
  LabelObstacle,
  PlacedLabel,
} from './atlasSvg/labelsAndGlyphs';

export interface AtlasSvgLayer { id: string; polygons: AtlasSvgPolygon[]; regions?: AtlasSvgRegion[] }

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
  /** Per-cell land elevation color-ramp fills (Azgaar "heightmap" layer; area mode). */
  heightCells?: AtlasSvgPolygon[];
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
const RAMP_HEIGHT = ramp3('#6da05f', '#a58858', '#f2efe9'); // lowland → upland → peak
const RAMP_TEMPERATURE = ramp3('#2c7bb6', '#ffffbf', '#d7191c'); // cold → hot
const RAMP_PRECIPITATION = ramp3('#f6e8c3', '#80cdc1', '#01665e'); // dry → wet

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
  // Heightmap ramp (Azgaar "heightmap" layer): land elevation, low → high.
  // buildCellRamp already skips water cells (h < LAND_THRESHOLD).
  const heightCells = buildCellRamp(atlas, (i) => cells.h[i], RAMP_HEIGHT);
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
    heightCells,
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
