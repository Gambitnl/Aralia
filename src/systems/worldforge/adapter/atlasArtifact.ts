// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/06/2026, 02:47:05
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/atlasDraw.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file atlasArtifact.ts — FMG atlas result → Worldforge AtlasArtifact adapter.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 (layer model, feet canon), §11
 * (options frozen in artifact; cell ids canonical). Build-order item 2
 * (adapter slice, directive B1).
 *
 * What changed: new module (B1).
 * Why: FmgAtlasResult lives in FMG-pixel space with FMG-metric semantics;
 * AtlasArtifact lives in Worldforge feet-canon space (SPEC §4 decision #12).
 * This adapter is the single conversion boundary.
 * Preserved: no spine/fmg files edited; all types consumed read-only.
 *
 * ── px → feet derivation ──────────────────────────────────────────────────
 * Source: .tmp/azgaar-src/src/renderers/draw-scalebar.ts (upstream render).
 *   val = (init * size * distanceScale) / scaleLevel   // distance in distanceUnit
 *   length = (val * scaleLevel) / distanceScale         // pixels
 * → pixels = init * size  →  1 px = distanceScale / (init * size) in distanceUnit
 *
 * At scaleLevel=1 (the cartographic identity zoom), init=100, size=1:
 *   1 px = distanceScale [distanceUnit]
 *
 * Upstream default (options.js line ~612):
 *   distanceScale = gauss(3, 1, 1, 5)  →  centre 3
 *   distanceUnit  = "km"  (non-US locale default)
 *
 * Therefore: DEFAULT canonical value is 1 FMG pixel = 3 km = 3 000 m.
 * In Worldforge feet-canon (SPEC §4, 1 ft = 0.3048 m exactly per units.ts):
 *   3 000 m × (1 ft / 0.3048 m) ≈ 9 842.52 ft/px
 *
 * Worldforge worlds use the default distanceScale (3 km/px). If the
 * world-creation UI later exposes distanceScale as a WorldGenOptions field,
 * this constant becomes a derived value rather than a hard default — for now
 * it is the only value the default options surface produces.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { type Feet, FEET_PER_METER } from '../units';
import { rootSeedPath } from '../seedPath';
import {
  WORLDFORGE_SCHEMA_VERSION,
  type AtlasArtifact,
  type AtlasBurg,
  type AtlasCell,
  type AtlasForest,
  type AtlasPass,
  type AtlasPeak,
  type AtlasRange,
  type AtlasRiver,
  type AtlasRoute,
} from '../artifacts';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { freezeWorldGenOptions, type WorldGenOptions } from './worldGenOptions';

// ---------------------------------------------------------------------------
// px → feet conversion (see file-header derivation)
// ---------------------------------------------------------------------------

/**
 * Default FMG distance scale: 3 km per FMG graph-unit pixel.
 * Source: Azgaar upstream options.js — `distanceScale = gauss(3, 1, 1, 5)`
 * with distanceUnit = "km" (non-US default). The centre (3) is the canonical
 * default; individual maps may differ, but Worldforge world-gen uses this
 * value unless the UI exposes distanceScale as a WorldGenOption in the future.
 */
const FMG_DEFAULT_DISTANCE_SCALE_KM_PER_PX = 3;

/**
 * Feet per one FMG graph-unit pixel, derived from the default distance scale.
 *   3 km/px × 1000 m/km × (1/0.3048) ft/m ≈ 9842.52 ft/px
 *
 * FROZEN constant: changing this value changes all artifact coordinates for
 * every existing world. Do not alter without an owner-approved world-break
 * decision (SPEC §4 / AGENTS.md determinism rules).
 */
export const FEET_PER_FMG_PIXEL: Feet =
  FMG_DEFAULT_DISTANCE_SCALE_KM_PER_PX * 1000 * FEET_PER_METER;

/** Convert an FMG pixel coordinate to Worldforge feet. */
export function feetFromFmgPixel(px: number): Feet {
  return px * FEET_PER_FMG_PIXEL;
}

// ---------------------------------------------------------------------------
// AtlasArtifact builder
// ---------------------------------------------------------------------------

/** The returned artifact type: AtlasArtifact augmented with frozen options. */
export type AtlasArtifactWithOptions = AtlasArtifact & {
  options: Readonly<WorldGenOptions>;
};

type AtlasAdapterInput = FmgAtlasResult | FmgWorldResult;

type RouteGroup = NonNullable<FmgWorldResult['pack']['routes']>[number]['group'];

/**
 * Convert an FmgAtlasResult (FMG pixel space) into the spine's
 * feet-canon AtlasArtifact, recording the resolved world-gen options
 * verbatim and frozen (SPEC §11).
 *
 * @param fmgAtlas - The result of `generateFmgAtlas`.
 * @param worldSeed - Numeric world seed (determines the root seed path).
 * @param options   - Resolved WorldGenOptions (null mapSize/lat/lon should
 *                    already be replaced with their drawn values by the
 *                    caller, or pass them as-is and they are stored verbatim).
 */
export function buildAtlasArtifact(
  fmgAtlas: AtlasAdapterInput,
  worldSeed: number,
  options: WorldGenOptions,
): AtlasArtifactWithOptions {
  const { pack, graphWidth, graphHeight } = fmgAtlas;
  const hasCivilizationData = Boolean(
    pack.cells.state &&
      pack.cells.culture &&
      pack.cells.burg &&
      pack.burgs &&
      pack.routes,
  );

  // ---- bounds (full map in feet) ----
  const bounds = {
    x: 0,
    y: 0,
    width: feetFromFmgPixel(graphWidth),
    height: feetFromFmgPixel(graphHeight),
  };

  // ---- cells (one AtlasCell per PACK cell; SPEC §11 cell id = pack cell id) ----
  // NOTE: pack.cells.i is a Uint32Array — TypedArray.map() coerces mapped
  // objects back to numbers (silently destroying them). Array.from() first.
  // (Orchestrator takeover fix, 2026-06-11: this was the stall point.)
  const cells: AtlasCell[] = Array.from(pack.cells.i).map((id) => {
    const [px, py] = pack.cells.p[id];
    const fmgHeight = pack.cells.h[id]; // 0..100 range (FMG convention)
    return {
      id,
      x: feetFromFmgPixel(px),
      y: feetFromFmgPixel(py),
      // Normalize FMG 0..100 height to 0..1 (SPEC §4: "height normalized 0..1")
      height: fmgHeight / 100,
      biomeId: pack.cells.biome ? pack.cells.biome[id] : 0,
      // river ids crossing this cell (pack.cells.r: Uint16Array, 0 = none)
      riverIds: pack.cells.r && pack.cells.r[id] > 0 ? [pack.cells.r[id]] : [],
      // Civilization arrays exist only after generateFmgWorld. For plain
      // generateFmgAtlas input, keep B1's placeholders so partial atlas
      // artifacts stay valid and deterministic.
      stateId: pack.cells.state ? pack.cells.state[id] : 0,
      cultureId: pack.cells.culture ? pack.cells.culture[id] : 0,
      burgId: pack.cells.burg ? pack.cells.burg[id] : 0,
    } satisfies AtlasCell;
  });

  // ---- rivers (AtlasRiver[] from pack.rivers) ----
  // flux proxy: we use the river's `discharge` field (m³/s, set by
  // Rivers.generate). It is the most direct analog to Azgaar's discharge
  // (which drives bank-width in L1 region generation). `width` (mouth width
  // in km) is an alternative but discharge is the primary generation output.
  const rivers: AtlasRiver[] = (pack.rivers ?? []).map((r) => ({
    id: r.i,
    cellIds: r.cells,
    flux: r.discharge,
  }));

  // ---- burgs / routes (generateFmgWorld only) ----
  // FMG source fields, from fmg/burgs-generator.ts:
  //   Burg.cell -> AtlasBurg.cellId
  //   Burg.x/y -> feet-canon x/y
  //   Burg.population -> AtlasBurg.population
  //   Burg.capital -> AtlasBurg.isCapital
  //   Burg.port -> AtlasBurg.isPort
  // Index 0 is FMG's placeholder entry, and removed burgs are editor-deleted
  // records; neither represents a live settlement for the artifact.
  const burgs: AtlasBurg[] = hasCivilizationData
    ? pack
        .burgs!.filter((burg) => burg.i && !burg.removed)
        .map((burg) => ({
          id: burg.i!,
          name: burg.name ?? '',
          cellId: burg.cell,
          x: feetFromFmgPixel(burg.x),
          y: feetFromFmgPixel(burg.y),
          population: burg.population ?? 0,
          isCapital: Boolean(burg.capital),
          isPort: Boolean(burg.port),
        }))
    : [];

  // FMG source fields, from fmg/routes-generator.ts:
  //   Route.i -> AtlasRoute.id
  //   Route.group "highways"/"roads"/"trails"/"paths"/"searoutes" -> singular kind
  //   Route.points are [x, y, cellId] triples, so the third value becomes
  //   the artifact's ordered cellIds. Some intermediate route segments carry
  //   `cells`, but the stored pack.routes contract uses points.
  const routes: AtlasRoute[] = hasCivilizationData
    ? pack.routes!.map((route) => ({
        id: route.i,
        cellIds: route.points.map((point) => point[2]),
        kind: mapRouteGroup(route.group),
      }))
    : [];

  // Named forests (forests campaign Task 2), from fmg/../forests/forestsPass:
  //   PackForest.i -> AtlasForest.id (1-based, 0 = "no forest")
  //   PackForest.cells -> AtlasForest.cellIds — raw pack cell ids, the same
  //     cell-space convention routes/rivers use (no conversion).
  //   PackForest.pole -> AtlasForest.pole — a POINT, so it converts FMG px →
  //     world feet exactly like AtlasBurg x/y (the label anchor must live in
  //     the same space burg labels do).
  // Present only after generateFmgWorld; plain atlas packs have no forests.
  const forests: AtlasForest[] = (pack.forests ?? []).map((forest) => ({
    id: forest.i,
    name: forest.name,
    kind: forest.kind,
    cellIds: [...forest.cells],
    pole: [feetFromFmgPixel(forest.pole[0]), feetFromFmgPixel(forest.pole[1])],
  }));

  // Named ranges + peaks (mountains campaign Task 2), from
  // fmg/../mountains/mountainsPass — the forests conventions verbatim:
  //   ids and cell-space data raw; pole a POINT converting FMG px → feet.
  // passes: DECLARED now, filled by the passes task (mountains Task 4);
  // until then pack.passes is never set, so the artifact carries [].
  const ranges: AtlasRange[] = (pack.ranges ?? []).map((range) => ({
    id: range.i,
    name: range.name,
    kind: range.kind,
    cellIds: [...range.cells],
    coreCellIds: [...range.coreCells],
    pole: [feetFromFmgPixel(range.pole[0]), feetFromFmgPixel(range.pole[1])],
  }));
  const peaks: AtlasPeak[] = (pack.peaks ?? []).map((peak) => ({
    id: peak.i,
    rangeId: peak.rangeI,
    cellId: peak.cellId,
    h: peak.h,
    name: peak.name,
  }));
  const passes: AtlasPass[] = (pack.passes ?? []).map((pass) => ({
    id: pass.i,
    rangeId: pass.rangeI,
    cellId: pass.cellId,
    name: pass.name,
    routeIds: [...pass.routeIds],
  }));

  return {
    layer: 'atlas',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: rootSeedPath(worldSeed),
    bounds,
    cells,
    burgs,
    rivers,
    routes,
    forests,
    ranges,
    peaks,
    passes,
    options: freezeWorldGenOptions(options),
  };
}

function mapRouteGroup(group: RouteGroup): AtlasRoute['kind'] {
  if (group === 'highways') return 'highway';
  if (group === 'roads') return 'road';
  if (group === 'trails') return 'trail';
  if (group === 'paths') return 'path';
  return 'searoute';
}
