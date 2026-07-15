// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 14/07/2026, 22:28:23
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, components/DesignPreview/steps/PreviewBuilding3D.tsx, components/World3D/World3DWrapper.tsx, components/World3D/worldGenCore.ts, components/Worldforge/TownPlanView.tsx, systems/world3d/buildingModels.ts, systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/buildingEnsembleParts.ts, systems/worldforge/bridge/buildingHistoryParts.ts, systems/worldforge/bridge/buildingMaterialParts.ts, systems/worldforge/bridge/buildingMotifParts.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/buildingPartyWalls.ts, systems/worldforge/bridge/buildingWeatheringParts.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/briefProgram.ts, systems/worldforge/interior/buildingEventHistory.ts, systems/worldforge/interior/buildingExtensions.ts, systems/worldforge/interior/buildingHistory.ts, systems/worldforge/interior/doors.ts, systems/worldforge/interior/footprint.ts, systems/worldforge/interior/furnish.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/generateInterior.ts, systems/worldforge/interior/manifests.ts, systems/worldforge/interior/occupancy.ts, systems/worldforge/interior/partition.ts, systems/worldforge/interior/program.ts, systems/worldforge/interior/renderBlueprintSvg.ts, systems/worldforge/interior/roofPlan.ts, systems/worldforge/interior/tradeRooms.ts, systems/worldforge/interior/walls.ts, systems/worldforge/town/architectureStyle.ts, systems/worldforge/town/buildingAge.ts, systems/worldforge/town/buildingEnsembles.ts, systems/worldforge/town/buildingMaterials.ts, systems/worldforge/town/buildingMotifs.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/town/buildingWeathering.ts, systems/worldforge/town/detachedParcels.ts, systems/worldforge/town/householdBrief.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSim.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/types.ts
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
 * Broad construction age used by town growth rings and permanent history.
 *
 * This is deliberately about the building, not its current occupants. A new
 * family can move into an ancient house without changing the age recorded on
 * the blueprint.
 */
export type BuildingAgeBand = 'new' | 'aged' | 'old' | 'ancient';

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

// ============================================================================
// Town Block And Building Ensemble Identity
// ============================================================================
// Architecture controls dress; ensemble data describes how a building belongs
// to its immediate street or court. It is authored by the town before the pure
// per-building generator runs, preserving the style/geometry ownership boundary.
// ============================================================================

export type BuildingEnsembleKind =
  | 'detached'
  | 'row'
  | 'courtyard'
  | 'market-arcade';

/** How a current town lot asks the building generator to occupy its envelope. */
export type BuildingLotProfile =
  | 'full-envelope'
  | 'rear-court'
  | 'left-return'
  | 'right-return';

/** How a detached building sits inside its larger street-facing parcel. */
export type DetachedParcelProfile =
  | 'lane-setback'
  | 'garden-setback'
  | 'left-side-yard'
  | 'right-side-yard';

/** Canonical block-level instructions stamped onto one building lot. */
export interface BuildingEnsemble {
  /** Stable street-edge or courtyard group shared by neighboring buildings. */
  blockKey: string;
  kind: BuildingEnsembleKind;
  /** Shared side walls in the building's frontage-oriented local frame. */
  partyWallLeft: boolean;
  partyWallRight: boolean;
  /**
   * Which frontage-order member visibly owns each shared wall. Both neighbors
   * retain their own tactical wall, but only this member renders the masonry.
   * Optional so old saves and synthetic previews keep their former behavior.
   */
  partyWallOwner?: 'earlier-frontage-member' | 'later-frontage-member';
  /** Group-level wall-top target that creates continuous or stepped eave lines. */
  eaveStoreys: 1 | 2 | 3;
  /**
   * Optional current-generation footprint agreement. Attached buildings and
   * viable detached compounds use it to meet their snapped envelope limits
   * deliberately instead of losing an unrelated footprint to a later crop.
   */
  lotProfile?: BuildingLotProfile;
  /** Stable per-lot proof of the profile choice; absent on legacy receipts. */
  lotSignature?: string;
  /** Explicit rural/suburban placement inside a detached plot envelope. */
  parcelProfile?: DetachedParcelProfile;
  /** Stable proof of the district vocabulary and per-lot placement choice. */
  parcelSignature?: string;
  /** Stable receipt proving which group recipe produced this instruction. */
  ensembleSignature: string;
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
  wealth: BriefWealth; ageBand: BuildingAgeBand;
  architecture?: ArchitectureIdentity;
}

/** Historic changes that can remain visible on a permanent building shell. */
export type BuildingWearKind =
  | 'sealed-door'
  | 're-roofed'
  | 'sagging-ridge'
  | 'patched-wall'
  | 'fire-scar';

/** Shared target fields for history attached to one exterior wall run. */
export interface BuildingWallHistoryTarget {
  floorLevel: number;
  wallRunIndex: number;
  alongFt: Feet;
  widthFt: Feet;
  baseFt: Feet;
  heightFt: Feet;
  colorHex: string;
}

/**
 * One resolved, renderable fact from a building's past.
 *
 * Targets point at stable blueprint arrays rather than world coordinates. The
 * 2D and 3D consumers can therefore read one answer, and history never needs
 * to guess which wall, roof plane, ridge, or footprint mass was meant. Wall
 * kinds stay separate union members so consumers can narrow them exhaustively.
 */
export type BuildingHistoryFeature =
  | {
      kind: 'later-phase';
      massIndex: number;
      phase: number;
      colorHex: string;
    }
  | ({ kind: 'sealed-door' } & BuildingWallHistoryTarget)
  | ({ kind: 'patched-wall' } & BuildingWallHistoryTarget)
  | ({ kind: 'fire-scar' } & BuildingWallHistoryTarget)
  | {
      kind: 're-roofed';
      planeIndex: number;
      colorHex: string;
    }
  | {
      kind: 'sagging-ridge';
      ridgeIndex: number;
      deflectionFt: Feet;
      colorHex: string;
    };

export interface BuildingBackstory {
  ageBand: BuildingAgeBand;
  /**
   * One phase number per secondary footprint mass. Zero means it was built
   * with the core; positive values identify visibly later additions.
   */
  phases: number[];
  /** Compact semantic summary used by inspectors, saves, and tests. */
  wear: BuildingWearKind[];
  /** Stable token proving that this exact building history can be replayed. */
  historySignature: string;
  /** Concrete targets and materials consumed by blueprint renderers. */
  features: BuildingHistoryFeature[];
}
/** Damage intensity stored by a fire or ruin event. Higher values affect more targets. */
export type BuildingDamageSeverity = 1 | 2 | 3;

/**
 * One chronological, replayable change to a building after generation.
 *
 * Payloads store outcomes rather than fresh random instructions. In particular,
 * renovation colors and extension targets are explicit so loading a save never
 * depends on the current district palette or generator implementation.
 */
export type BuildingEvent =
  | {
      day: number;
      kind: 'fire-damage';
      payload: {
        incidentId: string;
        severity: BuildingDamageSeverity;
      };
    }
  | {
      day: number;
      kind: 'renovation';
      payload?: {
        scope?: 'repair' | 'restyle';
        wallColor?: string;
        roofColor?: string;
        trimColor?: string;
        facadePattern?: FacadePattern;
      };
    }
  | {
      day: number;
      kind: 'extension';
      payload: {
        phase: number;
        colorHex?: string;
      } & (
        | {
            /** Legacy replay: reveal a secondary mass already present in the plan. */
            massIndex: number;
            mass?: never;
          }
        | {
            /**
             * Structural replay outcome in the original footprint's cell frame.
             * Negative coordinates are valid; generation normalizes the enlarged
             * footprint while retaining the original core's position on its lot.
             */
            mass: Pick<FootprintMass, 'kind' | 'x' | 'y' | 'w' | 'h'>;
            massIndex?: never;
          }
      );
    }
  | {
      day: number;
      kind: 'abandonment';
      payload?: {
        reason?: string;
        /** Fraction of windows boarded, clamped to 0..1. */
        boardedFraction?: number;
      };
    }
  | {
      day: number;
      kind: 'reoccupation';
      payload?: { occupantId?: string };
    }
  | {
      day: number;
      kind: 'ruin';
      payload?: {
        cause?: 'fire' | 'war' | 'neglect' | 'collapse';
        severity?: BuildingDamageSeverity;
      };
    };

/** Exact render targets derived by applying the ordered event log to one plan. */
export type BuildingLiveHistoryFeature =
  | {
      kind: 'scorched-room';
      floorLevel: number;
      roomId: number;
      intensity: BuildingDamageSeverity;
    }
  | {
      kind: 'roof-hole';
      planeIndex: number;
      x: Feet;
      y: Feet;
      radiusFt: Feet;
    }
  | {
      kind: 'boarded-window';
      floorLevel: number;
      windowIndex: number;
    }
  | {
      kind: 'extension-phase';
      massIndex: number;
      phase: number;
      colorHex: string;
    }
  | {
      kind: 'ruin-sag';
      ridgeIndex: number;
      deflectionFt: Feet;
      colorHex: string;
    };

export type BuildingUseState = 'occupied' | 'abandoned' | 'ruined';

/** Folded condition produced by `applyHistory`; the event log remains the source of truth. */
export interface AppliedBuildingHistory {
  lastDay: number;
  eventsApplied: number;
  status: BuildingUseState;
  /** A renovation hides old repair/damage dressing without deleting the backstory. */
  renovatedBackstory: boolean;
  features: BuildingLiveHistoryFeature[];
  /** Stable digest of the ordered log and its resulting condition. */
  historySignature: string;
}

/** A structural event retained across compaction with its original absolute ordinal. */
export interface SnapshottedStructuralBuildingEvent {
  eventIndex: number;
  event: Extract<BuildingEvent, { kind: 'extension' }>;
}

/**
 * Version 1 folded prefix. Renderer targets and style are stored outcomes; the
 * short structural list is retained because additions must exist before rooms
 * and roofs regenerate. Production registration bounds that list separately.
 */
export interface BuildingHistorySnapshotV1 {
  version: 1;
  throughDay: number;
  eventDigest: string;
  history: AppliedBuildingHistory;
  /** Day the current use state began; null means no use transition occurred. */
  useStateSinceDay: number | null;
  styleResolved?: StyleResolved;
  structuralEvents: SnapshottedStructuralBuildingEvent[];
  /** Fire ids on throughDay preserve same-day append idempotence after folding. */
  fireIncidentIdsOnThroughDay: string[];
}

/** A folded prefix plus a short chronological tail of newer events. */
export interface BuildingHistoryJournalV1 {
  version: 1;
  snapshot: BuildingHistorySnapshotV1;
  events: BuildingEvent[];
}

/** Legacy arrays remain valid save data and migrate only when compaction runs. */
export type BuildingEventHistory = BuildingEvent[] | BuildingHistoryJournalV1;

/** Compact save/worker shapes keyed by canonical plot id and then burg id. */
export type BuildingEventLogsByPlot = Record<number, BuildingEventHistory>;
export type BuildingEventLogsByBurg = Record<number, BuildingEventLogsByPlot>;

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

// ============================================================================
// Resolved Building Weathering
// ============================================================================
// Age should leave a visible record without changing the permanent floor plan.
// These closed names let generation, inspectors, and renderers share one patina
// answer while keeping structural damage in the separate history system.
// ============================================================================

/** Climate- and material-compatible residue visible on exterior walls. */
export type WallPatina =
  | 'none'
  | 'rain-streaks'
  | 'salt-bloom'
  | 'lichen'
  | 'dust-veil'
  | 'soot-wash';

/** Climate- and covering-compatible ageing visible around the roof surface. */
export type RoofPatina =
  | 'none'
  | 'moss'
  | 'salt-fade'
  | 'sun-bleach'
  | 'lichen-speckle'
  | 'soot-darkening';

/**
 * One deterministic weathering receipt shared by 2D and 3D consumers.
 *
 * The district signature identifies the local exposure recipe. Intensity is
 * strictly age-led, while coverage and the variant token let neighboring old
 * buildings carry the same kind of patina in visibly different places.
 */
export interface BuildingWeathering {
  ageBand: BuildingAgeBand;
  wallPatina: WallPatina;
  roofPatina: RoofPatina;
  intensity: 0 | 1 | 2 | 3;
  coverage: number;
  weatheringSignature: string;
  weatheringVariant: string;
}

// ============================================================================
// Resolved Construction Materials
// ============================================================================
// Color alone cannot explain how a building was made. These closed names let
// the town map, blueprint, and 3D bridge share one answer for wall assembly,
// roof covering, foundations, windows, shutters, and decorative craft.
// ============================================================================

/** Material system that gives an exterior wall its visible construction rhythm. */
export type WallMaterial =
  | 'rubble-stone'
  | 'dressed-stone'
  | 'limewashed-stone'
  | 'weatherboard'
  | 'tarred-board'
  | 'timber-plaster'
  | 'brick-infill'
  | 'round-log'
  | 'hewn-log'
  | 'wattle-daub';

/** Durable covering laid over the solved roof planes. */
export type RoofCovering =
  | 'slate'
  | 'stone-slab'
  | 'wood-shingle'
  | 'reed-thatch'
  | 'clay-tile'
  | 'sod';

/** Treatment where the building meets the ground. */
export type FoundationTreatment =
  | 'fieldstone'
  | 'battered-stone'
  | 'brick-plinth'
  | 'stone-piers'
  | 'timber-piles';

/** Amount and assembly quality of light admitted through each window. */
export type GlazingType =
  | 'open-lattice'
  | 'oiled-lattice'
  | 'leaded-casement'
  | 'clear-casement';

/** Exterior closure fitted beside a window. */
export type ShutterStyle =
  | 'none'
  | 'board-and-batten'
  | 'louvered'
  | 'paneled';

/** Family-approved craft details used on corners, beams, and roof edges. */
export type OrnamentKit =
  | 'none'
  | 'stone-quoins'
  | 'carved-bargeboards'
  | 'painted-timber'
  | 'rope-carving'
  | 'notched-log';

/**
 * Closed kit ids make saved and inspected material choices readable.
 *
 * Each culture family owns exactly three related kits. A district repeats one
 * as its dominant construction method and permits at most one alternative, so
 * neighboring buildings differ without borrowing an unrelated culture's work.
 */
export type ConstructionKitId =
  | 'highland-rubble-slate'
  | 'highland-ashlar-slate'
  | 'highland-limewash-slab'
  | 'coastal-weatherboard-shingle'
  | 'coastal-tarred-board-shingle'
  | 'coastal-frame-thatch'
  | 'river-timber-tile'
  | 'river-brick-tile'
  | 'river-frame-shingle'
  | 'rough-round-log-sod'
  | 'rough-hewn-log-shingle'
  | 'rough-pole-thatch'
  | 'temperate-frame-thatch'
  | 'temperate-brick-tile'
  | 'temperate-board-shingle';

/** One fully resolved construction answer shared by every visual consumer. */
export interface BuildingConstruction {
  kitId: ConstructionKitId;
  wallMaterial: WallMaterial;
  /** Vertical distance between visible masonry, board, or log courses. */
  wallCourseFt: Feet;
  /** Width of exposed posts, beams, and heavy trim. */
  timberWidthFt: Feet;
  roofCovering: RoofCovering;
  foundation: FoundationTreatment;
  glazing: GlazingType;
  shutters: ShutterStyle;
  ornamentKit: OrnamentKit;
  /** District recipe token shared even when this building uses its alternative kit. */
  constructionSignature: string;
}

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
  /** Material construction kit consumed by 2D inspectors and the 3D bridge. */
  construction: BuildingConstruction;
  /**
   * Age- and exposure-led patina. Optional only so old serialized blueprints
   * remain valid; every newly resolved styled building receives this field.
   */
  weathering?: BuildingWeathering;
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
  /**
   * Point in plan feet that maps to the building site's local origin. Omitted
   * plans retain the historical envelope-center convention. Structural
   * extensions set this so an asymmetric addition cannot move the old core.
   */
  siteOriginFt?: { x: Feet; y: Feet };
  floors: BlueprintFloor[]; // ordered basement..ground..upper; ground has level 0
  stairs: BlueprintStair[];
  /** Echo of the input household brief (undefined for bare v1 calls). */
  household?: HouseholdBrief;
  /** Block/row/courtyard instruction authored by the canonical town composer. */
  ensemble?: BuildingEnsemble;
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
  /** Legacy full log or versioned folded journal for post-generation changes. */
  eventLog?: BuildingEventHistory;
  /** Pure replay result consumed by 2D and 3D renderers. */
  liveHistory?: AppliedBuildingHistory;
}

/** Resolve the plan-to-site origin without changing legacy blueprint output. */
export function blueprintSiteOrigin(
  plan: Pick<BlueprintPlan, 'widthFt' | 'depthFt' | 'siteOriginFt'>,
): { x: Feet; y: Feet } {
  return plan.siteOriginFt ?? { x: plan.widthFt / 2, y: plan.depthFt / 2 };
}

export const cellKey = (cx: number, cy: number): string => `${cx},${cy}`;
