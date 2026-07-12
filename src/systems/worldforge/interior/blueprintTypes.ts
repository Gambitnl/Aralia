// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 11/07/2026, 14:54:30
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, components/DesignPreview/steps/PreviewBuilding3D.tsx, components/Worldforge/TownPlanView.tsx, systems/world3d/buildingModels.ts, systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/briefProgram.ts, systems/worldforge/interior/doors.ts, systems/worldforge/interior/footprint.ts, systems/worldforge/interior/furnish.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/generateInterior.ts, systems/worldforge/interior/manifests.ts, systems/worldforge/interior/occupancy.ts, systems/worldforge/interior/partition.ts, systems/worldforge/interior/program.ts, systems/worldforge/interior/renderBlueprintSvg.ts, systems/worldforge/interior/roofPlan.ts, systems/worldforge/interior/tradeRooms.ts, systems/worldforge/interior/walls.ts, systems/worldforge/town/architectureStyle.ts, systems/worldforge/town/buildingMotifs.ts, systems/worldforge/town/householdBrief.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// CONTRACT FROZEN for Phase 1A (Task 3). RE-FROZEN for Phase 1B (Roofscapes,
// Task 1), then extended additively for cohesive architectural identity. The
// identity extension does not change rooms, walls, or old style inputs: callers
// opt into town/district/building keys and receive extra resolved dress fields.
// Phase 1B additions:
//   - RoofPlan family (RoofChimney/RoofDormer/RoofTowerCap/RoofPlane/RoofPlan)
//   - StyleResolved (the resolved dress: one answer for 2D and 3D)
//   - BlueprintPlan gains `masses` (always set), `roof?`, `styleResolved?`
// Two reconciliations folded in here (both deliberate coordinated edits):
//   1. StyleContext.cultureId: number → cultureType: string. The 1A reserve
//      spelled it `cultureId`; the roof/style solver consumes the FMG culture
//      TYPE string via styleFamilyForCultureType (town/architectureStyle.ts).
//      Nothing populates StyleContext yet (grep: zero non-test consumers read
//      the field — only `style?: StyleContext` on BlueprintPlan references the
//      type), so the rename is safe.
//   2. StyleResolved / RoofPlan land verbatim from the Phase 1B Task 1 brief.
// Further additions require another deliberate re-freeze task.
import type { Feet } from '../units';
import type { FootprintMass } from './footprint';

/**
 * This file is the shared data contract for generated building blueprints.
 *
 * The building generator writes these room, wall, roof, style, and identity
 * records. The 2D blueprint drawer, 3D building bridge, occupancy system, and
 * town integration all read the same plan so they cannot invent conflicting
 * versions of one building. It contains data shapes only; generation and
 * rendering rules live in their dedicated modules.
 */

export type BuildingType =
  // residential
  | 'cottage' | 'townhouse' | 'tenement' | 'farmstead'
  // workplaces
  | 'shop' | 'smithy' | 'workshop' | 'inn' | 'tavern' | 'storehouse'
  // grand / civic
  | 'manor' | 'temple' | 'keep' | 'civic';

export type RoomPurpose =
  | 'hall' | 'common-room' | 'great-hall' | 'nave'
  | 'kitchen' | 'bedroom' | 'guest-room' | 'private-room' | 'solar'
  | 'shopfront' | 'workshop' | 'storage' | 'pantry' | 'cellar' | 'armory'
  | 'sanctuary' | 'vestry' | 'study' | 'guard-room' | 'corridor'
  // v2 building types (Task 2)
  | 'forge' | 'counting-room' | 'servant-room' | 'stockroom' | 'brewhouse';

export const EXTERIOR = -1;

/** Coarse family description the generator designs a house for.
 *  Slots and counts, never names — names stay lazy (town/household.ts). */
export interface MemberSlot {
  /** Stable tag: 'head', 'spouse', 'child:0', 'elder:0', 'kin:0', 'lodger:0', 'servant:0'. */
  tag: string;
  role: 'head' | 'spouse' | 'child' | 'elder' | 'kin' | 'lodger' | 'servant';
  ageBand: 'child' | 'adult' | 'elder';
}

export type BriefWealth = 'poor' | 'common' | 'wealthy';

/**
 * Stable names for the three architectural scopes a building belongs to.
 *
 * The settlement key keeps one town distinct from another, the district key
 * lets a quarter repeat a recognizable local dialect, and the building key
 * supplies the controlled exceptions that stop a street from looking cloned.
 * Keys are strings because production uses durable names such as `burg:17`,
 * `district:2`, and `plot:42`, while previews can use human-readable labels.
 */
export interface ArchitectureIdentity {
  settlementKey: string;
  districtKey: string;
  buildingKey: string;
}

export interface HouseholdBrief {
  homeId: string;
  slots: MemberSlot[];
  /** Head's trade ("blacksmith", "innkeeper", "farmer", "labourer"). */
  trade: string;
  /** True when the family runs THIS building (smithy, shop, inn, tavern). */
  worksAtHome: boolean;
  wealth: BriefWealth;
}

/** Which side of the plan faces the street. Convention is FIXED: the min-y
 *  cell edge (the 3D bridge maps plan +y depth inward from the street). */
export interface FrontageInfo {
  side: 'minY';
  /** The ground-floor street entry (the isEntry door's position). */
  entryX: Feet; entryY: Feet;
}

/**
 * Facts the architectural resolver needs before it dresses a building.
 *
 * Culture, climate, wealth, and age keep the approved Building Generator v2
 * drivers. `architecture` is optional so older fixtures and standalone
 * previews retain their exact per-building style stream; production supplies
 * it to coordinate a town, one of its social districts, and the individual lot.
 */
export interface StyleContext {
  /** FMG culture TYPE string (consumed by styleFamilyForCultureType). */
  cultureType: string; climate: 'temperate' | 'cold' | 'arid' | 'marsh';
  wealth: BriefWealth; ageBand: 'new' | 'aged' | 'old' | 'ancient';
  architecture?: ArchitectureIdentity;
}
export interface BuildingBackstory {
  ageBand: 'new' | 'aged' | 'old' | 'ancient';
  /** Later build phases per wing index; empty = built in one phase. */
  phases: number[];
  /** Wear kinds rolled at birth ('sealed-door' | 're-roofed' | 'sagging-ridge' | 'patched-wall'). */
  wear: string[];
}
export interface BuildingEvent { day: number; kind: string; payload?: Record<string, unknown>; }

/** A 5 ft grid cell (cell coords, not feet). Feet = cell * 5. */
export interface Cell { cx: number; cy: number; }

// ── Roof solver output (Phase 1B) ─────────────────────────────────────────
export interface RoofChimney { x: Feet; y: Feet; topFt: Feet; }
export interface RoofDormer { x: Feet; y: Feet; /** outward normal of the roof side it pierces */ nx: number; ny: number; }
export interface RoofTowerCap { x: Feet; y: Feet; w: Feet; d: Feet; apexFt: Feet; form: 'pyramid' | 'cone'; }
/** One planar roof face: 3-4 corners in feet, z = height above wall-top. */
export interface RoofPlane { pts: Array<[Feet, Feet, Feet]>; }
export interface RoofPlan {
  planes: RoofPlane[];
  ridges: Array<{ x1: Feet; y1: Feet; x2: Feet; y2: Feet; zFt: Feet }>;
  valleys: Array<{ x1: Feet; y1: Feet; x2: Feet; y2: Feet }>;
  chimneys: RoofChimney[];
  dormers: RoofDormer[];
  towerCaps: RoofTowerCap[];
  pitchRiseFt: Feet;
  eaveOverhangFt: Feet;
}
/**
 * Façade grammars shared by the identity resolver and the 3D bridge.
 *
 * These are deliberately structural names rather than culture names: each
 * culture family offers a subset, districts choose a dominant pattern, and a
 * minority of buildings choose a related alternative.
 */
export type FacadePattern =
  | 'plain'
  | 'belt-course'
  | 'vertical-bays'
  | 'half-timber'
  | 'log-bands';

/**
 * Additive exterior cues that make a building's purpose legible at a glance.
 *
 * Motifs never modify the permanent room/wall plan. The style resolver chooses
 * them from building type, culture family, district signature, and building
 * variant; the 3D bridge projects them as separately tagged exterior parts.
 */
export type BuildingMotif =
  | 'front-canopy'
  | 'shop-awning'
  | 'display-bay'
  | 'bay-window'
  | 'jettied-bay'
  | 'hanging-sign'
  | 'vent-stack'
  | 'loading-hoist'
  | 'side-shed'
  | 'covered-gallery'
  | 'entry-portico'
  | 'bell-cote'
  | 'roof-finials'
  | 'battlements'
  | 'corner-turrets'
  | 'buttresses'
  | 'log-porch';

/** The resolved dress: one answer for 2D and 3D. Never affects geometry
 *  below the wall-top (pinned by the style-identity test). */
export interface StyleResolved {
  familyId: string;             // architectureStyle StyleFamily['id']
  wallColor: string; roofColor: string; trimColor: string;
  roofForm: 'gable' | 'hip' | 'steep' | 'flat';
  pitchRiseFt: Feet; eaveOverhangFt: Feet;
  /** Wealth finish tier drives palette pick + ornament flag. */
  finishTier: 'poor' | 'common' | 'wealthy';
  ornament: boolean;
  raisedPlinth: boolean;        // marsh climate
  /** Shared signature repeated by buildings in the same settlement district. */
  districtSignature: string;
  /** Stable individual token used to prove neighboring buildings are not clones. */
  buildingVariant: string;
  /** Visible wall-detail grammar consumed by the 3D bridge. */
  facadePattern: FacadePattern;
  /** Type-recognition and culture-accent cues consumed by the 3D bridge. */
  motifs: BuildingMotif[];
  /** Small 0..2 geometry variant shared by all motifs on this building. */
  motifVariant: 0 | 1 | 2;
  /** District/type motif recipe token; sibling buildings may vary around it. */
  motifSignature: string;
}

export interface BlueprintRoom {
  id: number;
  purpose: RoomPurpose;
  cells: Cell[];
  /** Room size as a CELL COUNT (=== cells.length; each cell is 5×5 ft, so
   *  square feet = area * 25). Unlike the bbox, this never counts phantom
   *  cells outside an L-shaped room. */
  area: number;
  /** A cell GUARANTEED to belong to the room — the room cell closest to the
   *  room's centroid (ties: row-major first). Use this for labels, stairs
   *  and camera framing; a bbox center can land OUTSIDE a non-convex room. */
  anchor: Cell;
  /** Convenience bbox in feet. LOOSE BOUND ONLY for non-rectangular rooms:
   *  when area !== (w/5)*(d/5) the room is L-shaped and the bbox overstates
   *  it (its center may lie outside the room — use `anchor` instead). */
  bbox: { x: Feet; y: Feet; w: Feet; d: Feet };
  isMain: boolean;
  isCorridor: boolean;
  /** The MemberSlot tags this room was programmed for, comma-joined
   *  (e.g. 'child:0,child:1'). Undefined until the programmer wires it. */
  forSlot?: string;
}

/** A door on a wall line. axis 'x' = horizontal wall (crosses a y boundary),
 *  'y' = vertical wall (crosses an x boundary). Matches InteriorDoorway. */
export interface BlueprintDoor {
  a: number; b: number; // room ids; a === EXTERIOR for the street entry
  x: Feet; y: Feet;
  axis: 'x' | 'y';
  isEntry: boolean;
  /** Unit cell delta pointing from the door ACROSS the edge INTO the room the
   *  door opens into (perpendicular to the wall: axis 'x' ⇒ nx=0, ny=±1;
   *  axis 'y' ⇒ ny=0, nx=±1). This is the swing contract — renderers draw the
   *  leaf from openDir/swingInto, never from a/b ordering. */
  openDir: { nx: number; ny: number };
  /** Room id the door opens into (the larger room, ties → lower id; entry
   *  doors open inward, so swingInto === b). Always one of a/b. */
  swingInto: number;
}

export interface BlueprintWindow { x: Feet; y: Feet; axis: 'x' | 'y'; }

export interface BlueprintFurnishing {
  kind: string; roomId: number; x: Feet; y: Feet; rotation: 0 | 90 | 180 | 270;
}

/** A wall segment on one cell edge. thicknessFt grows outward from the line. */
export interface WallEdge {
  x: Feet; y: Feet; axis: 'x' | 'y';
  kind: 'outer' | 'inner';
  thicknessFt: Feet;
  /** Unit cell delta pointing FROM the interior (roomA) cell ACROSS the edge:
   *  toward open air for outer walls, toward roomB's cell for inner walls.
   *  Exactly one of nx/ny is ±1 (axis 'y' ⇒ nx, axis 'x' ⇒ ny). */
  nx: number; ny: number;
  /** Room id on the interior side of the edge (the cell the scan emitted from). */
  roomA: number;
  /** Room id across the edge; EXTERIOR (-1) for outer walls. */
  roomB: number;
}

/** A maximal straight run of collinear, same-kind, same-normal wall edges.
 *  Runs break at doors (door edges emit no WallEdge, so a door splits a run).
 *  Endpoints are in feet, on the 5 ft grid lines. The drawing/3D-friendly
 *  view of `walls`; per-edge `walls` stays for cell-level queries. */
export interface WallRun {
  x1: Feet; y1: Feet; x2: Feet; y2: Feet;
  axis: 'x' | 'y';
  kind: 'outer' | 'inner';
  thicknessFt: Feet;
  /** Outward normal shared by every edge in the run (see WallEdge.nx/ny). */
  nx: number; ny: number;
}

export interface BlueprintFloor {
  level: number; // -1 = basement, 0 = ground, 1+ = upper
  rooms: BlueprintRoom[];
  doors: BlueprintDoor[];
  windows: BlueprintWindow[];
  furnishings: BlueprintFurnishing[];
  walls: WallEdge[];
  /** Merged straight wall runs (see WallRun) — same wall set as `walls`. */
  wallRuns: WallRun[];
}

export interface BlueprintStair { fromLevel: number; x: Feet; y: Feet; }

export interface BlueprintPlan {
  buildingId: number;
  type: BuildingType;
  footprintCells: Cell[];
  widthFt: Feet; depthFt: Feet;
  floors: BlueprintFloor[]; // ordered basement..ground..upper; ground has level 0
  stairs: BlueprintStair[];
  /** Echo of the input household brief (undefined for bare v1 calls). */
  household?: HouseholdBrief;
  /** Which plan side faces the street (undefined until Task 9). */
  frontage?: FrontageInfo;
  /** Exact mass decomposition of the footprint (main first), echoed from
   *  Footprint.masses. ALWAYS set — the roof solver keys off it (Phase 1B). */
  masses: FootprintMass[];
  /** Solved roof — set when a style context is provided (Phase 1B Task 4). */
  roof?: RoofPlan;
  /** Resolved architectural dress — set with a style context (Phase 1B Task 4). */
  styleResolved?: StyleResolved;
  /** RESERVED for Phase 1B/3 — undefined in Phase 1A. */
  style?: StyleContext;
  /** RESERVED for Phase 1B/3 — undefined in Phase 1A. */
  backstory?: BuildingBackstory;
}

export const cellKey = (cx: number, cy: number): string => `${cx},${cy}`;
