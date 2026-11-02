/**
 * @file townEngine.ts — SP-T clean-room Voronoi-ward town generator, iteration #1.
 *
 * The deepest tier of the recursive cartographic stack: a burg FOOTPRINT polygon
 * is subdivided into WARDS (Voronoi cells, reusing SP1's clip-to-parent +
 * re-tessellate machinery), and each ward's street frontage is packed with
 * PARTY-WALL building plots — rectangles tiled edge-to-edge along the ward
 * boundary (the street), set back inward. This satisfies SP-T acceptance
 * criteria #1 (blocks-first, no beads-on-a-string) and #2 (party-wall frontage)
 * for one slice; civic anatomy / terrain / typology-by-scale are later passes.
 *
 * CLEAN-ROOM: no Watabou data/algorithms are used or cloned (see DECISIONS).
 * Pure: no React/DOM. Determinism flows from the hierarchical seed-path.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 item 8 (town benchmark + criteria).
 * North star: docs/projects/worldforge/subprojects/sp-t-town-generator/NORTH_STAR.md
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/Town3DScene.tsx, components/DesignPreview/steps/townMesh.ts, components/MapPane.tsx, components/Worldforge/TownPlanView.tsx, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/town/architectureDistricts.ts, systems/worldforge/town/buildingEnsembles.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/town/cultureStructures.ts, systems/worldforge/town/demoTownPlan.ts, systems/worldforge/town/householdBrief.ts, systems/worldforge/town/laneVillage.ts, systems/worldforge/town/population.ts, systems/worldforge/town/ruralHomesteadArtifacts.ts, systems/worldforge/town/ruralHomesteads.ts, systems/worldforge/town/stripFields.ts, systems/worldforge/town/townDiagnostics.ts, systems/worldforge/town/townLots.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/town/townSuburbs.ts, systems/worldforge/town/voronoiTownAdapter.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { fnv1a, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { generateSubmap, polygonBounds, pointInPolygon, clipPolygon, clipPolylineToPolygon, type Pt } from '../submap/submapEngine';
import { CELL_FT } from '../units';
import { assignTownPopulation, assignWardWealth, townWealthBand } from './population';
import { buildMarketSquare, plotFacesSquare } from './marketSquare';
import {
  assignArchitectureDistricts,
  type TownArchitectureDistrict,
} from './architectureDistricts';
import { resolveBuildingEnsembles } from './buildingEnsembles';
import {
  courtyardCentersForBlock,
  resolveCourtyardSpaces,
  type TownCourtyardSpace,
} from './courtyardSpaces';
import {
  buildStreetNetwork,
  densifyPolyline,
  halfWidthByWardEdge,
  roadGateCandidates,
  splitPolylineByRing,
  TIER_WIDTH_RATIO,
  type TownStreet,
} from './townStreetNetwork';
import {
  chamferSharpCorners,
  clipHalfPlane,
  houseShapeOk,
  isSquarish,
  MIN_HOUSE_CORNER_DEG,
  rectangleOnFront,
  simplifyConvexCorners,
  packBlockSquare,
  type DeepLotOptions,
} from './townLots';
import { buildSuburbs, pointAt, polylineLength } from './townSuburbs';
import { cutRiverChannel, distToLines, type RiverLink } from './townRiverCut';
import { keepRoadOffRivers, ROAD_RIVER_CLEAR_FT } from '../region/roadCourse';
import { buildLaneVillage } from './laneVillage';
import { stripFarmParcels, STRIP_FIELD_WIDTH_FT } from './stripFields';
import {
  orientedRect,
  setPieceFeatures,
  strongholdSetPiece,
  templeSetPiece,
  type CivicGrounds,
  type TownFaith,
  type TownHolder,
} from './civicGrounds';
import { STREET_TIER_ORDER, STREET_TIER_SPECS } from './streetRibbons';

export interface BuildingPlot {
  /** Plot footprint polygon (graph coords, the town's frame). */
  polygon: Pt[];
  /** Index of the ward edge (frontage) this plot faces; -1 for interior infill. */
  frontageEdge: number;
  /** Where the plot sits: street frontage vs ward-interior infill (#6). */
  kind?: 'frontage' | 'interior';
  /** Footprint shape: rectangle, stepped/L, or a block-clipped corner wedge. */
  shape?: 'rect' | 'L' | 'wedge';
  /** Which shared court this ward-interior plot faces; absent on legacy plots. */
  courtyardIndex?: number;
  /** Concrete building type (set by the population pass when a population is given). */
  buildingType?: import('./population').BuildingType;
  /** Whether this building is a home that carries population (cottage/townhouse/tenement). */
  residential?: boolean;
  /** Permanent residents living here (0 for non-residential workplaces/civic). */
  occupants?: number;
  /** Stable per-town building id (`b<index>`) — keys the lazy named household. */
  homeId?: string;
  /** Stable architecture identity assigned before population or adapter filtering. */
  architectureKey?: string;
  /** Block-level row/courtyard/arcade instruction authored after plot filtering. */
  ensemble?: import('../interior/blueprintTypes').BuildingEnsemble;
  /** Social class of the ward this plot sits in (set before classification). */
  district?: import('./population').WardWealth;
  /** For a HOME: the `homeId` of the workplace its breadwinners work at (undefined = unskilled labour). */
  workplaceId?: string;
  /** For a HOME: how its workers relate to their workplace. */
  workRole?: 'proprietor' | 'staff' | 'labourer';
  /** For a WORKPLACE: the `homeId` of the home whose family runs it. */
  proprietorHomeId?: string;
  /** For a WORKPLACE: number of employee homes assigned to it (excludes the proprietor). */
  staffCount?: number;
  /** A frontage plot whose street side looks onto the market square (GG-586). */
  facesMarket?: boolean;
}

/**
 * The population-pass fields of a {@link BuildingPlot} that survive into the flat
 * artifact plan, carried so the 3D bake can rebuild the founding household brief
 * ({@link import('./householdBrief').briefForPlot}) for each rendered building.
 * Exactly the fields briefForPlot reads (no geometry) — briefForPlot resolves
 * cross-references (workplaceId / proprietorHomeId) against the full set by homeId.
 */
export type TownPlotPopulation = Pick<
  BuildingPlot,
  | 'buildingType'
  | 'residential'
  | 'occupants'
  | 'homeId'
  | 'district'
  | 'workplaceId'
  | 'workRole'
  | 'proprietorHomeId'
>;

export type CivicKind = 'plaza' | 'temple' | 'keep' | 'citadel' | 'dock' | 'bridge';

export type TownTypology = 'hamlet' | 'village' | 'walled town' | 'city' | 'capital';

export interface TownScaleProfile {
  typology: TownTypology;
  population: number;
  /** Voronoi ward count — grows sublinearly with population, UNCAPPED. */
  wardCount: number;
  hasWalls: boolean;
  hasPlaza: boolean;
  hasTemple: boolean;
  hasKeep: boolean;
  /** Capital-only second stronghold. */
  hasCitadel: boolean;
}

export interface CivicStructure {
  kind: CivicKind;
  /** Footprint polygon of the civic space/building (graph coords). */
  polygon: Pt[];
  /** Index of the ward this civic structure occupies. */
  wardIndex: number;
}

export interface TownWalls {
  /** Defensive wall ring (inset from the footprint). */
  ring: Pt[];
  /** Gatehouse points on the ring where main roads enter. */
  gatehouses: Pt[];
  /**
   * Water-gate points (TG7): where an inherited river crosses the wall ring. A
   * river must pass UNDER/THROUGH an arch, not clip a solid rampart — these mark
   * the ring spans the wall mesh should break for an arch/portcullis gap. Empty
   * when no river crosses the ring (or the town is unwalled). Optional so existing
   * `TownWalls` constructors (e.g. the canonicalTown transform) stay valid until
   * they propagate it.
   */
  waterGates?: Pt[];
}

export interface TownWard {
  /** Ward (Voronoi cell) polygon clipped to the town footprint. */
  polygon: Pt[];
  /** The buildable block: the ward inset by a street margin. Buildings pack on
   *  THIS, so the gap between neighbouring blocks reads as the street network. */
  block: Pt[];
  /** Party-wall building plots packed along this ward's street frontage. */
  plots: BuildingPlot[];
  /** Civic role of this ward, if any (plaza wards carry no plots). */
  civic?: CivicKind;
  /** Social class of this ward (wealthy near the keep/market, poor at the rim). */
  wealth?: import('./population').WardWealth;
  /** Spatial district whose buildings repeat one roof/facade dialect. */
  architectureDistrict?: TownArchitectureDistrict;
  /**
   * A SUBURB row outside the wall (GG-544): houses along an approach road.
   * Its polygon is the ground strip under the row, not a Voronoi ward.
   */
  extramural?: boolean;
}

/** Land use of the ring between the built town core and the cell boundary. */
export type OutskirtKind = 'farm' | 'pasture' | 'scrub';
export interface TownOutskirt {
  /** Parcel polygon (cell coords). */
  polygon: Pt[];
  /** farm (tilled fields near the core) → pasture (grassland) → scrub (barren edge). */
  kind: OutskirtKind;
  /**
   * A STRIP FIELD's long direction, radians (GG-551). The furrows run this
   * way. Absent on pasture, scrub, and a farm parcel too small to strip.
   */
  furrowAngle?: number;
  /** Candidate3 source agricultural parcel before strip cutting; not a legal owner. */
  farmParent?: {id:string;polygon:Pt[]};
}

/**
 * Land use of the slack INSIDE the walls — ground the town encloses but has
 * never built on.
 *
 * WHY THESE FIVE. The wall ring is inset from the town footprint while the ward
 * process fills only part of that footprint, so a walled town encloses more
 * ground than it occupies. That is real history (walls raised for growth that
 * never came, or a town that shrank behind them), so the slack is kept — but it
 * has to read as land use, not as a hole. These are the five things a walled
 * settlement actually does with enclosed ground it has not built over, ordered
 * by how hard it works the land:
 *   yard    — service ground abutting a block: sheds, middens, woodpiles.
 *   garden  — kitchen gardens a step behind the frontage.
 *   orchard — tree crops, which want depth and are worth the wall's protection.
 *   paddock — stock penned inside the walls overnight; the largest working parcel.
 *   ruin    — cellars and footings of blocks the town no longer fills.
 * The split carries the meaning: `yard`/`garden` say the town uses every foot,
 * `orchard`/`paddock`/`ruin` say it encloses more than it needs. So the MIX is
 * what population-versus-footprint drives (see `wallFill`), not the raw area —
 * the area is whatever the walls leave, and all of it gets parcelled.
 */
export type OpenLandKind = 'yard' | 'garden' | 'orchard' | 'paddock' | 'ruin';
export interface TownOpenLand {
  /** Parcel polygon (town coords). */
  polygon: Pt[];
  /** yard/garden (worked hard) → orchard/paddock/ruin (more wall than town). */
  kind: OpenLandKind;
  /**
   * Rim slack between the built edge and the wall, an unbuilt ward block, or
   * an unbuilt suburb block outside the wall (GG-544).
   */
  source: 'rim' | 'ward' | 'extramural';
  /** A FRONT garden between a house and its street (GG-564). */
  front?: boolean;
}

export interface TownPlan {
  /** The burg footprint = the whole parent cell (a leaf submap cell). */
  footprint: Pt[];
  /**
   * The ORGANIC built-up boundary INSIDE the cell. The town lives here; it does
   * not adhere to the cell's exact shape. Wards/buildings/walls all sit within it.
   */
  core: Pt[];
  /** Voronoi wards subdividing the CORE (not the whole cell). */
  wards: TownWard[];
  /** Every building plot across all wards, flattened — the canonical building list
   *  (stable `homeId`s, population-tagged). Same object refs as `wards[].plots`. */
  plots: BuildingPlot[];
  /** Farmland/grassland/scrub parcels filling the ring between the core and cell edge. */
  outskirts: TownOutskirt[];
  /**
   * INTRAMURAL open land: gardens/yards/orchards/paddocks/ruins parcelling the
   * ground the walls enclose but the wards never built on, plus any ward block
   * that ended up with zero plots. Empty only when the town has no slack.
   */
  openLand: TownOpenLand[];
  /** Defensive wall ring + gatehouses (criterion #3). */
  walls: TownWalls;
  /** Civic anatomy: market plaza, temple(s), castle/keep (criterion #3). */
  civic: CivicStructure[];
  /** Main streets continued from inherited regional roads, clipped to town (#6). */
  streets: Pt[][];
  /**
   * THE street network — every paved line in and around the town, each with its
   * visual tier, its role, and its full width in plan units. Generated by
   * `townStreetNetwork.buildStreetNetwork`; the ward blocks are inset to match
   * it exactly, so this is the one description of the town's roads that the 2D
   * map, the 3D minimap and the streamed game ground all draw from.
   *
   * `streets` above is kept beside it as the RAW inherited approach geometry
   * (the plot/water carve still reads it); the network is what gets rendered.
   */
  streetNetwork: TownStreet[];
  /** Real shared courts enclosed by interior-block buildings, including amenity use. */
  courtyards: TownCourtyardSpace[];
  /** Rural homes seated on farm outskirts (carry the rural population). Empty if no population given. */
  farmsteads: import('./population').Farmstead[];
  /** Explicit candidate3 physical plans and refused household intents; not yet emitted as buildings. */
  ruralHomesteads?: import('./ruralHomesteads').RuralHomesteadPlan;
  /** Population accounting (who lives where) — present only when a population was given. */
  demographics?: import('./population').TownDemographics;
  /**
   * `wards`: a walled town of Voronoi blocks. `lanes`: an unwalled village of
   * houses along its road and lanes (GG-548). Absent on plans made before the
   * town-look pass.
   */
  form?: 'wards' | 'lanes';
  /**
   * The approach, forecourt and grounds of each temple, keep and citadel
   * (GG-566). Absent on plans made before GG-566.
   */
  civicGrounds?: CivicGrounds[];
}

export interface GenerateTownOptions {
  /** Candidate source3 only; default/legacy farm markers retain their old facts. */
  ruralHouseholdSources?: boolean;
  /** Population — derives typology, ward count, and which civic structures appear. */
  population?: number;
  /** Target ward count (Voronoi cells). Overrides the population-derived count. */
  wardCount?: number;
  /** Building frontage width (world units) before jitter. */
  plotWidth?: number;
  /** Building depth set back from the street (world units). */
  plotDepth?: number;
  /** Gap between adjacent plots and at corners (world units). */
  gap?: number;
  /** Inherited rivers/coast as polylines (footprint coords) — drives docks + bridges (#4). */
  water?: Pt[][];
  /**
   * Water that may be BRIDGED — rivers only. Defaults to `water` when absent.
   *
   * A coast edge is a shoreline, not a channel, so a bridge across it goes to
   * open sea. Kalg (burg 2) grew four bridges partly seated on its single coast
   * segment because bridges and docks read the same undifferentiated list.
   */
  bridgeWater?: Pt[][];
  /**
   * Width of the water being crossed, in the same units as `water`.
   *
   * Without it the deck is sized against the TOWN (`fpSpan * 0.11`), so every
   * bridge is a fixed 11% of the settlement whatever it spans — on Kalg that
   * made ~112-unit decks over a ~55-unit river, overshooting both banks by a
   * full river width.
   */
  waterWidth?: number;
  /** Max water distance for a ward edge to count as waterfront (world units). */
  waterMargin?: number;
  /** Optional terrain height sampler (footprint coords) for slope-aware streets (#4). */
  heightAt?: (p: Pt) => number;
  /** Max street grade (Δheight / length); steeper ward edges seat no frontage. */
  maxGrade?: number;
  /** Inherited regional roads (footprint coords) → continued main streets (#6). */
  roads?: Pt[][];
  /** Building-footprint variety: depth jitter + stepped/L shapes. Default true (#6). */
  variety?: boolean;
  /** Pack freestanding buildings into ward interiors (courtyards). Default true (#6). */
  interiorInfill?: boolean;
  /** Tile dense frontage lots edge-to-edge so shared party walls are real. */
  partyWallRows?: boolean;
  /**
   * Feet per plan unit. With it, lots, streets, quays and fields are sized in
   * real feet (GG-545, GG-550). Without it the plan is schematic and keeps
   * its ward-relative sizes. `canonicalTown` passes `spanFt / CANON_TOWN_SPAN`.
   */
  feetPerUnit?: number;
  /**
   * The coast lines among `water` (the same array objects). A port's core
   * grows out to them (GG-547) and they carve a quay, not a river channel.
   */
  coast?: Pt[][];
  /** The faith of the town's cell: chooses its temple's grounds (GG-566). */
  faith?: TownFaith;
  /** Who holds the town's keep: chooses the keep's grounds (GG-566). */
  holder?: TownHolder;
}

/** Area-weighted polygon centroid (falls back to vertex mean for degenerate polys). */
export function polygonCentroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += cross;
    cx += (poly[j][0] + poly[i][0]) * cross;
    cy += (poly[j][1] + poly[i][1]) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-9) {
    let x = 0, y = 0;
    for (const [px, py] of poly) { x += px; y += py; }
    return [x / poly.length, y / poly.length];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function len(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Half-width of the inherited main-road carve corridor, as a fraction of the
 * footprint span. Matches the 3D avenue ribbon (22 ft at the 1000 ft canonical
 * span ≈ 0.011) plus a small shoulder so buildings don't kiss the roadside.
 */
export const MAIN_ROAD_CARVE_HALF_FRAC = 0.014;

/**
 * Half-width of the river-channel carve, as a fraction of the footprint span.
 * Matches the 3D water channel (`channelHalfWidth = spanFt * 0.03`) plus a
 * shoulder so waterfront buildings hug the bank without standing in the water.
 */
export const WATER_CARVE_HALF_FRAC = 0.035;

/**
 * Widest half-channel a town river gets in the 3D bake, in feet. The same
 * number caps `channelHalfWidth` in `bridge/groundChunkLoader.ts`
 * (TOWN_RIVER_MAX_HALF_WIDTH_FT); the plan's river carve must match it.
 */
export const TOWN_RIVER_MAX_HALF_WIDTH_FT = 20;

/**
 * Lot sizes in feet for a town with a physical scale (GG-545, Remy's
 * town-look ruling q6, "Watabou grain"). A lot is three to six 5-ft cells
 * wide, about four on average, and runs back to the block's rear line up to
 * 70 ft. Remy accepted lots under the five-cell 3D room minimum for this look.
 */
export const LOT_WIDTH_FT = 20;
export const MIN_LOT_WIDTH_FT = 15;
export const MAX_LOT_WIDTH_FT = 30;
export const MAX_LOT_DEPTH_FT = 70;
/** Narrowest house, across its narrow side, in feet (GG-563, Remy 2026-11-01). */
export const MIN_HOUSE_WIDTH_FT = 12;

/** Quay between a port's buildings and the sea, in feet (GG-547). */
export const QUAY_WIDTH_FT = 15;

/** Distance from a point to the nearest edge of a polygon boundary. */
function distToPolyBoundary(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)));
  }
  return best;
}

/** Signed shoelace area (positive CCW). */
function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}

/**
 * TRUE inset of a convex polygon: every edge slides inward by exactly `margin`
 * along its own normal, and adjacent offset edges are re-intersected. Unlike
 * centroid-scaling (the old block inset), the margin is uniform — an off-center
 * or elongated ward no longer leaves one block edge sitting in the street.
 * Returns null when the margin swallows the polygon (caller decides fallback).
 */
/**
 * Exact per-edge inset by half-plane clipping (GG-564, 2026-11-01).
 *
 * Each edge keeps only the part of the polygon that lies at least its margin
 * inside that edge's line. The result can never reach into a street ribbon,
 * whatever the ward's shape: a short edge between two long ones simply drops
 * out, where the mitred offset of `insetConvexPolygon` crosses itself. On a
 * concave ward the far side of a reflex edge's line is also cut away, so the
 * block loses some yard, never road. Returns null when nothing buildable is
 * left. Inward is decided by the polygon's winding, not its centroid, because
 * the centroid of a concave ward can lie outside it.
 */
export function insetByHalfPlanes(poly: Pt[], marginAt: (edge: number) => number): Pt[] | null {
  const n = poly.length;
  if (n < 3) return null;
  const ccw = polyArea(poly) > 0;
  let out: Pt[] = poly.map((p) => [p[0], p[1]] as Pt);
  for (let i = 0; i < n && out.length >= 3; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) continue;
    // Left normal of a->b is inward for a counter-clockwise ring.
    const nx = (ccw ? -(b[1] - a[1]) : b[1] - a[1]) / L;
    const ny = (ccw ? b[0] - a[0] : -(b[0] - a[0])) / L;
    const m = marginAt(i);
    const side = (p: Pt): number => (p[0] - a[0]) * nx + (p[1] - a[1]) * ny - m;
    const next: Pt[] = [];
    for (let k = 0; k < out.length; k++) {
      const p = out[k];
      const q = out[(k + 1) % out.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) next.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = next;
  }
  // Drop repeated points left where a clip line passed through a vertex.
  const clean = out.filter((p, k) => {
    const q = out[(k + 1) % out.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6;
  });
  return clean.length >= 3 && Math.abs(polyArea(clean)) > 1e-6 ? clean : null;
}

export function insetConvexPolygon(poly: Pt[], margin: number | ((edge: number) => number)): Pt[] | null {
  const n = poly.length;
  if (n < 3) return null;
  // PER-EDGE margins (roads slice): a ward block is inset by the half-width of
  // the street on THAT side, so an avenue frontage steps back further than a
  // back lane. A single number still works and applies to every edge.
  const marginAt = typeof margin === 'function' ? margin : (): number => margin;
  const c = polygonCentroid(poly);
  // Offset line per edge: a point on it + its direction.
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const nm = inwardNormal(a, b, c);
    const m = marginAt(i);
    return {
      px: a[0] + nm[0] * m, py: a[1] + nm[1] * m,
      dx: b[0] - a[0], dy: b[1] - a[1],
    };
  });
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    // Vertex i = intersection of offset-edge (i-1) with offset-edge i.
    const A = lines[(i - 1 + n) % n];
    const B = lines[i];
    const det = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(det) < 1e-9) {
      // Near-parallel edges: fall back to sliding the shared vertex inward.
      const nm = inwardNormal(poly[(i - 1 + n) % n], poly[(i + 1) % n], c);
      const m = Math.max(marginAt((i - 1 + n) % n), marginAt(i));
      out.push([poly[i][0] + nm[0] * m, poly[i][1] + nm[1] * m]);
      continue;
    }
    const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / det;
    out.push([A.px + A.dx * t, A.py + A.dy * t]);
  }
  // Degenerate when the margin swallows the shape: area collapses, flips
  // orientation, or a vertex escapes the original polygon.
  const a0 = polyArea(poly);
  const a1 = polyArea(out);
  if (Math.sign(a1) !== Math.sign(a0) || Math.abs(a1) < Math.abs(a0) * 0.05) return null;
  for (const v of out) if (!pointInPolygon(v, poly)) return null;
  return out;
}

/**
 * Sutherland–Hodgman clip of a polygon against a CONVEX clip polygon. Used to
 * trim corner frontage plots to their ward block, turning rectangles into
 * street-hugging wedges/trapezoids at angled Voronoi edges.
 */
function clipPolygonToConvex(subject: Pt[], clip: Pt[]): Pt[] {
  const c = polygonCentroid(clip);
  let out = subject;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const nm = inwardNormal(a, b, c);
    const inside = (p: Pt): boolean => (p[0] - a[0]) * nm[0] + (p[1] - a[1]) * nm[1] >= -1e-9;
    const dist = (p: Pt): number => (p[0] - a[0]) * nm[0] + (p[1] - a[1]) * nm[1];
    const next: Pt[] = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const pIn = inside(p);
      const qIn = inside(q);
      if (pIn) next.push(p);
      if (pIn !== qIn) {
        const dp = dist(p);
        const t = dp / (dp - dist(q));
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = next;
  }
  return out;
}

/** Unit normal of edge a→b that points toward `interior` (into the ward). */
function inwardNormal(a: Pt, b: Pt, interior: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  // Flip to point toward the interior point.
  return (interior[0] - mx) * nx + (interior[1] - my) * ny >= 0 ? [nx, ny] : [-nx, -ny];
}

/**
 * Pack a single ward's street frontage with party-wall building plots. Each ward
 * edge is treated as a street; rectangular plots are tiled flush along it
 * (sharing side walls = party walls) and set back inward by `plotDepth`. Corners
 * and tiny edges are skipped so plots don't overlap. Deterministic per seed-path.
 */
export function packWardFrontage(
  ward: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): BuildingPlot[] {
  const plotWidth = opts.plotWidth ?? 6;
  const plotDepth = opts.plotDepth ?? 7;
  const gap = opts.gap ?? 1.2;
  const betweenPlotGap = opts.partyWallRows === true ? 0 : gap;
  const variety = opts.variety !== false;
  const interior = polygonCentroid(ward);
  const rng = rngFromPath(streamPath(seedPath, 'frontage'));
  const plots: BuildingPlot[] = [];
  const minNegotiatedLotFt = CELL_FT * 5;

  // Corner lots may poke past the ADJACENT block edge. Instead of clearing a
  // whole plot-depth around every corner (the old rule — it left bald corners),
  // pack close and clip the polygon to the block: an unchanged plot keeps its
  // exact vertices (party-wall endpoint contract), a trimmed one becomes a
  // street-hugging 'wedge' that follows the angled Voronoi edge.
  const finishPlot = (polygon: Pt[], e: number, shape: 'rect' | 'L'): void => {
    const clipped = clipPolygonToConvex(polygon, ward);
    if (clipped.length < 3) return;
    const ratio = Math.abs(polyArea(clipped)) / (Math.abs(polyArea(polygon)) || 1);
    if (ratio >= 0.999) { plots.push({ polygon, frontageEdge: e, kind: 'frontage', shape }); return; }
    if (ratio < 0.45) return; // sliver after the trim — not a usable building
    plots.push({ polygon: clipped, frontageEdge: e, kind: 'frontage', shape: 'wedge' });
  };

  for (let e = 0; e < ward.length; e++) {
    const a = ward[e];
    const b = ward[(e + 1) % ward.length];
    const L = len(a, b);
    const corner = gap; // pack right up to corners; the block clip trims overshoot into wedges
    if (L <= 2 * corner + plotWidth) continue; // edge too short for even one plot
    if (opts.heightAt && opts.maxGrade != null) {
      // Slope-aware (#4): skip frontage on streets too steep to build along.
      const grade = Math.abs(opts.heightAt(b) - opts.heightAt(a)) / (L || 1);
      if (grade > opts.maxGrade) continue;
    }
    const n = inwardNormal(a, b, interior);
    const ux = (b[0] - a[0]) / L;
    const uy = (b[1] - a[1]) / L;
    // Clamp depth so plots can't punch past the ward centroid on thin wards.
    const maxDepth = Math.max(2, len(a, interior) * 0.6);
    const baseDepth = Math.min(plotDepth, maxDepth);
    const negotiatesCellGrid = opts.partyWallRows === true
      // Keep the existing threshold separating miniature preview plans from
      // negotiated physical lots. Physical rows now reserve usable frontage;
      // miniature plans retain legacy packing and receive no fit receipt.
      && plotWidth >= CELL_FT * 1.5
      && baseDepth >= CELL_FT * 1.5;
    // Attached frontage is one negotiated street envelope. A stable edge hash
    // keeps depth variety between blocks without asking adjacent buildings to
    // reconcile independently rolled rear boundaries later in the pipeline.
    const rowDepthRoll = fnv1a(`${seedPath}|frontage:${e}|row-depth`) / 0xffffffff;
    const rowDepth = variety ? baseDepth * (0.78 + rowDepthRoll * 0.44) : baseDepth;

    let t = corner;
    while (t + plotWidth <= L - corner) {
      const rolledWidth = plotWidth * (0.8 + rng.next() * 0.4);
      const w = negotiatesCellGrid
        // Keep the authored street frontage instead of replacing every home
        // with a 15/20ft miniature. Five cells leave space for rooms and a
        // character-sized route; wider wards retain their larger source lots.
        // The edge budget below seats fewer buildings rather than overlapping.
        ? Math.max(minNegotiatedLotFt, Math.round(rolledWidth / CELL_FT) * CELL_FT)
        : rolledWidth;
      if (t + w > L - corner) break;
      // Preserve the historical frontage RNG draw order even when the current
      // dense-block contract consumes a shared edge depth instead of this lot's
      // individual roll. Detached settlements retain the individual value.
      const individualDepthRoll = variety ? rng.next() : 0.5;
      const depth = negotiatesCellGrid
        // Share the snapped rear boundary, preserving the ward's finite depth.
        // Narrow wards can still be smaller than the preferred five-cell depth;
        // expanding them would overwrite streets or neighboring parcels.
        ? Math.min(
            Math.max(CELL_FT, Math.floor(maxDepth / CELL_FT) * CELL_FT),
            Math.max(minNegotiatedLotFt, Math.round(rowDepth / CELL_FT) * CELL_FT),
          )
        : variety
          ? baseDepth * (0.78 + individualDepthRoll * 0.44)
          : baseDepth;
      const along = (s: number): Pt => [a[0] + ux * s, a[1] + uy * s];
      const inward = (p: Pt, d: number): Pt => [p[0] + n[0] * d, p[1] + n[1] * d];
      const p0 = along(t);
      const p1 = along(t + w);
      const shapeRoll = variety ? rng.next() : 1;
      // A historical L-shape consumed one extra side draw. Consume it before
      // deciding whether dense negotiation can use the shape so later lots on
      // this edge retain their established width sequence.
      const sideRoll = shapeRoll < 0.3 ? rng.next() : 1;
      if (!negotiatesCellGrid && variety && shapeRoll < 0.3) {
        // Stepped footprint: one half deeper than the other (an L/return).
        const d2 = depth * 0.55;
        const mid = along(t + w / 2);
        const polygon: Pt[] = sideRoll < 0.5
          ? [p0, p1, inward(p1, depth), inward(mid, depth), inward(mid, d2), inward(p0, d2)]
          : [p0, p1, inward(p1, d2), inward(mid, d2), inward(mid, depth), inward(p0, depth)];
        finishPlot(polygon, e, 'L');
      } else {
        finishPlot([p0, p1, inward(p1, depth), inward(p0, depth)], e, 'rect');
      }
      // Dense rows share exact side boundaries. Detached settlement profiles
      // retain the historical breathing room between neighboring plots.
      t += w + betweenPlotGap;
    }
  }
  return plots;
}

/** Build a court-facing rectangle whose first edge faces the shared center. */
function courtyardRect(center: Pt, angle: number, radius: number, width: number, depth: number): Pt[] {
  const radial: Pt = [Math.cos(angle), Math.sin(angle)];
  const tangent: Pt = [-radial[1], radial[0]];
  const front: Pt = [
    center[0] + radial[0] * radius,
    center[1] + radial[1] * radius,
  ];
  const back: Pt = [front[0] + radial[0] * depth, front[1] + radial[1] * depth];
  return [
    [front[0] - tangent[0] * width / 2, front[1] - tangent[1] * width / 2],
    [front[0] + tangent[0] * width / 2, front[1] + tangent[1] * width / 2],
    [back[0] + tangent[0] * width / 2, back[1] + tangent[1] * width / 2],
    [back[0] - tangent[0] * width / 2, back[1] - tangent[1] * width / 2],
  ];
}

/**
 * Pack ward-interior buildings around an intentionally empty shared center.
 * The old random-square scatter could label buildings as a courtyard while
 * placing one directly through its center. These tangent rectangles face the
 * court and preserve their first edge as the adapter's frontage reference.
 */
export function packWardInterior(
  ward: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): BuildingPlot[] {
  const plotWidth = opts.plotWidth ?? 6;
  const c = polygonCentroid(ward);
  const inner = scalePolygon(ward, c, 0.5); // courtyard core, clear of frontage
  const b = polygonBounds(inner);
  const size = plotWidth * 0.8;
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  const minSpan = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  const rawTarget = Math.floor(area / (size * size * 7));
  if (rawTarget === 0 || minSpan < size * 2.4) return [];
  // Large blocks may hold several distinct shared courts. Each needs at least
  // three facing buildings; the cap prevents an interior street grid from
  // replacing the intentionally open block core.
  const courtCount = rawTarget >= 18 ? 3 : rawTarget >= 10 ? 2 : 1;
  /** Preserve the established one-center RNG stream and recipe on small/fallback blocks. */
  const packSingleCourt = (): BuildingPlot[] => {
    const target = Math.min(8, Math.max(3, rawTarget));
    const singleRng = rngFromPath(streamPath(seedPath, 'interior'));
    const phase = singleRng.next() * Math.PI * 2;
    const courtRadius = Math.max(size * 0.72, minSpan * 0.13);
    const singleCenter = courtyardCentersForBlock(ward, 1)[0];
    const candidateCount = Math.max(12, target * 3);
    const single: BuildingPlot[] = [];
    for (let attempt = 0; attempt < candidateCount && single.length < target; attempt++) {
      const angle = phase + (attempt / candidateCount) * Math.PI * 2;
      const width = size * (0.72 + singleRng.next() * 0.34);
      const depth = size * (0.72 + singleRng.next() * 0.32);
      const polygon = courtyardRect(singleCenter, angle, courtRadius, width, depth);
      if (!polygon.every((point) => pointInPolygon(point, inner))) continue;
      if (single.some((plot) => polygonsIntersect(plot.polygon, polygon))) continue;
      single.push({
        polygon,
        frontageEdge: -1,
        kind: 'interior',
        shape: 'rect',
        courtyardIndex: 0,
      });
    }
    return single;
  };
  if (courtCount === 1) return packSingleCourt();

  const totalTarget = Math.min(18, Math.max(courtCount * 3, rawTarget));
  // Multi-court experimentation owns a separate named stream. A failed split
  // can therefore fall back without perturbing the established single court.
  const rng = rngFromPath(streamPath(seedPath, 'interior:multi-court'));
  const out: BuildingPlot[] = [];
  const placedByCourt: number[] = [];
  const centers = courtyardCentersForBlock(ward, courtCount);
  for (let courtIndex = 0; courtIndex < centers.length; courtIndex++) {
    const center = centers[courtIndex];
    const target = Math.floor(totalTarget / courtCount)
      + (courtIndex < totalTarget % courtCount ? 1 : 0);
    const phase = rng.next() * Math.PI * 2;
    const courtRadius = Math.max(size * 0.72, minSpan * 0.09);
    // More candidate angles than the desired count let short/concave sides
    // reject invalid rectangles without moving a durable cluster center.
    const candidateCount = Math.max(12, target * 4);
    let placed = 0;
    for (let attempt = 0; attempt < candidateCount && placed < target; attempt++) {
      const angle = phase + (attempt / candidateCount) * Math.PI * 2;
      const width = size * (0.72 + rng.next() * 0.34);
      const depth = size * (0.72 + rng.next() * 0.32);
      const polygon = courtyardRect(center, angle, courtRadius, width, depth);
      if (!polygon.every((point) => pointInPolygon(point, inner))) continue;
      if (out.some((plot) => polygonsIntersect(plot.polygon, polygon))) continue;
      out.push({
        polygon,
        frontageEdge: -1,
        kind: 'interior',
        shape: 'rect',
        courtyardIndex: courtIndex,
      });
      placed++;
    }
    placedByCourt.push(placed);
  }
  return placedByCourt.every((placed) => placed >= 3) ? out : packSingleCourt();
}

/** Squared distance from point p to segment ab. */
function segDist2(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist2(p, a);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist2(p, b);
  const t = c1 / c2;
  return dist2(p, [a[0] + t * vx, a[1] + t * vy]);
}

/** Squared distance from point p to the nearest segment of a polyline. */
function polylineDist2(p: Pt, line: Pt[]): number {
  let m = Infinity;
  for (let i = 0; i < line.length - 1; i++) m = Math.min(m, segDist2(p, line[i], line[i + 1]));
  return m;
}

/** Closest point on segment ab to p. */
function closestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const c2 = vx * vx + vy * vy;
  if (c2 < 1e-12) return a;
  let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / c2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * vx, a[1] + t * vy];
}

/** Nearest point on ANY of the water polylines to p (null if no water). */
function nearestWaterPoint(p: Pt, water: Pt[][]): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const line of water) {
    for (let i = 0; i < line.length - 1; i++) {
      const q = closestOnSeg(p, line[i], line[i + 1]);
      const d = dist2(p, q);
      if (d < bestD) { bestD = d; best = q; }
    }
  }
  return best;
}

/** Unit tangent of the water polyline segment nearest to p (river flow direction). */
function nearestWaterTangent(p: Pt, water: Pt[][]): Pt {
  let best: Pt = [1, 0];
  let bestD = Infinity;
  for (const line of water) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const q = closestOnSeg(p, a, b);
      const d = dist2(p, q);
      if (d < bestD) {
        bestD = d;
        const tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        best = [tx / tl, ty / tl];
      }
    }
  }
  return best;
}

/**
 * If a ward is waterfront, return the index of its edge nearest the water (where
 * a dock seats); otherwise null. "Waterfront" = an edge midpoint within `margin`
 * of any inherited water polyline. Criterion #4.
 */
export function wardWaterEdge(ward: Pt[], water: Pt[][], margin: number): number | null {
  if (water.length === 0) return null;
  let best = Infinity, edge = -1;
  for (let e = 0; e < ward.length; e++) {
    const a = ward[e];
    const b = ward[(e + 1) % ward.length];
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = Infinity;
    for (const line of water) d = Math.min(d, polylineDist2(mid, line));
    if (d < best) { best = d; edge = e; }
  }
  return best <= margin * margin ? edge : null;
}

/**
 * Find bridge points: where an inherited water polyline crosses from one ward
 * into another (a street/ward crossing), step-sampled for determinism. Criterion
 * #4. `step` is the sampling spacing in world units.
 */
export function findBridges(water: Pt[][], wardPolys: Pt[][], step: number): Pt[] {
  const bridges: Pt[] = [];
  const wardAt = (p: Pt): number => {
    for (let i = 0; i < wardPolys.length; i++) if (pointInPolygon(p, wardPolys[i])) return i;
    return -1;
  };
  for (const line of water) {
    let prevWard = -1;
    let prevPt: Pt | null = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const L = len(a, b);
      const n = Math.max(1, Math.ceil(L / Math.max(step, 1e-6)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const w = wardAt(p);
        if (w >= 0 && prevWard >= 0 && w !== prevWard && prevPt) {
          bridges.push([(p[0] + prevPt[0]) / 2, (p[1] + prevPt[1]) / 2]);
        }
        prevWard = w;
        prevPt = p;
      }
    }
  }
  return bridges;
}

/** Scale a polygon toward `center` by factor `k` (k<1 shrinks, e.g. an inset). */
function scalePolygon(poly: Pt[], center: Pt, k: number): Pt[] {
  return poly.map(([x, y]) => [center[0] + (x - center[0]) * k, center[1] + (y - center[1]) * k] as Pt);
}

/** Axis-aligned square of side `size` centered at `c`. */
function squareAt(c: Pt, size: number): Pt[] {
  const h = size / 2;
  return [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]];
}

/**
 * A pier deck: a rectangle of width `width` and length `length` whose near edge
 * sits at `base` and which extends along unit direction `dir`. Used for dock
 * decks that reach SEAWARD over the water from the shore (TG5) so a quay reads as
 * a pier on the water rather than a shed on land.
 */
function pierQuad(base: Pt, dir: Pt, length: number, width: number): Pt[] {
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / dl, dy = dir[1] / dl;
  const px = -dy, py = dx; // perpendicular (deck half-width)
  const hw = width / 2;
  const nearL: Pt = [base[0] + px * hw, base[1] + py * hw];
  const nearR: Pt = [base[0] - px * hw, base[1] - py * hw];
  const farL: Pt = [nearL[0] + dx * length, nearL[1] + dy * length];
  const farR: Pt = [nearR[0] + dx * length, nearR[1] + dy * length];
  return [nearL, farL, farR, nearR];
}

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Cheap polygon-overlap test: any vertex of one polygon inside the other. For the
 * small convex-ish shapes here (axis-aligned civic squares vs building rects/Ls)
 * checking both directions reliably catches containment and partial overlap — used
 * to clear building plots out from under civic structures.
 */
function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (const p of a) if (pointInPolygon(p, b)) return true;
  for (const p of b) if (pointInPolygon(p, a)) return true;
  return false;
}

/** True if segments p1p2 and p3p4 properly cross (orientation test). */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Robust polygon overlap for the building/civic shapes here (rotated rects and
 * L-footprints): vertex containment either way OR any edge crossing. Catches the
 * edge-only intersections that the vertex-only test misses (two rects clipping
 * corners without a vertex inside the other).
 */
function polygonsIntersect(a: Pt[], b: Pt[]): boolean {
  // Bounding-box reject first. Same answer (disjoint boxes cannot touch),
  // but deep lots and suburbs tripled the plot count, and the carve and
  // suburb passes test every lot against every corridor piece.
  let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
  for (const [x, y] of a) { if (x < aMinX) aMinX = x; if (x > aMaxX) aMaxX = x; if (y < aMinY) aMinY = y; if (y > aMaxY) aMaxY = y; }
  let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
  for (const [x, y] of b) { if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x; if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y; }
  if (aMaxX < bMinX || bMaxX < aMinX || aMaxY < bMinY || bMaxY < aMinY) return false;
  if (polysOverlap(a, b)) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

/**
 * Greedy collision resolution: keep plots in order, dropping any that intersect a
 * plot already kept. Frontage is added before interior infill, so street-facing
 * buildings win and colliding courtyard squares (or acute-corner frontage) drop.
 */
function resolveCollisions(
  plots: BuildingPlot[],
  preservePartyWalls = false,
): BuildingPlot[] {
  const kept: BuildingPlot[] = [];
  for (const p of plots) {
    let ok = true;
    for (let k = 0; k < kept.length; k++) {
      if (!polygonsIntersect(p.polygon, kept[k].polygon)) continue;

      // Dense frontage packing intentionally makes consecutive lots share one
      // exact endpoint on the same street edge. The generic polygon test sees
      // that boundary contact as an intersection; preserve it while still
      // rejecting real overlaps, corner clashes, and all infill collisions.
      const earlier = kept[k];
      const sameFrontage = preservePartyWalls
        && p.kind === 'frontage'
        && earlier.kind === 'frontage'
        && p.frontageEdge >= 0
        && p.frontageEdge === earlier.frontageEdge;
      const sharedEndpoint = sameFrontage && (
        dist2(earlier.polygon[1], p.polygon[0]) <= 1e-12
        || dist2(p.polygon[1], earlier.polygon[0]) <= 1e-12
      );
      if (sharedEndpoint) continue;

      ok = false;
      break;
    }
    if (ok) kept.push(p);
  }
  return kept;
}

/**
 * Build the defensive wall ring (footprint inset toward its centroid) and seat
 * its gatehouses. Criterion #3 (walls + gatehouses).
 *
 * ROADS DECIDE THE GATES (roads slice, 2026-08-23). A gate is FIRST seated
 * wherever an inherited regional road actually crosses the ring, because that is
 * the only place a traveller can arrive. The old rule — midpoints of the longest
 * footprint edges — knew nothing about roads, so a highway drove through solid
 * rampart while the gates a few hundred feet away opened onto empty grass. That
 * rule survives only as the TOP-UP: it fills the ring out to `gateCount` when a
 * town has fewer approach roads than gates, and its candidates are rejected when
 * they land on top of a road gate.
 *
 * A TOP-UP GATE STANDS ON DRY GROUND (GG-582). `dry` says whether a point is
 * clear of the river; a top-up candidate that is not goes to the next longest
 * edge. Toseiraion (burg 758) had its main gate 12 ft inside its river.
 */
export function buildWalls(footprint: Pt[], gateCount = 3, roads: Pt[][] = [], inset = 0.94, dry?: (p: Pt) => boolean): TownWalls {
  const c = polygonCentroid(footprint);
  // `inset` is the ring's share of the core radius: 0.94 for a town that
  // fills its walls loosely, less for one that has outgrown them (GG-544).
  const ring = scalePolygon(footprint, c, inset);
  const b = polygonBounds(ring);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  // Two gates closer than this are one gate: a road that wobbles back and forth
  // across the ring must not grow a row of gatehouses a few feet apart.
  const minSpacing = span * 0.08;
  const gatehouses: Pt[] = roadGateCandidates(ring, roads, minSpacing);
  // Rank footprint edges by length; top-up gates sit at the midpoints of the longest.
  const edges = footprint.map((a, i) => {
    const bb = footprint[(i + 1) % footprint.length];
    return { i, L: len(a, bb), mid: [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2] as Pt };
  }).sort((p, q) => q.L - p.L);
  for (const e of edges) {
    if (gatehouses.length >= gateCount) break;
    // Project the edge midpoint onto the ring (same inset toward centroid).
    const g: Pt = [c[0] + (e.mid[0] - c[0]) * inset, c[1] + (e.mid[1] - c[1]) * inset];
    if (gatehouses.some((h) => len(h, g) < minSpacing)) continue;
    if (dry && !dry(g)) continue;
    gatehouses.push(g);
  }
  // waterGates are seated later by generateTownPlan once the inherited water is
  // known (buildWalls has no water context).
  return { ring, gatehouses, waterGates: [] };
}

/**
 * Find where inherited water polylines cross the wall ring — the points a
 * water-gate/arch must break the rampart so a river doesn't clip solid stone
 * (TG7). Returns the crossing points on the ring edges.
 */
export function findWaterGates(ring: Pt[], water: Pt[][]): Pt[] {
  if (ring.length < 3 || water.length === 0) return [];
  const gates: Pt[] = [];
  for (const line of water) {
    for (let s = 0; s < line.length - 1; s++) {
      const w1 = line[s], w2 = line[s + 1];
      for (let e = 0; e < ring.length; e++) {
        const r1 = ring[e], r2 = ring[(e + 1) % ring.length];
        const x = segIntersectPoint(w1, w2, r1, r2);
        if (x) gates.push(x);
      }
    }
  }
  return gates;
}

/** Intersection point of segments p1p2 and p3p4, or null if they don't cross. */
function segIntersectPoint(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // parallel
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

/** Which civic structures a town of a given scale should seat. */
export interface CivicRoleRequest {
  plaza?: boolean;
  temple?: boolean;
  keep?: boolean;
  citadel?: boolean;
}

/**
 * Assign civic roles to wards by position: the plaza is the most central ward,
 * the keep/citadel the most peripheral (defensible), the temple the next-most
 * central distinct ward. Only the requested roles are placed (scale-gated).
 * Returns a role per ward index. Criterion #3 + #5.
 */
export function assignCivicRoles(
  wardCentroids: Pt[],
  townCenter: Pt,
  req: CivicRoleRequest = { plaza: true, temple: true, keep: true },
): Map<number, CivicKind> {
  const roles = new Map<number, CivicKind>();
  if (wardCentroids.length === 0) return roles;
  const byCentrality = wardCentroids
    .map((p, i) => ({ i, d: dist2(p, townCenter) }))
    .sort((a, b) => a.d - b.d);
  const takeCentral = (): number | undefined => byCentrality.find((x) => !roles.has(x.i))?.i;
  const takePeripheral = (): number | undefined => {
    for (let k = byCentrality.length - 1; k >= 0; k--) if (!roles.has(byCentrality[k].i)) return byCentrality[k].i;
    return undefined;
  };
  if (req.plaza) { const i = takeCentral(); if (i != null) roles.set(i, 'plaza'); }
  if (req.keep) { const i = takePeripheral(); if (i != null) roles.set(i, 'keep'); }
  if (req.citadel) { const i = takePeripheral(); if (i != null) roles.set(i, 'citadel'); }
  if (req.temple) { const i = takeCentral(); if (i != null) roles.set(i, 'temple'); }
  return roles;
}

/** Population bands → settlement typology (uncapped: above the top band = capital). */
export function typologyForPopulation(pop: number): TownTypology {
  if (pop < 100) return 'hamlet';
  if (pop < 1000) return 'village';
  if (pop < 5000) return 'walled town';
  if (pop < 25000) return 'city';
  return 'capital';
}

/**
 * Derive the full scale profile from population: typology, ward count (sublinear,
 * UNCAPPED — no fixed size cap), and which civic structures appear. Criterion #5.
 */
export function scaleProfile(population: number): TownScaleProfile {
  const pop = Math.max(0, population);
  const typology = typologyForPopulation(pop);
  const wardCount = Math.max(3, Math.round(Math.pow(Math.max(pop, 1), 0.45) * 0.9));
  const walled = typology === 'walled town' || typology === 'city' || typology === 'capital';
  return {
    typology,
    population: pop,
    wardCount,
    hasWalls: walled,
    hasPlaza: typology !== 'hamlet',
    hasTemple: typology !== 'hamlet',
    hasKeep: walled,
    hasCitadel: typology === 'capital',
  };
}

/** Distance from `center` to the polygon boundary along angle `ang` (radians). */
function rayPolyRadius(center: Pt, ang: number, poly: Pt[]): number {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue;
    const acx = a[0] - center[0], acy = a[1] - center[1];
    const t = (ex * acy - ey * acx) / det; // ray param (distance from center)
    const u = (dx * acy - dy * acx) / det; // edge param
    if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return isFinite(best) ? best : 0;
}

/** Fraction of the cell radius the built-up core occupies, by settlement scale. */
function coreFracFor(profile: TownScaleProfile | null): number {
  if (!profile) return 0.7;
  switch (profile.typology) {
    case 'hamlet': return 0.42;
    case 'village': return 0.52;
    case 'walled town': return 0.64;
    case 'city': return 0.76;
    default: return 0.86; // capital
  }
}

/**
 * Build the ORGANIC built-up core inside the parent cell. Rather than adopting
 * the cell's exact polygon, the core is a smooth blob centred in the cell whose
 * radius is a fraction of the cell radius modulated by a few seeded harmonics —
 * so the town has its own shape and leaves an outskirts ring out to the cell edge.
 */
export function buildTownCore(
  footprint: Pt[],
  center: Pt,
  coreFrac: number,
  seedPath: SeedPath,
  segments = 28,
  coast: readonly Pt[][] = [],
  quay = 0,
): Pt[] {
  const rng = rngFromPath(streamPath(seedPath, 'core'));
  const p1 = rng.next() * Math.PI * 2, p2 = rng.next() * Math.PI * 2, p3 = rng.next() * Math.PI * 2;
  const a1 = 0.1 + rng.next() * 0.14, a2 = 0.05 + rng.next() * 0.08, a3 = 0.03 + rng.next() * 0.05;
  // A PORT REACHES ITS SHORE (GG-547, town-look 2026-10-31). The blob knew
  // nothing of the sea, so a coast town stood a median 17% of the cell span
  // back from its own shoreline with farmland between. A ray that meets the
  // cell edge on the coast now runs the core out to a quay's width of the
  // shore; the coastal share is smoothed over neighbor rays so the waterfront
  // joins the landward blob without a step.
  const fb = polygonBounds(footprint);
  const coastTol = Math.max(fb.maxX - fb.minX, fb.maxY - fb.minY) * 0.005;
  const samples: Array<{ ang: number; cellR: number; r: number; coastal: number }> = [];
  for (let k = 0; k < segments; k++) {
    const ang = (k / segments) * Math.PI * 2;
    const cellR = rayPolyRadius(center, ang, footprint);
    if (cellR <= 0) continue;
    const noise = 1 + a1 * Math.sin(ang + p1) + a2 * Math.sin(2 * ang + p2) + a3 * Math.sin(3 * ang + p3);
    let r = cellR * coreFrac * noise;
    r = Math.min(r, cellR * 0.94); // keep a margin so the core stays inside the cell
    r = Math.max(r, cellR * 0.16);
    const hit: Pt = [center[0] + Math.cos(ang) * cellR, center[1] + Math.sin(ang) * cellR];
    const coastal = coast.some((line) => polylineDist2(hit, line as Pt[]) <= coastTol * coastTol) ? 1 : 0;
    samples.push({ ang, cellR, r, coastal });
  }
  const m = samples.length;
  return samples.map((s, k) => {
    let w = 0;
    for (let o = -2; o <= 2; o++) w += samples[(k + o + m) % m].coastal;
    w /= 5;
    const shore = Math.max(s.r, s.cellR - quay);
    const r = s.r + (shore - s.r) * w;
    return [center[0] + Math.cos(s.ang) * r, center[1] + Math.sin(s.ang) * r] as Pt;
  });
}

/**
 * Subdivide the ring between the core and the cell edge into land-use parcels:
 * farmland hugs the core, pasture beyond, scrub/barren at the rim. A coarse
 * Voronoi over the whole cell; cells whose centroid is inside the core are the
 * town and are dropped (the town renders on top). Distance from the core edge to
 * the cell edge classifies the rest.
 */
export function buildOutskirts(
  footprint: Pt[],
  core: Pt[],
  center: Pt,
  seedPath: SeedPath,
  count = 40,
): TownOutskirt[] {
  const model = generateSubmap({ polygon: footprint, seedPath: streamPath(seedPath, 'outskirts') }, { count });
  const out: TownOutskirt[] = [];
  for (const cell of model.cells) {
    if (cell.polygon.length < 3) continue;
    const c = polygonCentroid(cell.polygon);
    if (pointInPolygon(c, core)) continue; // inside the town
    const ang = Math.atan2(c[1] - center[1], c[0] - center[0]);
    const coreR = rayPolyRadius(center, ang, core);
    const cellR = rayPolyRadius(center, ang, footprint);
    const dist = Math.hypot(c[0] - center[0], c[1] - center[1]);
    const frac = cellR > coreR ? (dist - coreR) / (cellR - coreR) : 1;
    const kind: OutskirtKind = frac < 0.45 ? 'farm' : frac < 0.78 ? 'pasture' : 'scrub';
    out.push({ polygon: cell.polygon, kind });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Intramural open land
// ---------------------------------------------------------------------------

/** Angular resolution of the built-edge / wall radius profiles. */
const OPEN_LAND_ANGLE_STEPS = 360;
/**
 * People per unit of enclosed cell-fraction at which a town is judged to fill
 * its walls. Calibrated on the canonical frame (`CANON_TOWN_SPAN`): the capital
 * Borieborum (31,392 people behind a ring enclosing 0.338 of its cell) reads as
 * full, the walled town Hafting (2,306 behind 0.283) reads as a third full.
 */
const WALL_FILL_REFERENCE = 90_000;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * FARTHEST ray/polygon crossing from `center` (the polygon's outer edge along
 * the ray). `rayPolyRadius` returns the NEAREST crossing, which is the entry
 * point — for "how far out does the built fabric reach" we need the exit.
 * Returns 0 when the ray misses the polygon entirely.
 */
function farRayPolyRadius(center: Pt, ang: number, poly: Pt[]): number {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue;
    const acx = a[0] - center[0], acy = a[1] - center[1];
    const t = (ex * acy - ey * acx) / det;
    const u = (dx * acy - dy * acx) / det;
    if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6 && t > best) best = t;
  }
  return best;
}

/** Sample a radius profile (indexed by angle step) at an arbitrary angle. */
function sampleProfile(profile: number[], ang: number): number {
  const n = profile.length;
  let f = (ang / (Math.PI * 2)) * n;
  f -= Math.floor(f / n) * n;
  const i0 = Math.floor(f) % n;
  const i1 = (i0 + 1) % n;
  const t = f - Math.floor(f);
  return profile[i0] * (1 - t) + profile[i1] * t;
}

/**
 * How full a town's walls are: the people it holds against the ground it
 * encloses. Scale-free — the enclosed area is expressed as a fraction of the
 * parent cell's bbox span, so the number means the same whatever coordinate
 * scale the plan was generated at. 1 = the town needs every foot inside its
 * walls; 0 = it rattles around in them.
 */
export function wallFill(population: number, enclosedArea: number, fpSpan: number): number {
  if (!(population > 0) || !(enclosedArea > 0) || !(fpSpan > 0)) return 0;
  const enclosedFrac = enclosedArea / (fpSpan * fpSpan);
  if (!(enclosedFrac > 0)) return 0;
  return clamp01(Math.sqrt(population / enclosedFrac / WALL_FILL_REFERENCE));
}

/**
 * Split every edge of `poly` so no segment is longer than `maxLen`. Needed
 * before the polar clamp below: clamping only moves VERTICES, so a long chord
 * across a curved band boundary would cut the corner. Densifying bounds that
 * error to well under a parcel's width.
 */
function densifyPolygon(poly: Pt[], maxLen: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    out.push(a);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.min(24, Math.floor(L / maxLen));
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * Classify one open-land parcel.
 *
 * `depth` is the parcel's position across the slack band (0 = against a built
 * block, 1 = against the wall). `fill` is population-versus-footprint. A town
 * that needs its ground works the edge hard and keeps the rest as garden; a
 * town rattling around inside its walls turns the same ground over to trees,
 * stock, and — where it once built — ruins.
 */
function classifyOpenLand(depth: number, fill: number, walled: boolean, roll: number): OpenLandKind {
  if (walled) {
    // Ruins are the walls' own record of a bigger past, so they need a wall.
    const ruinChance = clamp01((1 - fill) - 0.35) * 1.2;
    if (roll < ruinChance * (0.4 + 0.6 * depth)) return 'ruin';
  }
  const score = depth * 0.55 + (1 - fill) * 1.0 + (roll - 0.5) * 0.25 - 0.15;
  if (score < 0.25) return 'yard';
  if (score < 0.5) return 'garden';
  if (score < 0.75) return 'orchard';
  return 'paddock';
}

/**
 * Parcel the open ground INSIDE the town: the slack between the built edge and
 * the wall (or, unwalled, the core edge), plus any ward block that packed zero
 * plots. This fills what the wards leave; it never moves them.
 *
 * REGION. Two disjoint sources, both exact:
 *  1. RIM SLACK. The envelope (wall ring, else core) and the built fabric are
 *     both radial blobs about the town center, so the remainder between them is
 *     described exactly by two radius profiles: `rOut(θ)` = the wall, `rIn(θ)` =
 *     the farthest any BUILT ward reaches along that ray. "Built ward" means the
 *     full ward polygon, not its block, so the street margin between blocks
 *     stays street and no parcel lands in the roadway — that is the "minus ward
 *     blocks, minus streets" subtraction, done in one step. Civic polygons are
 *     removed afterwards by intersection test, since a dock or bridge reaches
 *     past the ward edge.
 *  2. UNBUILT WARD BLOCKS. A ward with zero plots and no civic role is the same
 *     phenomenon at block scale, so its block becomes open land too. Plaza and
 *     temple/keep/citadel wards are LEFT ALONE — their emptiness is the civic
 *     structure, not slack.
 *
 * PARCELLING. Both sources go through `generateSubmap`, so the parcels are
 * seeded Voronoi work like the outskirts, not hand-placed. The rim tessellates
 * the envelope's BOUNDING BOX — a convex polygon, which `clipPolygon`
 * (Sutherland–Hodgman, convex-clip only) handles exactly; running it on the
 * concave wall ring is precisely what leaves the ward gap in the first place.
 * Each cell is then clamped into the band in polar coordinates: densify, take
 * (θ, r) about the center, clamp r into [rIn(θ), rOut(θ)], map back. The clamp
 * is monotone in r and leaves θ alone, so parcels stay disjoint and land exactly
 * inside the band; cells wholly inside the built area or outside the wall
 * collapse to zero area and are dropped.
 */
export function buildIntramuralOpenLand(args: {
  /** Wall ring when walled, else the built-up core. */
  envelope: Pt[];
  wards: TownWard[];
  civic: CivicStructure[];
  /** Town center the envelope and the built fabric are both radial about. */
  center: Pt;
  /** Footprint span — sets the scale-free thresholds. */
  fpSpan: number;
  walled: boolean;
  population: number;
  seedPath: SeedPath;
}): TownOpenLand[] {
  const { envelope, wards, civic, center, fpSpan, walled, population, seedPath } = args;
  // NO FALLBACK: an unusable region is a generator bug, not an empty result.
  if (envelope.length < 3) {
    throw new Error('buildIntramuralOpenLand: envelope needs at least 3 vertices');
  }
  if (!(fpSpan > 0)) {
    throw new Error(`buildIntramuralOpenLand: footprint span must be positive (got ${fpSpan})`);
  }

  const out: TownOpenLand[] = [];
  const envArea = polyArea(envelope);
  if (!(envArea > 0)) {
    throw new Error('buildIntramuralOpenLand: envelope has zero area');
  }
  const fill = wallFill(population, envArea, fpSpan);
  const rng = rngFromPath(streamPath(seedPath, 'open-land'));

  // A ward is BUILT if it carries plots or a civic role; those bound the slack.
  const builtWards = wards.filter((w) => w.plots.length > 0 || w.civic != null);
  const emptyWards = wards.filter((w) => w.plots.length === 0 && w.civic == null);
  // Solid civic ground (keep/temple/citadel/dock/bridge/plaza) is never open land.
  const civicPolys = civic.map((c) => c.polygon).filter((p) => p.length >= 3);

  // --- 1. Rim slack -------------------------------------------------------
  const rOut: number[] = new Array(OPEN_LAND_ANGLE_STEPS);
  const rIn: number[] = new Array(OPEN_LAND_ANGLE_STEPS);
  for (let k = 0; k < OPEN_LAND_ANGLE_STEPS; k++) {
    const ang = (k / OPEN_LAND_ANGLE_STEPS) * Math.PI * 2;
    const ro = rayPolyRadius(center, ang, envelope);
    let ri = 0;
    for (const w of builtWards) {
      const r = farRayPolyRadius(center, ang, w.polygon);
      if (r > ri) ri = r;
    }
    rOut[k] = ro;
    rIn[k] = Math.min(ri, ro);
  }

  // Slack narrower than this is a rendering seam, not a parcel of land.
  const minBandWidth = fpSpan * 0.012;
  const minParcelArea = (fpSpan * 0.02) ** 2;
  let slackArea = 0;
  const dTheta = (Math.PI * 2) / OPEN_LAND_ANGLE_STEPS;
  for (let k = 0; k < OPEN_LAND_ANGLE_STEPS; k++) {
    if (rOut[k] - rIn[k] > minBandWidth) slackArea += 0.5 * (rOut[k] ** 2 - rIn[k] ** 2) * dTheta;
  }

  // Parcel grain: about a third of a ward, so a parcel reads at the same scale
  // as the blocks it sits against.
  const targetParcelArea = Math.max(minParcelArea * 4, (envArea / Math.max(1, wards.length)) * 0.32);

  if (slackArea > minParcelArea) {
    // Sites spread over the bbox, so scale the count up by how much bigger the
    // bbox is than one parcel.
    const b = polygonBounds(envelope);
    const bboxArea = (b.maxX - b.minX) * (b.maxY - b.minY);
    const count = Math.max(24, Math.min(600, Math.round(bboxArea / targetParcelArea)));
    const bbox: Pt[] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
    const model = generateSubmap(
      { polygon: bbox, seedPath: streamPath(seedPath, 'open-land') },
      { count },
    );
    const densifyStep = fpSpan * 0.01;
    for (const cell of model.cells) {
      if (cell.polygon.length < 3) continue;
      if (pointInPolygon(center, cell.polygon)) continue; // polar frame is singular here
      const dense = densifyPolygon(cell.polygon, densifyStep);
      const clamped: Pt[] = [];
      for (const [x, y] of dense) {
        const dx = x - center[0], dy = y - center[1];
        const ang = Math.atan2(dy, dx);
        const r = Math.hypot(dx, dy);
        const lo = sampleProfile(rIn, ang);
        const hi = sampleProfile(rOut, ang);
        if (hi - lo <= minBandWidth) { clamped.push([center[0] + Math.cos(ang) * lo, center[1] + Math.sin(ang) * lo]); continue; }
        const rc = r < lo ? lo : r > hi ? hi : r;
        clamped.push([center[0] + Math.cos(ang) * rc, center[1] + Math.sin(ang) * rc]);
      }
      if (clamped.length < 3) continue;
      if (polyArea(clamped) < minParcelArea) continue;
      const c = polygonCentroid(clamped);
      if (civicPolys.some((p) => pointInPolygon(c, p) || polygonsIntersect(clamped, p))) continue;
      const ang = Math.atan2(c[1] - center[1], c[0] - center[0]);
      const lo = sampleProfile(rIn, ang);
      const hi = sampleProfile(rOut, ang);
      const depth = hi > lo ? clamp01((Math.hypot(c[0] - center[0], c[1] - center[1]) - lo) / (hi - lo)) : 1;
      out.push({ polygon: clamped, kind: classifyOpenLand(depth, fill, walled, rng.next()), source: 'rim' });
    }
  }

  // --- 2. Unbuilt ward blocks --------------------------------------------
  for (let i = 0; i < wards.length; i++) {
    const w = wards[i];
    if (!emptyWards.includes(w)) continue;
    const block = w.block.length >= 3 ? w.block : w.polygon;
    const blockArea = block.length >= 3 ? polyArea(block) : 0;
    if (blockArea < minParcelArea) continue;
    // An unbuilt block is ringed by streets and neighbours, so it always reads as
    // close-in ground: shallow depth, whatever the town's fill.
    const kindFor = (): OpenLandKind => classifyOpenLand(0.15, fill, walled, rng.next());
    // Split into holdings at the SAME grain as the rim parcels, so a big unbuilt
    // block reads as several gardens rather than one flat slab. A block already
    // at or under that grain is one holding — subdividing it would only produce
    // slivers, and dropping the slivers would put the blank block back.
    const holdings = Math.max(1, Math.min(4, Math.round(blockArea / targetParcelArea)));
    if (holdings <= 1) {
      if (!civicPolys.some((p) => polygonsIntersect(block, p))) {
        out.push({ polygon: block, kind: kindFor(), source: 'ward' });
      }
      continue;
    }
    const sub = generateSubmap(
      { polygon: block, seedPath: streamPath(seedPath, `open-ward:${i}`) },
      { count: holdings },
    );
    for (const cell of sub.cells) {
      if (cell.polygon.length < 3 || polyArea(cell.polygon) < minParcelArea * 0.2) continue;
      if (civicPolys.some((p) => polygonsIntersect(cell.polygon, p))) continue;
      out.push({ polygon: cell.polygon, kind: kindFor(), source: 'ward' });
    }
  }

  return out;
}

/**
 * Max docks by settlement size (#4 quality). `wardWaterEdge` seats a dock on
 * EVERY waterfront ward, which over-densifies a river+coast town (a 5k port grew
 * 11 piers); a town has a few principal quays, not one per block. Scales with
 * trade weight (size). No profile (raw wardCount call) → a modest default.
 */
function dockCapForTypology(t: TownTypology | undefined): number {
  switch (t) {
    case 'hamlet':
    case 'village': return 1;
    case 'walled town': return 2;
    case 'city': return 4;
    case 'capital': return 6;
    default: return 3;
  }
}

/**
 * Max bridges by settlement size. `findBridges` can over-generate where a river
 * snakes along a ward boundary. A real town has 1-3 principal crossings.
 */
function bridgeCapForTypology(t: TownTypology | undefined): number {
  switch (t) {
    case 'hamlet':
    case 'village': return 1;
    case 'walled town': return 2;
    case 'city': return 3;
    case 'capital': return 4;
    default: return 2;
  }
}

/**
 * Plan-unit sizes for one town: real feet when the plan has a physical scale
 * (`feetPerUnit`), else shares of the ward span (a schematic plan, such as a
 * unit test or the building lab, has no feet to measure).
 */
interface TownSizing {
  /** Feet → plan units; for a schematic plan, a nominal scale. */
  unit: (ft: number) => number;
  /** True when `unit` is a real physical scale. */
  physical: boolean;
  laneWidth: number;
  lots: DeepLotOptions;
}

function townSizing(opts: GenerateTownOptions, packOpts: GenerateTownOptions, wardSpan: number): TownSizing {
  const fpu = opts.feetPerUnit;
  if (fpu && fpu > 0) {
    const unit = (ft: number): number => ft / fpu;
    return {
      unit,
      physical: true,
      // GG-550 (town-look, 2026-10-31): the plan's back lane IS the 3D lane,
      // 10 ft — two cells, walkable side by side. Every tier keeps the shared
      // feet ladder (28/22/15/10 ft), so the plan and the 3D bake agree.
      laneWidth: unit(STREET_TIER_SPECS.lane.widthFt),
      lots: {
        lotWidth: unit(LOT_WIDTH_FT),
        minLotWidth: unit(MIN_LOT_WIDTH_FT),
        maxLotWidth: unit(MAX_LOT_WIDTH_FT),
        maxDepth: unit(MAX_LOT_DEPTH_FT),
        snap: unit(CELL_FT),
        alleyChance: 0.1,
        alleyWidth: unit(CELL_FT),
        minHouseWidth: unit(MIN_HOUSE_WIDTH_FT),
        minCornerDeg: MIN_HOUSE_CORNER_DEG,
      },
    };
  }
  // Schematic plan: the historical ward-relative sizes. 600 ft per core span
  // is only a nominal scale for the few feet-named sizes (piers, greens).
  const plotWidth = packOpts.plotWidth ?? Math.max(2, wardSpan * 0.16);
  const plotDepth = packOpts.plotDepth ?? Math.max(2.5, wardSpan * 0.2);
  return {
    unit: (ft: number): number => (ft * wardSpan) / 120,
    physical: false,
    laneWidth: Math.max(wardSpan * 0.06, 1.2) * 2,
    lots: {
      lotWidth: plotWidth,
      minLotWidth: plotWidth * 0.6,
      maxLotWidth: plotWidth * 1.5,
      maxDepth: plotDepth * 2,
      snap: 0,
      alleyChance: 0.1,
      alleyWidth: packOpts.gap ?? Math.max(0.4, wardSpan * 0.035),
    },
  };
}

/** Thin quads along polylines: the ground a road or a river occupies. */
function corridorQuads(lines: readonly Pt[][], half: number): Pt[][] {
  const quads: Pt[][] = [];
  for (const s of lines) {
    for (let i = 0; i < s.length - 1; i++) {
      const [x1, y1] = s[i];
      const [x2, y2] = s[i + 1];
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1e-6) continue;
      const nx = (-(y2 - y1) / L) * half;
      const ny = ((x2 - x1) / L) * half;
      quads.push([[x1 - nx, y1 - ny], [x2 - nx, y2 - ny], [x2 + nx, y2 + ny], [x1 + nx, y1 + ny]]);
    }
    // One rectangle per segment leaves a wedge uncovered on the outside of
    // every bend, where a house could stand inside the road. An octagon
    // around each vertex (circumscribed, so it covers the full circle of
    // radius `half`) closes it. The ends get one too: an approach ends at its
    // gate, and the octagon keeps a small clear patch just inside the arch.
    const r = half / Math.cos(Math.PI / 8);
    for (let i = 0; i < s.length; i++) {
      if (s.length < 2) break;
      const [cx, cy] = s[i];
      const cap: Pt[] = [];
      for (let k = 0; k < 8; k++) cap.push([cx + Math.cos((k * Math.PI) / 4 + Math.PI / 8) * r, cy + Math.sin((k * Math.PI) / 4 + Math.PI / 8) * r]);
      quads.push(cap);
    }
  }
  return quads;
}

/**
 * The water carve: ground along rivers and the shore that no building may
 * touch (GG-546, GG-547).
 *
 * With a physical scale, a river clears its 3D channel half-width (the same
 * `min(3% of span, 20 ft)` the ground bake carves) plus a five-foot towpath,
 * and the coast clears a quay. The old single `WATER_CARVE_HALF_FRAC` cleared
 * 3.5% of the span on BOTH sides of every water line — about 42 ft at the
 * usual town scale, twice the river the 3D bake draws — and it touched 32% of
 * all empty blocks. A schematic plan keeps the old share.
 */
function waterCarveQuads(
  water: readonly Pt[][],
  coast: readonly Pt[][],
  fpSpan: number,
  sizing: TownSizing,
  /** GG-561: the cut channel's half width, when the river width is known. */
  channelHalf?: number,
): Pt[][] {
  if (channelHalf && channelHalf > 0) {
    const coastSet = new Set(coast);
    return [
      ...corridorQuads(water.filter((line) => !coastSet.has(line)), channelHalf),
      ...corridorQuads(coast, sizing.physical ? sizing.unit(QUAY_WIDTH_FT) : fpSpan * WATER_CARVE_HALF_FRAC),
    ];
  }
  if (!sizing.physical) return corridorQuads(water, fpSpan * WATER_CARVE_HALF_FRAC);
  const coastSet = new Set(coast);
  const rivers = water.filter((line) => !coastSet.has(line));
  const riverHalf = Math.min(fpSpan * 0.03, sizing.unit(TOWN_RIVER_MAX_HALF_WIDTH_FT)) + sizing.laneWidth / 2;
  return [
    ...corridorQuads(rivers, riverHalf),
    ...corridorQuads(coast, sizing.unit(QUAY_WIDTH_FT)),
  ];
}

/**
 * Bank margin each side of a river, in feet (GG-561): the towpath or quay
 * between the water and the first street. It equals the bridge abutment, so a
 * deck lands on the bank line.
 */
export const RIVER_BANK_FT = 8;

/** Parapet on EACH side of a bridge deck, in feet (GG-560). */
export const BRIDGE_PARAPET_FT = 2;
/** How far a bridge deck runs onto each bank past the water's edge, in feet (GG-560). */
export const BRIDGE_ABUTMENT_FT = 8;

/**
 * A bridge deck that CARRIES A STREET across the river (TG5, GG-560).
 *
 * GG-560 (Remy 2026-11-01, Borieborum: "why are these bridges so massive"):
 * the deck width was 32% of the deck length, and the length was 1.5 river
 * widths. Over a 153 ft river that made 229 x 73 ft decks for 10 ft lanes.
 * A bridge is the street it carries, so now:
 *  - the deck runs ALONG the street (`dir`), not square to the flow;
 *  - its width is the street's own width plus a parapet on each side;
 *  - its length is the channel measured along the street (an oblique
 *    crossing is longer) plus an abutment on each bank.
 * Without a river width (a schematic plan) the length keeps the historical
 * `fpSpan * 0.11`.
 */
function bridgeDeck(
  at: Pt,
  dir: Pt,
  streetWidth: number,
  bridgeWater: Pt[][],
  opts: GenerateTownOptions,
  fpSpan: number,
  sizing: TownSizing,
): Pt[] {
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  const u: Pt = [dir[0] / dl, dir[1] / dl];
  const tan = nearestWaterTangent(at, bridgeWater);
  // |sin| of the crossing angle; a street almost parallel to the flow is
  // clamped so the deck cannot run on down the river.
  const sin = Math.max(0.5, Math.abs(u[0] * tan[1] - u[1] * tan[0]));
  const length = opts.waterWidth
    ? opts.waterWidth / sin + 2 * sizing.unit(BRIDGE_ABUTMENT_FT)
    : fpSpan * 0.11;
  const width = streetWidth + 2 * sizing.unit(BRIDGE_PARAPET_FT);
  const base: Pt = [at[0] - u[0] * length * 0.5, at[1] - u[1] * length * 0.5];
  return pierQuad(base, u, length, width);
}

/**
 * A bridge deck on a river LINK (GG-560, GG-561): from one bank end of a cut
 * street to the other, run on by an abutment at each end, at the street's
 * width plus a parapet each side.
 */
function linkDeck(a: Pt, b: Pt, streetWidth: number, sizing: TownSizing): Pt[] {
  const L = len(a, b) || 1;
  const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const ab = sizing.unit(BRIDGE_ABUTMENT_FT);
  return pierQuad([a[0] - u[0] * ab, a[1] - u[1] * ab], u, L + 2 * ab, streetWidth + 2 * sizing.unit(BRIDGE_PARAPET_FT));
}

/**
 * The street a bridge at `bp` carries: the nearest intramural street, and its
 * direction at that point. Null when no street passes within `reach`.
 */
function streetAt(bp: Pt, streets: readonly TownStreet[], reach: number): { street: TownStreet; dir: Pt } | null {
  let best: { street: TownStreet; dir: Pt } | null = null;
  let bestD = reach * reach;
  for (const s of streets) {
    if (s.role === 'approach') continue;
    const L = s.centerline;
    for (let i = 0; i < L.length - 1; i++) {
      const d = segDist2(bp, L[i], L[i + 1]);
      if (d < bestD) { bestD = d; best = { street: s, dir: [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]] }; }
    }
  }
  return best;
}

/**
 * Drop a bridge deck that touches a deck kept before it (GG-560). Two decks
 * side by side read as one plaza on the water; the first one in the list
 * (the caller's preferred crossing) stays.
 */
function keepDecksApart(decks: CivicStructure[], clearance: number): CivicStructure[] {
  const kept: CivicStructure[] = [];
  for (const c of decks) {
    const near = kept.some((k) => polygonsIntersect(c.polygon, k.polygon)
      || c.polygon.some((p) => distToPolyBoundary(p, k.polygon) < clearance)
      || k.polygon.some((p) => distToPolyBoundary(p, c.polygon) < clearance));
    if (!near) kept.push(c);
  }
  return kept;
}

/**
 * Turn a small block into ONE building (GG-546). A block too small to cut
 * into lots is a single house in a real town, not a garden in the middle of
 * the fabric. The block's longest edge becomes the street frontage.
 */
function blockAsBuilding(block: Pt[]): BuildingPlot {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < block.length; i++) {
    const L = len(block[i], block[(i + 1) % block.length]);
    if (L > bestLen) { bestLen = L; best = i; }
  }
  const polygon = [...block.slice(best), ...block.slice(0, best)].map((p) => [p[0], p[1]] as Pt);
  return { polygon, frontageEdge: best, kind: 'frontage', shape: 'wedge' };
}

/**
 * Share of a block's short span one row of deep lots may take (GG-545).
 * Two rows facing each other then leave a back court about 40% across in
 * every block. Without it the deep rows covered whole blocks and the
 * shared courts (court-facing houses and their amenities) vanished from
 * every town; Watabou blocks keep an open yard in the middle too.
 */
export const DEEP_ROW_SHARE = 0.3;

/**
 * Row share for a block whose houses stand behind front gardens (GG-564).
 * The garden takes the front of each lot, so the rows run deeper and the
 * back court is smaller. Without it most lots in a small wealthy block were
 * too shallow for a garden and a house, and only 16% of a city's wealthy
 * houses got one.
 */
export const GARDEN_ROW_SHARE = 0.45;

/**
 * Row depth, in feet, that a thin block may always reach (GG-563): a 16 ft
 * house plus a little yard. At 30 ft the rows of a medium block met in its
 * middle and closed every back court (Hafting kept 7 of 14 court houses).
 */
export const THIN_BLOCK_ROW_FT = 20;

/**
 * How far off a straight line a block corner may stand and still merge into
 * one longer street edge, in feet (GG-563 block shapes, `simplifyConvexCorners`).
 */
export const BLOCK_STRAIGHTEN_FT = 4;

/**
 * THE OLDER CORE (GG-577; Remy did not answer the courts question, so the
 * recommended default "bring some back" was taken). Within this share of the
 * walled town's mean radius round the market, the ward grid is half as dense
 * each way, so the old blocks are twice as wide and keep a shared court ringed
 * by square houses.
 */
export const OLD_CORE_SHARE = 0.55;

/** Nominal court-house width in feet; the court packer builds at 0.6 to 0.85 of it (GG-563). */
export const COURT_HOUSE_FT = 25;

/** Length over depth of a town block on the ward grid (GG-563 block shapes). */
export const BLOCK_ASPECT = 1.6;
/**
 * Ward sites on the grid per ward the population asks for (GG-563 block
 * shapes). Smaller blocks give more street front, and every lot on it can
 * hold a square house: at 1.6, Hafting keeps 366 houses where 1.0 kept 297.
 */
export const BLOCK_GRID_DENSITY = 1.6;
/** Share of a grid cell a ward site may move, so blocks are not all alike. */
export const BLOCK_JITTER = 0.3;

/** True when two non-adjacent edges of a ring cross. */
function selfCrosses(poly: Pt[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // these two share vertex 0
      if (segIntersectPoint(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Civic building size as a share of its block's short side, by kind. */
const CIVIC_SIZE: Record<'temple' | 'keep' | 'citadel', number> = { temple: 0.3, keep: 0.4, citadel: 0.5 };

/**
 * The square a temple, keep or citadel occupies at its ward's center. Moved
 * out of the ward pass (town-look, 2026-10-31) so the deep-lot rows can stop
 * short of it before the civic structure is pushed.
 */
function civicSquareFor(role: 'temple' | 'keep' | 'citadel', block: Pt[], center: Pt): Pt[] {
  const b = polygonBounds(block);
  const span = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  // A keep is a habitable stronghold, not a ten-foot-wide three-floor pole.
  // The existing civic-priority pass reserves its ground before houses.
  const preferredSize = Math.max(role === 'keep' || role === 'citadel' ? 40 : 25, span * CIVIC_SIZE[role] * 2);
  let size = preferredSize;
  while (size > 5 && !squareAt(center, size).every(p => pointInPolygon(p, block))) size -= 5;
  // Still too big at the 5-unit floor (a tiny schematic plan, or a crowded
  // capital whose wall now encloses only its old town): keep halving until
  // the square fits its own block, so it cannot spill into the next civic
  // ward and be dropped by the de-overlap pass.
  while (size > 0.5 && !squareAt(center, size).every(p => pointInPolygon(p, block))) size /= 2;
  return squareAt(center, size);
}

/** A block at least this many feet across keeps a shared court (GG-577). */
export const COURT_BLOCK_FT = 80;
/** Open width the rows of a court block leave in its middle, in feet (GG-577). */
export const COURT_SPAN_FT = 50;
/** Court-house size: at most this wide and this deep, in feet (GG-577). */
export const COURT_HOUSE_MAX_W_FT = 24;
export const COURT_HOUSE_DEPTH_FT = 16;
/** Open ground a court keeps in its middle, in feet (GG-577). */
export const COURT_OPEN_FT = 18;

/**
 * A SHARED COURT RINGED BY SQUARE HOUSES (GG-577). The rows of a court block
 * stop `rowDepth` from its streets; the ground they leave is the court. Up to
 * four square court houses stand against its longest sides, backs to the
 * rows, so the middle stays open for the well, wash-yard or work-yard. A court
 * needs two houses at least, or it is just a yard. The general court packer
 * (`packWardInterior`) made 0 to 3 houses even in a 138 ft block, and the rows
 * covered most of them.
 */
function courtRingHouses(block: Pt[], rowDepth: number, unit: (ft: number) => number): BuildingPlot[] {
  const court = insetByHalfPlanes(block, () => rowDepth);
  if (!court || court.length < 3) return [];
  const c = polygonCentroid(court);
  const middle = polygonCentroid(block);
  const edges = court
    .map((a, i) => ({ a, b: court[(i + 1) % court.length] }))
    .map((e) => ({ ...e, L: len(e.a, e.b) }))
    .sort((p, q) => q.L - p.L);
  // The middle keeps COURT_OPEN_FT of open ground; a house shallower than
  // 12 ft is no house, so a court too small for both is no court.
  const depth = Math.min(unit(COURT_HOUSE_DEPTH_FT), (blockShortSpan(court) - unit(COURT_OPEN_FT)) / 2);
  if (depth < unit(MIN_HOUSE_WIDTH_FT)) return [];
  const out: BuildingPlot[] = [];
  for (const e of edges.slice(0, 4)) {
    const w = Math.min(unit(COURT_HOUSE_MAX_W_FT), e.L * 0.5);
    if (w < unit(MIN_HOUSE_WIDTH_FT) || e.L < 1e-9) continue;
    const u: Pt = [(e.b[0] - e.a[0]) / e.L, (e.b[1] - e.a[1]) / e.L];
    let n: Pt = [-u[1], u[0]];
    const mid: Pt = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    if ((c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] < 0) n = [u[1], -u[0]];
    const p0: Pt = [mid[0] - u[0] * w / 2, mid[1] - u[1] * w / 2];
    const p1: Pt = [mid[0] + u[0] * w / 2, mid[1] + u[1] * w / 2];
    // As deep as the open middle allows: the house stays half the open width
    // from the block's center, which is where the court record looks.
    let d = depth;
    const houseAt = (dd: number): Pt[] => [p0, p1, [p1[0] + n[0] * dd, p1[1] + n[1] * dd], [p0[0] + n[0] * dd, p0[1] + n[1] * dd]];
    while (d >= unit(MIN_HOUSE_WIDTH_FT) && (pointInPolygon(middle, houseAt(d)) || distToPolyBoundary(middle, houseAt(d)) < unit(COURT_OPEN_FT) / 2)) d -= unit(1);
    if (d < unit(MIN_HOUSE_WIDTH_FT)) continue;
    const poly = houseAt(d);
    // Inside the court (tested 2% in from the house's own sides).
    const pc = polygonCentroid(poly);
    if (!poly.every((p) => pointInPolygon([pc[0] + (p[0] - pc[0]) * 0.98, pc[1] + (p[1] - pc[1]) * 0.98], court))) continue;
    if (out.some((o) => polygonsIntersect(o.polygon, poly))) continue;
    out.push({ polygon: poly, frontageEdge: -1, kind: 'interior', shape: 'rect', courtyardIndex: 0 });
  }
  return out.length >= 2 ? out : [];
}

/** Grounds margin round each civic building, in feet (GG-566). */
export const CIVIC_GROUNDS_FT: Record<'temple' | 'keep' | 'citadel', number> = { temple: 30, keep: 25, citadel: 35 };
/**
 * Radius kept clear of the ward grid round each civic seat, in feet (GG-563
 * block shapes). A Voronoi cell reaches about half way to its nearest
 * neighbor site, so the seat's ward is about this wide: room for the
 * building, its grounds and its streets.
 */
export const CIVIC_SEAT_FT: Record<'temple' | 'keep' | 'citadel', number> = { temple: 140, keep: 140, citadel: 180 };
/**
 * Least clearance round the market point, in feet, by size class (GG-586).
 * No scattered ward site stands nearer, so the market ward is at least about
 * this big. A ward span sized the square before, and a city's wards are
 * smaller than a walled town's: city squares came out 6,000 to 11,000 sq ft,
 * too small for the market hall a city's market holds. A square that was
 * already bigger keeps its size (the larger of the two clearances wins). A
 * capital takes the city's floor: without one, Borieborum's square (a river
 * cuts its old core) was 9,473 sq ft with 2 stalls; with 160 ft the sampled
 * capitals' squares are 26,000 to 40,000 sq ft.
 */
export const MARKET_SEAT_FT: Partial<Record<TownTypology, number>> = { 'walled town': 120, city: 160, capital: 160 };
/** Full width of the approach to each civic building, in feet (GG-566). */
export const CIVIC_APPROACH_FT: Record<'temple' | 'keep' | 'citadel', number> = { temple: 12, keep: 12, citadel: 14 };
/** Depth of the forecourt before a civic door, in feet (GG-566). */
export const CIVIC_FORECOURT_FT = 24;
/** Full width of a passage to a back court, in feet (GG-565). */
export const PASSAGE_FT = 6;

/** A civic building's layout before the de-overlap pass decides whether it stays. */
interface CivicDraft {
  wardIndex: number;
  civicKind: 'temple' | 'keep' | 'citadel';
  building: Pt[];
  center: Pt;
  face: Pt;
  halfSize: number;
  grounds: Pt[];
  forecourt: Pt[];
  approach: Pt[];
  approachWidth: number;
}

/**
 * THE GROUNDS OF A TEMPLE, KEEP OR CITADEL (GG-566). The building faces its
 * best street: the ward edge with the widest street, the nearest of equals.
 * It stands at the ward's middle, square to that street, with a margin of
 * grounds round it that the deep lot rows may not enter, a forecourt before
 * its door, and an approach from the door straight out to the street. The
 * building shrinks, as `civicSquareFor` does, until it and half its margin
 * fit inside the block.
 */
function draftCivic(
  role: 'temple' | 'keep' | 'citadel',
  wardIndex: number,
  ward: Pt[],
  block: Pt[],
  center: Pt,
  halfAt: (a: Pt, b: Pt) => number,
  unit: (ft: number) => number,
): CivicDraft {
  // The best street: widest first, then nearest. A foot near a corner is
  // pulled toward the middle of its edge so the way does not meet a junction.
  let bestE = 0, bestHalf = -Infinity, bestD = Infinity;
  for (let e = 0; e < ward.length; e++) {
    const a = ward[e], b = ward[(e + 1) % ward.length];
    if (len(a, b) < 1e-9) continue;
    const h = halfAt(a, b);
    const d = Math.sqrt(segDist2(center, a, b));
    if (h > bestHalf + 1e-9 || (Math.abs(h - bestHalf) <= 1e-9 && d < bestD)) { bestE = e; bestHalf = h; bestD = d; }
  }
  const ea = ward[bestE], eb = ward[(bestE + 1) % ward.length];
  const L2 = dist2(ea, eb) || 1;
  const tRaw = ((center[0] - ea[0]) * (eb[0] - ea[0]) + (center[1] - ea[1]) * (eb[1] - ea[1])) / L2;
  const t = Math.max(0.2, Math.min(0.8, tRaw));
  const foot: Pt = [ea[0] + (eb[0] - ea[0]) * t, ea[1] + (eb[1] - ea[1]) * t];
  const fl = len(center, foot) || 1;
  const face: Pt = [(foot[0] - center[0]) / fl, (foot[1] - center[1]) / fl];

  const margin = unit(CIVIC_GROUNDS_FT[role]);
  const b = polygonBounds(block);
  const span = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  const inside = (poly: Pt[]): boolean => poly.every((p) => pointInPolygon(p, block));
  let size = Math.max(role === 'keep' || role === 'citadel' ? 40 : 25, span * CIVIC_SIZE[role] * 2);
  // The building keeps its size when the block is tight; its grounds are
  // clipped to the block instead. Only a walkway round it must fit.
  const walkway = unit(4);
  while (size > 5 && !inside(orientedRect(center, face, size + 2 * walkway, size + 2 * walkway))) size -= 5;
  while (size > 0.5 && !inside(orientedRect(center, face, size, size))) size /= 2;
  const half = size / 2;
  const building = orientedRect(center, face, size, size);
  const groundsSquare = orientedRect(center, face, size + 2 * margin, size + 2 * margin);
  const grounds = clipPolygon(block, groundsSquare);
  const fd = Math.min(unit(CIVIC_FORECOURT_FT), margin);
  const fcCenter: Pt = [center[0] + face[0] * (half + fd / 2), center[1] + face[1] * (half + fd / 2)];
  const forecourt = clipPolygon(orientedRect(fcCenter, face, size * 0.8, fd), groundsSquare);
  const door: Pt = [center[0] + face[0] * half, center[1] + face[1] * half];
  return {
    wardIndex, civicKind: role, building, center, face, halfSize: half,
    grounds: grounds.length >= 3 ? grounds : groundsSquare,
    forecourt,
    approach: [door, foot],
    approachWidth: unit(CIVIC_APPROACH_FT[role]),
  };
}

/**
 * OPEN A WAY THROUGH THE HOUSES (GG-565, GG-566). A corridor of half width
 * `half` runs from `a` to `b`. A street-front lot it crosses keeps the parts
 * beside the corridor that are still a house (GG-563 shape rule), each with
 * its street edge first; this is the gap or arch between two street houses
 * that old towns used. Any other house it crosses is removed. The plot order
 * is kept, so plot numbers stay stable apart from the houses removed.
 */
function openCorridor(plots: BuildingPlot[], a: Pt, b: Pt, half: number, minW: number, exempt?: BuildingPlot): BuildingPlot[] {
  const L = len(a, b);
  if (L < 1e-9 || !(half > 0)) return plots;
  const v: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const p: Pt = [-v[1], v[0]];
  const quad = pierQuad(a, v, L, half * 2);
  const pa = p[0] * a[0] + p[1] * a[1];
  const out: BuildingPlot[] = [];
  for (const plot of plots) {
    if (plot === exempt || !polygonsIntersect(plot.polygon, quad)) { out.push(plot); continue; }
    if (plot.kind === 'interior' || plot.polygon.length < 3) continue;
    const poly = plot.polygon;
    const p0 = poly[0], p1 = poly[1];
    const fl = len(p0, p1);
    if (fl < 1e-9) continue;
    const u: Pt = [(p1[0] - p0[0]) / fl, (p1[1] - p0[1]) / fl];
    const c = polygonCentroid(poly);
    let n: Pt = [-u[1], u[0]];
    if ((c[0] - p0[0]) * n[0] + (c[1] - p0[1]) * n[1] < 0) n = [u[1], -u[0]];
    const front = n[0] * p0[0] + n[1] * p0[1];
    const bb = polygonBounds(poly);
    const eps = (Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) || 1) * 1e-6 + 1e-9;
    for (const piece of [
      clipHalfPlane(poly, { nx: p[0], ny: p[1], c: pa - half }),
      clipHalfPlane(poly, { nx: -p[0], ny: -p[1], c: -(pa + half) }),
    ]) {
      if (piece.length < 3) continue;
      const ring = lineEdgeFirst(piece, n, front, u, eps * 10);
      if (!ring || !houseShapeOk(ring, minW, MIN_HOUSE_CORNER_DEG)) continue;
      out.push({ ...plot, polygon: ring, shape: 'wedge' });
    }
  }
  return out;
}

/**
 * PASSAGES TO THE BACK COURTS (GG-565, Remy 2026-11-01: "add a passage").
 * A court house stands in the back court of its block, and the street rows
 * closed every one in. Each court house now gets a passage from its own door
 * to the nearest street: an alley between two street houses, or an arch, as
 * old towns reached their back workshops. A house already on a passage (one
 * that runs past within half its width) shares it. The passage avoids the
 * other court houses when any route can; failing that, a house in its way
 * goes. Returns the passages as streets (role `passage`) so every renderer
 * draws them.
 */
function cutCourtPassages(
  wards: TownWard[],
  width: number,
  minW: number,
  blocked: (quad: Pt[]) => boolean,
): TownStreet[] {
  const passages: TownStreet[] = [];
  const half = width / 2;
  wards.forEach((w, wi) => {
    const own: TownStreet[] = [];
    for (const house of w.plots.filter((p) => p.kind === 'interior')) {
      if (!w.plots.includes(house)) continue; // removed by an earlier passage
      if (own.some((s) => house.polygon.some((v) => segDist2(v, s.centerline[0], s.centerline[1]) <= (half * 1.5) ** 2))) continue;
      const start = polygonCentroid(house.polygon);
      // Routes: straight out to the foot on each street, the shortest way
      // from this house. The best crosses the fewest other houses, then is
      // the shortest.
      const options: Array<{ foot: Pt; length: number; crosses: number }> = [];
      for (let e = 0; e < w.polygon.length; e++) {
        const ea = w.polygon[e], eb = w.polygon[(e + 1) % w.polygon.length];
        const L2 = dist2(ea, eb);
        if (L2 < 1e-12) continue;
        const tRaw = ((start[0] - ea[0]) * (eb[0] - ea[0]) + (start[1] - ea[1]) * (eb[1] - ea[1])) / L2;
        const t = Math.max(0.15, Math.min(0.85, tRaw));
        const foot: Pt = [ea[0] + (eb[0] - ea[0]) * t, ea[1] + (eb[1] - ea[1]) * t];
        const L = len(start, foot);
        if (L < 1e-9) continue;
        const quad = pierQuad(start, [(foot[0] - start[0]) / L, (foot[1] - start[1]) / L], L, width);
        if (blocked(quad)) continue;
        const crosses = w.plots.filter((pl) => pl !== house && pl.kind === 'interior' && polygonsIntersect(pl.polygon, quad)).length;
        options.push({ foot, length: L, crosses });
      }
      if (options.length === 0) continue;
      options.sort((x, y) => x.crosses - y.crosses || x.length - y.length);
      const { foot } = options[0];
      w.plots = openCorridor(w.plots, start, foot, half, minW, house);
      own.push({ centerline: [start, foot], tier: 'lane', role: 'passage', width, serves: { wardIndex: wi, court: house.courtyardIndex ?? 0 } });
    }
    passages.push(...own);
  });
  return passages;
}

/** First crossing of the ray `c + t·dir` (t > 0) with a closed ring, or null. */
function rayToRing(c: Pt, dir: Pt, ring: Pt[]): Pt | null {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const det = ex * dir[1] - dir[0] * ey;
    if (Math.abs(det) < 1e-12) continue;
    const acx = a[0] - c[0], acy = a[1] - c[1];
    const t = (ex * acy - ey * acx) / det;
    const u = (dir[0] * acy - dir[1] * acx) / det;
    if (t > 1e-9 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return isFinite(best) ? [c[0] + dir[0] * best, c[1] + dir[1] * best] : null;
}

/** How deep a row from block edge `e` can run before it meets `obstacle`. */
function depthBefore(block: Pt[], e: number, obstacle: Pt[]): number {
  const a = block[e];
  const b = block[(e + 1) % block.length];
  const nrm = inwardNormal(a, b, polygonCentroid(block));
  // Only what stands IN FRONT of this street limits its rows: a corner off
  // to the side (beyond the edge's ends, widened by half a lane) is another
  // street's business. The first version measured every corner and left
  // Hafting's keep block bare.
  const L = len(a, b) || 1;
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  let d = Infinity;
  for (const v of obstacle) {
    const s = (v[0] - a[0]) * ux + (v[1] - a[1]) * uy;
    if (s < 0 || s > L) continue;
    d = Math.min(d, (v[0] - a[0]) * nrm[0] + (v[1] - a[1]) * nrm[1]);
  }
  // A square edge can still cross in front with both corners to the sides.
  const c = polygonCentroid(obstacle);
  const sc = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy;
  if (sc >= 0 && sc <= L) {
    let half = 0;
    for (const v of obstacle) half = Math.max(half, Math.hypot(v[0] - c[0], v[1] - c[1]));
    d = Math.min(d, (c[0] - a[0]) * nrm[0] + (c[1] - a[1]) * nrm[1] - half);
  }
  return d;
}

/**
 * A pier on a ward's water-facing edge `waterEdge` (#4, TG5). The deck
 * reaches SEAWARD: from the ward interior toward the water, refined toward
 * the nearest point on the actual water line, so it stands over the water,
 * not inland as a shed. It starts just shy of the shore edge and part of it
 * overhangs the water. Shared by intramural wards and the suburb band.
 */
function pierFor(polygon: Pt[], centroid: Pt, waterEdge: number, water: Pt[][], maxLen = Infinity): Pt[] {
  const a = polygon[waterEdge];
  const b = polygon[(waterEdge + 1) % polygon.length];
  const wb = polygonBounds(polygon);
  const span = Math.min(wb.maxX - wb.minX, wb.maxY - wb.minY);
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let sx = mid[0] - centroid[0];
  let sy = mid[1] - centroid[1];
  const wp = nearestWaterPoint(mid, water);
  if (wp) { sx = wp[0] - mid[0]; sy = wp[1] - mid[1]; }
  const sl = Math.hypot(sx, sy) || 1;
  sx /= sl; sy /= sl;
  const pierLen = Math.min(span * 0.34, maxLen);
  const pierWidth = span * 0.14;
  // A capped (river) dock starts ON its bank line (GG-561); the others keep
  // their old half-width step inland.
  const back = isFinite(maxLen) ? 0 : pierWidth * 0.5;
  const base: Pt = [mid[0] - sx * back, mid[1] - sy * back];
  return pierQuad(base, [sx, sy], pierLen, pierWidth);
}

/** Short span of a block: about the diameter of its inscribed circle (4A/P). */
function blockShortSpan(block: Pt[]): number {
  let perimeter = 0;
  for (let i = 0; i < block.length; i++) perimeter += len(block[i], block[(i + 1) % block.length]);
  return perimeter > 0 ? (4 * Math.abs(polyArea(block))) / perimeter : 0;
}

/** Length of one main-street block along the street, in feet (GG-567). */
export const MAIN_STREET_BLOCK_FT = 150;
/** How far each pair of main-street ward sites stands off the street, in feet (GG-567). */
export const MAIN_STREET_SITE_FT = 50;

/** The main street a walled town is laid along (GG-567). */
interface MainStreetPlan {
  gate: Pt;
  market: Pt;
  line: Pt[];
  /** Ward sites: the market, then one pair per block, one site each side. */
  sites: Pt[];
  /** A scattered ward site this rejects would break the pairs. */
  exclude: (p: Pt) => boolean;
  /** How far a ward edge may lie from `line` and still be on it. */
  near: number;
}

/**
 * THE MAIN STREET, LAID FIRST (GG-567, Remy 2026-11-01: "missing a logical
 * 'main street' vibe. currently it just snakes aimlessly"). The high street
 * was a shortest path over ward edges from each gate, so it zig-zagged along
 * Voronoi edges. Old towns grew along one road: a fairly straight or gently
 * curved street from the main gate to the market. So the engine now lays that
 * street BEFORE it cuts the wards, and seeds the ward sites in pairs across
 * it, one each side, a block apart. The Voronoi edge between a pair is the
 * line between them, so the wards form round the street. No scattered site
 * may stand near the street or the market, or it would split a pair.
 *
 * The main gate is the gate on the longest road (the road the town grew on);
 * with no road, the first gate. The bend is a gentle curve, at most a tenth
 * of the length off the straight line, its side and size from the seed.
 */
function planMainStreet(
  ring: Pt[],
  gatehouses: Pt[],
  roads: Pt[][],
  footprint: Pt[],
  marketIn: Pt,
  unit: (ft: number) => number,
  physical: boolean,
  wardSpan: number,
  seedPath: SeedPath,
  channel: { rivers: Pt[][]; half: number } | null = null,
  marketClearMin = 0,
): MainStreetPlan | null {
  if (ring.length < 3 || gatehouses.length === 0) return null;
  // The road each gate stands on, by its length inside the town cell.
  const onRoadTol = wardSpan * 0.05;
  const roadLen = (g: Pt): number => {
    let best = -1;
    for (const road of roads) {
      if (polylineDist2(g, road) > onRoadTol * onRoadTol) continue;
      best = Math.max(best, clipPolylineToPolygon(road, footprint).reduce((s, piece) => s + polylineLength(piece), 0));
    }
    return best;
  };
  const d = physical ? unit(MAIN_STREET_SITE_FT) : wardSpan * 0.3;
  const blockLen = physical ? unit(MAIN_STREET_BLOCK_FT) : wardSpan * 0.9;
  const marketClear = Math.max(wardSpan * 0.8, marketClearMin);
  const bend = (fnv1a(`${seedPath}|main-street-bend`) / 0xffffffff - 0.5) * 0.2;
  const layFrom = (gate: Pt): { plan: MainStreetPlan; pairs: number; slots: number } | null => {
    let market: Pt = [marketIn[0], marketIn[1]];
    // GG-561: a market in the river moves out onto this gate's bank.
    if (channel) {
      // A full ward span clear of the river, so the square is not a strip.
      const clear = channel.half + wardSpan;
      if (distToLines(market, channel.rivers) < clear) {
        const q = nearestWaterPoint(market, channel.rivers) ?? market;
        const tan = nearestWaterTangent(market, channel.rivers);
        let nx = -tan[1], ny = tan[0];
        if ((gate[0] - q[0]) * nx + (gate[1] - q[1]) * ny < 0) { nx = -nx; ny = -ny; }
        market = [q[0] + nx * clear, q[1] + ny * clear];
      }
    }
    const L = len(gate, market);
    if (L < wardSpan) return null;
    const ux = (market[0] - gate[0]) / L, uy = (market[1] - gate[1]) / L;
    const ctrl: Pt = [(gate[0] + market[0]) / 2 - uy * L * bend, (gate[1] + market[1]) / 2 + ux * L * bend];
    const n = Math.max(8, Math.ceil(L / (blockLen * 0.25)));
    const line: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const s = k / n, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
      line.push([a * gate[0] + b * ctrl[0] + c * market[0], a * gate[1] + b * ctrl[1] + c * market[1]]);
    }
    const total = polylineLength(line);
    // A short street still gets two blocks: the block shortens to fit.
    const step = Math.max(d * 1.5, Math.min(blockLen, (total - marketClear * 0.75) / 2));
    const keepOff2 = (step / 2) ** 2 + (2 * d) ** 2;
    const sites: Pt[] = [[market[0], market[1]]];
    let pairs = 0, slots = 0;
    const centers: Pt[] = [];
    for (let s = step * 0.5; s < total - marketClear * 0.75; s += step) {
      slots++;
      const { p, t: tan } = pointAt(line, s);
      const pair: Pt[] = [[p[0] - tan[1] * d, p[1] + tan[0] * d], [p[0] + tan[1] * d, p[1] - tan[0] * d]];
      // Both sites or neither: a lone site would bend the street toward it.
      // Only the street point must be in town and out of the river. A site
      // past the wall or in the river still makes the street edge; its ward
      // is clipped to the wall or cut by the river afterward.
      if (pointInPolygon(p, ring) && distToPolyBoundary(p, ring) > d * 0.5
        && (!channel || distToLines(p, channel.rivers) > channel.half + d * 0.5)) { sites.push(...pair); pairs++; centers.push(p); }
    }
    return {
      pairs,
      slots,
      plan: {
        gate, market, line, sites,
        // Only round the pairs placed: where a pair was refused, the scatter
        // fills in, or the market ward would run down the empty strip.
        exclude: (p) => centers.some((c) => dist2(p, c) < keepOff2) || dist2(p, market) < marketClear * marketClear
          || (!!channel && distToLines(p, channel.rivers) < channel.half + d * 0.5),
        near: d * 0.35,
      },
    };
  };
  // The main gate: the gate on the longest road whose street keeps most of
  // its pairs (a river beside the line takes them); failing that, the gate
  // whose street keeps the most. Ties keep the gate order.
  const tries = gatehouses
    .map((g, i) => ({ i, road: roadLen(g), lay: layFrom(g) }))
    .filter((x): x is { i: number; road: number; lay: NonNullable<ReturnType<typeof layFrom>> } => x.lay !== null);
  if (tries.length === 0) return null;
  const good = (x: (typeof tries)[number]): boolean => x.lay.slots > 0 && x.lay.pairs / x.lay.slots >= 0.6;
  tries.sort((x, y) => Number(good(y)) - Number(good(x)) || y.road - x.road || y.lay.pairs - x.lay.pairs || x.i - y.i);
  return tries[0].lay.plan;
}

/**
 * Weld ward corners closer than `tol` into one (GG-567). Where four cells
 * meet almost at one point, as they do at each block of the main street,
 * Voronoi gives two corners a hair apart and a tiny edge between them, a
 * jog of a few inches at a sharp angle in the street. Every ward snaps each
 * corner to the first corner seen within `tol`, so neighbors still share
 * their edges exactly. A ring that would fall under three corners is kept.
 */
function weldWardCorners(polys: Pt[][], tol: number): Pt[][] {
  const reps: Pt[] = [];
  const grid = new Map<string, number[]>();
  const cell = Math.max(tol, 1e-9);
  const snap = (p: Pt): Pt => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const ri of grid.get(`${gx + dx},${gy + dy}`) ?? []) if (len(reps[ri], p) <= tol) return reps[ri];
    }
    reps.push([p[0], p[1]]);
    const k = `${gx},${gy}`;
    grid.set(k, [...(grid.get(k) ?? []), reps.length - 1]);
    return reps[reps.length - 1];
  };
  return polys.map((poly) => {
    const out: Pt[] = [];
    for (const p of poly) {
      const q = snap(p);
      if (out.length && out[out.length - 1] === q) continue;
      out.push(q);
    }
    while (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out.length >= 3 ? out.map((q) => [q[0], q[1]] as Pt) : poly;
  });
}

/**
 * A ROAD THAT STOPS SHORT OF THE WALL RUNS ON TO IT (GG-582). A world road
 * ends at its town's center, and a river town's center usually lies in its
 * river. Kept to a bank, such a road can end just outside the wall without
 * ever crossing it (Jarkkite, burg 20 of world 903674813, had no gate on its
 * west road). A road that
 * never crosses the ring and ends within 15% of the ring's span of it
 * runs on to the nearest DRY ring point (`dry`, as for a top-up gate), or to
 * a gate already within the gate spacing, and a gate stands there. Changes
 * `walls.gatehouses` in place.
 */
function roadsReachWall(roads: Pt[][], walls: TownWalls, dry: (p: Pt) => boolean): Pt[][] {
  const ring = walls.ring;
  const b = polygonBounds(ring);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const minSpacing = span * 0.08; // as `buildWalls`
  // The ring sampled finely, so the nearest dry point is found to within a
  // small share of the span.
  const step = span * 0.005;
  const ringPts: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    const n = Math.max(1, Math.ceil(len(a, c) / step));
    for (let k = 0; k < n; k++) ringPts.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n]);
  }
  const nearestOnRing = (p: Pt): { q: Pt; d: number } => {
    let best = { q: ring[0], d: Infinity };
    for (const q of ringPts) {
      const d = len(p, q);
      if (d < best.d && dry(q)) best = { q, d };
    }
    return best;
  };
  const crossesRing = (road: Pt[]): boolean => {
    for (let s = 0; s < road.length - 1; s++) {
      for (let e = 0; e < ring.length; e++) if (segIntersectPoint(road[s], road[s + 1], ring[e], ring[(e + 1) % ring.length])) return true;
    }
    return false;
  };
  return roads.map((road) => {
    if (road.length < 2 || crossesRing(road)) return road;
    for (const atEnd of [true, false]) {
      const end = atEnd ? road[road.length - 1] : road[0];
      if (pointInPolygon(end, ring)) continue;
      const hit = nearestOnRing(end);
      if (hit.d > span * 0.15) continue;
      const shared = walls.gatehouses.find((g) => len(g, hit.q) < minSpacing);
      const gate: Pt = shared ?? hit.q;
      if (!shared) walls.gatehouses.push(gate);
      return atEnd ? [...road, gate] : [gate, ...road];
    }
    return road;
  });
}

/**
 * The river lines a town road keeps off, and how far (GG-582): half the
 * river's width at the town plus `ROAD_RIVER_CLEAR_FT`, in plan units. The
 * world roads are moved before they reach the engine (`townRoadCourseCanon`,
 * the rule the region tier shares); this reach serves what the town makes
 * itself, its top-up gates and its field tracks. A gate needs less: it stands
 * anywhere out of the water (`gateClear`, half the river's width), as a
 * gatehouse at the water's edge does. Null without physical scale or without
 * a river.
 */
function riverRoadReach(opts: GenerateTownOptions): { rivers: Pt[][]; clear: number; gateClear: number } | null {
  const fpu = opts.feetPerUnit;
  const coast = new Set(opts.coast ?? []);
  const rivers = opts.bridgeWater ?? (opts.water ?? []).filter((l) => !coast.has(l));
  if (!fpu || fpu <= 0 || !opts.waterWidth || opts.waterWidth <= 0 || rivers.length === 0) return null;
  return { rivers, clear: opts.waterWidth / 2 + ROAD_RIVER_CLEAR_FT / fpu, gateClear: opts.waterWidth / 2 };
}

/**
 * SP-T: parent cell → organic town CORE inside it → Voronoi wards (via the SP1
 * engine) → party-wall frontage plots + civic anatomy + walls; the ring between
 * the core and the cell edge becomes farmland/pasture/scrub outskirts. The town
 * lives inside the cell but does not adhere to its exact shape.
 *
 * An UNWALLED settlement takes the lane-village path instead (GG-548, Remy's
 * town-look ruling: walls mean wards, no walls means lanes).
 */
export function generateTownPlan(
  footprint: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): TownPlan {
  // GG-582: the world roads come in already on a bank (`townRoadCourseCanon`
  // with the river's reach). Top-up gates and field tracks keep this far off
  // the river too.
  const riverReach = riverRoadReach(opts);
  // Population (if given) drives the typology profile: ward count, walls, and
  // which civic structures appear (hamlet → capital + citadel). Criterion #5.
  const profile = opts.population != null ? scaleProfile(opts.population) : null;
  const wardCount = opts.wardCount ?? profile?.wardCount ?? 12;
  const fpb = polygonBounds(footprint);
  const fpSpan = Math.max(fpb.maxX - fpb.minX, fpb.maxY - fpb.minY) || 1;
  // Organic town core INSIDE the cell — the town doesn't adopt the cell's shape.
  // The built town (wards/walls/buildings) lives within this blob; the ring out
  // to the cell edge becomes outskirts (farm/pasture/scrub).
  // GG-547: a port's core runs out to its shore, so the coast feeds it.
  const cellCenter = polygonCentroid(footprint);
  const quay = opts.feetPerUnit && opts.feetPerUnit > 0 ? QUAY_WIDTH_FT / opts.feetPerUnit : fpSpan * 0.015;
  const core = buildTownCore(footprint, cellCenter, coreFracFor(profile), seedPath, 28, opts.coast ?? [], quay * 2);
  if (profile && !profile.hasWalls) {
    return generateLaneVillagePlan(footprint, seedPath, opts, profile, core, cellCenter, fpSpan);
  }
  // Walls: for a walled town the wall RING is the build envelope — wards (and
  // therefore every building) are carved INSIDE it. The core→ring band is the
  // extramural margin. Unwalled settlements build out to the core edge.
  // Gates are seated on the ROADS that arrive (see buildWalls): a gatehouse
  // marks where a real approach crosses the rampart, not an arbitrary long edge.
  //
  // A CROWDED TOWN HAS OUTGROWN ITS WALLS (GG-544, town-look 2026-10-31). The
  // core is the whole built-up extent. The wall used to sit at 94% of it in
  // every town, which left a capital only a thin band of land outside the
  // wall: no room for the suburbs the benchmark shows (about half of all
  // buildings). Now the ring encloses the OLD town: the more crowded the core
  // (people against its ground, the `wallFill` scale), the further in the wall
  // sits — 94% of the core radius when the town rattles around in it, 70% when
  // it is full — and the band between becomes suburb blocks.
  const crowd = profile ? wallFill(profile.population, Math.abs(polyArea(core)) * 0.94 * 0.94, fpSpan) : 0;
  const walls = !profile || profile.hasWalls
    ? buildWalls(core, 3, opts.roads ?? [], 0.94 - 0.24 * crowd, riverReach ? (p) => distToLines(p, riverReach.rivers) >= riverReach.gateClear : undefined)
    : { ring: [], gatehouses: [], waterGates: [] };
  // GG-582: a world road kept to a bank can stop just short of the wall where
  // the town's center lies in the river; it runs on to the wall at a gate.
  if (riverReach && walls.ring.length >= 3) opts = { ...opts, roads: roadsReachWall(opts.roads ?? [], walls, (p) => distToLines(p, riverReach.rivers) >= riverReach.gateClear) };
  const envelope = walls.ring.length >= 3 ? walls.ring : core;
  // Reuse SP1's clip-to-parent Voronoi tessellation to carve the envelope into
  // wards — the town is itself a submap, one tier deeper than the local map.
  // THE MAIN STREET FIRST (GG-567): its paired sites go in before the
  // scatter, which keeps clear of it. The total ward count stays the same.
  const ebPre = polygonBounds(envelope);
  const wardSpanPre = (Math.max(ebPre.maxX - ebPre.minX, ebPre.maxY - ebPre.minY) || 1) / Math.sqrt(Math.max(1, wardCount));
  const sizingPre = townSizing(opts, opts, wardSpanPre);
  // THE RIVER CHANNEL (GG-561): the river's own width plus a bank each side.
  const coastLines = new Set(opts.coast ?? []);
  const riverLines = opts.bridgeWater ?? (opts.water ?? []).filter((l) => !coastLines.has(l));
  const channel = opts.waterWidth && opts.waterWidth > 0 && riverLines.length > 0
    ? { rivers: riverLines, half: opts.waterWidth / 2 + sizingPre.unit(RIVER_BANK_FT) }
    : null;
  const mainStreet = walls.ring.length >= 3 && (!profile || profile.hasPlaza)
    ? planMainStreet(walls.ring, walls.gatehouses, opts.roads ?? [], footprint, polygonCentroid(envelope), sizingPre.unit, sizingPre.physical, wardSpanPre, seedPath, channel,
      // GG-586: a floor on the market's size, for a plan at true scale only,
      // and never more than a fifth of the walled area across.
      sizingPre.physical && profile ? Math.min(sizingPre.unit(MARKET_SEAT_FT[profile.typology] ?? 0), Math.max(ebPre.maxX - ebPre.minX, ebPre.maxY - ebPre.minY) * 0.2) : 0)
    : null;
  // The wards: Voronoi cells of the envelope, the river channel cut out of
  // them. `seats` are extra forced sites and `keepClear` keeps the grid off
  // them (the civic seats below); the first cut has none.
  const cutWards = (seats: Pt[], keepClear: (p: Pt) => boolean): { wardPolys: Pt[][]; riverLinks: RiverLink[] } => {
    const model = generateSubmap({ polygon: envelope, seedPath }, mainStreet
      ? {
        count: Math.max(4, Math.round(wardCount * BLOCK_GRID_DENSITY) - mainStreet.sites.length - seats.length),
        forcedSites: [...mainStreet.sites, ...seats],
        exclude: (p) => mainStreet.exclude(p) || keepClear(p),
        // GG-563 block shapes: the wards on a grid turned to the main street,
        // so blocks come out near-rectangular and hold square houses.
        lattice: {
          angle: Math.atan2(mainStreet.market[1] - mainStreet.gate[1], mainStreet.market[0] - mainStreet.gate[0]),
          aspect: BLOCK_ASPECT,
          jitter: BLOCK_JITTER,
          // GG-577: the older core round the market keeps blocks twice as
          // wide, so they hold shared courts again.
          coarse: { center: mainStreet.market, radius: OLD_CORE_SHARE * Math.sqrt(Math.abs(polyArea(envelope)) / Math.PI) },
        },
      }
      : { count: wardCount });
    let polys = mainStreet
      ? weldWardCorners(model.cells.map((c) => c.polygon), sizingPre.laneWidth * 0.75)
      : model.cells.map((c) => c.polygon);
    // THE RIVER OUT OF THE TOWN (GG-561, Remy 2026-11-01: "why are these docks
    // in the middle of the river?"). Each ward the channel crosses splits along
    // the two bank lines, and the pieces in the water go, so the banks become
    // ward edges (see townRiverCut.ts). Before this, at Borieborum 120 of 1,995
    // buildings had their center in the river and all six docks stood within
    // 7 ft of its center line. A street that crossed the river now stops at each
    // bank; those bank ends are the LINKS a bridge may join.
    let links: RiverLink[] = [];
    if (channel) {
      const cut = cutRiverChannel(polys, channel.rivers, channel.half, (sizingPre.laneWidth * 2) ** 2, fpSpan);
      polys = cut.polys;
      const tol = wardSpanPre * 1e-4;
      const onWard = (p: Pt): boolean => polys.some((poly) => poly.some((q) => Math.abs(q[0] - p[0]) <= tol && Math.abs(q[1] - p[1]) <= tol));
      links = cut.links.filter((l) => onWard(l.a) && onWard(l.b));
    }
    return { wardPolys: polys, riverLinks: links };
  };
  const townCenter = polygonCentroid(envelope);
  const req: CivicRoleRequest = profile
    ? { plaza: profile.hasPlaza, temple: profile.hasTemple, keep: profile.hasKeep, citadel: profile.hasCitadel }
    : { plaza: true, temple: true, keep: true };
  // Swap `kind` onto ward `at`, moving any role there to the ward it leaves.
  const seatRole = (roles: Map<number, CivicKind>, at: number, kind: CivicKind): void => {
    const was = [...roles].find(([, r]) => r === kind)?.[0];
    if (at < 0 || was === undefined || at === was) return;
    const displaced = roles.get(at);
    roles.delete(was);
    if (displaced) roles.set(was, displaced);
    roles.set(at, kind);
  };
  const assignRoles = (polys: Pt[][], centroids: Pt[]): Map<number, CivicKind> => {
    const roles = assignCivicRoles(centroids, townCenter, req);
    // The market stands where the main street ends (GG-567).
    if (mainStreet && req.plaza) {
      // The ward that holds the market point; when the river cut or a street
      // gap took that point, the ward whose middle is nearest it.
      // A sliver (a piece the river cut, say) is no market square.
      // A strip (the land between the wall and the river, say) is none either.
      // And the square must survive its own market frontage (28 ft) inset.
      const frontHalf = sizingPre.laneWidth * TIER_WIDTH_RATIO.plaza / 2;
      const roomy = (i: number): boolean => {
        if (Math.abs(polyArea(polys[i])) < (wardSpanPre * 0.6) ** 2 || blockShortSpan(polys[i]) < wardSpanPre * 0.5) return false;
        const square = insetByHalfPlanes(polys[i], () => frontHalf);
        return !!square && Math.abs(polyArea(square)) >= (wardSpanPre * 0.3) ** 2;
      };
      let at = polys.findIndex((p, i) => roomy(i) && pointInPolygon(mainStreet.market, p));
      if (at < 0) {
        for (let i = 0; i < polys.length; i++) {
          if (roomy(i) && (at < 0 || dist2(centroids[i], mainStreet.market) < dist2(centroids[at], mainStreet.market))) at = i;
        }
      }
      seatRole(roles, at, 'plaza');
    }
    // Peripheral slivers cannot contain a keep. Prefer the outermost unclaimed
    // ward that can reserve a forty-foot square before the street setback.
    // Tiny schematic towns retain the historical placement when none can fit.
    for (const kind of ['keep', 'citadel'] as const) {
      const current = [...roles].find(([, role]) => role === kind)?.[0];
      if (current === undefined) continue;
      const candidates = polys.map((polygon, index) => ({ polygon, index }))
        .filter(({ polygon, index }) => (!roles.has(index) || index === current)
          && squareAt(centroids[index], 40).every(p => pointInPolygon(p, polygon)))
        .sort((a, b) => dist2(centroids[b.index], townCenter) - dist2(centroids[a.index], townCenter));
      if (candidates.length) { roles.delete(current); roles.set(candidates[0].index, kind); }
    }
    return roles;
  };
  let { wardPolys, riverLinks } = cutWards([], () => false);
  let wardCentroids = wardPolys.map(polygonCentroid);
  let roles = assignRoles(wardPolys, wardCentroids);
  // CIVIC SEATS BEFORE THE HOUSES (GG-563 block shapes). The ward grid makes
  // smaller blocks, and a temple or keep in a small block shrank to an 11 ft
  // square at Borieborum. So the first cut only says WHERE each civic
  // building goes; the wards are then cut again with a site at each of those
  // points and the grid kept clear round it (`CIVIC_SEAT_FT` across), so each
  // gets a ward big enough for its building and its grounds.
  if (mainStreet) {
    const seats = [...roles]
      .filter(([, r]) => r === 'temple' || r === 'keep' || r === 'citadel')
      .map(([i, r]) => ({ kind: r as 'temple' | 'keep' | 'citadel', at: wardCentroids[i] }));
    if (seats.length > 0) {
      const clear = (p: Pt): boolean => seats.some((s) => dist2(p, s.at) < Math.min(sizingPre.unit(CIVIC_SEAT_FT[s.kind]), wardSpanPre * 0.9) ** 2);
      ({ wardPolys, riverLinks } = cutWards(seats.map((s) => s.at), clear));
      wardCentroids = wardPolys.map(polygonCentroid);
      roles = assignCivicRoles(wardCentroids, townCenter, req);
      const plazaAt = assignRoles(wardPolys, wardCentroids);
      seatRole(roles, [...plazaAt].find(([, r]) => r === 'plaza')?.[0] ?? -1, 'plaza');
      for (const s of seats) seatRole(roles, wardPolys.findIndex((p) => pointInPolygon(s.at, p)), s.kind);
    }
  }
  // BRIDGES ON THE LINKS (GG-560, GG-561). A bridge is a street across the
  // river. The main street's crossing comes first, then the crossings
  // nearest the town center, a ward span apart; a crossing more oblique than
  // about 37 degrees off square is not built. Even a town allowed no bridge
  // gets one when the river cuts it in two, or half the town has no way in.
  const bridgeLinks: RiverLink[] = [];
  if (channel && riverLinks.length > 0) {
    const midOf = (l: RiverLink): Pt => [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2];
    const ranked = riverLinks
      .map((l) => {
        const mid = midOf(l);
        const tan = nearestWaterTangent(mid, channel.rivers);
        const L = len(l.a, l.b) || 1;
        const sin = Math.abs(((l.b[0] - l.a[0]) / L) * tan[1] - ((l.b[1] - l.a[1]) / L) * tan[0]);
        const onMain = !!mainStreet && Math.sqrt(polylineDist2(mid, mainStreet.line)) < wardSpanPre * 0.5;
        return { l, mid, sin, onMain, d2: dist2(mid, townCenter) };
      })
      .filter((r) => r.sin >= 0.6)
      .sort((x, y) => Number(y.onMain) - Number(x.onMain) || x.d2 - y.d2);
    const cap = Math.max(1, bridgeCapForTypology(profile?.typology));
    for (const r of ranked) {
      if (bridgeLinks.length >= cap) break;
      if (bridgeLinks.some((k) => dist2(midOf(k), r.mid) < wardSpanPre * wardSpanPre)) continue;
      bridgeLinks.push(r.l);
    }
  }

  // Terrain/water inputs (#4): inherited rivers/coast → docks + bridges.
  const water = opts.water ?? [];
  // Bridgeable water defaults to all water, so existing callers keep their
  // behaviour; canonicalTown narrows it to rivers.
  const bridgeWater = opts.bridgeWater ?? water;
  const waterMargin = opts.waterMargin ?? Math.max(fpSpan * 0.05, channel ? channel.half + sizingPre.laneWidth : 0);
  // Default plot dimensions SCALE TO THE FOOTPRINT when not given, so a town
  // fills regardless of the absolute coord scale it's generated at (e.g. a tiny
  // burg sub-cell from the live drill vs a large standalone footprint). Without
  // this, absolute defaults can exceed ward-edge lengths → zero buildings.
  //
  // Plots scale to the WARD, not the whole footprint: denser towns have more, and
  // therefore smaller, wards, so footprint-relative plots would be huge in a tiny
  // ward → few buildings that mostly collide. A characteristic ward span (the
  // footprint tiled into `wardCount` cells ≈ fpSpan/√wardCount) keeps buildings
  // proportional to their ward, so coverage stays consistent and total building
  // count scales UP with ward count (hamlet < … < capital).
  // Ward span is measured over the BUILD ENVELOPE (the core), since wards now
  // tessellate the core rather than the whole cell — keeps buildings proportioned.
  const eb = polygonBounds(envelope);
  const coreSpan = Math.max(eb.maxX - eb.minX, eb.maxY - eb.minY) || 1;
  const wardSpan = coreSpan / Math.sqrt(Math.max(1, wardCount));
  const packOpts: GenerateTownOptions = {
    ...opts,
    plotWidth: opts.plotWidth ?? Math.max(2, wardSpan * 0.16),
    plotDepth: opts.plotDepth ?? Math.max(2.5, wardSpan * 0.2),
    gap: opts.gap ?? Math.max(0.4, wardSpan * 0.035),
    partyWallRows: opts.partyWallRows
      ?? (profile?.typology !== 'hamlet' && profile?.typology !== 'village'),
  };
  const sizing = townSizing(opts, packOpts, wardSpan);
  // GG-545 (town-look, Remy's ruling q6 "Watabou grain"): attached-row towns
  // cut every block into deep lots that meet at the block's rear line.
  const deepLots = packOpts.partyWallRows === true;

  // THE STREET NETWORK (roads slice, 2026-08-23). Generated here, before any
  // block is inset, because the streets decide how far each block must step
  // back. Gate-to-heart and gate-to-gate routes are traced over the ward-edge
  // graph and counted, so the busiest lines become avenues and the rest stay
  // back lanes — see townStreetNetwork.ts for the rules.
  //
  // `laneWidth` is the back lane's full width. With a physical scale it is the
  // 3D lane itself (GG-550); a schematic plan keeps the historical share.
  const laneWidth = sizing.laneWidth;
  const streetNetwork = buildStreetNetwork({
    wardPolys,
    wardCivic: wardPolys.map((_, i) => roles.get(i)),
    wallRing: walls.ring,
    gatehouses: walls.gatehouses,
    approachRoads: opts.roads ?? [],
    envelope,
    laneWidth,
    // GG-549: a gate with no road gets a track to the fields.
    fields: { footprint, core, center: cellCenter },
    mainStreet: mainStreet ? { gate: mainStreet.gate, line: mainStreet.line, near: mainStreet.near } : undefined,
    links: bridgeLinks.map((l) => [l.a, l.b] as [Pt, Pt]),
    // GG-582: the main street does not cut a river bend when it drops a corner.
    ...(channel && opts.waterWidth ? { river: { lines: channel.rivers, half: opts.waterWidth / 2 } } : {}),
    // GG-582: a road that shares a gate with another runs to that gate.
    approachesToGates: true,
  });
  // GG-582: a field track keeps to a bank as the world roads do. Its gate end
  // stays where the gate is; the rest moves onto dry ground.
  if (riverReach) {
    for (const st of streetNetwork) {
      if (!st.track) continue;
      const gate = st.centerline[0];
      st.centerline = keepRoadOffRivers(st.centerline, riverReach.rivers.map((line) => ({ line, clear: riverReach.clear })), (p) => p[0] === gate[0] && p[1] === gate[1]);
    }
  }
  // Ward-edge → half-width, keyed on the same quantized endpoints the network
  // used. This is the join that makes the gap the generator leaves EQUAL the
  // ribbon every renderer paints.
  const eb0 = polygonBounds(envelope);
  const envSpan = Math.max(eb0.maxX - eb0.minX, eb0.maxY - eb0.minY) || 1;
  const edgeQuant = Math.max(envSpan * 1e-4, 1e-6);
  const halfWidths = halfWidthByWardEdge(streetNetwork, edgeQuant);
  const halfWidthKey = (a: Pt, b: Pt): string => {
    const ka = `${Math.round(a[0] / edgeQuant)},${Math.round(a[1] / edgeQuant)}`;
    const kb = `${Math.round(b[0] / edgeQuant)},${Math.round(b[1] / edgeQuant)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  // Street margin: each ward shrinks to a buildable BLOCK inset PER EDGE by the
  // half-width of the street on that side, so the gap left between neighbouring
  // blocks is the street network at its true, tiered width. Without this,
  // buildings on either side of a shared ward edge sit back-to-back with no
  // street between them — and, before the per-edge step, an avenue was drawn
  // twice as wide as the gap the generator had actually left for it.
  const blockInset = (poly: Pt[]): Pt[] => {
    // No clamp here on purpose: the network already capped each street against
    // the narrower of the wards it borders. Clamping a SECOND time would make
    // the gap narrower than the ribbon painted over it — the exact drift this
    // slice removes — so the inset takes the network's half-width verbatim.
    const halfAt = (i: number): number =>
      halfWidths.get(halfWidthKey(poly[i], poly[(i + 1) % poly.length])) ?? laneWidth / 2;
    // TRUE inset (real street margin). The old centroid-scale left the block
    // nearly touching the street on off-center wards — buildings in the road.
    // Tiny wards retry at half margin (a narrower but still real street) before
    // the legacy centroid-scale fallback keeps the very smallest buildable.
    // A concave ward can inset to a ring that crosses itself (Hafting's
    // ward 0 zig-zagged), and no lot can be cut from that. Such an inset is
    // rejected like a swallowed one; plain scaling, which can never cross
    // itself, stays the last step.
    //
    // GG-564 (Remy 2026-11-01, "houses cross over the street edge"): the two
    // old fallbacks, a half-margin retry and a plain scale, left blocks that
    // reached into the painted street. At Hafting 42 ward edges took the half
    // margin and 8 the scale, and 77 of 401 houses stood in a road. The
    // fallback is now the exact half-plane inset, which keeps the full street
    // width on every edge. A ward with nothing buildable left gets no block,
    // so its ground stays street; it never gets houses in the road.
    // The full mitred inset stays first, so every ward it handled keeps its
    // block and vertex order exactly.
    const simple = (p: Pt[] | null): Pt[] | null => (p && !selfCrosses(p) ? p : null);
    const inset = simple(insetConvexPolygon(poly, halfAt)) ?? insetByHalfPlanes(poly, halfAt);
    return inset ?? [];
  };

  // DISTRICTS BEFORE LOTS (GG-564). Whether a ward's houses stand behind front
  // gardens depends on its social class, and the lots must know it before they
  // are cut. The class is the one `finishTownPlan` assigns (same anchors, same
  // stream, ward by ward in order), handed on so the two cannot disagree.
  const wealthAnchors: Pt[] = [];
  for (const [wi, role] of roles) {
    if (role === 'plaza') wealthAnchors.push(polygonCentroid(blockInset(wardPolys[wi])));
    else if (role === 'temple' || role === 'keep' || role === 'citadel') wealthAnchors.push(wardCentroids[wi]);
  }
  const wardWealth = assignWardWealth(wardCentroids, wealthAnchors, coreSpan, seedPath);
  const gardenDepth = sizing.unit(FRONT_GARDEN_FT.wealthy);

  const civic: CivicStructure[] = [];
  const civicDrafts: CivicDraft[] = [];
  const wards: TownWard[] = wardPolys.map((polygon, i) => {
    // GG-563 block shapes: near-straight corners merge into longer streets.
    const block = simplifyConvexCorners(blockInset(polygon), sizing.unit(BLOCK_STRAIGHTEN_FT));
    const role = roles.get(i);
    if (role === 'plaza') {
      // Open market square: the BLOCK is the square. The block inset already
      // carved the frontage ring, and at the plaza tier's width that ring is
      // wide. Shrinking the block a further 0.78 on top of it (which this did
      // before the roads slice, when the inset was one narrow uniform margin)
      // double-counted the frontage: on a village the ring came out wider than
      // the market square it was supposed to surround.
      civic.push({ kind: 'plaza', polygon: block, wardIndex: i });
      return { polygon, block, plots: [], civic: 'plaza', wealth: wardWealth[i] };
    }
    const wardSeed = streamPath(seedPath, `ward:${i}`);
    let resolved: BuildingPlot[];
    if (deepLots) {
      // Deep lots tile their block by construction: neighbors share exact
      // side cuts and rear lines (party walls), so the generic overlap test
      // must not run between them. Court infill still yields to them.
      // A THIN BLOCK BUILDS SOLID (GG-563). The row share keeps a back court
      // in a big block, but in a thin one it made rows too shallow for a
      // house. A row may always reach `thinRow` deep; the rear line where two
      // rows meet (the block's middle) still stops it.
      const thinRow = sizing.unit(THIN_BLOCK_ROW_FT);
      const rowCapBase = wardWealth[i] === 'wealthy'
        ? Math.min(sizing.lots.maxDepth + gardenDepth, Math.max(thinRow + gardenDepth, blockShortSpan(block) * GARDEN_ROW_SHARE))
        : Math.min(sizing.lots.maxDepth, Math.max(thinRow, blockShortSpan(block) * DEEP_ROW_SHARE));
      // GG-577: a plain block wide enough keeps a shared court; its rows
      // stop short so the court is at least COURT_SPAN_FT across.
      const courtBlock = sizing.physical && !role && blockShortSpan(block) >= sizing.unit(COURT_BLOCK_FT);
      const rowCap = courtBlock
        ? Math.min(rowCapBase, (blockShortSpan(block) - sizing.unit(COURT_SPAN_FT)) / 2)
        : rowCapBase;
      // A temple, keep or citadel stands in its ward's middle. Each row stops
      // a lane short of it; before this the deep rows reached the building
      // and the civic-clearing pass below deleted every lot that touched it.
      const draft = role === 'temple' || role === 'keep' || role === 'citadel'
        ? draftCivic(role, i, polygon, block, wardCentroids[i], (a, b) => halfWidths.get(halfWidthKey(a, b)) ?? laneWidth / 2, sizing.unit)
        : null;
      if (draft) civicDrafts.push(draft);
      // GG-563 block-shape ruling: rectangle rows, not nearest-street wedges.
      const lots = packBlockSquare(block, wardSeed, {
        ...sizing.lots,
        maxDepth: rowCap,
        // GG-566: the rows stop at the civic grounds, not a lane short of
        // the bare building.
        edgeDepth: draft ? (e) => depthBefore(block, e, draft.grounds) : undefined,
        // Slope-aware (#4): an edge too steep to build along carries no lots.
        edgeAllowed: opts.heightAt && opts.maxGrade != null
          ? (a, b) => Math.abs(opts.heightAt!(b) - opts.heightAt!(a)) / (len(a, b) || 1) <= opts.maxGrade!
          : undefined,
      });
      // The rows stop short of the middle, so every block keeps a back
      // court. The court packer works on the whole block as it always has
      // (it builds only in the block's inner half); a court house that would
      // touch a deep lot yields to it.
      const infill = opts.interiorInfill !== false && courtBlock
        ? courtRingHouses(block, rowCap, sizing.unit).filter((p) => !lots.some((l) => polygonsIntersect(p.polygon, l.polygon)))
        : opts.interiorInfill !== false
        // GG-563 block shapes: a court house is sized in feet (about 15 to
        // 21 ft) where the plan has feet. Sized from the ward span, it no
        // longer fit the smaller grid blocks, and a 12,000-person city kept
        // no shared court at all.
        ? packWardInterior(block, wardSeed, sizing.physical ? { ...packOpts, plotWidth: sizing.unit(COURT_HOUSE_FT) } : packOpts).filter((p) => !lots.some((l) => polygonsIntersect(p.polygon, l.polygon))
          // GG-563: a court house obeys the same shape rule as a lot.
          && houseShapeOk(p.polygon, sizing.lots.minHouseWidth ?? 0, MIN_HOUSE_CORNER_DEG))
        : [];
      resolved = [...lots, ...resolveCollisions(infill)];
      // GG-566: the approach opens a way from the civic door to its street.
      if (draft) resolved = openCorridor(resolved, draft.approach[0], draft.approach[1], draft.approachWidth / 2, sizing.lots.minHouseWidth ?? 0);
    } else {
      const plots = packWardFrontage(block, wardSeed, packOpts);
      // Interior block infill (#6): freestanding buildings in the courtyard core.
      if (opts.interiorInfill !== false) plots.push(...packWardInterior(block, wardSeed, packOpts));
      // Drop buildings that overlap each other (acute-corner frontage collisions +
      // interior squares landing on frontage); frontage is kept over infill.
      resolved = resolveCollisions(plots, packOpts.partyWallRows === true);
    }
    // Street-margin guard: boundary wards inherit slightly CONCAVE edges from
    // the blob core, where the convex inset/clip can under-shoot. Any plot that
    // still ends up hugging the ward edge (= the street centerline) is a
    // building in the road — drop it rather than draw it. The guard is a
    // quarter of the back lane (the historical value on schematic plans).
    const wb2 = polygonBounds(polygon);
    const wspan = Math.max(wb2.maxX - wb2.minX, wb2.maxY - wb2.minY) || 1;
    const guard = Math.min(wspan * 0.5 - 1e-3, laneWidth / 2) * 0.5;
    const plots = resolved.filter((p) =>
      p.polygon.every((v) => distToPolyBoundary(v, polygon) > guard),
    );
    // Waterfront ward → seat a dock on the water-facing edge (#4).
    const waterEdge = wardWaterEdge(polygon, water, waterMargin);
    if (waterEdge != null) {
      // GG-561: a river dock starts at the bank and reaches no further than
      // the bank margin plus 30% of the river's width.
      const a = polygon[waterEdge], b = polygon[(waterEdge + 1) % polygon.length];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const onRiver = !!channel && distToLines(mid, channel.rivers) <= (opts.coast?.length ? distToLines(mid, opts.coast) : Infinity);
      const maxLen = onRiver ? sizing.unit(RIVER_BANK_FT) + (opts.waterWidth ?? 0) * 0.3 : Infinity;
      civic.push({ kind: 'dock', polygon: pierFor(polygon, wardCentroids[i], waterEdge, water, maxLen), wardIndex: i });
    }
    if (role === 'temple' || role === 'keep' || role === 'citadel') {
      const drafted = civicDrafts.find((d) => d.wardIndex === i);
      civic.push({ kind: role, polygon: drafted ? drafted.building : civicSquareFor(role, block, wardCentroids[i]), wardIndex: i });
      return { polygon, block, plots, civic: role, wealth: wardWealth[i] };
    }
    return { polygon, block, plots, civic: waterEdge != null ? 'dock' : undefined, wealth: wardWealth[i] };
  });

  // Cap docks to the principal quays: keep the K nearest actual water (the truest
  // waterfront), K by typology. The other waterfront wards keep their frontage as
  // ordinary buildings. Ward 'dock' flags are reconciled with the survivors after
  // the de-overlap pass below (which may drop a few more docks).
  const dockCap = dockCapForTypology(profile?.typology);
  const dockCivics = civic.filter((c) => c.kind === 'dock');
  if (dockCivics.length > dockCap) {
    const keep = new Set(
      dockCivics
        .map((c) => {
          const ctr = polygonCentroid(c.polygon);
          let d = Infinity;
          for (const line of water) d = Math.min(d, polylineDist2(ctr, line));
          return { c, d };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, dockCap)
        .map((s) => s.c),
    );
    for (let idx = civic.length - 1; idx >= 0; idx--) {
      if (civic[idx].kind === 'dock' && !keep.has(civic[idx])) civic.splice(idx, 1);
    }
  }

  // Water-gates (TG7): where an inherited river crosses the wall ring, mark the
  // arch/gate break so the rampart doesn't render through the river as solid
  // stone. Only meaningful on a walled town (ring present).
  if (walls.ring.length >= 3) {
    walls.waterGates = findWaterGates(walls.ring, water);
  }

  // Bridges where a river crosses between wards (#4). With the channel cut
  // (GG-561) the bridges are the links chosen above, and the old crossing
  // search below finds nothing, since no ward edge crosses the water now.
  const bridgeCap = bridgeCapForTypology(profile?.typology);
  let potentialBridges = channel ? [] : findBridges(bridgeWater, wardPolys, fpSpan / 140);
  if (channel) {
    const linkDecks = bridgeLinks.map((l) => {
      const mid: Pt = [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2];
      const hit = streetAt(mid, streetNetwork, wardSpan);
      return { kind: 'bridge' as const, polygon: linkDeck(l.a, l.b, hit ? hit.street.width : laneWidth, sizing), wardIndex: -1 };
    });
    // Any other town street that crosses the river carries a deck where it
    // crosses: the run from a gate that stands where the wall meets the
    // river, say (Kalg, burg 2, drew its east-gate street over open water).
    const crossDecks: CivicStructure[] = [];
    // GG-582: an approach road and a field track get a deck where they cross
    // too; they used to be skipped, so their crossings were open water.
    for (const st of streetNetwork) {
      const L = st.centerline;
      for (let i = 0; i < L.length - 1; i++) {
        for (const river of channel.rivers) {
          for (let j = 0; j < river.length - 1; j++) {
            const x = segIntersectPoint(L[i], L[i + 1], river[j], river[j + 1]);
            if (!x || linkDecks.some((d) => pointInPolygon(x, d.polygon))) continue;
            const dir: Pt = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
            crossDecks.push({ kind: 'bridge', polygon: bridgeDeck(x, dir, st.width, channel.rivers, opts, fpSpan, sizing), wardIndex: -1 });
          }
        }
      }
    }
    const decks = keepDecksApart([...linkDecks, ...crossDecks], laneWidth);
    civic.push(...decks);
    // A dock never stands on a bridge.
    for (let k = civic.length - 1; k >= 0; k--) {
      if (civic[k].kind === 'dock' && decks.some((d) => polygonsIntersect(d.polygon, civic[k].polygon))) civic.splice(k, 1);
    }
  }

  // A BRIDGE CARRIES A STREET (GG-560). Each crossing point lies on a ward
  // edge, so it lies on a street of the network. The best-paved street wins,
  // then the crossing nearest the town center. Crossings within one ward span
  // of a crossing already chosen are the same crossing; the old pass averaged
  // such a cluster into a point that lay on no street at all.
  const crossings = potentialBridges
    .map((at) => ({ at, hit: streetAt(at, streetNetwork, wardSpan) }))
    .filter((c): c is { at: Pt; hit: { street: TownStreet; dir: Pt } } => c.hit !== null)
    .sort((a, b) => STREET_TIER_ORDER.indexOf(a.hit.street.tier) - STREET_TIER_ORDER.indexOf(b.hit.street.tier)
      || dist2(a.at, townCenter) - dist2(b.at, townCenter));
  const chosen: typeof crossings = [];
  for (const c of crossings) {
    if (chosen.length >= bridgeCap) break;
    if (chosen.some((k) => dist2(k.at, c.at) < wardSpan * wardSpan)) continue;
    chosen.push(c);
  }
  potentialBridges = chosen.map((c) => c.at);

  // Bridge decks SPAN the channel (TG5) along the street they carry, at that
  // street's width plus parapets (see `bridgeDeck`). A deck that touches one
  // already kept is dropped (GG-560).
  civic.push(...keepDecksApart(chosen.map((c) => ({
    kind: 'bridge' as const,
    polygon: bridgeDeck(c.at, c.hit.dir, c.hit.street.width, bridgeWater, opts, fpSpan, sizing),
    wardIndex: -1,
  })), laneWidth));

  // De-overlap solid civic structures: a waterfront keep/temple ward can seat
  // both a dock and its civic building, and adjacent waterfront wards can seat
  // docks that collide. Keep them by priority (citadel > keep > temple > dock),
  // dropping any that intersect an already-kept one. Plazas/bridges are exempt.
  const civicPriority: Record<CivicKind, number> = { citadel: 0, keep: 1, temple: 2, dock: 3, plaza: 9, bridge: 9 };
  const passthrough = civic.filter((c) => c.kind === 'plaza' || c.kind === 'bridge');
  const solidSorted = civic
    .filter((c) => c.kind !== 'plaza' && c.kind !== 'bridge')
    .sort((a, b) => civicPriority[a.kind] - civicPriority[b.kind]);
  const solidCivic: CivicStructure[] = [];
  for (const c of solidSorted) {
    if (!solidCivic.some((o) => polygonsIntersect(c.polygon, o.polygon))) solidCivic.push(c);
  }
  // Rebuild the civic list (kept solids + plazas/bridges).
  civic.length = 0;
  civic.push(...passthrough, ...solidCivic);

  // Reconcile ward 'dock' flags with the surviving dock civics — the dock cap and
  // the de-overlap pass both drop docks, so a ward must not claim a pier it lost.
  const dockWardIdx = new Set(civic.filter((c) => c.kind === 'dock').map((c) => c.wardIndex));
  for (let i = 0; i < wards.length; i++) {
    if (wards[i].civic === 'dock' && !dockWardIdx.has(i)) wards[i].civic = undefined;
  }

  // Clear building plots out from under the kept solid civic structures — including
  // any that spill across a ward boundary. Fixes civic-on-house overlap.
  if (solidCivic.length > 0) {
    for (const w of wards) {
      if (w.plots.length > 0) {
        w.plots = w.plots.filter((p) => !solidCivic.some((c) => polygonsIntersect(p.polygon, c.polygon)));
      }
    }
  }

  // CIVIC GROUNDS (GG-566). A draft whose building lost the de-overlap pass
  // goes with it. The grounds and the approach of every kept building stay
  // clear of houses in every ward (a neighbor's row can spill across).
  const keptDrafts = civicDrafts.filter((d) => solidCivic.some((c) => c.wardIndex === d.wardIndex && c.kind === d.civicKind));
  for (const d of keptDrafts) {
    const L = len(d.approach[0], d.approach[1]);
    const way = L > 1e-9 ? pierQuad(d.approach[0], [(d.approach[1][0] - d.approach[0][0]) / L, (d.approach[1][1] - d.approach[0][1]) / L], L, d.approachWidth) : null;
    for (const w of wards) {
      if (w.plots.length === 0) continue;
      w.plots = w.plots.filter((p) => !polygonsIntersect(p.polygon, d.grounds));
      if (way) w.plots = openCorridor(w.plots, d.approach[0], d.approach[1], d.approachWidth / 2, sizing.lots.minHouseWidth ?? 0);
    }
  }

  // Cross-ward de-overlap: per-ward packing can't see neighbours, so frontage from
  // adjacent wards can clip at shared corners. One bbox-gated pass drops the later
  // of any colliding pair from DIFFERENT wards (intra-ward was already resolved).
  const items = wards.flatMap((w, wi) => w.plots.map((plot) => ({ wi, plot, bb: polygonBounds(plot.polygon) })));
  const dropped = new Set<BuildingPlot>();
  for (let i = 0; i < items.length; i++) {
    if (dropped.has(items[i].plot)) continue;
    const A = items[i].bb;
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].wi === items[j].wi || dropped.has(items[j].plot)) continue;
      const B = items[j].bb;
      if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) continue; // bbox reject
      if (polygonsIntersect(items[i].plot.polygon, items[j].plot.polygon)) dropped.add(items[j].plot);
    }
  }
  if (dropped.size > 0) {
    for (const w of wards) w.plots = w.plots.filter((p) => !dropped.has(p));
  }

  // Road continuation (#6): inherited regional roads clipped to the town. Kept
  // as the RAW approach geometry on the plan; the network is what is drawn.
  const streets = (opts.roads ?? []).flatMap((r) => clipPolylineToPolygon(r, footprint));

  // Buildings off the highway and out of the water.
  //
  // ROAD CARVE = THE DRAWN APPROACHES ONLY (GG-546, town-look 2026-10-31). The
  // carve used to follow the RAW inherited road (`streets`). At true scale
  // (GG-541) a raw road runs straight through a walled town while the street
  // actually drawn there is the routed spine on the ward edges — and every
  // block is already inset for that spine. So the carve cleared houses along a
  // road nobody could see: on Hafting 70% of the raw road lay inside the wall,
  // and the road carve touched 37% of all empty blocks in the census. The carve
  // now follows the extramural approaches (and field tracks) the network draws,
  // at their own width plus a quarter-lane shoulder.
  const approaches = streetNetwork.filter((s) => s.role === 'approach');
  const shoulder = laneWidth / 4;
  const roadCarve = approaches.flatMap((s) => corridorQuads([s.centerline], s.width / 2 + shoulder));
  const waterCarve = waterCarveQuads(water, opts.coast ?? [], fpSpan, sizing, channel?.half);
  const carveQuads = [...roadCarve, ...waterCarve];
  if (carveQuads.length > 0) {
    for (const w of wards) {
      w.plots = w.plots.filter((p) => !carveQuads.some((q) => polygonsIntersect(p.polygon, q)));
    }
  }

  // A block too small to cut into lots, left with none, is one building
  // (GG-546). Larger empty blocks stay open land (gardens, yards) below.
  const smallBlockArea = (sizing.lots.maxDepth * 2) ** 2;
  const minBlockArea = sizing.lots.minLotWidth ** 2;
  const streetGuard = laneWidth / 4;
  for (const w of wards) {
    if (w.plots.length > 0 || (w.civic && w.civic !== 'dock') || w.block.length < 3) continue;
    const area = Math.abs(polyArea(w.block));
    if (area < minBlockArea || area > smallBlockArea) continue;
    // GG-563: the same shape rule as every lot; a sharp block corner is cut
    // off and stays open ground.
    const minW = sizing.lots.minHouseWidth ?? sizing.lots.minLotWidth * 0.8;
    const whole = houseShapeOk(w.block, minW, MIN_HOUSE_CORNER_DEG) ? w.block : chamferSharpCorners(w.block, MIN_HOUSE_CORNER_DEG, minW);
    if (!houseShapeOk(whole, minW, MIN_HOUSE_CORNER_DEG)) continue;
    const plot = blockAsBuilding(whole);
    if (!plot.polygon.every((v) => distToPolyBoundary(v, w.polygon) > streetGuard)) continue;
    if (carveQuads.some((q) => polygonsIntersect(plot.polygon, q))) continue;
    if (solidCivic.some((c) => polygonsIntersect(plot.polygon, c.polygon))) continue;
    w.plots = [plot];
  }

  // PASSAGES TO THE BACK COURTS (GG-565). Run once every intramural house
  // is final, so no later pass can close a passage again. A passage may not
  // cross a civic building, its grounds, or the water.
  const passageBlocked = (quad: Pt[]): boolean => solidCivic.some((c) => polygonsIntersect(quad, c.polygon))
    || keptDrafts.some((d) => polygonsIntersect(quad, d.grounds))
    || waterCarve.some((q) => polygonsIntersect(quad, q));
  const passages = cutCourtPassages(wards, sizing.unit(PASSAGE_FT), sizing.lots.minHouseWidth ?? 0, passageBlocked);
  // The civic approaches join the network as passages too, so every
  // renderer draws them.
  const approachWays: TownStreet[] = keptDrafts.map((d) => ({ centerline: d.approach, tier: 'street', role: 'passage', width: d.approachWidth }));
  const civicGrounds: CivicGrounds[] = keptDrafts.map((d) => {
    const pick = d.civicKind === 'temple' ? templeSetPiece(opts.faith) : strongholdSetPiece(d.civicKind, opts.holder);
    return {
      wardIndex: d.wardIndex, civicKind: d.civicKind, setPiece: pick.setPiece, chosenBy: pick.chosenBy,
      grounds: d.grounds, forecourt: d.forecourt, approach: d.approach, approachWidth: d.approachWidth,
      features: setPieceFeatures({
        setPiece: pick.setPiece, grounds: d.grounds, building: d.building, center: d.center, face: d.face,
        halfSize: d.halfSize, forecourt: d.forecourt, approach: d.approach, approachWidth: d.approachWidth,
        unit: sizing.unit, seedPath: streamPath(seedPath, `civic-grounds:${d.wardIndex}`),
      }),
    };
  });

  // SUBURBS (GG-544, Remy's ruling q3: "Set by how full the walls are"). A town
  // spills outside its walls as many houses as its walls are full: the outside
  // count is `wallFill` times the inside count, so a crowded capital doubles
  // and a half-empty town grows a short ribbon. Suburb BLOCKS in the band
  // between the wall and the core edge build first, nearest a road first;
  // what the target still needs then strings out along the roads as ribbons.
  // Every suburb ward comes AFTER every intramural ward, so intramural plot
  // numbers keep their order. Unbuilt band blocks are market gardens.
  const extramuralLand: TownOpenLand[] = [];
  // SUBURB LANES (GG-604), filled below once every suburb house is placed.
  const suburbLaneStreets: TownStreet[] = [];
  if (profile && walls.ring.length >= 3) {
    const insideCount = wards.reduce((n, w) => n + w.plots.length, 0);
    const ringArea = Math.abs(polyArea(walls.ring));
    const fill = wallFill(profile.population, ringArea, fpSpan);
    let remaining = Math.round(fill * insideCount);
    // A suburb lot also yields to every intramural plot: the Voronoi clip
    // against a concave wall ring can leave a ward poking outside the ring,
    // and its deep lots with it. A coarse grid keeps the test cheap.
    const cell = Math.max(sizing.lots.maxDepth * 2, 1e-6);
    const grid = new Map<string, Pt[][]>();
    const cellsOf = (poly: Pt[]): string[] => {
      const bb = polygonBounds(poly);
      const keys: string[] = [];
      for (let gx = Math.floor(bb.minX / cell); gx <= Math.floor(bb.maxX / cell); gx++) {
        for (let gy = Math.floor(bb.minY / cell); gy <= Math.floor(bb.maxY / cell); gy++) keys.push(`${gx},${gy}`);
      }
      return keys;
    };
    for (const w of wards) for (const p of w.plots) for (const k of cellsOf(p.polygon)) {
      const bucket = grid.get(k) ?? [];
      bucket.push(p.polygon);
      grid.set(k, bucket);
    }
    const hitsTown = (poly: Pt[]): boolean => cellsOf(poly).some((k) => (grid.get(k) ?? []).some((q) => polygonsIntersect(poly, q)));
    const blocked = (poly: Pt[]): boolean => carveQuads.some((q) => polygonsIntersect(poly, q))
      || civicGrounds.some((g) => polygonsIntersect(poly, g.grounds))
      || civic.some((c) => c.kind !== 'plaza' && polygonsIntersect(poly, c.polygon))
      || hitsTown(poly);
    const cb = polygonBounds(core);
    const bboxArea = (cb.maxX - cb.minX) * (cb.maxY - cb.minY);
    const band = buildSuburbBand({
      core,
      ring: walls.ring,
      center: cellCenter,
      fpSpan,
      laneWidth,
      clearance: laneWidth * 1.5,
      // Suburb blocks at the grain of the wards inside the wall.
      cellCount: Math.max(12, Math.min(600, Math.round((bboxArea * wardCount) / Math.max(ringArea, 1e-9)))),
      lots: sizing.lots,
      gardenDepth: sizing.unit(FRONT_GARDEN_FT.suburb),
      thinRow: sizing.unit(THIN_BLOCK_ROW_FT),
      straighten: sizing.unit(BLOCK_STRAIGHTEN_FT),
      roads: approaches.map((s) => s.centerline),
      channel,
      seedPath: streamPath(seedPath, 'suburbs'),
    }).sort((p, q) => p.roadDist - q.roadDist);
    // PORT QUAYS OUTSIDE THE WALL (GG-547). A crowded town's wall now sits
    // back from its shore, so no intramural ward may touch the water, and
    // Paphina (a port) lost every dock. A real port's quays stand outside
    // its wall: the band cells nearest the water seat piers, up to the
    // town's dock cap.
    // Which band cell each quay stands on; its ward index is set below.
    const quayCells: Array<{ dock: CivicStructure; cell: (typeof band)[number] }> = [];
    let docksNow = civic.filter((c) => c.kind === 'dock').length;
    if (docksNow < dockCap && water.length > 0) {
      const quays = band
        .map((b) => ({ b, edge: wardWaterEdge(b.cell, water, waterMargin) }))
        .filter((q) => q.edge != null)
        .map((q) => {
          // GG-561: a river quay starts on its bank and stops short of mid-river.
          const ea = q.b.cell[q.edge!], eb = q.b.cell[(q.edge! + 1) % q.b.cell.length];
          const em: Pt = [(ea[0] + eb[0]) / 2, (ea[1] + eb[1]) / 2];
          const onRiver = !!channel && distToLines(em, channel.rivers) <= (opts.coast?.length ? distToLines(em, opts.coast) : Infinity);
          const pier = pierFor(q.b.cell, polygonCentroid(q.b.cell), q.edge!, water, onRiver ? sizing.unit(RIVER_BANK_FT) + (opts.waterWidth ?? 0) * 0.3 : Infinity);
          let d = Infinity;
          for (const line of water) d = Math.min(d, polylineDist2(polygonCentroid(pier), line));
          return { b: q.b, pier, d };
        })
        .sort((p, q) => p.d - q.d);
      const added: Pt[][] = [];
      for (const q of quays) {
        if (docksNow >= dockCap) break;
        if (civic.some((c) => c.kind !== 'plaza' && polygonsIntersect(q.pier, c.polygon))) continue;
        const dock: CivicStructure = { kind: 'dock', polygon: q.pier, wardIndex: -1 };
        civic.push(dock);
        quayCells.push({ dock, cell: q.b });
        added.push(q.pier);
        docksNow++;
      }
      if (added.length > 0) {
        for (const w of wards) w.plots = w.plots.filter((p) => !added.some((q) => polygonsIntersect(p.polygon, q)));
      }
    }
    const bandWard = new Map<(typeof band)[number], number>();
    const bandLots: Pt[][] = [];
    const farthest = band.length > 0 ? band[band.length - 1].roadDist : 1;
    band.forEach((b, bi) => {
      const plots = b.plots.filter((p) => !blocked(p.polygon));
      if (remaining > 0 && plots.length > 0) {
        bandWard.set(b, wards.length);
        wards.push({ polygon: b.cell, block: b.block, plots, extramural: true, civic: quayCells.some((q) => q.cell === b) ? 'dock' : undefined });
        remaining -= plots.length;
        for (const p of plots) bandLots.push(p.polygon);
        return;
      }
      if (carveQuads.some((q) => polygonsIntersect(b.block, q)) || civic.some((c) => c.kind !== 'plaza' && polygonsIntersect(b.block, c.polygon))) return;
      const depth = isFinite(farthest) && farthest > 0 ? clamp01(b.roadDist / farthest) : 1;
      const roll = fnv1a(`${seedPath}|suburb-garden:${bi}`) / 0xffffffff;
      extramuralLand.push({ polygon: b.block, kind: classifyOpenLand(depth, fill, false, roll), source: 'extramural' });
    });
    // A quay names its ward, as every civic structure does: the suburb ward
    // its cell became, or a dock ward of its own on an unbuilt cell.
    for (const q of quayCells) {
      let wi = bandWard.get(q.cell);
      if (wi === undefined) {
        wi = wards.length;
        wards.push({ polygon: q.cell.cell, block: q.cell.block, plots: [], civic: 'dock', extramural: true });
      }
      q.dock.wardIndex = wi;
    }
    if (remaining > 0 && approaches.length > 0) {
      const rows = buildSuburbs({
        roads: approaches.map((s) => ({ line: s.centerline, width: s.width + shoulder * 2, weight: s.track ? 0.35 : 1 })),
        wallRing: walls.ring,
        footprint,
        target: remaining,
        lotWidth: sizing.lots.lotWidth,
        minLotWidth: sizing.lots.minLotWidth,
        // Kept at 40 ft (GG-564): a deeper ribbon lot met the folded inner
        // edge of its ground strip at a road bend. The front garden takes what
        // the house can spare (see cutFrontGardens).
        lotDepth: sizing.unit(40),
        snap: sizing.lots.snap,
        clearance: laneWidth * 1.5,
        // Every road corridor blocks, its own included: a ribbon lot sits
        // exactly on its road's corridor edge, which the shrunken overlap
        // test lets through; a lot that cuts into a bend does not get through.
        blockers: [...roadCarve, ...waterCarve, ...civic.map((c) => c.polygon), ...bandLots],
        intersects: polygonsIntersect,
        seedPath: streamPath(seedPath, 'suburbs'),
      });
      for (const row of rows) {
        wards.push({ polygon: row.ground, block: row.strip, plots: row.plots, extramural: true });
      }
    }
    // SUBURB LANES (GG-604). Each suburb block is pulled in from its cell by
    // about half a lane, but that lane was never a street. The router, the 2D
    // map and the 3D bake did not know it, so a house that faced it had no way
    // out except through the row behind (Borieborum: 471 rows on such edges,
    // 182 of its 1,151 doors cut a neighbor). The cell edges of the built
    // suburb blocks become passages, joined to the approach roads they cross.
    // The ribbons along the roads already face their road and are unchanged.
    const builtCells = band.filter((b) => bandWard.has(b) && wards[bandWard.get(b)!].plots.length > 0).map((b) => b.cell);
    // A link from a lane group to its nearest road may not cross the wall or
    // the water, and is at most eight lanes long.
    const ringEdges = walls.ring.map((p, i) => [p, walls.ring[(i + 1) % walls.ring.length]] as const);
    const blockedLink = (p: Pt, q: Pt): boolean => ringEdges.some(([r0, r1]) => segmentsCross(p, q, r0, r1))
      || waterCarve.some((quad) => polygonsIntersect([p, q, p], quad));
    suburbLaneStreets.push(...suburbLanes(builtCells, approaches, wards.flatMap((w) => w.plots.map((pl) => pl.polygon)),
      laneWidth, edgeQuant, laneWidth * 8, blockedLink));
  }

  // Outskirts: the ring between the built core and the cell edge → farm/pasture/scrub,
  // with every farm parcel cut into strips along its road (GG-551).
  const outskirtCount = Math.max(18, Math.min(80, Math.round(wardCount * 1.1)));
  const outskirts = stripFarmParcels({
    outskirts: buildOutskirts(footprint, core, cellCenter, seedPath, outskirtCount),
    roads: approaches.map((s) => s.centerline),
    center: cellCenter,
    stripWidth: sizing.physical ? sizing.unit(STRIP_FIELD_WIDTH_FT) : fpSpan * 0.03,
    roadReach: fpSpan * 0.12,
    retainParentParcels: opts.ruralHouseholdSources,
    seedPath: streamPath(seedPath, 'strip-fields'),
  });

  return finishTownPlan({
    // The suburb lanes come last, so every earlier street keeps its id.
    footprint, core, wards, civic, walls, streets, streetNetwork: [...streetNetwork, ...passages, ...approachWays, ...suburbLaneStreets], outskirts,
    profile, seedPath, townCenter, coreSpan, envSpan, form: 'wards',
    civicGrounds,
    unit: sizing.unit, laneWidth,
    ruralHouseholdSources: opts.ruralHouseholdSources,
    // Intramural open land: the ground the walls enclose that the wards never
    // built on, plus any ward block that packed zero plots. It runs LAST so it
    // sees the final plot list. Suburb wards are outside the wall: not slack.
    openLandFor: (all) => [
      ...buildIntramuralOpenLand({
        envelope,
        wards: all.filter((w) => !w.extramural),
        civic,
        center: townCenter,
        fpSpan,
        walled: walls.ring.length >= 3,
        population: profile?.population ?? opts.population ?? 0,
        seedPath,
      }),
      ...extramuralLand,
    ],
  });
}

/**
 * SUBURB BLOCKS (GG-544): the band between the wall and the edge of the built
 * core, cut into blocks of deep lots.
 *
 * A Watabou city's suburbs are not one row of houses along each road. Near
 * the gates they form whole blocks, and only farther out do they thin to a
 * ribbon. So the band outside the wall is tessellated like the town inside it
 * (same Voronoi machinery, same deep-lot rule), and each block reports how far
 * it is from the nearest approach road. The caller builds the blocks nearest a
 * road first until the suburb target is met; the rest stay market gardens.
 *
 * The band is the region between two radius profiles about the cell center —
 * the wall plus a standoff, and the core edge — so each Voronoi cell is
 * clamped into it in polar coordinates, exactly as the intramural open land
 * is. A concave wall ring is never used as a clip polygon.
 */
function buildSuburbBand(a: {
  core: Pt[];
  ring: Pt[];
  center: Pt;
  fpSpan: number;
  laneWidth: number;
  clearance: number;
  cellCount: number;
  lots: DeepLotOptions;
  /** Front-garden depth the suburb rows make room for (GG-564). */
  gardenDepth: number;
  /** Row depth a thin block may always reach (GG-563). */
  thinRow: number;
  /** How far off straight a block corner may be and still merge away (GG-563). */
  straighten: number;
  /** The river channel, cut out of every suburb cell (GG-561). */
  channel?: { rivers: Pt[][]; half: number } | null;
  roads: Pt[][];
  seedPath: SeedPath;
}): Array<{ cell: Pt[]; block: Pt[]; plots: BuildingPlot[]; roadDist: number }> {
  const rIn: number[] = new Array(OPEN_LAND_ANGLE_STEPS);
  const rOut: number[] = new Array(OPEN_LAND_ANGLE_STEPS);
  for (let k = 0; k < OPEN_LAND_ANGLE_STEPS; k++) {
    const ang = (k / OPEN_LAND_ANGLE_STEPS) * Math.PI * 2;
    // The inner bound is ALWAYS the wall plus its standoff. Where the core
    // edge lies inside that (seen from the cell center), the band is empty
    // along this ray; clamping to the core edge put lots inside the wall.
    rIn[k] = farRayPolyRadius(a.center, ang, a.ring) + a.clearance;
    rOut[k] = Math.max(rIn[k], rayPolyRadius(a.center, ang, a.core));
  }
  const b = polygonBounds(a.core);
  const bbox: Pt[] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
  const model = generateSubmap({ polygon: bbox, seedPath: streamPath(a.seedPath, 'suburb-band') }, { count: a.cellCount });
  const minBand = a.lots.minLotWidth;
  const out: Array<{ cell: Pt[]; block: Pt[]; plots: BuildingPlot[]; roadDist: number }> = [];
  model.cells.forEach((cell, i) => {
    if (cell.polygon.length < 3 || pointInPolygon(a.center, cell.polygon)) return;
    const clamped: Pt[] = [];
    for (const [x, y] of densifyPolygon(cell.polygon, a.fpSpan * 0.01)) {
      const ang = Math.atan2(y - a.center[1], x - a.center[0]);
      const r = Math.hypot(x - a.center[0], y - a.center[1]);
      const lo = sampleProfile(rIn, ang);
      const hi = sampleProfile(rOut, ang);
      const rc = hi - lo <= minBand ? lo : r < lo ? lo : r > hi ? hi : r;
      clamped.push([a.center[0] + Math.cos(ang) * rc, a.center[1] + Math.sin(ang) * rc]);
    }
    if (Math.abs(polyArea(clamped)) < (a.lots.minLotWidth * 3) ** 2) return;
    // GG-561: the river channel is cut out of the suburb cells as it is out
    // of the wards inside the wall. A cell the river crosses becomes one
    // piece per bank; the first piece keeps the cell's old seed.
    const pieces = a.channel
      ? cutRiverChannel([clamped], a.channel.rivers, a.channel.half, (a.lots.minLotWidth * 3) ** 2, a.fpSpan).polys
      : [clamped];
    pieces.forEach((piece, k) => suburbBlock(piece, k === 0 ? `suburb-block:${i}` : `suburb-block:${i}:${k}`));
  });
  return out;

  function suburbBlock(clamped: Pt[], key: string): void {
    // A lane between neighboring suburb blocks: pull each block in from its
    // cell by about half a lane.
    const c = polygonCentroid(clamped);
    const cb = polygonBounds(clamped);
    const span = Math.max(cb.maxX - cb.minX, cb.maxY - cb.minY) || 1;
    // GG-563 block shapes: the wall-curve corners merge into longer streets.
    const block = simplifyConvexCorners(scalePolygon(clamped, c, Math.max(0.6, 1 - a.laneWidth / span)), a.straighten);
    let roadDist = Infinity;
    for (const road of a.roads) roadDist = Math.min(roadDist, Math.sqrt(polylineDist2(c, road)));
    const lots = packBlockSquare(block, streamPath(a.seedPath, key), {
      ...a.lots,
      // Suburb houses stand behind front gardens (GG-564).
      maxDepth: Math.min(a.lots.maxDepth + a.gardenDepth, Math.max(a.thinRow + a.gardenDepth, blockShortSpan(block) * GARDEN_ROW_SHARE)),
    });
    // The street guard every town block keeps: no vertex within a quarter
    // lane of the cell edge (the lane centerline).
    // And the wall rule the ribbons keep: pulling the block in for its lane
    // can carry its inner edge back across the wall line, so every corner
    // must stay outside the ring and half the standoff clear of it.
    const plots = lots.filter((p) => p.polygon.every((v) =>
      distToPolyBoundary(v, clamped) > a.laneWidth / 4
      && !pointInPolygon(v, a.ring)
      && distToPolyBoundary(v, a.ring) >= a.clearance / 2));
    out.push({ cell: clamped, block, plots, roadDist });
  }
}

/**
 * SUBURB LANES (GG-604): the lanes between the built suburb blocks, as
 * passages (`role: 'passage'`, half a lane wide).
 *
 * - Each cell edge is emitted once, so the edge two built cells share is one
 *   lane. A piece whose middle lies in a house is left out.
 * - A suburb lot keeps more than a quarter lane from its cell edge
 *   (`buildSuburbBand`), so a lane half a lane wide reaches no house. As a
 *   passage it is not a street the GG-564 pass drops houses for.
 * - Each lane is simplified, then joined to every approach road it crosses:
 *   the crossing point is added to both lines (a collinear point, so the road
 *   keeps its shape), and the router joins them at that one node.
 * - A group of lanes that reaches no road gets one straight link to the
 *   nearest road or reached lane, clear of houses, the wall and the water.
 *   A group that still reaches nothing is dropped: a lane with no way to the
 *   town would trap the doors that join it instead of freeing them.
 *
 * Deterministic: the cells, segments and roads are read in their given order.
 * MUTATES the centerlines of `roads` (the inserted crossing points only).
 */
function suburbLanes(
  cells: Pt[][], roads: TownStreet[], plots: Pt[][], laneWidth: number, quant: number,
  maxLink: number, blockedLink: (a: Pt, b: Pt) => boolean,
): TownStreet[] {
  if (cells.length === 0) return [];
  const key = (p: Pt): string => `${Math.round(p[0] / quant)},${Math.round(p[1] / quant)}`;
  const segKey = (a: Pt, b: Pt): string => { const ka = key(a), kb = key(b); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  // A coarse grid of house polygons keeps the inside test cheap.
  const gridSize = Math.max(laneWidth * 8, 1e-6);
  const gkey = (x: number, y: number): string => `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
  const grid = new Map<string, Pt[][]>();
  for (const poly of plots) {
    const bb = polygonBounds(poly);
    for (let gx = Math.floor(bb.minX / gridSize); gx <= Math.floor(bb.maxX / gridSize); gx++) {
      for (let gy = Math.floor(bb.minY / gridSize); gy <= Math.floor(bb.maxY / gridSize); gy++) {
        const k = `${gx},${gy}`;
        const bucket = grid.get(k) ?? [];
        bucket.push(poly);
        grid.set(k, bucket);
      }
    }
  }
  const inHouse = (p: Pt): boolean => (grid.get(gkey(p[0], p[1])) ?? []).some((q) => pointInPolygon(p, q));

  // 1. Cell edges, once each, as runs of kept segments.
  const seen = new Set<string>();
  const runs: Pt[][] = [];
  for (const ring of cells) {
    const own: Pt[][] = [];
    let run: Pt[] | null = null;
    let firstKept = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const k = segKey(a, b);
      const drop = key(a) === key(b) || seen.has(k) || inHouse([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      seen.add(k);
      if (drop) { if (run) { own.push(run); run = null; } continue; }
      if (i === 0) firstKept = true;
      if (!run) run = [[a[0], a[1]]];
      run.push([b[0], b[1]]);
    }
    if (run) {
      // The ring closes: a run that ends at the ring's first point joins the
      // run that starts there.
      if (firstKept && own.length > 0) own[0] = [...run, ...own[0].slice(1)];
      else own.push(run);
    }
    runs.push(...own);
  }

  // 2. Simplify (Douglas-Peucker, a twentieth of a lane): the cells were
  // densified to follow the wall curve, and every vertex is a router node.
  const tol2 = (laneWidth * 0.05) ** 2;
  const simplify = (line: Pt[]): Pt[] => {
    if (line.length <= 2) return line;
    const keep = new Array<boolean>(line.length).fill(false);
    keep[0] = keep[line.length - 1] = true;
    const stack: Array<[number, number]> = [[0, line.length - 1]];
    while (stack.length > 0) {
      const [s, e] = stack.pop()!;
      let best = -1, bestD = tol2;
      for (let i = s + 1; i < e; i++) {
        const d = segDist2(line[i], line[s], line[e]);
        if (d > bestD) { bestD = d; best = i; }
      }
      if (best < 0) continue;
      keep[best] = true;
      stack.push([s, best], [best, e]);
    }
    return line.filter((_, i) => keep[i]);
  };
  const lineLength = (line: Pt[]): number => line.slice(1).reduce((s, p, i) => s + len(line[i], p), 0);
  const lanes = runs.map(simplify).filter((line) => line.length >= 2 && lineLength(line) >= laneWidth);

  // 3. Join each lane to the approach roads it crosses.
  const touchesRoad = new Array<boolean>(lanes.length).fill(false);
  const nearTol = laneWidth * 0.2;
  const insertAt = (line: Pt[], hits: Array<{ seg: number; t: number; p: Pt }>): void => {
    // Back to front, so each index stays valid while the line grows.
    for (const h of [...hits].sort((x, y) => y.seg - x.seg || y.t - x.t)) {
      const a = line[h.seg], b = line[h.seg + 1];
      if (key(h.p) === key(a) || key(h.p) === key(b)) continue;
      line.splice(h.seg + 1, 0, h.p);
    }
  };
  lanes.forEach((line, li) => {
    for (const road of roads) {
      const rl = road.centerline;
      const laneHits: Array<{ seg: number; t: number; p: Pt }> = [];
      const roadHits: Array<{ seg: number; t: number; p: Pt }> = [];
      for (let i = 0; i < line.length - 1; i++) {
        for (let j = 0; j < rl.length - 1; j++) {
          const p = segIntersectPoint(line[i], line[i + 1], rl[j], rl[j + 1]);
          if (!p) continue;
          laneHits.push({ seg: i, t: len(line[i], p), p });
          roadHits.push({ seg: j, t: len(rl[j], p), p });
        }
      }
      if (laneHits.length > 0) {
        touchesRoad[li] = true;
        insertAt(line, laneHits);
        insertAt(rl, roadHits);
      }
      // A lane end on the road (within the router's T-join reach) joins too.
      for (const end of [line[0], line[line.length - 1]]) {
        for (let j = 0; j < rl.length - 1 && !touchesRoad[li]; j++) {
          if (segDist2(end, rl[j], rl[j + 1]) <= nearTol * nearTol) touchesRoad[li] = true;
        }
      }
    }
  });

  // 4. Keep only the groups of lanes that reach a road. Two lanes are one
  // group when they share a vertex, or when an end of one lies on the other.
  const parent = lanes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (i: number, j: number): void => { const a = find(i), b = find(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const byVertex = new Map<string, number>();
  lanes.forEach((line, li) => {
    for (const p of line) {
      const k = key(p);
      const other = byVertex.get(k);
      if (other === undefined) byVertex.set(k, li); else union(li, other);
    }
  });
  lanes.forEach((line, li) => {
    for (const end of [line[0], line[line.length - 1]]) {
      lanes.forEach((otherLine, oi) => {
        if (oi === li || find(oi) === find(li)) return;
        for (let j = 0; j < otherLine.length - 1; j++) {
          if (segDist2(end, otherLine[j], otherLine[j + 1]) <= nearTol * nearTol) { union(li, oi); return; }
        }
      });
    }
  });
  const reached = new Set<number>();
  lanes.forEach((_, li) => { if (touchesRoad[li]) reached.add(find(li)); });

  // 5. A group that reaches no road (its neighbor cells are market gardens)
  // gets one straight link to the nearest road or reached lane, if the link
  // stays clear of every house and of `blockedLink` (the wall, the water) and
  // is at most `maxLink` long. Groups are linked in lane order, so a group
  // linked first can carry the next one.
  const links: Pt[][] = [];
  const clearOfHouses = (a: Pt, b: Pt): boolean => {
    const n = Math.max(1, Math.ceil(len(a, b) / (laneWidth * 0.25)));
    for (let k = 1; k < n; k++) if (inHouse([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])) return false;
    return true;
  };
  const project = (p: Pt, a: Pt, b: Pt): Pt => {
    const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
    const t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0;
    return [a[0] + vx * t, a[1] + vy * t];
  };
  const groups = [...new Set(lanes.map((_, li) => find(li)))];
  for (const g of groups) {
    if (reached.has(g)) continue;
    const targets: Pt[][] = [...roads.map((r) => r.centerline), ...lanes.filter((_, li) => reached.has(find(li)))];
    let from: Pt | undefined, to: Pt | undefined, target: Pt[] | undefined, bestD = maxLink;
    for (let li = 0; li < lanes.length; li++) {
      if (find(li) !== g) continue;
      for (const v of lanes[li]) {
        for (const line of targets) {
          for (let j = 0; j < line.length - 1; j++) {
            const q = project(v, line[j], line[j + 1]);
            const d = len(v, q);
            if (d > bestD || (target && d === bestD)) continue;
            if (!clearOfHouses(v, q) || blockedLink(v, q)) continue;
            from = v; to = q; target = line; bestD = d;
          }
        }
      }
    }
    if (!from || !to || !target) continue;
    // The link's far end becomes a vertex of its target, so the router joins it.
    for (let j = 0; j < target.length - 1; j++) {
      if (segDist2(to, target[j], target[j + 1]) <= 1e-12 && key(to) !== key(target[j]) && key(to) !== key(target[j + 1])) {
        target.splice(j + 1, 0, to);
        break;
      }
    }
    links.push([from, to]);
    reached.add(g);
  }
  return [...lanes.filter((_, li) => reached.has(find(li))), ...links]
    .map((centerline) => ({ centerline, tier: 'lane' as const, role: 'passage' as const, width: laneWidth / 2 }));
}

/**
 * A test for "does this house reach into a street?" over the whole network
 * (GG-564). A street is its centerline plus half its width, with round ends.
 *
 * The block inset keeps a house off every WARD EDGE street. Three kinds of
 * street are not ward edges, and houses stood in them: the run from a gate
 * to the first ward corner, a gate hook the router removed (GG-562), and the
 * round end of a wide street where it meets a narrower one. At Hafting, after
 * the exact inset, the 6 houses left in a street were all of these kinds.
 */
function streetReach(streets: readonly TownStreet[], cell: number): (poly: Pt[], eps: number) => boolean {
  type Seg = { a: Pt; b: Pt; half: number };
  const grid = new Map<string, Seg[]>();
  for (const s of streets) {
    const half = s.width / 2;
    const L = s.centerline;
    for (let i = 0; i < L.length - 1; i++) {
      const seg: Seg = { a: L[i], b: L[i + 1], half };
      const x0 = Math.floor((Math.min(seg.a[0], seg.b[0]) - half) / cell), x1 = Math.floor((Math.max(seg.a[0], seg.b[0]) + half) / cell);
      const y0 = Math.floor((Math.min(seg.a[1], seg.b[1]) - half) / cell), y1 = Math.floor((Math.max(seg.a[1], seg.b[1]) + half) / cell);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const k = `${gx},${gy}`;
        const bucket = grid.get(k);
        if (bucket) bucket.push(seg); else grid.set(k, [seg]);
      }
    }
  }
  return (poly, eps) => {
    const b = polygonBounds(poly);
    const seen = new Set<Seg>();
    for (let gx = Math.floor(b.minX / cell); gx <= Math.floor(b.maxX / cell); gx++) {
      for (let gy = Math.floor(b.minY / cell); gy <= Math.floor(b.maxY / cell); gy++) {
        for (const seg of grid.get(`${gx},${gy}`) ?? []) {
          if (seen.has(seg)) continue;
          seen.add(seg);
          const r2 = (seg.half - eps) ** 2;
          if (r2 <= 0) continue;
          if (poly.some((v) => segDist2(v, seg.a, seg.b) < r2)) return true;
          // The street's own centerline or its round end inside the house.
          for (const c of [seg.a, seg.b]) {
            if (pointInPolygon(c, poly) || distToPolyBoundary(c, poly) ** 2 < r2) return true;
          }
          for (let i = 0; i < poly.length; i++) {
            if (segmentsCross(poly[i], poly[(i + 1) % poly.length], seg.a, seg.b)) return true;
          }
        }
      }
    }
    return false;
  };
}

/** Front-garden depth in feet, by district (GG-564). */
export const FRONT_GARDEN_FT = { suburb: 15, wealthy: 20 } as const;
/** A front garden never leaves a house shallower than this, in feet. */
const MIN_HOUSE_DEPTH_FT = 16;
/** A front garden shallower than this is not worth a fence; the house stays on the line. */
const MIN_FRONT_GARDEN_FT = 6;

/**
 * Rotate a clipped ring so its edge on the line `n·p = off` comes first and
 * runs along `u`, the way every street-front lot lists its street edge.
 * Null when no edge lies on that line.
 */
function lineEdgeFirst(poly: Pt[], n: Pt, off: number, u: Pt, eps: number): Pt[] | null {
  const m = poly.length;
  const onLine = (p: Pt): boolean => Math.abs(n[0] * p[0] + n[1] * p[1] - off) <= eps;
  let best = -1;
  let bestLen = 0;
  for (let k = 0; k < m; k++) {
    const p = poly[k], q = poly[(k + 1) % m];
    if (!onLine(p) || !onLine(q)) continue;
    const L = len(p, q);
    if (L > bestLen) { bestLen = L; best = k; }
  }
  if (best < 0) return null;
  let ring = [...poly.slice(best), ...poly.slice(0, best)];
  if ((ring[1][0] - ring[0][0]) * u[0] + (ring[1][1] - ring[0][1]) * u[1] < 0) ring = [ring[1], ring[0], ...ring.slice(2).reverse()];
  return ring;
}

/**
 * GARDENS BY DISTRICT (GG-564, Remy's ruling 2026-11-01). In the dense core
 * inside the walls a house stands on its street line. Outside the walls and in
 * a wealthy district it stands back behind a front garden. The garden is cut
 * from the front of the lot, at one depth per ward, so the houses of one row
 * keep one building line and their shared side walls. The lot's street edge
 * stays first in its ring (the lot contract), now on the building line.
 * Returns the gardens; the plots are changed in place.
 */
function cutFrontGardens(wards: TownWard[], unit: (ft: number) => number, seedPath: SeedPath): TownOpenLand[] {
  const gardens: TownOpenLand[] = [];
  wards.forEach((w, wi) => {
    const target = w.extramural ? FRONT_GARDEN_FT.suburb : w.wealth === 'wealthy' ? FRONT_GARDEN_FT.wealthy : 0;
    if (!target || w.block.length < 3) return;
    // One depth per ward, varied a little between wards.
    const roll = fnv1a(`${seedPath}|front-garden:${wi}`) / 0xffffffff;
    const want = unit(target) * (0.8 + roll * 0.4);
    const bb = polygonBounds(w.block);
    const eps = (Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) || 1) * 1e-6;
    for (const plot of w.plots) {
      if (plot.kind === 'interior' || plot.polygon.length < 3) continue;
      const poly = plot.polygon;
      const p0 = poly[0], p1 = poly[1];
      // Only a lot whose first edge IS its street front (on the block line).
      const lineTol = unit(1);
      if (distToPolyBoundary(p0, w.block) > lineTol || distToPolyBoundary(p1, w.block) > lineTol) continue;
      const L = len(p0, p1);
      if (L < 1e-9) continue;
      const u: Pt = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
      const c = polygonCentroid(poly);
      let n: Pt = [-u[1], u[0]];
      if ((c[0] - p0[0]) * n[0] + (c[1] - p0[1]) * n[1] < 0) n = [u[1], -u[0]];
      const front = n[0] * p0[0] + n[1] * p0[1];
      let depth = 0;
      for (const v of poly) depth = Math.max(depth, n[0] * v[0] + n[1] * v[1] - front);
      const s = Math.min(want, depth - unit(MIN_HOUSE_DEPTH_FT));
      if (s < unit(MIN_FRONT_GARDEN_FT)) continue;
      const house = clipHalfPlane(poly, { nx: -n[0], ny: -n[1], c: -(front + s) });
      const garden = clipHalfPlane(poly, { nx: n[0], ny: n[1], c: front + s });
      const ring = house.length >= 3 ? lineEdgeFirst(house, n, front + s, u, eps * 10 + 1e-9) : null;
      if (!ring || garden.length < 3) continue;
      if (!houseShapeOk(ring, unit(MIN_HOUSE_WIDTH_FT), MIN_HOUSE_CORNER_DEG) && houseShapeOk(poly, unit(MIN_HOUSE_WIDTH_FT), MIN_HOUSE_CORNER_DEG)) continue;
      plot.polygon = ring;
      gardens.push({ polygon: garden, kind: 'garden', source: 'ward', front: true });
    }
  });
  return gardens;
}

/**
 * The passes every town shares once its wards, civic ground and streets are
 * final: social districts, the canonical plot list and its identity keys, the
 * population, building ensembles, courts and open land, then the densified
 * street network. Shared by the ward town and the lane village so the two
 * forms cannot drift apart in these rules.
 */
function finishTownPlan(a: {
  footprint: Pt[];
  core: Pt[];
  wards: TownWard[];
  civic: CivicStructure[];
  walls: TownWalls;
  streets: Pt[][];
  streetNetwork: TownStreet[];
  outskirts: TownOutskirt[];
  profile: TownScaleProfile | null;
  seedPath: SeedPath;
  townCenter: Pt;
  coreSpan: number;
  envSpan: number;
  form: 'wards' | 'lanes';
  ruralHouseholdSources?: boolean;
  openLandFor: (wards: TownWard[]) => TownOpenLand[];
  /** Feet to plan units (a nominal scale on a schematic plan). */
  unit: (ft: number) => number;
  laneWidth: number;
  civicGrounds?: CivicGrounds[];
}): TownPlan {
  const { footprint, core, wards, civic, walls, streets, outskirts, profile, seedPath, townCenter, coreSpan, envSpan } = a;
  // NO HOUSE IN A STREET (GG-564). The last word on every house, after every
  // pass that placed one: a house that reaches into any street of the network
  // is dropped. See `streetReach` for the streets the block inset cannot see.
  // A passage (GG-565, GG-566) starts at the door of the house it serves and
  // opened its own way through the rows, so it is not tested here.
  const reach = streetReach(a.streetNetwork.filter((s) => s.role !== 'passage'), Math.max(a.laneWidth * 4, 1e-6));
  const reachEps = a.laneWidth * 0.01;
  for (const w of wards) w.plots = w.plots.filter((p) => !reach(p.polygon, reachEps));
  // SQUARISH HOUSES (GG-563, Remy's ruling 2026-11-01: "stick with MOSTLY
  // squares or squarish (rectangles or L shapes ...)"). A house whose
  // corners are not all within 15 degrees of square becomes the biggest
  // rectangle on its street front inside its lot; the whole lot is drawn
  // as yard under it, so the leftover wedge reads as yard. A lot too small
  // for a 12 ft rectangle is all yard. Before this pass 39% of Hafting's
  // houses were squarish, 18% of Paphina's and 12% of Borieborum's.
  const squaredYards: TownOpenLand[] = [];
  const minHouse = a.unit(MIN_HOUSE_WIDTH_FT);
  for (const w of wards) {
    w.plots = w.plots.filter((p) => {
      if (isSquarish(p.polygon)) return true;
      const rect = rectangleOnFront(p.polygon, minHouse);
      squaredYards.push({ polygon: p.polygon, kind: 'yard', source: 'ward' });
      if (!rect) return false;
      p.polygon = rect;
      p.shape = 'rect';
      return true;
    });
  }
  // Population accounting (who lives where): classify every building, distribute the
  // population across homes (occupancy rising with density) + rural farmsteads, and
  // emit demographics. Only when a population was supplied. Mutates plot occupancy.
  // Social districts: rank wards by closeness to the prestige anchors (keep/citadel/
  // temple/market), then tag every plot with its ward's class so the population pass
  // can class-shade building types (wealthy quarter vs poor rim).
  const wardCentroids = wards.map((w) => polygonCentroid(w.polygon));
  const prestige = civic.filter((c) => c.kind === 'keep' || c.kind === 'citadel' || c.kind === 'temple' || c.kind === 'plaza');
  const anchors = prestige.map((c) => polygonCentroid(c.polygon));
  const wealth = assignWardWealth(wardCentroids, anchors, coreSpan, seedPath)
    // A ward classed before its lots were cut (GG-564) keeps that class.
    .map((w, i) => wards[i].wealth ?? w);
  const architectureDistricts = assignArchitectureDistricts(
    wardCentroids,
    townCenter,
    wards.map((ward) => ward.civic),
    seedPath,
  );
  wards.forEach((w, i) => {
    w.wealth = wealth[i];
    w.architectureDistrict = architectureDistricts[i];
    for (const p of w.plots) p.district = wealth[i];
  });
  // Front gardens by district (GG-564); the lane village seats its own.
  const frontGardens = a.form === 'wards' ? cutFrontGardens(wards, a.unit, seedPath) : [];

  // THE MARKET SQUARE (GG-586, Remy 2026-11-02 at Hafting: "we need a market
  // square to be implemented"). The plaza was a bare block. Now its square
  // holds stalls in rows, a centerpiece and, in a larger town, a market hall,
  // a weigh house and a pillory, chosen by the town's size and wealth band
  // (`marketSquare.ts`). It is built here, once every house is final, because
  // the houses that face the square become its shops and inns (the population
  // pass below reads `facesMarket`). A plan with no scale profile (a
  // schematic plan) has no size class to choose from, so its square stays bare.
  const marketGrounds: CivicGrounds[] = [];
  const plaza = civic.find((c) => c.kind === 'plaza');
  if (plaza && plaza.polygon.length >= 3 && profile) {
    const square = plaza.polygon;
    const marketStreets = a.streetNetwork
      .filter((s) => s.role !== 'passage' && s.centerline.length >= 2)
      .map((s) => ({ line: s.centerline, half: s.width / 2 }));
    // The main street's mouth: the point of the main street nearest the square.
    let mainEnd: Pt | undefined;
    let mainD = Infinity;
    for (const s of a.streetNetwork) {
      if (!s.main) continue;
      for (const p of s.centerline) {
        const d = distToPolyBoundary(p, square);
        if (d < mainD) { mainD = d; mainEnd = p; }
      }
    }
    const market = buildMarketSquare({
      wardIndex: plaza.wardIndex,
      square,
      typology: profile.typology,
      band: townWealthBand(wards.map((w) => w.wealth)),
      streets: marketStreets,
      ...(mainEnd ? { mainEnd } : {}),
      unit: a.unit,
      seedPath: streamPath(seedPath, `market:${plaza.wardIndex}`),
    });
    if (market) marketGrounds.push(market);
    // A house faces the square when its street side looks onto it across the
    // market frontage street and at most a wealthy front garden.
    const maxGap = a.laneWidth * TIER_WIDTH_RATIO.plaza + a.unit(FRONT_GARDEN_FT.wealthy) + a.unit(4);
    for (const w of wards) {
      for (const p of w.plots) {
        if (p.frontageEdge >= 0 && p.kind !== 'interior' && plotFacesSquare(p.polygon, square, maxGap)) p.facesMarket = true;
      }
    }
  }

  const allPlots = wards.flatMap((w) => w.plots);
  // Architecture identity exists even for unpopulated previews. Assign it only
  // after civic-overlap and cross-ward filtering finalize the canonical plot
  // list, so normalized 2D and transformed 3D plans retain the same key.
  allPlots.forEach((plot, plotIndex) => {
    plot.architectureKey = `plot:${plotIndex}`;
  });
  let farmsteads: import('./population').Farmstead[] = [];
  let demographics: import('./population').TownDemographics | undefined;
  if (profile) {
    const farmParcels = outskirts.filter((o) => o.kind === 'farm');
    const pop = assignTownPopulation({
      plots: allPlots,
      farmParcels,
      population: profile.population,
      ruralHouseholdSources: a.ruralHouseholdSources,
      profile,
      townCenter,
      townSpan: coreSpan,
      seedPath,
    });
    farmsteads = pop.farmsteads;
    demographics = pop.demographics;
  }

  // Compose finalized lots into rows, courts, detached groups, and market
  // arcades only after collision and population passes finish. Every consumer
  // then receives one durable ensemble answer rather than re-deriving adjacency.
  const ensembles = resolveBuildingEnsembles(
    wards,
    civic,
    profile?.typology,
    seedPath,
  );
  for (const plot of allPlots) plot.ensemble = ensembles.get(plot);

  // The shared-space receipt is authored after ensemble assignment so its
  // block key is exactly the one carried by every court-facing building.
  const courtyards = resolveCourtyardSpaces(wards, seedPath);

  // Squared-off yards first, so a front garden cut later draws over them.
  const openLand = [...squaredYards, ...a.openLandFor(wards), ...frontGardens];

  // Densify the network so a long street drapes over terrain bumps instead of
  // spanning them as one flat plank. Spacing is span-relative: the plan is
  // generated in a normalized frame and scaled per view, so a fixed number here
  // would be a different real distance in every town.
  const densified: TownStreet[] = a.streetNetwork.map((st) => ({
    ...st,
    centerline: densifyPolyline(st.centerline, envSpan / 50),
  }));
  // The market comes after the temple and keep grounds, so their indices stay.
  return { footprint, core, wards, plots: allPlots, outskirts, openLand, walls, civic, streets, streetNetwork: densified, courtyards, farmsteads, demographics, form: a.form, civicGrounds: [...(a.civicGrounds ?? []), ...marketGrounds] };
}

/**
 * LANE VILLAGE (GG-548): every unwalled settlement. Houses stand along the
 * road and a few branch lanes with gardens behind them; a green and a church
 * sit at the heart; strip fields run back from the roads. The layout rules
 * live in `laneVillage.ts`; this function seats water, civic ground and the
 * street network around them and runs the shared finishing passes.
 */
function generateLaneVillagePlan(
  footprint: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions,
  profile: TownScaleProfile,
  core: Pt[],
  cellCenter: Pt,
  fpSpan: number,
): TownPlan {
  const eb = polygonBounds(core);
  const coreSpan = Math.max(eb.maxX - eb.minX, eb.maxY - eb.minY) || 1;
  // A village has no wards to measure; a schematic plan takes a twelfth of
  // the core as its nominal ward.
  const sizing = townSizing(opts, opts, coreSpan / 12);
  const unit = sizing.unit;
  const water = opts.water ?? [];
  const bridgeWater = opts.bridgeWater ?? water;
  // GG-561: the village keeps off the river's true channel too.
  const coastSet = new Set(opts.coast ?? []);
  const villageRivers = opts.bridgeWater ?? water.filter((l) => !coastSet.has(l));
  const channelHalf = opts.waterWidth && opts.waterWidth > 0 && villageRivers.length > 0 ? opts.waterWidth / 2 + unit(RIVER_BANK_FT) : 0;
  const waterCarve = waterCarveQuads(water, opts.coast ?? [], fpSpan, sizing, channelHalf || undefined);
  const streetWidth = sizing.laneWidth * TIER_WIDTH_RATIO.street;
  const avenueWidth = sizing.laneWidth * TIER_WIDTH_RATIO.avenue;

  const layout = buildLaneVillage({
    footprint,
    extent: core,
    center: cellCenter,
    roads: opts.roads ?? [],
    blockers: waterCarve,
    // GG-582: a branch lane may not start on the street's bridge.
    ...(villageRivers.length > 0 && opts.waterWidth ? { river: { lines: villageRivers, half: opts.waterWidth / 2 } } : {}),
    population: profile.population,
    hasGreen: profile.hasPlaza,
    hasChurch: profile.hasTemple,
    streetWidth,
    laneWidth: sizing.laneWidth,
    lotWidth: unit(26),
    minLotWidth: unit(MIN_LOT_WIDTH_FT),
    lotDepth: unit(24),
    gardenDepth: unit(45),
    frontGardenDepth: unit(FRONT_GARDEN_FT.suburb),
    snap: sizing.physical ? unit(CELL_FT) : 0,
    greenSize: unit(70),
    churchSize: unit(36),
    churchyardMargin: unit(CIVIC_GROUNDS_FT.temple),
    intersects: polygonsIntersect,
    seedPath: streamPath(seedPath, 'lane-village'),
  });

  const wards: TownWard[] = layout.rows.map((row) => ({ polygon: row.ground, block: row.strip, plots: row.plots }));
  const civic: CivicStructure[] = [];
  if (layout.green) {
    civic.push({ kind: 'plaza', polygon: layout.green, wardIndex: wards.length });
    wards.push({ polygon: layout.green, block: layout.green, plots: [], civic: 'plaza' });
  }
  // THE CHURCH AND ITS GROUNDS (GG-566). The church faces the street from
  // inside its yard; a forecourt and an approach run from its door to the
  // street, and the faith of the cell chooses what the yard holds.
  const civicGrounds: CivicGrounds[] = [];
  if (layout.church) {
    const wardIndex = wards.length;
    civic.push({ kind: 'temple', polygon: layout.church, wardIndex });
    wards.push({ polygon: layout.churchyard ?? layout.church, block: layout.church, plots: [], civic: 'temple' });
    if (layout.churchyard && layout.churchFoot) {
      const ch = layout.church;
      const door: Pt = [(ch[0][0] + ch[1][0]) / 2, (ch[0][1] + ch[1][1]) / 2];
      const center = polygonCentroid(ch);
      const fl = len(door, layout.churchFoot) || 1;
      const face: Pt = [(layout.churchFoot[0] - door[0]) / fl, (layout.churchFoot[1] - door[1]) / fl];
      const fcDepth = Math.max(0, fl - streetWidth / 2);
      const forecourt = pierQuad(door, face, fcDepth, len(ch[0], ch[1]) * 0.8);
      const approach = [door, layout.churchFoot];
      const approachWidth = unit(CIVIC_APPROACH_FT.temple);
      const pick = templeSetPiece(opts.faith);
      civicGrounds.push({
        wardIndex, civicKind: 'temple', setPiece: pick.setPiece, chosenBy: pick.chosenBy,
        grounds: layout.churchyard, forecourt, approach, approachWidth,
        features: setPieceFeatures({
          setPiece: pick.setPiece, grounds: layout.churchyard, building: ch, center, face,
          halfSize: Math.max(len(ch[0], ch[1]), len(ch[1], ch[2])) / 2,
          forecourt, approach, approachWidth, unit,
          seedPath: streamPath(seedPath, `civic-grounds:${wardIndex}`),
        }),
      });
    }
  }

  // One landing stage where the water comes nearest the heart (the dock cap
  // for a village is one), and one bridge where the street crosses a river.
  const extentR = coreSpan / 2;
  const wp = nearestWaterPoint(layout.heart, water);
  if (wp && Math.hypot(wp[0] - layout.heart[0], wp[1] - layout.heart[1]) < extentR * 1.2) {
    const dx = wp[0] - layout.heart[0], dy = wp[1] - layout.heart[1];
    const dl = Math.hypot(dx, dy) || 1;
    const pierWidth = unit(14);
    // GG-561: on a river the landing stage starts at the bank, not at the
    // river's center line, and reaches 30% of the way across.
    const onRiver = channelHalf > 0 && distToLines(wp, villageRivers) < 1e-6;
    const back = onRiver ? channelHalf : pierWidth;
    const reach = onRiver ? unit(RIVER_BANK_FT) + (opts.waterWidth ?? 0) * 0.3 : unit(60);
    const base: Pt = [wp[0] - (dx / dl) * back, wp[1] - (dy / dl) * back];
    civic.push({ kind: 'dock', polygon: pierQuad(base, [dx / dl, dy / dl], reach, pierWidth), wardIndex: -1 });
  }
  // GG-560: each deck carries its own lane or street, along it, at its width
  // plus parapets; a deck that touches another is dropped.
  const crossings: Array<{ at: Pt; dir: Pt; width: number }> = [];
  for (const lane of layout.lanes) {
    const width = lane.kind === 'branch' ? sizing.laneWidth : streetWidth;
    for (const river of bridgeWater) {
      for (let i = 0; i < lane.line.length - 1; i++) {
        for (let j = 0; j < river.length - 1; j++) {
          const x = segIntersectPoint(lane.line[i], lane.line[i + 1], river[j], river[j + 1]);
          const dir: Pt = [lane.line[i + 1][0] - lane.line[i][0], lane.line[i + 1][1] - lane.line[i][1]];
          if (x) crossings.push({ at: x, dir, width });
        }
      }
    }
  }
  civic.push(...keepDecksApart(crossings
    .sort((p, q) => dist2(p.at, layout.heart) - dist2(q.at, layout.heart))
    .map((c) => ({ kind: 'bridge' as const, polygon: bridgeDeck(c.at, c.dir, c.width, bridgeWater, opts, fpSpan, sizing), wardIndex: -1 })),
  sizing.laneWidth).slice(0, bridgeCapForTypology(profile.typology)));
  const solid = civic.filter((c) => c.kind === 'dock' || c.kind === 'bridge');
  if (solid.length > 0) {
    for (const w of wards) w.plots = w.plots.filter((p) => !solid.some((c) => polygonsIntersect(p.polygon, c.polygon)));
  }

  // The street network. The road is the village STREET inside the village and
  // the approach outside it; branch lanes are back lanes.
  const streetNetwork: TownStreet[] = [];
  const roads = opts.roads ?? [];
  for (const road of roads) {
    const parts = splitPolylineByRing(road, core);
    for (const line of parts.inside) streetNetwork.push({ centerline: line, tier: 'street', role: 'spine', width: streetWidth });
    for (const line of parts.outside) streetNetwork.push({ centerline: line, tier: 'avenue', role: 'approach', width: avenueWidth });
  }
  for (const lane of layout.lanes) {
    if (lane.kind === 'branch') {
      streetNetwork.push({ centerline: lane.line, tier: 'lane', role: 'ward', width: sizing.laneWidth });
    } else if (roads.length === 0) {
      // A village with no world road: its own seeded street.
      streetNetwork.push({ centerline: lane.line, tier: 'street', role: 'spine', width: streetWidth });
    }
  }

  // THE MAIN STREET (GG-567): in a village it is the village street that
  // passes the green, the street the village grew along.
  let mainIdx = -1, mainD = Infinity;
  streetNetwork.forEach((s, i) => {
    if (s.role !== 'spine') return;
    const d = polylineDist2(layout.heart, s.centerline);
    if (d < mainD) { mainD = d; mainIdx = i; }
  });
  if (mainIdx >= 0) streetNetwork[mainIdx] = { ...streetNetwork[mainIdx], main: true };

  for (const g of civicGrounds) streetNetwork.push({ centerline: g.approach, tier: 'street', role: 'passage', width: g.approachWidth });
  const streets = roads.flatMap((r) => clipPolylineToPolygon(r, footprint));
  const outskirtCount = Math.max(18, Math.min(80, Math.round(profile.wardCount * 1.1)));
  const outskirts = stripFarmParcels({
    outskirts: buildOutskirts(footprint, core, cellCenter, seedPath, outskirtCount),
    roads: [...roads, ...layout.lanes.map((l) => l.line)],
    center: cellCenter,
    stripWidth: sizing.physical ? unit(STRIP_FIELD_WIDTH_FT) : fpSpan * 0.03,
    roadReach: fpSpan * 0.12,
    retainParentParcels: opts.ruralHouseholdSources,
    seedPath: streamPath(seedPath, 'strip-fields'),
  });

  return finishTownPlan({
    footprint, core, wards, civic,
    walls: { ring: [], gatehouses: [], waterGates: [] },
    streets, streetNetwork, outskirts, profile, seedPath,
    townCenter: layout.heart, coreSpan, envSpan: coreSpan, form: 'lanes',
    unit, laneWidth: sizing.laneWidth, civicGrounds,
    ruralHouseholdSources: opts.ruralHouseholdSources,
    openLandFor: () => layout.gardens.map((g) => ({ polygon: g.polygon, kind: g.kind, source: 'ward' as const, ...(g.front ? { front: true } : {}) })),
  });
}

/** Convenience: total building plots across all wards. */
export function countPlots(plan: TownPlan): number {
  return plan.wards.reduce((n, w) => n + w.plots.length, 0);
}

export { polygonBounds };
