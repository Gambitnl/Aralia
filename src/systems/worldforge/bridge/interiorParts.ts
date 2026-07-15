// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 21:38:02
 * Dependents: components/World3D/InteriorHourContext.tsx, systems/world3d/types.ts, systems/worldforge/bridge/buildingHistoryParts.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/sitePartTransform.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file interiorParts.ts — L4 interior → renderable wall/furnishing parts.
 *
 * Turns an InteriorPlan (plot-local FEET, street wall at y=0) into a list of
 * site-local boxes in METERS that the 3D scene renders inside a building's
 * group, replacing the solid shell box: perimeter walls with a real gap at
 * the entry door (decision #11 — seamless, the camera can walk in), interior
 * walls along room boundaries minus doorway gaps, and low furnishing blocks.
 * Styled blueprints also carry their resolved regional wall material and an
 * additive facade grammar (courses, bays, half-timbering, or log bands). Those
 * details sit outside the structural wall boxes, so they never close a door,
 * fill a window, or move the permanent plan. Larger role motifs use that same
 * additive path for signs, vents, porches, bell-cotes, and defensive details.
 *
 * Frame: x = centered frontage meters (matching the renderer group's +x
 * along the footprint's 0→1 edge). z = centered DEPTH meters with +z
 * pointing INWARD (away from the street). The renderer flips z by the
 * site's doorZSign so the street wall lands on the correct face of the
 * rotated group — same convention the exterior door mesh already uses.
 */

import { blueprintForPlot, generateInterior, type InteriorPlotInput } from '../interior/generateInterior';
import { EXTERIOR, type InteriorRoom, type InteriorPlan } from '../interior/types';
import type {
  BuildingMotif,
  BuildingHistoryFeature,
  BuildingLiveHistoryFeature,
  BlueprintPlan,
  FacadePattern,
  WallRun,
} from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import { HEARTH_KINDS } from '../interior/occupancy';
import { OUTER_THICKNESS_FT } from '../interior/walls';
import {
  buildBuildingMeshData,
  buildRoofMeshData,
  roofDeformationForPlan,
  type MeshBox,
} from '../../world3d/buildingModels';
import type { ChunkGeometryArrays } from '../../world3d/types';
import type { SeedPath } from '../seedPath';
import { buildBuildingMotifParts } from './buildingMotifParts';
import { buildBuildingHistoryParts } from './buildingHistoryParts';
import {
  buildBuildingMaterialParts,
  glazingPaneColor,
  type MaterialDetailKind,
} from './buildingMaterialParts';
import {
  buildBuildingWeatheringParts,
  type WeatheringDetailKind,
} from './buildingWeatheringParts';
import {
  buildBuildingEnsembleParts,
  type EnsembleDetailKind,
} from './buildingEnsembleParts';
import { isVisibleExteriorRun } from './buildingPartyWalls';
import { CELL_FT } from '../units';

// Preserve the bridge's public tag import while the dedicated motif module owns
// the geometry and literal. Existing renderers and tests need no migration.
export { MOTIF_PART_TAG } from './buildingMotifParts';
// Permanent history has its own tag for renderer inspection and tactical
// exclusion, parallel to the existing role-motif contract.
export { HISTORY_PART_TAG } from './buildingHistoryParts';
// Construction materials have their own semantic tag for renderer inspection
// and tactical exclusion, parallel to motifs and permanent history.
export { MATERIAL_PART_TAG } from './buildingMaterialParts';
// Age and climate patina remains independently inspectable and nonstructural.
export { WEATHERING_PART_TAG } from './buildingWeatheringParts';
// Block-level eaves and arcades stay separately inspectable and nonstructural.
export { ENSEMBLE_PART_TAG } from './buildingEnsembleParts';

/** One renderable box, site-local meters (y sits on the ground). */
export interface SitePart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  /**
   * Tactical-only parts remain authoritative for combat extraction but are
   * omitted by 3D renderers. Row blocks use this to keep each home enclosed
   * without drawing two structural walls at one shared lot boundary.
   */
  renderRole?: 'tactical-only';
  /** Base elevation in meters (default 0 = on the floor). Lets a part float
   * above the ground — e.g. an occupant's head atop their body. */
  baseY?: number;
  /** When set, the renderer lights this part's material with this emissive hex
   * (a warm glow). Drives the LIVING overlay's lit hearth (BGv2 Task 14): the
   * hearth furnishing glows after dusk when the family is home. */
  emissiveHex?: string;
  /** Optional classification tag. ROOF_PART_TAG marks the solved-roof dressing
   * (chimney flues, dormer masses) so consumers/tests can separate roof parts
   * from the wall/floor structure without a color sniff (BGv2 Task 5). */
  tag?: string;
  /** Exact exterior motif represented by this additive part. */
  motifKind?: BuildingMotif;
  /** Exact permanent-history fact represented by this additive part. */
  historyKind?: BuildingHistoryFeature['kind'] | BuildingLiveHistoryFeature['kind'];
  /** Exact physical construction detail represented by this additive part. */
  materialDetailKind?: MaterialDetailKind;
  /** Exact age/exposure mark represented by this presentation-only part. */
  weatheringDetailKind?: WeatheringDetailKind;
  /** Exact block-level row or arcade cue represented by this additive part. */
  ensembleDetailKind?: EnsembleDetailKind;
  /** When set, this part is a live-lit surface the renderer drives from the
   * building's hourly schedule: 'window' glass or the 'hearth' fire. Set
   * UNCONDITIONALLY at bake (independent of any hour) so the renderer can find
   * and toggle it. Replaces the old bake-time emissiveHex on these parts. */
  lightRole?: 'window' | 'hearth';
}

/** Tag stamped on solved-roof dressing parts (chimney/dormer boxes). */
export const ROOF_PART_TAG = 'roof';

/** Tag stamped on additive exterior trim generated from a facade grammar. */
export const FACADE_PART_TAG = 'facade';

/** The triangulated solved roof (planes + tower caps) as ONE geometry group,
 *  site-local METERS, ready for a single BufferGeometry. Separate from the box
 *  `parts` because roof planes are arbitrary triangles, not axis-aligned boxes
 *  (BGv2 Task 5). Absent when the plan carries no solved roof. */
export interface RoofPartGroup {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  /** Resolved roof tint (plan.styleResolved.roofColor). */
  colorHex: string;
}

const FT = 0.3048;
/** Wall thickness, meters. */
const WALL_T = 0.3;
/** Extra roof-eave overhang past the outer wall face, feet — a small readable
 *  eave so the roof caps the wall top instead of stopping flush/inside it. */
const EAVE_CLEAR_FT = 0.5;
/** Shallow projection of facade trim beyond the structural wall face. */
const FACADE_DEPTH_M = 0.08;
/** Width of one vertical structural bay marker, feet. */
const FACADE_POST_WIDTH_FT = 0.55;
/** Height of one horizontal facade course, feet. */
const FACADE_BAND_HEIGHT_FT = 0.42;
/** Maximum distance between vertical bay markers, feet. */
const FACADE_BAY_SPACING_FT = 10;
/** Window void width used by walls.ts and buildingModels.ts, plus trim clearance. */
const FACADE_WINDOW_HALF_CLEAR_FT = 1.6;
/** Doorway clear width, feet (one 5 ft cell). */
const DOOR_FT = 5;
/** Single worn-plank floor color shared by every generated interior. */
const FLOOR_COLOR = '#9a8a72';
/** Thin slab height that gives interiors a visible floor without blocking walls. */
const FLOOR_H = 0.12;
/** Interior wall color (lime-washed plaster). */
export const INTERIOR_WALL_COLOR = '#cfc7b8';
/** Door leaf tint (stained timber) — dresses the entry gap so it reads as a
 * real door rather than a bare punched-out hole (IN1). */
export const DOOR_LEAF_COLOR = '#4a3220';
/** Lintel beam tint above the entry door. */
export const DOOR_LINTEL_COLOR = '#6b4a30';
/** Window pane tint (dark glazed glass) set into perimeter walls (IN1). */
export const WINDOW_PANE_COLOR = '#2f3a4d';
/** Ceiling slab tint for single-storey interiors so they stay enclosed (IN2).
 * Matches the floor plank so a one-room interior reads as a finished box. */
export const CEILING_COLOR = '#8c7d68';
/** Door leaf clear width, feet (slightly under the DOOR_FT gap so the leaf
 * sits inside the opening). */
const DOOR_LEAF_FT = 4;
/** Door leaf height, meters. */
const DOOR_LEAF_H = 2.1;
/** Window opening height/width, meters, and sill elevation. */
const WINDOW_W = 0.9;
const WINDOW_H = 1.0;
const WINDOW_SILL_M = 1.1;
/** Exterior (perimeter) wall tint by plot role — keeps the market/house
 * identity the solid shells used to carry. */
export const PERIMETER_WALL_COLORS: Record<string, string> = {
  market: '#c8923f',
  workshop: '#b09a72', // same as house for now, or maybe slightly different
  house: '#b09a72',
};

export const FURNITURE: Record<string, { w: number; d: number; h: number; colorHex: string }> = {
  table: { w: 1.6, d: 0.9, h: 0.8, colorHex: '#c8a24a' },
  hearth: { w: 1.4, d: 0.7, h: 1.4, colorHex: '#b5552e' },
  'forge-hearth': { w: 1.6, d: 0.9, h: 1.2, colorHex: '#5a4636' },
  counter: { w: 2.2, d: 0.7, h: 1.0, colorHex: '#c8a24a' },
  shelf: { w: 1.8, d: 0.4, h: 1.8, colorHex: '#9a8458' },
  barrel: { w: 0.7, d: 0.7, h: 1.0, colorHex: '#8a6a42' },
  bed: { w: 1.0, d: 2.0, h: 0.6, colorHex: '#7da0c4' },
  chest: { w: 1.0, d: 0.6, h: 0.6, colorHex: '#a07c4a' },
  crate: { w: 0.8, d: 0.8, h: 0.8, colorHex: '#8a6a42' },
  workbench: { w: 2.0, d: 0.8, h: 0.9, colorHex: '#b08968' },
  bench: { w: 1.5, d: 0.4, h: 0.45, colorHex: '#a5824f' },
  altar: { w: 1.4, d: 0.8, h: 1.1, colorHex: '#b8b2a4' },
  desk: { w: 1.4, d: 0.7, h: 0.78, colorHex: '#8f6b45' },
  chair: { w: 0.5, d: 0.5, h: 0.9, colorHex: '#9c7a4e' },
  'weapon-rack': { w: 1.2, d: 0.4, h: 1.7, colorHex: '#6f5a3e' },
  anvil: { w: 0.9, d: 0.4, h: 0.9, colorHex: '#45464b' },
  'writing-desk': { w: 1.3, d: 0.6, h: 0.95, colorHex: '#8f6b45' },
  strongbox: { w: 0.7, d: 0.5, h: 0.5, colorHex: '#5f5140' },
};

/**
 * Resolve a furnishing kind to its 3D box spec. Throws on an unknown kind
 * rather than silently dropping the piece from the scene (no-fallback). The
 * FURNISHING_RECIPE_KINDS coverage test guarantees every emitted kind resolves,
 * so this throw fires only when a new generator kind lands without a render spec.
 */
export function furnishingSpec(kind: string): { w: number; d: number; h: number; colorHex: string } {
  const spec = FURNITURE[kind];
  if (!spec) throw new Error(`interiorParts: unknown furnishing kind "${kind}" — add a spec to FURNITURE`);
  return spec;
}

/** Stair flight tint (worn timber). */
export const STAIR_COLOR = '#7a5a36';

/** Warm emissive tint painted on a LIT hearth's furnishing box. */
export const HEARTH_GLOW_HEX = '#ff8a3c';

/** Warm emissive tint painted on window panes when the building is lit from
 * within at dusk/night (interior-lighting slice). Slightly lighter/cooler than
 * the hearth glow so a lit window reads as lamplight spilling through glass
 * rather than an open flame. Emissive-only — the pane itself glows; no light is
 * cast, so this reads town-wide from the street at zero light cost. */
export const WINDOW_GLOW_HEX = '#ffb066';

/** A 1-D wall run [lo, hi] on a fixed line, in feet. */
interface Run {
  lo: number;
  hi: number;
}

/** Merge overlapping or touching wall spans on a fixed wall line. */
function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  const sorted = [...runs].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  for (const run of sorted) {
    const last = out[out.length - 1];
    if (!last || run.lo > last.hi) {
      out.push({ ...run });
      continue;
    }
    last.hi = Math.max(last.hi, run.hi);
  }
  return out;
}

/** Remove [gapLo, gapHi] from every run (splitting where needed). */
function cutRuns(runs: Run[], gapLo: number, gapHi: number): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (gapHi <= r.lo || gapLo >= r.hi) {
      out.push(r);
      continue;
    }
    if (gapLo > r.lo) out.push({ lo: r.lo, hi: gapLo });
    if (gapHi < r.hi) out.push({ lo: gapHi, hi: r.hi });
  }
  return out;
}

/**
 * Render-ready body for one occupant, in METERS + hex — the projection of the
 * parametric BodyPlan (BODY-1, body/generateBody) the figure renderer needs.
 * Kept structural (no BodyPlan import) so this module stays decoupled from the
 * roster/body data types; the bridge maps BodyPlan → OccupantBody at the call
 * site.
 */
export interface OccupantBody {
  /** Total standing height (heel to crown), meters. */
  heightM: number;
  /** Shoulder width → body box width, meters. */
  shoulderWidthM: number;
  /** Torso depth (front-to-back) → body box depth, meters. */
  depthM: number;
  /** Head height (chin to crown) → head box, meters. */
  headSizeM: number;
  skinToneHex: string;
  clothingHex: string;
}

/** Minimal occupant view (structural — avoids coupling to roster types). */
export interface OccupantFigure {
  id: number;
  ageBand: 'child' | 'adult' | 'elder';
  /** Standing at their work plot (front-of-house) vs at home (back half). */
  atWork?: boolean;
  /** Parametric body (BODY-1): per-person proportions + palette. Required —
   * every roster occupant has an identity, so there is one real path and no
   * fallback to uniform crates. */
  body: OccupantBody;
  /** LIVING overlay station (BGv2 Task 14): the exact PLAN-FEET position + floor
   * this figure stands at for the current game hour, from occupancy.ts (via the
   * bridge's occupancyForPlot). When present it OVERRIDES the room-cycling
   * heuristic below, so a figure lands at its real station — the smith at the
   * forge, a sleeper at their bed. Feet in the blueprint frame (0 = min corner),
   * mapped through the same toX/toZ as every other part. */
  station?: { xFt: number; yFt: number; level: number };
}

/**
 * Wall envelope (in METERS — the footprint the renderer must fit roofs/floors
 * to; the plot footprint is up to 5 ft larger per axis, and sizing roofs to it
 * caused the floating-sombrero look, shots 1–2 of Remy's 2026-06-12 review)
 * AND interior parts, from a SINGLE interior generation. The 3D bake needs both
 * per plot; generating the (deterministic) interior once and reusing it here
 * avoids regenerating it — significant for large capitals (~650 plots).
 */
export function buildInterior(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
  shellHeightM: number,
  occupants: OccupantFigure[] = [],
  // LIVING overlay (BGv2 Task 14): light the hearth furnishing when the family
  // is home in a hearth window. Defaults false so briefless / daytime bakes are
  // byte-identical to before.
  hearthLit = false,
  // Interior-lighting slice: light the window panes (emissive glow) when the
  // building is occupied at a dusk/night bake hour. Decided by the caller from
  // occupancy; defaults false so daytime / briefless bakes are unchanged.
  litWindows = false,
): {
  envelope: {
    wallWidthM: number;
    wallDepthM: number;
    siteOriginXFt?: number;
    siteOriginYFt?: number;
  };
  parts: SitePart[];
  roof?: RoofPartGroup;
} {
  // PERF NOTE (2026-07-08): blueprintForPlot runs ~3x per populated plot — here
  // (generateInterior fetches it internally, plus the blueprintForPlot call
  // below) and once more in occupancyScheduleForPlot. It LOOKS wasteful, but
  // generateBuilding is memoized, so calls 2 and 3 are cache hits. Measured over
  // a 650-plot capital bake: the 2 redundant calls cost ~17 ms total (1.9% of
  // blueprint work); the real cost is cold generation (~1.3 ms/plot). Left
  // un-threaded ON PURPOSE — passing one plan through these three signatures
  // would risk the determinism / byte-stability contracts the tests guard, for a
  // 1.9% win. Re-measure before revisiting. If bake feels slow, the target is
  // cold generation, not these fetches. Bench: .agent/scratch/bench-blueprint-fetch.ts
  const plan = generateInterior(plot, seedPath);
  const blueprint = blueprintForPlot(plot, seedPath);
  const parts = buildInteriorParts(plot, seedPath, shellHeightM, occupants, plan, blueprint, hearthLit, litWindows);
  // Solved roof (BGv2 Task 5): when the blueprint carries plan.roof (a style
  // context was resolved), raise the triangulated roof group + chimney/dormer
  // dressing so the town building gets the solved roof instead of the legacy
  // whole-rect prism. Absent (roof undefined) when no style resolved — the
  // renderer then keeps the legacy prism, and the part list is unchanged.
  const storeyHeightM = shellHeightM / Math.max(1, plan.storeys);
  const perimeterColor = PERIMETER_WALL_COLORS[plot.role] ?? PERIMETER_WALL_COLORS.house;
  const { dressing, roof } = blueprint
    ? blueprintRoof(blueprint, storeyHeightM, perimeterColor)
    : { dressing: [] as SitePart[], roof: undefined };
  parts.push(...dressing);
  return {
    envelope: {
      wallWidthM: plan.widthFt * FT,
      wallDepthM: plan.depthFt * FT,
      // Legacy chunks remain sparse; only asymmetric structural history needs
      // to carry an origin distinct from the current envelope center.
      ...(plan.siteOriginFt
        ? { siteOriginXFt: plan.siteOriginFt.x, siteOriginYFt: plan.siteOriginFt.y }
        : {}),
    },
    parts,
    ...(roof ? { roof } : {}),
  };
}

// ============================================================================
// Additive Facade Dressing
// ============================================================================
// The blueprint's wall runs remain the structural truth. This section projects
// shallow trim just beyond their exterior faces, using the resolved district
// grammar. Because dressing is emitted after structure and tagged separately,
// callers can inspect or hide it without changing collision or room topology.
// ============================================================================

/** Along-axis bounds of one straight wall run, in blueprint feet. */
function wallRunSpan(run: WallRun): [number, number] {
  return run.axis === 'x' ? [run.x1, run.x2] : [run.y1, run.y2];
}

/**
 * Split a horizontal trim course around every window void on this wall run.
 *
 * Door edges already split wall runs, but windows are openings inside a run.
 * Keeping a small 0.1 ft margin beyond each 3 ft window prevents projected log
 * bands or belt courses from appearing as bars across the glass.
 */
function facadeBandSpans(
  run: WallRun,
  windows: BlueprintPlan['floors'][number]['windows'],
  lo: number,
  hi: number,
): Array<[number, number]> {
  const wallLineFt = run.axis === 'x' ? run.y1 : run.x1;
  const openings = windows
    .filter((window) => {
      if (window.axis !== run.axis) return false;
      const fixedFt = run.axis === 'x' ? window.y : window.x;
      return Math.abs(fixedFt - wallLineFt) < 1e-6;
    })
    .map((window) => {
      const centerFt = run.axis === 'x' ? window.x : window.y;
      return [
        Math.max(lo, centerFt - FACADE_WINDOW_HALF_CLEAR_FT),
        Math.min(hi, centerFt + FACADE_WINDOW_HALF_CLEAR_FT),
      ] as [number, number];
    })
    .filter(([openingLo, openingHi]) => openingHi > openingLo)
    .sort(([a], [b]) => a - b);

  const spans: Array<[number, number]> = [];
  let cursorFt = lo;
  for (const [openingLo, openingHi] of openings) {
    if (openingLo > cursorFt) spans.push([cursorFt, openingLo]);
    cursorFt = Math.max(cursorFt, openingHi);
  }
  if (hi > cursorFt) spans.push([cursorFt, hi]);
  return spans;
}

/**
 * Convert one decorative span on an outer wall into a shallow render box.
 *
 * `alongCenterFt` and `alongLengthFt` describe the strip along the wall. The
 * strip is then moved just beyond the wall's outward face, which prevents
 * z-fighting while keeping the facade attached to its exact irregular shell.
 */
function facadePartOnRun(
  run: WallRun,
  originXFt: number,
  originYFt: number,
  alongCenterFt: number,
  alongLengthFt: number,
  baseYFt: number,
  heightFt: number,
  colorHex: string,
): SitePart {
  const outwardFt = run.thicknessFt / 2 + FACADE_DEPTH_M / FT / 2;
  const common = {
    h: heightFt * FT,
    baseY: baseYFt * FT,
    colorHex,
    tag: FACADE_PART_TAG,
  };

  // Horizontal wall runs extend along plan x and project along their y normal.
  if (run.axis === 'x') {
    return {
      ...common,
      x: (alongCenterFt - originXFt) * FT,
      z: (run.y1 - originYFt + run.ny * outwardFt) * FT,
      w: alongLengthFt * FT,
      d: FACADE_DEPTH_M,
    };
  }

  // Vertical wall runs extend along plan y and project along their x normal.
  return {
    ...common,
    x: (run.x1 - originXFt + run.nx * outwardFt) * FT,
    z: (alongCenterFt - originYFt) * FT,
    w: FACADE_DEPTH_M,
    d: alongLengthFt * FT,
  };
}

/**
 * Dress every above-grade outer wall from the resolved facade grammar.
 *
 * Window centers sit halfway through 5 ft cells, while vertical markers sit on
 * wall-run boundaries and 10 ft intervals. That rhythm naturally avoids most
 * glazing without reading or rewriting window geometry. Door runs are already
 * split by the blueprint wall builder, so the same rule frames rather than
 * blocks entrances.
 */
function facadeDetails(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): SitePart[] {
  const style = blueprint.styleResolved;
  if (!style || style.facadePattern === 'plain') return [];

  const pattern: FacadePattern = style.facadePattern;
  const origin = blueprintSiteOrigin(blueprint);
  const storeyHeightFt = storeyHeightM / FT;
  const parts: SitePart[] = [];

  // Each floor owns its own wall runs, so details follow upper-storey shells as
  // faithfully as the ground floor and never dress a below-grade basement.
  for (const floor of blueprint.floors) {
    if (floor.level < 0) continue;
    const floorBaseFt = floor.level * storeyHeightFt;

    for (const run of floor.wallRuns) {
      if (!isVisibleExteriorRun(blueprint, run)) continue;
      const [lo, hi] = wallRunSpan(run);
      const runLengthFt = hi - lo;
      if (runLengthFt <= 0) continue;

      // Belt-course and half-timber districts repeat a strong line below each
      // eave. Wealthy buildings add a lower sill course as restrained ornament.
      const bandOffsetsFt: number[] = [];
      if (pattern === 'belt-course' || pattern === 'half-timber') {
        bandOffsetsFt.push(Math.max(0.5, storeyHeightFt - 1));
        if (style.ornament) bandOffsetsFt.push(1);
      }

      // Log districts use several close horizontal bands so the wall reads as
      // stacked construction rather than a plaster face.
      if (pattern === 'log-bands') {
        for (let offsetFt = 1.5; offsetFt < storeyHeightFt - 0.5; offsetFt += 2) {
          bandOffsetsFt.push(offsetFt);
        }
      }

      for (const offsetFt of bandOffsetsFt) {
        for (const [spanLo, spanHi] of facadeBandSpans(run, floor.windows, lo, hi)) {
          parts.push(facadePartOnRun(
            run,
            origin.x,
            origin.y,
            (spanLo + spanHi) / 2,
            spanHi - spanLo,
            floorBaseFt + offsetFt,
            FACADE_BAND_HEIGHT_FT,
            style.trimColor,
          ));
        }
      }

      // Vertical-bay and half-timber districts mark corners, door breaks, and
      // long spans. Ten-foot spacing is broad enough to remain legible at town
      // scale while still giving a close building a constructed rhythm.
      if (pattern === 'vertical-bays' || pattern === 'half-timber') {
        const centersFt: number[] = [lo];
        for (
          let atFt = lo + FACADE_BAY_SPACING_FT;
          atFt < hi;
          atFt += FACADE_BAY_SPACING_FT
        ) {
          centersFt.push(atFt);
        }
        centersFt.push(hi);

        const postWidthFt = Math.min(FACADE_POST_WIDTH_FT, runLengthFt);
        for (const proposedFt of centersFt) {
          // Keep the post body on this run even when the marker represents an
          // endpoint; adjacent runs may overlap at a corner, which reads as one
          // stronger corner post and is harmless additive geometry.
          const centerFt = Math.max(
            lo + postWidthFt / 2,
            Math.min(hi - postWidthFt / 2, proposedFt),
          );
          parts.push(facadePartOnRun(
            run,
            origin.x,
            origin.y,
            centerFt,
            postWidthFt,
            floorBaseFt + 0.45,
            Math.max(0.5, storeyHeightFt - 0.9),
            style.trimColor,
          ));
        }
      }
    }
  }

  return parts;
}

/**
 * Blueprint structure to SiteParts (Task 12). Converts the pure
 * buildBuildingMeshData boxes (plan feet) into site-local meter parts:
 * per-level floor/ceiling slabs with stair holes, thickness-true walls
 * following the irregular shell along each run's outward normal, window
 * voids (sill + head + glazed pane), door jamb reveals + lintels, and
 * stair flights for every level of the plan.
 */
function blueprintStructureParts(
  bp: BlueprintPlan,
  storeyHeightM: number,
  perimeterColor: string,
  // Interior-lighting slice: when true, window panes glow with WINDOW_GLOW_HEX
  // so the building reads as lit from within (lamplight through the glass) at
  // dusk/night. Emissive-only — no light cast. Deterministic (the flag is
  // decided from occupancy at the bake hour by the caller).
  litWindows = false,
): SitePart[] {
  const md = buildBuildingMeshData(bp, { storeyHeightFt: storeyHeightM / FT });
  const origin = blueprintSiteOrigin(bp);
  // Styled blueprints own their regional/district wall material. The role
  // color remains the honest fallback for legacy or synthetic plans that have
  // no resolved style.
  const exteriorWallColor = bp.styleResolved?.wallColor ?? perimeterColor;
  const windowPaneColor = bp.styleResolved
    ? glazingPaneColor(bp.styleResolved.construction.glazing)
    : WINDOW_PANE_COLOR;
  const colorFor = (b: MeshBox): string => {
    switch (b.kind) {
      case 'floor': return FLOOR_COLOR;
      case 'ceiling': return CEILING_COLOR;
      case 'stair': return STAIR_COLOR;
      case 'door-lintel': return DOOR_LINTEL_COLOR;
      case 'window-pane': return windowPaneColor;
      default: return b.wallKind === 'outer' ? exteriorWallColor : INTERIOR_WALL_COLOR;
    }
  };
  const parts: SitePart[] = [];
  for (const floor of md.floors) {
    for (const b of floor.boxes) {
      // Frontage order is stable inside a town block. When the opposite
      // neighbor owns this side's masonry, retain the wall for tactical
      // extraction but tell renderers not to draw the duplicate copy.
      const ensemble = bp.ensemble;
      const isLeftPartyWall = b.wallKind === 'outer'
        && b.nx === -1
        && b.ny === 0
        && ensemble?.partyWallLeft === true;
      const isRightPartyWall = b.wallKind === 'outer'
        && b.nx === 1
        && b.ny === 0
        && ensemble?.partyWallRight === true;
      const tacticalOnly =
        (isLeftPartyWall && ensemble?.partyWallOwner === 'earlier-frontage-member')
        || (isRightPartyWall && ensemble?.partyWallOwner === 'later-frontage-member');

      parts.push({
        x: (b.x - origin.x) * FT,
        z: (b.y - origin.y) * FT,
        w: b.w * FT,
        d: b.d * FT,
        h: b.h * FT,
        colorHex: colorFor(b),
        ...(tacticalOnly ? { renderRole: 'tactical-only' as const } : {}),
        ...(b.z0 !== 0 ? { baseY: b.z0 * FT } : {}),
        // Window panes are ALWAYS tagged 'window' (bake-hour independent); the
        // renderer decides lit/dark live from the building's schedule.
        ...(b.kind === 'window-pane' ? { lightRole: 'window' as const } : {}),
      });
    }
  }

  // Construction materials, weathering, facade grammar, role motifs, and
  // permanent history are additive dressing outside the completed structural
  // walk. Core boxes, openings, slabs, and stairs are never rewritten.
  parts.push(...buildBuildingMaterialParts(bp, storeyHeightM));
  parts.push(...buildBuildingWeatheringParts(bp, storeyHeightM));
  parts.push(...buildBuildingEnsembleParts(bp, storeyHeightM));
  parts.push(...facadeDetails(bp, storeyHeightM));
  parts.push(...buildBuildingMotifParts(bp, storeyHeightM));
  parts.push(...buildBuildingHistoryParts(bp, storeyHeightM));
  return parts;
}

/**
 * Blueprint → structure parts PLUS the solved roof (BGv2 Task 5). When the plan
 * carries `plan.roof` (populated only when a StyleContext was resolved), this
 * raises the solved roof on top of the wall-true structure:
 *   - `roof`: the triangulated roof planes + tower cap fans as ONE geometry
 *     group in site-local meters, colored `plan.styleResolved.roofColor`.
 *   - chimney flues (trim color) and dormer masses (roof color) as tagged
 *     SiteParts appended to `parts`.
 * When `plan.roof` is absent the structure walk is UNCHANGED and `roof` is
 * undefined — a roofless plan is byte-identical to the pre-Task-5 output.
 *
 * Structure parts are byte-stable either way: the roof arrives as a separate
 * group + dressing, never perturbing the wall/floor/stair boxes.
 */
export function buildBlueprintParts(
  bp: BlueprintPlan,
  storeyHeightM: number,
  perimeterColor: string,
  litWindows = false,
): { parts: SitePart[]; roof?: RoofPartGroup } {
  const parts = blueprintStructureParts(bp, storeyHeightM, perimeterColor, litWindows);
  const { dressing, roof } = blueprintRoof(bp, storeyHeightM, perimeterColor);
  parts.push(...dressing);
  return roof ? { parts, roof } : { parts };
}

/**
 * The solved roof for a BlueprintPlan (BGv2 Task 5): the triangle group (planes
 * + tower caps, site-local meters) plus chimney/dormer dressing as tagged box
 * SiteParts. Empty (`roof` undefined, no dressing) when the plan carries no
 * solved roof, so roofless plans stay byte-identical. Shared by
 * buildBlueprintParts and buildInterior so both raise the SAME roof.
 */
function blueprintRoof(
  bp: BlueprintPlan,
  storeyHeightM: number,
  perimeterColor: string,
): { dressing: SitePart[]; roof?: RoofPartGroup } {
  if (!bp.roof) return { dressing: [] };
  const origin = blueprintSiteOrigin(bp);
  const envelopeCenterX = bp.widthFt / 2;
  const envelopeCenterY = bp.depthFt / 2;
  // Wall top = built (above-grade) storeys × storey height, in FEET — matches
  // the wallTopFt the roof solver used (generateBuilding: storeys * storeyFt).
  const storeyFt = storeyHeightM / FT;
  const aboveGradeStoreys = bp.floors.filter((f) => f.level >= 0).length;
  const wallTopFt = aboveGradeStoreys * storeyFt;
  const rm = buildRoofMeshData(bp.roof, wallTopFt, roofDeformationForPlan(bp));

  // Roof geometry group: plan feet → meters. The mesh Y axis is vertical, so a
  // MeshBox-frame (x, Y, z) point maps to the site frame the same way the box
  // parts do — anchor on the stable site origin and scale by FT; Y is the
  // world-up baseY offset the renderer applies. Positions are [x, Y, z] triples.
  //
  // Eave-overhang fix (BGv2 Phase 1B): the solver sets the eave `eaveOverhangFt`
  // (1 ft temperate) beyond the footprint grid line, but the OUTER walls grow
  // OUTWARD `OUTER_THICKNESS_FT` (1.5 ft) beyond that same line — so a bare eave
  // lands INSIDE the outer wall face, leaving the wall top exposed as a rim (on
  // tall buildings that rim reads as an open-topped box). Push the EAVE ring
  // (the roof's lowest vertices) OUTWARD from the footprint center so it clears
  // the outer wall face by EAVE_CLEAR_FT. Only the eave ring moves — ridge/apex
  // (higher Y) are untouched, so the pitch profile above the eave is unchanged.
  const src = rm.tris.positions;
  // Eave = the roof's lowest plane vertices (in plan feet, before the FT scale).
  let eaveZFt = Infinity;
  for (let i = 1; i < src.length; i += 3) eaveZFt = Math.min(eaveZFt, src[i]);
  const eaveOverhangFt = bp.roof.eaveOverhangFt;
  // Feet to push the eave outward past its solved position so it reaches the
  // outer wall face plus a small visible overhang.
  const pushFt = Math.max(0, OUTER_THICKNESS_FT - eaveOverhangFt) + EAVE_CLEAR_FT;
  const roofPartyWalls = bp.ensemble?.partyWallOwner
    ? {
        left: bp.ensemble.partyWallLeft,
        right: bp.ensemble.partyWallRight,
      }
    : { left: false, right: false };
  const footprintMinXFt = Math.min(...bp.masses.map((mass) => mass.x * CELL_FT));
  const footprintMaxXFt = Math.max(
    ...bp.masses.map((mass) => (mass.x + mass.w) * CELL_FT),
  );
  const positions = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    let cx = src[i] - origin.x;       // site-local plan feet (x)
    let cz = src[i + 2] - origin.y;   // site-local plan feet (z)
    // Push only eave-level vertices outward, away from center on each axis.
    if (pushFt > 0 && Math.abs(src[i + 1] - eaveZFt) < 1e-3) {
      const envelopeX = src[i] - envelopeCenterX;
      const envelopeZ = src[i + 2] - envelopeCenterY;
      const sitsOnLeftPartyWall = roofPartyWalls.left
        && Math.abs(src[i] - footprintMinXFt) < 1e-4;
      const sitsOnRightPartyWall = roofPartyWalls.right
        && Math.abs(src[i] - footprintMaxXFt) < 1e-4;
      if (envelopeX !== 0 && !sitsOnLeftPartyWall && !sitsOnRightPartyWall) {
        cx += Math.sign(envelopeX) * pushFt;
      }
      if (envelopeZ !== 0) cz += Math.sign(envelopeZ) * pushFt;
    }
    // History tessellation and hip corners can add eave-level vertices close
    // to a clipped seam. The generic clearance shift must not push those fresh
    // vertices back through the canonical party-wall half-space.
    if (roofPartyWalls.left) cx = Math.max(cx, footprintMinXFt - origin.x);
    if (roofPartyWalls.right) cx = Math.min(cx, footprintMaxXFt - origin.x);
    positions[i] = cx * FT;                 // x, centered (+ eave overhang)
    positions[i + 1] = src[i + 1] * FT;     // Y (already includes wallTopFt)
    positions[i + 2] = cz * FT;             // z, centered (+ eave overhang)
  }
  const roofColor = bp.styleResolved?.roofColor ?? perimeterColor;
  const trimColor = bp.styleResolved?.trimColor ?? perimeterColor;
  const roof: RoofPartGroup = {
    positions,
    indices: rm.tris.indices,
    normals: rm.tris.normals,
    colorHex: roofColor,
  };

  // Chimney flues (trim) + dormer masses (roof), as tagged box SiteParts. Their
  // MeshBox x/y are footprint feet; z0/h are FEET above ground (already include
  // wallTopFt), so baseY = z0*FT and the renderer lifts them onto the roof.
  const dressing: SitePart[] = [];
  for (const c of rm.chimneyBoxes) {
    dressing.push({
      x: (c.x - origin.x) * FT, z: (c.y - origin.y) * FT,
      w: c.w * FT, d: c.d * FT, h: c.h * FT,
      baseY: c.z0 * FT, colorHex: trimColor, tag: ROOF_PART_TAG,
    });
  }
  for (const dm of rm.dormerBoxes) {
    dressing.push({
      x: (dm.x - origin.x) * FT, z: (dm.y - origin.y) * FT,
      w: dm.w * FT, d: dm.d * FT, h: dm.h * FT,
      baseY: dm.z0 * FT, colorHex: roofColor, tag: ROOF_PART_TAG,
    });
  }

  return { dressing, roof };
}

export function buildInteriorParts(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
  shellHeightM: number,
  occupants: OccupantFigure[] = [],
  // Optional precomputed interior — lets a caller that also needs the wall
  // envelope (the 3D bake) generate the interior ONCE and reuse it here rather
  // than regenerating. Defaults to generating from (plot, seedPath).
  precomputedPlan?: InteriorPlan,
  // Optional precomputed BlueprintPlan (Task 12): when present, ALL structure
  // (slabs, walls, windows, door reveals, stairs, ceiling) is raised from the
  // blueprint via buildBuildingMeshData instead of the legacy room-rect walk.
  // On the default path (no precomputedPlan) the blueprint is derived here;
  // callers that inject a synthetic legacy plan keep the legacy geometry.
  precomputedBlueprint?: BlueprintPlan,
  // LIVING overlay (BGv2 Task 14): when true, the hearth furnishing part is
  // tagged with a warm emissiveHex so the renderer glows it. False = cold.
  hearthLit = false,
  // Interior-lighting slice: when true, every window pane is tagged with a warm
  // emissiveHex so the shell reads as lit from within at dusk/night. False = dark
  // glass (daytime, or an unoccupied/civic building at night).
  litWindows = false,
): SitePart[] {
  const plan = precomputedPlan ?? generateInterior(plot, seedPath);
  const blueprint =
    precomputedBlueprint ?? (precomputedPlan ? undefined : blueprintForPlot(plot, seedPath));
  const W = plan.widthFt;
  const D = plan.depthFt;
  const origin = plan.siteOriginFt ?? { x: W / 2, y: D / 2 };
  const toX = (fx: number): number => (fx - origin.x) * FT;
  const toZ = (fy: number): number => (fy - origin.y) * FT;
  const parts: SitePart[] = [];
  const wallH = Math.min(shellHeightM, 3);
  // Vertical spacing between floors (the shell is divided evenly by storey).
  const storeyHeightM = shellHeightM / Math.max(1, plan.storeys);
  const perimeterColor = PERIMETER_WALL_COLORS[plot.role] ?? PERIMETER_WALL_COLORS.house;

  // ── Blueprint path (Task 12): the WHOLE structure — per-level floor slabs
  // with stair holes, thickness-true walls on the irregular shell, window
  // voids, door jamb reveals, stair flights and the top ceiling — is raised
  // from the BlueprintPlan. The legacy room-rect walk below is skipped.
  if (blueprint) {
    parts.push(...blueprintStructureParts(blueprint, storeyHeightM, perimeterColor, litWindows));
    // Basement furnishings come straight from the blueprint: the legacy
    // InteriorPlan cannot represent level -1, so below-grade furniture (like
    // the structure above) is raised from the BlueprintPlan directly, sunk a
    // full storey via negative baseY. The generator guarantees basements
    // have NO windows; the below-grade slab/walls arrive via
    // blueprintStructureParts (MeshBox z0 < 0 → negative baseY).
    for (const fl of blueprint.floors) {
      if (fl.level >= 0) continue;
      const baseY = fl.level * storeyHeightM;
      for (const f of fl.furnishings) {
        const spec = furnishingSpec(f.kind);
        const rotated = f.rotation === 90 || f.rotation === 270;
        parts.push({
          x: toX(f.x), z: toZ(f.y),
          w: rotated ? spec.d : spec.w, d: rotated ? spec.w : spec.d,
          h: spec.h, colorHex: spec.colorHex, baseY,
        });
      }
    }
  } else {

  // Emit the full-envelope floor before walls, furniture, or people. The
  // renderer places part bottoms on local ground, so this thin plank slab
  // covers raw terrain without changing the frozen wall-envelope contract.
  parts.push({
    x: 0,
    z: 0,
    w: W * FT,
    d: D * FT,
    h: FLOOR_H,
    colorHex: FLOOR_COLOR,
  });

  // Wall lines: key "h:<y>" (horizontal, along x) or "v:<x>" (vertical).
  // Perimeter lines start as full runs; internal room edges accumulate runs
  // (duplicates from adjacent rooms overlap harmlessly — gap cutting below
  // applies to every run on the line, so doors stay open through both).
  const lines = new Map<string, Run[]>();
  const addRun = (key: string, lo: number, hi: number): void => {
    const runs = lines.get(key) ?? [];
    runs.push({ lo, hi });
    lines.set(key, runs);
  };

  addRun('h:0', 0, W);
  addRun(`h:${D}`, 0, W);
  addRun('v:0', 0, D);
  addRun(`v:${W}`, 0, D);
  for (const r of plan.rooms) {
    if (r.y > 0) addRun(`h:${r.y}`, r.x, r.x + r.w);
    if (r.y + r.d < D) addRun(`h:${r.y + r.d}`, r.x, r.x + r.w);
    if (r.x > 0) addRun(`v:${r.x}`, r.y, r.y + r.d);
    if (r.x + r.w < W) addRun(`v:${r.x + r.w}`, r.y, r.y + r.d);
  }

  // Collapse coincident shared-wall spans before cutting doors. This keeps
  // the old "all runs on the line are cut by a door" behavior, but removes
  // duplicate slabs that rendered as twinned walls from inside a room.
  for (const [key, runs] of lines) {
    lines.set(key, mergeRuns(runs));
  }

  // Cut doorway gaps. Entry door (a === EXTERIOR) sits on h:0 — the
  // perimeter street wall — which is what makes the building enterable.
  for (const door of plan.doorways) {
    const half = DOOR_FT / 2;
    if (door.axis === 'x') {
      const key = `h:${door.y}`;
      if (lines.has(key)) lines.set(key, cutRuns(lines.get(key)!, door.x - half, door.x + half));
    } else {
      const key = `v:${door.x}`;
      if (lines.has(key)) lines.set(key, cutRuns(lines.get(key)!, door.y - half, door.y + half));
    }
  }
  // The exterior entry is also used below to choose the front-of-house room
  // for workers, so this import remains part of the live placement contract.

  // Runs → boxes. Perimeter walls rise to the shell height and carry the
  // plot-role tint; interior walls stop at wallH in lime plaster.
  for (const [key, runs] of lines) {
    const horizontal = key.startsWith('h:');
    const lineAt = Number(key.slice(2));
    const isPerimeter =
      (horizontal && (lineAt === 0 || lineAt === D)) ||
      (!horizontal && (lineAt === 0 || lineAt === W));
    const h = isPerimeter ? shellHeightM : wallH;
    const colorHex = isPerimeter ? perimeterColor : INTERIOR_WALL_COLOR;
    for (const r of runs) {
      if (r.hi - r.lo < 1) continue; // skip slivers under 1 ft
      const len = (r.hi - r.lo) * FT;
      if (horizontal) {
        parts.push({ x: toX((r.lo + r.hi) / 2), z: toZ(lineAt), w: len, d: WALL_T, h, colorHex });
      } else {
        parts.push({ x: toX(lineAt), z: toZ((r.lo + r.hi) / 2), w: WALL_T, d: len, h, colorHex });
      }
    }
  }
  } // end legacy structure path

  // ── Door + windows (IN1). Without these the entry is a bare rectangular hole
  // in the perimeter wall and the shell has no glazing — town houses read as
  // windowless boxes. We DRESS the existing geometry: a door leaf set into the
  // entry gap (with a lintel beam over it), and dark glazed panes recessed into
  // the perimeter walls. These are plain SitePart boxes, so they ride the same
  // rotation / doorZSign / z-flip the renderer already applies to every part.
  const entry = plan.doorways.find((door) => door.a === EXTERIOR);
  if (entry) {
    // Entry doorway sits on h:0 (street wall) at door.x, axis x. Map to part
    // frame: x = toX(door.x), z on the toZ(0) perimeter line.
    const isX = entry.axis === 'x';
    // The entry sits on an outer wall of its room — since the blueprint
    // generator (Task 10 adapter) that can be ANY side of the building, not
    // just the h:0 street line. entry.x/entry.y carry the full position for
    // both axes (one is the wall line, the other the position along it).
    const dx = toX(entry.x);
    const dz = toZ(entry.y);
    const leafLen = DOOR_LEAF_FT * FT;
    // Door leaf: thin slab filling the gap, slightly thicker than the wall so
    // it shows from both faces. Spans x (h:0) or z (v:0) depending on axis.
    parts.push({
      x: dx,
      z: dz,
      w: isX ? leafLen : WALL_T + 0.06,
      d: isX ? WALL_T + 0.06 : leafLen,
      h: DOOR_LEAF_H,
      colorHex: DOOR_LEAF_COLOR,
    });
    // Lintel: a low beam capping the opening, from the door head to the shell.
    const lintelH = Math.max(0.15, shellHeightM - DOOR_LEAF_H);
    if (lintelH > 0.16) {
      parts.push({
        x: dx,
        z: dz,
        w: isX ? leafLen + 0.4 : WALL_T + 0.08,
        d: isX ? WALL_T + 0.08 : leafLen + 0.4,
        h: lintelH,
        colorHex: DOOR_LINTEL_COLOR,
        baseY: DOOR_LEAF_H,
      });
    }
  }

  // Windows: recessed dark panes on the perimeter walls. Place a pair on each
  // long perimeter face, inset from the corners and clear of the entry door, so
  // the shell reads as a glazed building rather than a blank box. Deterministic
  // (fixed fractions), so a re-bake yields identical parts. Legacy path only:
  // the blueprint carries REAL windows (voids + panes from the plan).
  if (!blueprint) {
    const entryX = entry && entry.axis === 'x' ? entry.x : null;
    // Front (street, h:0) + back (h:D) faces span along x; left/right (v:0,v:W)
    // span along z. Use interior fractions; skip any pane that lands on the door.
    const fracs = [0.28, 0.72] as const;
    const halfPaneFt = DOOR_FT / 2;
    // Front & back walls (panes vary in x).
    for (const lineZ of [0, D]) {
      for (const fr of fracs) {
        const fx = W * fr;
        if (lineZ === 0 && entryX != null && Math.abs(fx - entryX) < halfPaneFt) continue;
        parts.push({
          x: toX(fx),
          z: toZ(lineZ),
          w: WINDOW_W,
          d: WALL_T + 0.04,
          h: WINDOW_H,
          colorHex: WINDOW_PANE_COLOR,
          baseY: WINDOW_SILL_M,
          lightRole: 'window',
        });
      }
    }
    // Left & right walls (panes vary in z).
    const entryZ = entry && entry.axis === 'y' ? entry.y : null;
    for (const lineX of [0, W]) {
      for (const fr of fracs) {
        const fy = D * fr;
        if (lineX === 0 && entryZ != null && Math.abs(fy - entryZ) < halfPaneFt) continue;
        parts.push({
          x: toX(lineX),
          z: toZ(fy),
          w: WALL_T + 0.04,
          d: WINDOW_W,
          h: WINDOW_H,
          colorHex: WINDOW_PANE_COLOR,
          baseY: WINDOW_SILL_M,
          lightRole: 'window',
        });
      }
    }
  }

  // Ceiling (IN2). A single-storey building has no upper-floor slab, so hiding
  // the roof when the camera enters opened the interior to the sky. Cap the
  // ground room with a thin ceiling slab at the shell top. Multi-storey
  // buildings already get this enclosure from their upper-floor slab, so emit
  // the ceiling only when there are no upper floors.
  if (!blueprint && plan.upperFloors.length === 0) {
    parts.push({
      x: 0,
      z: 0,
      w: W * FT,
      d: D * FT,
      h: FLOOR_H,
      colorHex: CEILING_COLOR,
      baseY: Math.max(FLOOR_H, shellHeightM - FLOOR_H),
    });
  }

  for (const f of plan.furnishings) {
    const spec = furnishingSpec(f.kind);
    const rotated = f.rotation === 90 || f.rotation === 270;
    parts.push({
      x: toX(f.x),
      z: toZ(f.y),
      w: rotated ? spec.d : spec.w,
      d: rotated ? spec.w : spec.d,
      h: spec.h,
      colorHex: spec.colorHex,
      // Hearth furnishings are ALWAYS tagged 'hearth' (bake-hour independent);
      // the renderer glows the fire live from the building's hearth schedule.
      ...(HEARTH_KINDS.has(f.kind) ? { lightRole: 'hearth' as const } : {}),
    });
  }

  // Occupants (ROSTER-1): standing-figure boxes. Workers use the room that
  // owns the exterior doorway, while residents cycle through the remaining
  // rooms. This keeps people in real walkable room centers instead of on a
  // fixed depth line that can cross internal walls.
  const entryDoor = plan.doorways.find((door) => door.a === EXTERIOR);
  const fallbackRoom = plan.rooms[0];
  const entryRoom = plan.rooms.find((room) => room.id === entryDoor?.b) ?? fallbackRoom;
  // Placeable rooms across every floor, each tagged with its elevation. Resident
  // (non-working) occupants fill the ground rooms first, then upstairs bedrooms,
  // so a multi-storey home is inhabited top to bottom. Keyed `<level>:<roomId>`
  // because each floor numbers its rooms from 0 (ids are not globally unique).
  interface Placeable { room: InteriorRoom; baseY: number; key: string }
  const groundResidents: Placeable[] = plan.rooms
    .filter((room) => room.id !== entryRoom?.id)
    .map((room) => ({ room, baseY: 0, key: `0:${room.id}` }));
  const upperResidents: Placeable[] = plan.upperFloors.flatMap((floor) =>
    floor.rooms.map((room) => ({ room, baseY: floor.level * storeyHeightM, key: `${floor.level}:${room.id}` })),
  );
  const residentPool: Placeable[] = [...groundResidents, ...upperResidents];
  const entryPlaceable: Placeable = { room: entryRoom, baseY: 0, key: `0:${entryRoom?.id ?? 0}` };

  // Blueprint room anchors (Task 12): an L-shaped room's bbox center can sit
  // ON a blueprint wall (the bbox is a loose bound), so occupants stand at the
  // room's anchor — a cell GUARANTEED inside the room — when the blueprint is
  // known. Keyed `${level}:${roomId}` to match Placeable.key.
  const anchorByKey = new Map<string, { x: number; y: number }>();
  if (blueprint) {
    for (const fl of blueprint.floors) {
      for (const r of fl.rooms) {
        anchorByKey.set(`${fl.level}:${r.id}`, {
          x: (r.anchor.cx + 0.5) * CELL_FT,
          y: (r.anchor.cy + 0.5) * CELL_FT,
        });
      }
    }
  }

  const placeFor: Placeable[] = occupants.map((occupant, index) => {
    if (occupant.atWork && entryRoom) return entryPlaceable;
    const choices = residentPool.length > 0 ? residentPool : [entryPlaceable];
    return choices[index % choices.length] ?? entryPlaceable;
  });
  const perKey = new Map<string, number>();
  for (const p of placeFor) perKey.set(p.key, (perKey.get(p.key) ?? 0) + 1);
  const placedPerKey = new Map<string, number>();
  occupants.forEach((o, k) => {
    // Populated-household occupants (BGv2 Task 14 station identity) are NO LONGER
    // baked into the static parts: the live InteriorOccupants layer renders them
    // against the game clock so they move hour to hour. Only the roster fallback
    // (street/commuter figures with no station) is still baked as a static box.
    if (o.station) return;
    const placeable = placeFor[k] ?? entryPlaceable;
    const room = placeable.room;
    const totalInRoom = perKey.get(placeable.key) ?? 1;
    const slotInRoom = placedPerKey.get(placeable.key) ?? 0;
    placedPerKey.set(placeable.key, slotInRoom + 1);
    const anchor = anchorByKey.get(placeable.key);
    const centerX = anchor ? anchor.x : room.x + room.w / 2;
    const centerY = anchor ? anchor.y : room.y + room.d / 2;
    // Anchor cells are 5 ft; a tighter ring keeps the crowd clear of the
    // real-thickness blueprint walls (an inner wall protrudes its full
    // 0.5 ft into the neighbor cell: 0.762 − 0.2 − 0.1524 ≈ 0.41 m clear).
    const ringRadiusM = totalInRoom > 1 ? (anchor ? 0.2 : 0.6) : 0;
    const angle = (Math.PI * 2 * slotInRoom) / totalInRoom + room.id * 0.37;
    const offsetXFt = (Math.cos(angle) * ringRadiusM) / FT;
    const offsetYFt = (Math.sin(angle) * ringRadiusM) / FT;
    const px = toX(centerX + offsetXFt);
    const pz = toZ(centerY + offsetYFt);
    const baseYForBody = placeable.baseY;
    // A villager reads as a person, not a crate: a clothed body box under a
    // skin-toned head. Dimensions and palette come from the occupant's
    // parametric BodyPlan (BODY-1) — height, build, skin and clothing all vary
    // per person, so a crowd reads as a population rather than clones. The floor's
    // elevation (placeable.baseY) lifts upstairs occupants onto their storey.
    // Tagged 'occupant' so consumers/tests can precisely separate baked figure
    // boxes from structure (and assert populated plots bake none).
    const body = o.body;
    const headH = body.headSizeM;
    const bodyH = Math.max(0.1, body.heightM - headH);
    parts.push({
      x: px,
      z: pz,
      w: body.shoulderWidthM,
      d: body.depthM,
      h: bodyH,
      colorHex: body.clothingHex,
      tag: 'occupant',
      // Omit baseY on the ground floor so the part shape is unchanged there.
      ...(baseYForBody > 0 ? { baseY: baseYForBody } : {}),
    });
    parts.push({
      x: px,
      z: pz,
      w: body.headSizeM * 0.85,
      d: body.headSizeM * 0.8,
      h: headH,
      baseY: baseYForBody + bodyH,
      colorHex: body.skinToneHex,
      tag: 'occupant',
    });
  });

  // ── Upper storeys (L4 multi-storey). The exterior shell already encloses every
  // storey, so each upper floor adds only its own floor slab, INTERNAL room-divider
  // walls (with doorway gaps), and furniture — lifted to the floor's elevation via
  // baseY, which the renderer already honors. A stair flight box fills each shaft
  // gap. Single-storey buildings have no upperFloors, so this block is skipped and
  // their part list is byte-identical to before. ──
  if (plan.upperFloors.length > 0) {
    const upperWallH = Math.min(storeyHeightM, 3);
    for (const floor of plan.upperFloors) {
      const baseY = floor.level * storeyHeightM;
      // Blueprint path: slabs, walls and stairs already came from the
      // blueprint structure — only the furniture is emitted per upper floor.
      if (blueprint) {
        for (const f of floor.furnishings) {
          const spec = furnishingSpec(f.kind);
          const rotated = f.rotation === 90 || f.rotation === 270;
          parts.push({
            x: toX(f.x), z: toZ(f.y),
            w: rotated ? spec.d : spec.w, d: rotated ? spec.w : spec.d,
            h: spec.h, colorHex: spec.colorHex, baseY,
          });
        }
        continue;
      }
      parts.push({ x: 0, z: 0, w: W * FT, d: D * FT, h: FLOOR_H, colorHex: FLOOR_COLOR, baseY });

      const fLines = new Map<string, Run[]>();
      const addF = (key: string, lo: number, hi: number): void => {
        const runs = fLines.get(key) ?? [];
        runs.push({ lo, hi });
        fLines.set(key, runs);
      };
      for (const r of floor.rooms) {
        // Skip envelope-edge lines (h:0/h:D/v:0/v:W) — the shell wall covers them.
        if (r.y > 0) addF(`h:${r.y}`, r.x, r.x + r.w);
        if (r.y + r.d < D) addF(`h:${r.y + r.d}`, r.x, r.x + r.w);
        if (r.x > 0) addF(`v:${r.x}`, r.y, r.y + r.d);
        if (r.x + r.w < W) addF(`v:${r.x + r.w}`, r.y, r.y + r.d);
      }
      for (const [key, runs] of fLines) fLines.set(key, mergeRuns(runs));
      for (const door of floor.doorways) {
        const half = DOOR_FT / 2;
        if (door.axis === 'x') {
          const key = `h:${door.y}`;
          if (fLines.has(key)) fLines.set(key, cutRuns(fLines.get(key)!, door.x - half, door.x + half));
        } else {
          const key = `v:${door.x}`;
          if (fLines.has(key)) fLines.set(key, cutRuns(fLines.get(key)!, door.y - half, door.y + half));
        }
      }
      for (const [key, runs] of fLines) {
        const horizontal = key.startsWith('h:');
        const lineAt = Number(key.slice(2));
        for (const r of runs) {
          if (r.hi - r.lo < 1) continue;
          const len = (r.hi - r.lo) * FT;
          if (horizontal) {
            parts.push({ x: toX((r.lo + r.hi) / 2), z: toZ(lineAt), w: len, d: WALL_T, h: upperWallH, colorHex: INTERIOR_WALL_COLOR, baseY });
          } else {
            parts.push({ x: toX(lineAt), z: toZ((r.lo + r.hi) / 2), w: WALL_T, d: len, h: upperWallH, colorHex: INTERIOR_WALL_COLOR, baseY });
          }
        }
      }
      for (const f of floor.furnishings) {
        const spec = furnishingSpec(f.kind);
        const rotated = f.rotation === 90 || f.rotation === 270;
        parts.push({
          x: toX(f.x), z: toZ(f.y),
          w: rotated ? spec.d : spec.w, d: rotated ? spec.w : spec.d,
          h: spec.h, colorHex: spec.colorHex, baseY,
        });
      }
    }
    // Stair flight: one wood box per gap, rising a full storey at the shaft.
    // Legacy only — the blueprint structure already carries stair flights.
    if (!blueprint) {
      for (const s of plan.stairs) {
        parts.push({
          x: toX(s.x), z: toZ(s.y), w: DOOR_FT * FT, d: DOOR_FT * FT,
          h: storeyHeightM, colorHex: STAIR_COLOR, baseY: s.fromFloor * storeyHeightM,
        });
      }
    }
  }

  return parts;
}
