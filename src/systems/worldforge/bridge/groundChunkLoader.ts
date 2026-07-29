// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 18/07/2026, 21:55:11
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/DungeonEntrances.tsx, components/World3D/GroundAgents.tsx, components/World3D/GroundMovePlane.tsx, components/World3D/GroundProps.tsx, components/World3D/PlayerAvatar.tsx, components/World3D/WebGPUProbe.tsx, components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/canopyInterior.ts, components/World3D/combat/InPlaceCombatLayer.tsx, components/World3D/createGroundWorkerChunkLoader.ts, components/World3D/createWorldGenClient.ts, components/World3D/groundChunkWorker.ts, components/World3D/worldGenCore.ts, components/Worldforge/AgentSim3DPreview.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx, systems/combat/worldScenario/liveSettlementEncounter.ts, systems/combat/worldScenario/statePatrolWorldEvent.ts, systems/combat/worldScenario/travelAmbushBattlefield.ts, systems/combat/worldScenario/worldBattleScenario.ts, systems/worldforge/bridge/dungeonEntrances.ts, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkWorkerCore.ts, systems/worldforge/bridge/groundHostiles.ts, systems/worldforge/bridge/groundProps.ts, systems/worldforge/provenance/groundProvenance.ts
 * Imports: 49 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file groundChunkLoader.ts â€” walking-scale ChunkData producer + loader for
 * Worldforge ground mode (slice 3b of Azgaar â†’ submap â†’ 3D world mode).
 *
 * KEY INSIGHT (replaces the planned coords.ts refactor): the world3d
 * geometry/bundle/streamer layers are SCALE-FREE â€” chunkGeometry spaces
 * vertices by CHUNK_WORLD_SIZE and maps height 0..100 â†’ meters via
 * heightToMeters; only chunkSampler's grid math bakes in the continent
 * METERS_PER_CELL (1024). So ground mode needs no core surgery: this module
 * samples chunks at GROUND scale (one LocalArtifact cell = 5 ft = 1.524 m)
 * and hands them to the SAME buildChunkBundle. The streamer, LOD and scene
 * consume the result unchanged.
 *
 * Coverage: a LocalArtifact spans 600 Ã— 1.524 m = 914.4 m â‰ˆ 7.14 chunks per
 * axis (CHUNK_WORLD_SIZE = 128 m). Vertices beyond the artifact clamp to its
 * edge values (flat continuation), mirroring chunkSampler's clamping.
 */
import type {
  ChunkData,
  ChunkMeshBundle,
  VegetationScatter,
  LodTier,
  BuildingOccupantRender,
} from "../../world3d/types";
import { handleGroundChunkRequest } from "./groundChunkWorkerCore";
import {
  WORLD3D_CONFIG,
  heightToMeters,
  metersToHeight,
  resolutionForLod,
} from "../../world3d/config";
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from "../../../config/mapConfig";
import { biomeColor } from "../../world3d/terrainColor";
import type {
  LocalArtifact,
  RegionArtifact,
  RegionCrossing,
  RegionTownSite,
  RegionMarker,
  RegionRoad,
} from "../artifacts";
import {
  ROAD_3D_TIERS,
  PATH_3D_KEEP_POINTS,
  PATH_3D_SKIP_POINTS,
} from "../travel/roadTunables";
import {
  localArtifactToWorldData,
  GROUND_METERS_PER_CELL,
} from "./groundWorldAdapter";
import {
  getCanonicalTownPlan,
  transformTownPlan,
  townSpanFtForBurg,
  CANON_TOWN_SPAN,
  getCanonicalTownWaterFeatures,
  canonicalTownSeedPath,
  canonicalArtifactTownForSiteFromAtlas,
} from "../town/canonicalTown";
import { occupancyScheduleForPlot } from "./buildingOccupancy";
import {
  householdMemberIdentity,
  householdPopulationForPlot,
  householdPopulationsForPlan,
} from "../town/householdBrief";
import {
  blueprintForPlot,
  type InteriorPlotInput,
} from "../interior/generateInterior";
import { buildingShellHeightM } from "../interior/generateBuilding";
import { buildTownWaterBodies } from "../town/townWaterBodies";
import { STREET_MIN_WIDTH_M } from "../town/streetRibbons";
import type { AdaptedTownPlan } from "../town/townPlanAdapter";
import { waterRunsFromLevels, waterLevelsByCell, rasterizeChannel } from "./waterRegions";
import type { WaterRun } from "./waterRegions";
import { deriveHydrology } from "./terrainHydrology";
import type { TownPlan } from "../artifacts";
import {
  buildInterior,
  DOOR_LEAF_COLOR,
  ENSEMBLE_PART_TAG,
  HISTORY_PART_TAG,
  MATERIAL_PART_TAG,
  MOTIF_PART_TAG,
  WEATHERING_PART_TAG,
  type SitePart,
  type OccupantBody,
  type OccupantFigure,
} from "./interiorParts";
import {
  siteOrientationFromQuad,
  worldOffsetToSiteLocal,
  sitePartLocalOffset,
} from "./sitePartTransform";
import { generateTownRoster } from "../roster/generateTownRoster";
import {
  occupantLocationAt,
  type ActivityKind,
} from "../roster/occupantSchedule";
import type { TownRoster, Occupant } from "../roster/types";
import { buildStreetGraph, frontDoorForPlot } from "../roster/agentPath";
import { generateBody } from "../body/generateBody";
import type { BodyPlan } from "../body/types";
import { childSeedPath, rootSeedPath } from "../seedPath";
import {
  generateHiddenPlaces,
  type HiddenPlaceKind,
} from "../discovery/hiddenPlaces";
import type { Pt } from "../submap/submapEngine";
import { localWithDeltas } from "./groundDeltas";
import type { WorldDelta } from "../delta/types";
import {
  getBurgNamer,
  getBridgeAtlas,
  getBurgCultureType,
} from "./legacySubmapBridge";
import {
  styleFamilyForCultureType,
  styledGatehouseForm,
  climateForBiomeId,
  type StyleFamily,
  type GatehouseForm,
} from "../town/architectureStyle";
import type {
  BuildingEnsemble,
  BuildingEventLogsByBurg,
} from "../interior/blueprintTypes";
import { buildingPlotInput } from "../town/buildingPlotInput";
import { SeededRandom } from "../../../utils/random/seededRandom";
import { generateBusinessName } from "../../economy/NpcBusinessManager";
import type { BusinessType, WorldBusiness } from "../../../types/business";
import type { RichNPC } from "../../../types/world";
import type {
  BattleMapBiome,
  BattleMapCrossing,
  BattleMapData,
  BattleMapTile,
  BattleMapTerrain,
  BattleMapDecoration,
  BattleMapSurface,
  BattleMapWorldOccupant,
  Position,
  TargetableMapObject,
} from "@/types/combat";
import { generateGroundHostiles } from "./groundHostiles";
import {
  buildGroundProps,
  imprintPropOnTile,
  propFootprintRadiusM,
  PROPS_BY_ID,
} from "./groundProps";
import type { PropInstance } from "../props/propSchema";
import type { EntranceKind } from "../dungeon/world/dungeonSites";
import { dungeonEntrancesForWindow } from "./dungeonEntrances";
// Canopy atmosphere (forests Task 11). BIOMES is pure data: its one import is
// a type-only binding (elided at build), so it is worker-safe here.
import { BIOMES } from "../../../data/biomes";
import { biomeIdForCell } from "../local/biomeForCell";
import { forestKindForCell } from "../forests/forestKindForCell";
import type { ForestKind } from "../forests/forestClusters";
import {
  resolveTerrainTerraces,
  type TerrainTerraceReceipt,
} from "./terrainTerraces";
import {
  resolveSnowLineFt,
  latitudeAtGraphY,
  SNOW_LINE_H,
  SNOW_RGB,
  SNOW_BAND,
} from "../mountains/mountainTunables";
import {
  settlementDefenseForBurg,
  type GroundSettlementDefense,
} from "./settlementDefense";
import { buildFarShells, type FarShells } from "./farShells";
import { FEET_PER_FMG_PIXEL } from "../adapter/atlasArtifact";

/** A polyline in ground world-meters with a uniform width (meters). */
export interface GroundPolyline {
  points: Array<{ x: number; z: number }>;
  widthM: number;
  /** Source role retained so tactical crops can distinguish routes from streets. */
  sourceKind?: "region-road" | "town-street" | "river";
  /** Stable Region route/river id when this run descends from one. */
  sourceId?: number;
  /** Optional tint (e.g. town-wall runs carry the style family's wallTint). */
  colorHex?: string;
  /**
   * River-only surface height at every centerline point, in world meters.
   * This is computed once from the carved bed and shared by rendering and
   * crossing placement; roads and walls intentionally leave it absent.
   */
  waterlineY?: number[];
}

// Ground rivers use a deliberately modest constant depth for this first real
// surface slice. It places the water above the carved bed while keeping ford
// crowns partly submerged; discharge-scaled depth remains a separate look call.
export const GROUND_RIVER_CHANNEL_DEPTH_M = 0.5;

// Water-biome cells are classified by their centers, while terrain triangles
// extend beyond those centers. One cell of overdraw per bank closes that edge
// without changing the physical river width used by crossings or the referee.
const RIVER_SURFACE_BANK_OVERDRAW_M = GROUND_METERS_PER_CELL;

/** A filled town water body (river channel / harbour apron), ground meters. */
export interface GroundWaterBody {
  pointsM: Array<{ x: number; z: number }>;
  /**
   * What this body IS. The three kinds cannot share a height rule: the sea is
   * flat at zero by definition, a lake is flat at its own elevation, and a
   * river surface DESCENDS along its course — it stands above sea level
   * everywhere but its mouth. One flat height for all three is what drew burg
   * Hajdured's river 15 m below the ground it runs through.
   */
  kind: "sea" | "lake" | "river";
  /**
   * Reference water height in world meters (set by the terrain-carve pass).
   * Flat for sea and lake. For a river this is its LOWEST point — the single
   * number decks and crossings reference — while the surface itself comes from
   * `centerlineM`.
   */
  surfaceY: number;
  /**
   * Rivers only: the ordered centerline with a resolved height per point. Chunk
   * clipping invents new polygon vertices, so a per-vertex height array cannot
   * survive it; the renderer projects each surviving vertex onto this line and
   * interpolates instead.
   */
  centerlineM?: Array<{ x: number; z: number; surfaceY: number }>;
  /**
   * Sea aprons only: the shoreline segment this apron extends from, in ground
   * meters. The apron's outer corners reach far offshore and sample ground that
   * says nothing about the waterline, so the height comes from here instead.
   */
  shoreEdgeM?: Array<{ x: number; z: number }>;
}

/** A dock pier / bridge span deck (convex quad), ground meters. */
export interface GroundDeck {
  cornersM: Array<{ x: number; z: number }>;
  /** Deck-top Y in world meters, just above the adjacent water (carve pass). */
  topY: number;
  /**
   * Civic role of the deck (TG5). Carried from the canonical plan's civic kind so
   * the 3D renderer can tint a weathered-timber quay distinctly from a lighter
   * bridge span — they must not share one identical slab material. Ford
   * crossings ride the same seam: `ford` is the wet gravel bar of the crossing
   * and `fordStone` its individual stepping stones (matching the 2D painter's
   * submerged-causeway-plus-stones language).
   */
  kind: "dock" | "bridge" | "ford" | "fordStone";
  /**
   * Style-family deck detailing (piling spacing / railing / bridge-arch rise),
   * stamped from the burg's architecture family so a coastal-timber quay and a
   * highland-stone bridge read differently in 3D.
   */
  detail?: { pilingSpacingM: number; railing: boolean; archRiseM: number };
  /** Links regional bridge geometry back to the crossing receipt. */
  sourceCrossingId?: string;
  /**
   * Optional per-deck tint override (0..1 RGB). Ford causeway strips use it to
   * darken as they submerge (wet→dry gradient) and stones to break the
   * rivet-line uniformity; absent decks fall back to their kind color.
   */
  color?: [number, number, number];
}

/** Ground-meter projection of one Region crossing receipt. */
export interface GroundCrossing {
  id: string;
  kind: "bridge" | "ford";
  xM: number;
  zM: number;
  roadDirection: { x: number; z: number };
  /** Unit river-flow heading in the same x/z frame as roadDirection. */
  riverDirection: { x: number; z: number };
  spanM: number;
  widthM: number;
  roadRouteId: number;
  riverId: number;
  roadSourceIndex?: number;
  riverSourceIndex?: number;
}

/** A roster person resolved to the plot center where their figure is rendered. */
export interface GroundOccupantSite {
  burgId: number;
  occupantId: number;
  name: string;
  xM: number;
  zM: number;
  /** Schedule activity at the bake hour (drives the close-range nameplate). */
  activity?: ActivityKind;
}

/**
 * Current resident position supplied to tactical extraction. Live callers may
 * add movement state from `allGroundAgentsAt`; legacy callers can continue to
 * use the static schedule-derived sites already carried by GroundWorld.
 */
export interface GroundOccupantProjectionInput extends GroundOccupantSite {
  moving?: boolean;
}

/** Player-facing label for a townsperson's current activity. */
const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  sleeping: "asleep",
  home: "at home",
  working: "working",
  out: "out & about",
};

/** An artifact feature in ground meters (world space, origin = artifact NW). */
export interface GroundFeature {
  id: number;
  kind: string;
  xM: number;
  zM: number;
}

// ============================================================================
// Ground Hostile Creature definition
// ============================================================================
// This interface defines a hostile creature placed in the ground world. It
// holds coordinate positions in meters relative to the ground world's origin
// and the monster id matching standard bestiary entries (e.g. "Goblin").
// ============================================================================
export interface GroundHostile {
  id: string;
  name: string;
  xM: number;
  zM: number;
  monsterId: string;
}

/** Pre-extracted, chunk-samplable view of a LocalArtifact. */
/** SP4 hidden place placed in the 3D ground world (meters). */
export interface GroundHiddenSite {
  id: string;
  kind: HiddenPlaceKind;
  name: string;
  xM: number;
  zM: number;
  /** Proximity radius (meters) within which the player reveals it. */
  discoveryRadiusM: number;
}

/**
 * A world-grown dungeon ENTRANCE surfaced in the 3D ground world (Pillar 2,
 * Task 6). Each is a sealed door / mouth / stair the player can walk up to and
 * DISCOVER — the interior itself is Pillar 3 (no fake interiors here). The
 * entrance is anchored to a real {@link DungeonSite} (marker/temple/sewer/civ
 * origin) whose `sitePath` names the dungeon deterministically; the derived
 * name ("The Wrenfield Crypt") is resolved lazily at discovery time via
 * `generateDungeonForSite` (cached per sitePath) so world assembly stays cheap.
 */
export interface GroundDungeonEntrance {
  /** Stable per-window id (sitePath-derived) — the REVEAL_HIDDEN_SITE key. */
  id: string;
  /** The frozen site seed path (serialized) — names the dungeon on discovery. */
  sitePath: string;
  /** Atlas cell the site anchors to (for the map-pane pin, not the player's cell). */
  cellId: number;
  entranceKind: EntranceKind;
  /** Window-local ground meters (origin = artifact NW), like every ground piece. */
  xM: number;
  zM: number;
  /** Proximity radius (meters) within which the player discovers it. */
  discoveryRadiusM: number;
}

/**
 * Canopy atmosphere of the window's atlas cell (forests Task 11): what the 3D
 * scene needs to close the woods overhead — dimmer ambient light, pulled-in
 * fog. Resolved ONCE per window from the legacy biome def + named-forest kind;
 * the render-side modulation (fey dims less, haunted fog one step heavier)
 * lives in the scene, not here.
 */
export interface GroundCanopy {
  /** True by construction — a canopy only exists where the def says shade. */
  shade: boolean;
  /** Fog grade from the biome def ('light' when the def shades without fog). */
  fog: "light" | "medium" | "heavy";
  /** Named-forest kind of the cell; null inside anonymous/unnamed woods. */
  forestKind: ForestKind | null;
}

export interface GroundWorld {
  cols: number;
  rows: number;
  /** 0..100 heights (groundWorldAdapter domain), row-major. */
  heights: number[];
  biomeIds: string[];
  /** Total ground extent, world meters. */
  extentMetersX: number;
  extentMetersZ: number;
  /** The artifact's OWN placed features (trees/bushes/boulders…), meters. */
  features: GroundFeature[];
  /**
   * WAVE-1 beautification props (crates/stalls/barrels/boulders…), a SEPARATE
   * layer from `features` — each carries FULL combat-referee data via its catalog
   * def. Positions in ground meters (xM/zM). Deterministic per world+window.
   */
  props: PropInstance[];
  /** Hostile monsters placed deterministically on the ground map. */
  hostiles: GroundHostile[];
  /** SP4 hidden places (off-map, revealed by 3D proximity), ground meters. */
  hiddenSites: GroundHiddenSite[];
  /**
   * World-grown dungeon entrances inside this window (Pillar 2): sealed doors /
   * cave mouths / temple stairs / sewer grates the player discovers by 3D
   * proximity. Empty when no dungeon site falls in the window.
   */
  dungeonEntrances: GroundDungeonEntrance[];
  /** River/road centerlines crossing the artifact, ground meters. */
  rivers: GroundPolyline[];
  roads: GroundPolyline[];
  /** Optional for old fixtures/saves; current Region builds always provide it. */
  crossings?: GroundCrossing[];
  /** Town defensive wall rings (closed polylines), ground meters. */
  walls: GroundPolyline[];
  /** Town water bodies (rivers/harbour), filled flat surfaces, ground meters. */
  waterBodies: GroundWaterBody[];
  /**
   * Connected bodies of water taken from the biome grid, each with one flat
   * level. This is where a VISIBLE water surface comes from; `waterBodies`
   * above are the town's crude channel/apron quads, which shape the bed and
   * position decks but are the wrong shape to draw — an in-game look showed
   * them as 52 m wide slabs laid over the landscape.
   *
   * Optional because a world baked before this existed carries none, and the
   * renderer treats "absent" as "no water sheets" rather than failing.
   */
  waterRuns?: WaterRun[];
  /** Town dock/bridge deck slabs, ground meters. */
  decks: GroundDeck[];
  /** Town road-gate placements (ground meters) for gatehouse meshes (styled-architecture slice). */
  gatehouses: Array<{
    xM: number;
    zM: number;
    angleRad: number;
    gapHalfM: number;
    form: GatehouseForm;
    colorHex: string;
    burgId: number;
  }>;
  /** Town sites overlapping the artifact, center in ground meters. */
  towns: Array<{
    burgId: number;
    name: string;
    xM: number;
    zM: number;
    halfM: number;
  }>;
  /** State and regiment facts stationed in each visible generated settlement. */
  settlementDefenses?: GroundSettlementDefense[];
  /** Town-plan building plots (C3 generateTownPlan), centers in meters. */
  buildings: Array<{
    id: string;
    xM: number;
    zM: number;
    /** Plot footprint corners, ground meters (quad order from the plan). */
    cornersM: Array<{ x: number; z: number }>;
    /** Town-authored group identity used for terrain terrace negotiation. */
    ensemble?: BuildingEnsemble;
    /** Actual production pad datum after a viable attached row negotiates. */
    terrainTerrace?: TerrainTerraceReceipt;
    /** Building height, meters (storeys × 3). */
    heightM: number;
    role: string;
    /** Architecture-style stamps (Task 7): absent on legacy/unstyled plans. */
    wallColorHex?: string;
    roofColorHex?: string;
    roofForm?: "gable" | "hip" | "steep" | "flat";
    /** The burg's style family builds chimneys. */
    chimney?: boolean;
    /** Interior wall envelope, meters (≤ plot; roofs/floors fit THIS). */
    wallWidthM: number;
    wallDepthM: number;
    /** L4 interior: walls + furnishings as site-local boxes (seamless). */
    parts: SitePart[];
    /** Solved roof group, site-local meters (BGv2 Task 5); undefined until a
     *  style resolves. When set, the renderer skips the legacy roof prism. */
    solvedRoof?: {
      positions: Float32Array;
      indices: Uint32Array;
      normals: Float32Array;
      colorHex: string;
    };
    /** Living-interiors live clock: length-24 window-lit / hearth-lit schedules,
     *  baked once; the renderer re-resolves them against the live game hour.
     *  Present only for populated plots. */
    litHours?: boolean[];
    hearthHours?: boolean[];
    /** Baked occupant render packets — the family, resolved live per hour.
     *  Present only for populated plots (replaces the old baked occupant boxes). */
    occupants?: BuildingOccupantRender[];
    /** Interior envelope in PLAN FEET (blueprint frame) — the frame occupant
     *  stations resolve in. Present only when `occupants` is. */
    interiorWidthFt?: number;
    interiorDepthFt?: number;
    /** Stable plan origin for occupants in asymmetrically extended buildings. */
    interiorOriginXFt?: number;
    interiorOriginYFt?: number;
    /** Canonical router door relative to the plot center, ground meters. */
    frontDoorOffsetX?: number;
    frontDoorOffsetZ?: number;
    name?: string;
    unlabeled?: boolean;
    labelRangeM?: number;
  }>;
  /** Occupant rosters per town (L4 — future UI/schedules consume these). */
  rosters: TownRoster[];
  /**
   * Roster occupants resolved to their current plot center. The figure boxes
   * already live inside building parts; these entries are marker-only labels.
   */
  occupants: GroundOccupantSite[];
  /**
   * Per-town plans (feet frame), paired with `rosters` by burgId. Together with
   * `boundsFeet` these are the inputs `groundTownAgentsAt` needs to animate
   * townsfolk walking the streets per-frame against the live clock.
   */
  townPlans?: Array<{ burgId: number; plan: TownPlan }>;
  /** Artifact window origin in town/plan FEET (`local.bounds`) for feet→meters. */
  boundsFeet?: { x: number; y: number };
  /**
   * Canopy atmosphere of the window's atlas cell (forests Task 11). Null when
   * the cell's biome def has no canopyShade — or when no anchor cell was given
   * (tests/legacy callers) — and the 3D scene then renders exactly the
   * pre-canopy lighting.
   */
  canopy?: GroundCanopy | null;
  /**
   * Encoded-height snow line for this window (Task 10 MOUNTAINS), resolved ONCE
   * from the anchor cell's latitude band (spec §5). Ground vertices at/above it
   * blend toward snow in `sampleGroundChunk`. Absent (tests/legacy/anchor-less
   * builds) → the sampler uses the temperate baseline SNOW_LINE_H.
   */
  snowLineH?: number;
  /**
   * Far-distance terrain shells (2026-07-21): coarse static region + atlas
   * horizon ring meshes replacing the visible world edge. Present whenever the
   * window was built with a region; when absent the sampler keeps the legacy
   * edge-falloff drop + haze so old fixtures render unchanged.
   */
  farShells?: FarShells;
}

const FEET_TO_METERS = 0.3048;

// A road segment can cross an entire local river between two widely spaced
// Region vertices. Walking the segment at half-cell intervals guarantees that
// every visibly wet cell gets a chance to break the ribbon, while a short
// binary search places each new endpoint back at the wet/dry cell boundary.
const ROAD_WET_CLIP_SAMPLE_M = GROUND_METERS_PER_CELL / 2;
const ROAD_WET_CLIP_BOUNDARY_STEPS = 14;

type GroundRibbonPoint = { x: number; z: number };

/** Return the point a chosen fraction of the way along one straight run. */
function groundRibbonPointAt(
  start: GroundRibbonPoint,
  end: GroundRibbonPoint,
  t: number,
): GroundRibbonPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

/**
 * Break one route into dry runs without adding a ribbon over wet cells.
 *
 * Source vertices remain intact. Only wet/dry transition points are inserted,
 * so land approaches preserve their authored shape and the renderer does not
 * inherit hundreds of temporary sampling points. A route with no wet sample
 * returns as one unchanged run.
 */
function splitRibbonAroundWetCells(
  points: GroundRibbonPoint[],
  isWet: (point: GroundRibbonPoint) => boolean,
): GroundRibbonPoint[][] {
  if (points.length < 2) return [];

  const runs: GroundRibbonPoint[][] = [];
  let activeRun: GroundRibbonPoint[] = [];
  const samePoint = (a: GroundRibbonPoint, b: GroundRibbonPoint): boolean =>
    Math.hypot(a.x - b.x, a.z - b.z) <= 1e-6;
  const append = (point: GroundRibbonPoint): void => {
    const last = activeRun[activeRun.length - 1];
    if (!last || !samePoint(last, point)) activeRun.push(point);
  };
  const finishRun = (): void => {
    if (
      activeRun.length >= 2 &&
      !samePoint(activeRun[0], activeRun[activeRun.length - 1])
    ) {
      runs.push(activeRun);
    }
    activeRun = [];
  };

  // Find every wet/dry transition inside each authored segment. The midpoint
  // of the resulting intervals decides whether that interval belongs to a
  // land approach or to the crossing deck's gap.
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1];
    const end = points[pointIndex];
    const lengthM = Math.hypot(end.x - start.x, end.z - start.z);
    const sampleCount = Math.max(
      1,
      Math.ceil(lengthM / ROAD_WET_CLIP_SAMPLE_M),
    );
    const boundaries = [0];
    let previousT = 0;
    let previousWet = isWet(start);

    for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
      const sampleT = sampleIndex / sampleCount;
      const sampleWet = isWet(groundRibbonPointAt(start, end, sampleT));
      if (sampleWet !== previousWet) {
        let lowT = previousT;
        let highT = sampleT;
        const lowWet = previousWet;

        // Refine the transition without changing which side owns the interval.
        for (let step = 0; step < ROAD_WET_CLIP_BOUNDARY_STEPS; step += 1) {
          const middleT = (lowT + highT) / 2;
          if (isWet(groundRibbonPointAt(start, end, middleT)) === lowWet) {
            lowT = middleT;
          } else {
            highT = middleT;
          }
        }
        // Keep the emitted endpoint on the proven dry side. A mathematical
        // midpoint can round into the wet cell and leave one final ribbon
        // vertex over water even though the adjoining interval was removed.
        boundaries.push(lowWet ? highT : lowT);
      }
      previousT = sampleT;
      previousWet = sampleWet;
    }
    boundaries.push(1);

    for (let intervalIndex = 1; intervalIndex < boundaries.length; intervalIndex += 1) {
      const startT = boundaries[intervalIndex - 1];
      const endT = boundaries[intervalIndex];
      const middle = groundRibbonPointAt(start, end, (startT + endT) / 2);
      if (isWet(middle)) {
        finishRun();
        continue;
      }

      const intervalStart = groundRibbonPointAt(start, end, startT);
      const intervalEnd = groundRibbonPointAt(start, end, endT);
      if (
        activeRun.length > 0 &&
        !samePoint(activeRun[activeRun.length - 1], intervalStart)
      ) {
        finishRun();
      }
      append(intervalStart);
      append(intervalEnd);
    }
  }
  finishRun();
  return runs;
}

/** Region polylines (feet, world space) → ground meters, kept if any point
 * lands inside the artifact window (fine clipping happens per chunk). Route
 * polylines carry `kind`, which sets the tier tint (ROAD_3D_TIERS) and breaks
 * faint paths into a keep/skip patch cycle so they read as broken wear-lines.
 * A supplied wet-crossing context removes only water-biome overlap inside an
 * authoritative crossing span, leaving the ford/bridge deck to carry the wet
 * gap. Rivers pass no `kind` and behave exactly as before. */
export function regionPolylinesToGround(
  lines: Array<{
    centerline: Array<[number, number]>;
    widthFt: number;
    kind?: RegionRoad["kind"];
    routeId?: number;
    riverId?: number;
  }>,
  local: LocalArtifact,
  sourceKind?: GroundPolyline["sourceKind"],
  wetClip?: Readonly<{
    crossings: RegionCrossing[];
    biomeIds: string[];
    cols: number;
    rows: number;
  }>,
): GroundPolyline[] {
  const { bounds } = local;
  const out: GroundPolyline[] = [];
  const push = (
    pts: Array<{ x: number; z: number }>,
    widthFt: number,
    colorHex?: string,
    sourceId?: number,
  ): void => {
    const extentX = bounds.width * FEET_TO_METERS;
    const extentZ = bounds.height * FEET_TO_METERS;
    const minX = -50;
    const minZ = -50;
    const maxX = extentX + 50;
    const maxZ = extentZ + 50;
    const inside = (p: { x: number; z: number }): boolean =>
      p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
    const segmentTouches = (
      a: { x: number; z: number },
      b: { x: number; z: number },
    ): boolean => {
      if (inside(a) || inside(b)) return true;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const crossesVertical = (x: number): boolean => {
        if (Math.abs(dx) <= 1e-9) return false;
        const t = (x - a.x) / dx;
        const z = a.z + dz * t;
        return t >= 0 && t <= 1 && z >= minZ && z <= maxZ;
      };
      const crossesHorizontal = (z: number): boolean => {
        if (Math.abs(dz) <= 1e-9) return false;
        const t = (z - a.z) / dz;
        const x = a.x + dx * t;
        return t >= 0 && t <= 1 && x >= minX && x <= maxX;
      };
      return (
        crossesVertical(minX) ||
        crossesVertical(maxX) ||
        crossesHorizontal(minZ) ||
        crossesHorizontal(maxZ)
      );
    };
    const touches =
      pts.some(inside) ||
      pts.slice(1).some((point, index) => segmentTouches(pts[index], point));
    if (touches && pts.length >= 2) {
      out.push({
        points: pts,
        widthM: Math.max(1, widthFt * FEET_TO_METERS),
        ...(sourceKind ? { sourceKind } : {}),
        ...(sourceId != null ? { sourceId } : {}),
        ...(colorHex ? { colorHex } : {}),
      });
    }
  };
  for (const line of lines) {
    const pts = line.centerline.map(([fx, fy]) => ({
      x: (fx - bounds.x) * FEET_TO_METERS,
      z: (fy - bounds.y) * FEET_TO_METERS,
    }));
    const colorHex = line.kind ? ROAD_3D_TIERS[line.kind].colorHex : undefined;
    const sourceId = line.routeId ?? line.riverId;

    // Only receipts for this exact source route may open a wet gap. The span
    // is projected once into local meters; unrelated water elsewhere along the
    // route remains visible because no authored crossing deck exists there.
    const routeCrossings =
      wetClip && line.routeId != null
        ? wetClip.crossings
            .filter((crossing) => crossing.roadRouteId === line.routeId)
            .map((crossing) => ({
              x: (crossing.point[0] - bounds.x) * FEET_TO_METERS,
              z: (crossing.point[1] - bounds.y) * FEET_TO_METERS,
              direction: {
                x: crossing.roadDirection[0],
                z: crossing.roadDirection[1],
              },
              halfSpanM: (crossing.spanFt * FEET_TO_METERS) / 2,
              halfWidthM:
                Math.max(crossing.widthFt, line.widthFt) * FEET_TO_METERS * 0.5 +
                GROUND_METERS_PER_CELL,
            }))
        : [];
    const isWetCrossingPoint = (point: GroundRibbonPoint): boolean => {
      if (!wetClip || routeCrossings.length === 0) return false;
      const insideCrossing = routeCrossings.some((crossing) => {
        const dx = point.x - crossing.x;
        const dz = point.z - crossing.z;
        const along = dx * crossing.direction.x + dz * crossing.direction.z;
        const across = dx * -crossing.direction.z + dz * crossing.direction.x;
        return (
          Math.abs(along) <= crossing.halfSpanM &&
          Math.abs(across) <= crossing.halfWidthM
        );
      });
      if (!insideCrossing) return false;

      // Match the nearest-cell rule already used by the ford deck builder, so
      // the road gap and the visible water tint cannot disagree at the banks.
      const col = Math.max(
        0,
        Math.min(wetClip.cols - 1, Math.round(point.x / GROUND_METERS_PER_CELL)),
      );
      const row = Math.max(
        0,
        Math.min(wetClip.rows - 1, Math.round(point.z / GROUND_METERS_PER_CELL)),
      );
      const biome = wetClip.biomeIds[row * wetClip.cols + col];
      return biome === "water" || biome === "ocean";
    };
    const landRuns =
      routeCrossings.length > 0
        ? splitRibbonAroundWetCells(pts, isWetCrossingPoint)
        : [pts];

    // Every surviving land run reuses the existing deterministic path patch
    // emitter. A crossing therefore adds a gap without replacing the style
    // rules that already make faint paths read as broken wear-lines.
    for (const landRun of landRuns) {
      if (line.kind === "path") {
      // Faint path: deterministic keep/skip cycle → broken wear-line patches.
        const cycle = PATH_3D_KEEP_POINTS + PATH_3D_SKIP_POINTS;
        for (let start = 0; start < landRun.length; start += cycle) {
          push(
            landRun.slice(start, start + PATH_3D_KEEP_POINTS),
            line.widthFt,
            colorHex,
            sourceId,
          );
        }
      } else {
        push(landRun, line.widthFt, colorHex, sourceId);
      }
    }
  }
  return out;
}

// ============================================================================
// Shared River Waterlines
// ============================================================================
// River surfaces, crossings, and future shoreline props must agree on one Y.
// These helpers derive that truth from the final carved ground grid, then make
// it queryable without storing functions on GroundWorld (which must remain safe
// to send across the staged worker boundary).
// ============================================================================

/** Sample the rendered ground surface, including the window-edge falloff.
 * `applyEdgeFalloff = false` mirrors a far-shell world (2026-07-21), where the
 * sampler no longer drops terrain at the border — decks and waterlines must
 * agree with whichever convention the terrain actually renders. */
function groundSurfaceMetersAt(
  heights: number[],
  cols: number,
  rows: number,
  x: number,
  z: number,
  applyEdgeFalloff = true,
): number {
  const encoded = sampleEncodedHeight(heights, cols, rows, x, z);
  const edgeT = applyEdgeFalloff
    ? edgeFalloffT(
        x,
        z,
        cols * GROUND_METERS_PER_CELL,
        rows * GROUND_METERS_PER_CELL,
      )
    : 0;
  return heightToMeters(Math.max(0, encoded - EDGE_DROP_H * edgeT));
}

/**
 * Stamp each regional river with a surface sample for every centerline point.
 * Adjacent uphill violations are pooled to their shared average (isotonic
 * smoothing), giving the smallest deterministic correction that guarantees the
 * resulting sequence never climbs while travelling downstream.
 */
export function computeGroundRiverWaterlines(
  rivers: GroundPolyline[],
  heights: number[],
  cols: number,
  rows: number,
  applyEdgeFalloff = true,
): GroundPolyline[] {
  return rivers.map((river) => {
    if (river.sourceKind !== "river" || river.points.length === 0) return river;

    const rawWaterlineY = river.points.map(
      (point) =>
        groundSurfaceMetersAt(
          heights, cols, rows, point.x, point.z, applyEdgeFalloff,
        ) + GROUND_RIVER_CHANNEL_DEPTH_M,
    );

    // Rivers are authored source-to-mouth. Pool-adjacent-violators merges any
    // downstream rise into one flat reach instead of inventing an uphill flow.
    const blocks: Array<{
      start: number;
      end: number;
      total: number;
      count: number;
    }> = [];
    rawWaterlineY.forEach((height, index) => {
      blocks.push({ start: index, end: index, total: height, count: 1 });
      while (blocks.length >= 2) {
        const downstream = blocks[blocks.length - 1];
        const upstream = blocks[blocks.length - 2];
        if (
          upstream.total / upstream.count >=
          downstream.total / downstream.count
        )
          break;
        blocks.splice(blocks.length - 2, 2, {
          start: upstream.start,
          end: downstream.end,
          total: upstream.total + downstream.total,
          count: upstream.count + downstream.count,
        });
      }
    });

    const waterlineY = new Array<number>(rawWaterlineY.length);
    for (const block of blocks) {
      const pooledHeight = block.total / block.count;
      for (let index = block.start; index <= block.end; index += 1) {
        waterlineY[index] = pooledHeight;
      }
    }

    return { ...river, waterlineY };
  });
}

/** Find the nearest point on a segment and return its interpolation fraction. */
function segmentProjection(
  x: number,
  z: number,
  a: { x: number; z: number },
  b: { x: number; z: number },
): { distanceSq: number; t: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
  const nearestX = a.x + dx * t;
  const nearestZ = a.z + dz * t;
  return {
    distanceSq: (x - nearestX) ** 2 + (z - nearestZ) ** 2,
    t,
  };
}

/** Resolve a river surface from already-stamped runs, if the point is wet. */
function riverWaterlineForRuns(
  rivers: GroundPolyline[],
  x: number,
  z: number,
): number | undefined {
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  let nearestWaterline: number | undefined;

  for (const river of rivers) {
    if (
      river.sourceKind !== "river" ||
      !river.waterlineY ||
      river.waterlineY.length !== river.points.length
    ) {
      continue;
    }

    const surfaceHalfWidth = river.widthM / 2 + RIVER_SURFACE_BANK_OVERDRAW_M;
    for (let index = 1; index < river.points.length; index += 1) {
      const projection = segmentProjection(
        x,
        z,
        river.points[index - 1],
        river.points[index],
      );
      if (
        projection.distanceSq > surfaceHalfWidth * surfaceHalfWidth ||
        projection.distanceSq >= nearestDistanceSq
      ) {
        continue;
      }

      const upstream = river.waterlineY[index - 1];
      const downstream = river.waterlineY[index];
      nearestDistanceSq = projection.distanceSq;
      nearestWaterline = upstream + (downstream - upstream) * projection.t;
    }
  }

  return nearestWaterline;
}

/**
 * Query the exact surface rendered for a ground river at a world-meter point.
 * Returning undefined outside every wet corridor lets land callers keep their
 * terrain anchor and makes legacy GroundWorld fixtures degrade honestly.
 */
export function riverWaterlineAt(
  ground: Pick<GroundWorld, "rivers">,
  x: number,
  z: number,
): number | undefined {
  return riverWaterlineForRuns(ground.rivers, x, z);
}

/** Project Region crossing receipts into the same ground-meter frame as runs. */
export function regionCrossingsToGround(
  crossings: RegionCrossing[],
  local: LocalArtifact,
  roads: GroundPolyline[],
  rivers: GroundPolyline[],
): GroundCrossing[] {
  const extentX = local.bounds.width * FEET_TO_METERS;
  const extentZ = local.bounds.height * FEET_TO_METERS;

  const sourceIndexAt = (
    lines: GroundPolyline[],
    sourceId: number,
    point: { x: number; z: number },
  ): number | undefined => {
    let nearestIndex: number | undefined;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    lines.forEach((line, index) => {
      if (line.sourceId !== sourceId) return;
      for (
        let pointIndex = 1;
        pointIndex < line.points.length;
        pointIndex += 1
      ) {
        const distanceSq = pointSegmentDistanceSq(
          point.x,
          point.z,
          line.points[pointIndex - 1],
          line.points[pointIndex],
        );
        if (distanceSq < nearestDistanceSq) {
          nearestDistanceSq = distanceSq;
          nearestIndex = index;
        }
      }
    });
    return nearestIndex;
  };

  return crossings.flatMap((crossing) => {
    const point = {
      x: (crossing.point[0] - local.bounds.x) * FEET_TO_METERS,
      z: (crossing.point[1] - local.bounds.y) * FEET_TO_METERS,
    };
    const spanM = crossing.spanFt * FEET_TO_METERS;
    const halfSpanM = spanM / 2;
    if (
      point.x + halfSpanM < 0 ||
      point.x - halfSpanM > extentX ||
      point.z + halfSpanM < 0 ||
      point.z - halfSpanM > extentZ
    )
      return [];

    const projected: GroundCrossing = {
      id: crossing.id,
      kind: crossing.kind,
      xM: point.x,
      zM: point.z,
      roadDirection: {
        x: crossing.roadDirection[0],
        z: crossing.roadDirection[1],
      },
      riverDirection: {
        x: crossing.riverDirection[0],
        z: crossing.riverDirection[1],
      },
      spanM,
      widthM: crossing.widthFt * FEET_TO_METERS,
      roadRouteId: crossing.roadRouteId,
      riverId: crossing.riverId,
    };
    const roadSourceIndex = sourceIndexAt(roads, crossing.roadRouteId, point);
    const riverSourceIndex = sourceIndexAt(rivers, crossing.riverId, point);
    if (roadSourceIndex != null) projected.roadSourceIndex = roadSourceIndex;
    if (riverSourceIndex != null) projected.riverSourceIndex = riverSourceIndex;
    return [projected];
  });
}

// Routes can share a corridor and therefore emit separate mechanics receipts
// for what is visually one river crossing. Two referee cells are enough to
// absorb harmless route-centerline drift without merging genuinely separate
// crossings farther along the same river.
const RENDER_CROSSING_GROUP_RADIUS_M = GROUND_METERS_PER_CELL * 2;

/**
 * Choose one visual representative for each same-river crossing cluster.
 *
 * GroundCrossing receipts remain untouched for movement and tactical facts;
 * only the deck builder consumes this smaller list. The first receipt anchors
 * each cluster so replacing it with a wider route cannot move the grouping
 * boundary for later receipts. Equal widths keep their original order, while a
 * strictly wider route supplies the visible ford or bridge treatment.
 */
function renderedCrossingRepresentatives(
  crossings: GroundCrossing[],
): GroundCrossing[] {
  const groups: Array<{
    anchor: GroundCrossing;
    representative: GroundCrossing;
  }> = [];

  // Compare only crossings on the same source river and close enough to read
  // as one shared corridor. Distinct crossings on that river keep their own
  // deck treatment even when several routes elsewhere share another crossing.
  for (const crossing of crossings) {
    const group = groups.find(
      ({ anchor }) =>
        anchor.riverId === crossing.riverId &&
        Math.hypot(anchor.xM - crossing.xM, anchor.zM - crossing.zM) <=
          RENDER_CROSSING_GROUP_RADIUS_M,
    );

    // A new river/location pair starts a new visual treatment group.
    if (!group) {
      groups.push({ anchor: crossing, representative: crossing });
      continue;
    }

    // The widest route owns the shared treatment so the rendered crossing
    // never narrows below any movement receipt that travels through it.
    if (crossing.widthM > group.representative.widthM) {
      group.representative = crossing;
    }
  }

  return groups.map(({ representative }) => representative);
}

/** Build physical 3D decks without collapsing the source mechanics receipts. */
function regionalBridgeDecks(
  crossings: GroundCrossing[],
  rivers: GroundPolyline[],
  heights: number[],
  cols: number,
  rows: number,
  biomeIds: string[],
  applyEdgeFalloff = true,
): GroundDeck[] {
  return renderedCrossingRepresentatives(crossings).flatMap((crossing) => {
    const along = crossing.roadDirection;
    const across = { x: -along.z, z: along.x };
    const halfSpan = crossing.spanM / 2;
    const halfWidth = crossing.widthM / 2;
    const at = (alongM: number, acrossM: number) => ({
      x: crossing.xM + along.x * alongM + across.x * acrossM,
      z: crossing.zM + along.z * alongM + across.z * acrossM,
    });
    const corner = (alongSign: number, acrossSign: number) =>
      at(halfSpan * alongSign, halfWidth * acrossSign);

    // Terrain still supplies dry landing heights, while the new shared river
    // query supplies the visible wet surface. Both use the same edge-falloff
    // convention, so crossings at the artifact boundary do not float.
    const surfaceYAt = (x: number, z: number) =>
      groundSurfaceMetersAt(heights, cols, rows, x, z, applyEdgeFalloff);
    const waterlineYAt = (x: number, z: number) =>
      riverWaterlineForRuns(rivers, x, z);

    if (crossing.kind === "ford") {
      // Nearest-cell water lookup (mirrors sampleGroundChunk's biome pick):
      // the VISIBLE wet zone is the water-biome tint, not any bed-depth rule,
      // so the causeway must span exactly what reads as water on screen.
      const isWaterAt = (x: number, z: number): boolean => {
        const col = Math.max(
          0,
          Math.min(cols - 1, Math.round(x / GROUND_METERS_PER_CELL)),
        );
        const row = Math.max(
          0,
          Math.min(rows - 1, Math.round(z / GROUND_METERS_PER_CELL)),
        );
        const biome = biomeIds[row * cols + col];
        return biome === "water" || biome === "ocean";
      };
      return fordCrossingDecks(
        crossing,
        at,
        halfSpan,
        surfaceYAt,
        waterlineYAt,
        isWaterAt,
      );
    }

    // Bridge deck: the roadway must MEET the dry landings at both ends —
    // spanFt bakes a landing into each end, so the highest terrain along the
    // full deck centerline is where a flat deck end has to rest. Anchoring to
    // that ceiling (plus the deck clearance) keeps the ends flush with the
    // banks while the arch clears the carved channel; anchoring to the water
    // or bed instead would strand the deck below its own road on any river
    // carved deeper than the clearance.
    let spanCeilY = Number.NEGATIVE_INFINITY;
    for (let i = -8; i <= 8; i += 1) {
      const p = at((i / 8) * halfSpan, 0);
      spanCeilY = Math.max(spanCeilY, surfaceYAt(p.x, p.z));
    }

    const crossingWaterlineY = waterlineYAt(crossing.xM, crossing.zM);
    return [
      {
        cornersM: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
        // Dry landings normally win. The waterline is a safety floor for a
        // steep/edge case so the bridge can never be buried by its own river.
        topY:
          Math.max(spanCeilY, crossingWaterlineY ?? Number.NEGATIVE_INFINITY) +
          DECK_CLEARANCE_M,
        kind: "bridge",
        detail: {
          pilingSpacingM: 4,
          railing: true,
          archRiseM: Math.min(4, crossing.spanM * 0.04),
        },
        sourceCrossingId: crossing.id,
      },
    ];
  });
}

// Ford look constants (3D twin of the 2D painter's submerged causeway): the
// gravel bar sits 0.35 m over the channel floor, which leaves its crown 0.15 m
// below the new 0.5 m water surface. Bed humps may lift individual strips into
// view, producing a readable shallow shoal rather than a dry bridge deck.
const FORD_BAR_PROUD_M = 0.35;
const FORD_BAR_MIN_HALF_WIDTH_M = 1.6; // never thinner than a footpath bar
const FORD_STONE_OFFSET_M = 0.9; // stone-line gap outside the bar edge
const FORD_STONE_STEP_M = 1.1; // base center-to-center stone spacing
// Hard cap per crossing. Counts marched steps, not emitted stones, so it must
// cover the longest span (~92 m at ~1.27 m average step) with headroom — a
// lower cap silently truncates the far end of the stone line.
const FORD_STONE_MAX = 96;
// Dry-approach length baked into each end of spanFt by deriveRegionCrossings
// (generateRegion CROSSING_LANDING_FT — not exported; kept in step manually).
const FORD_LANDING_M = 16 * FEET_TO_METERS;
// Causeway strip length along the span. Strips let the bar RIDE a rising bed
// instead of letting terrain wedges knife through one long flat slab, and give
// the coarse per-patch color variation the 2D painter gets from mottling.
const FORD_STRIP_LEN_M = 5;
// A strip's crown clears its own bed hump by at least this.
const FORD_BAR_BED_CLEAR_M = 0.08;
// Causeway strips and stones exist only where the bed is within this of the
// deepest channel point — a causeway on dry land is just a weird wall, and
// stepping stones on grass read as fence posts.
const FORD_WET_MARGIN_M = 1.0;
// Wet→dry sand for the causeway (a strip darkens as the bed rises toward its
// crown) and the stone base gray, jittered per stone against the rivet-line
// read. Dry sand matches deckGeometry's DECK_COLOR.ford fallback.
const FORD_DRY_SAND_RGB: [number, number, number] = [
  0xb3 / 255,
  0xa3 / 255,
  0x7d / 255,
];
const FORD_WET_SAND_RGB: [number, number, number] = [
  0x86 / 255,
  0x77 / 255,
  0x58 / 255,
];
const FORD_STONE_RGB: [number, number, number] = [
  0x5c / 255,
  0x55 / 255,
  0x4a / 255,
];

/** Linear blend of two 0..1 RGB triples, with a brightness jitter, clamped. */
function tintLerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
  brightness: number,
): [number, number, number] {
  const mix = (i: number) => (a[i] + (b[i] - a[i]) * t) * brightness;
  return [
    Math.min(1, Math.max(0, mix(0))),
    Math.min(1, Math.max(0, mix(1))),
    Math.min(1, Math.max(0, mix(2))),
  ];
}

/**
 * A ford's 3D body: a gravel causeway spanning the river at water level plus
 * a single-file line of stepping stones beside it. All pieces are ordinary
 * deck quads, so they ride the existing chunk clip → deck mesh path
 * untouched; irregularity comes from the crossing's route/river ids, keeping
 * the layout deterministic per world seed.
 *
 * The causeway is a chain of short strips. Each strip stands a low step above
 * the shared river waterline's implied channel floor, but also clears ITS OWN
 * bed hump, so a rising bed lifts the causeway in
 * steps instead of knifing through one long flat slab. Strips and stones
 * exist only in the WET zone — a spot is wet when its cell carries the water
 * biome (the tint the player actually sees; bed-depth-only gating left holes
 * over shallow-but-tinted stretches) or, for water-biome-free fixtures, when
 * its bed sits within FORD_WET_MARGIN_M of the channel floor. Dry landings
 * belong to the trail, not the ford. Strip color runs wet→dry: a strip whose
 * bed nearly reaches its crown is awash and darkens toward wet sand.
 *
 * A single center-point bed sample is NOT enough for the waterline: a
 * crossing can sit at the window edge where the center column is bank-height
 * while the wet channel runs a few meters over — the dense min keeps the
 * causeway on the water.
 */
function fordCrossingDecks(
  crossing: GroundCrossing,
  at: (alongM: number, acrossM: number) => { x: number; z: number },
  halfSpan: number,
  surfaceYAt: (x: number, z: number) => number,
  waterlineYAt: (x: number, z: number) => number | undefined,
  isWaterAt: (x: number, z: number) => boolean,
): GroundDeck[] {
  const seed = crossing.roadRouteId * 131071 + crossing.riverId * 8209;
  const barHalfWidth = Math.max(
    crossing.widthM * 0.6,
    FORD_BAR_MIN_HALF_WIDTH_M,
  );

  // Preserve the deepest-bed scan as a legacy fallback for fixtures/saves that
  // predate waterlineY. Current worlds replace it with the shared river query.
  const landingTrimM = Math.min(halfSpan * 0.4, FORD_LANDING_M);
  let channelFloorY = Number.POSITIVE_INFINITY;
  const sampleHalf = halfSpan - landingTrimM;
  for (let i = -8; i <= 8; i += 1) {
    const p = at((i / 8) * sampleHalf, 0);
    channelFloorY = Math.min(channelFloorY, surfaceYAt(p.x, p.z));
  }
  const sharedWaterlineY =
    waterlineYAt(crossing.xM, crossing.zM) ??
    channelFloorY + GROUND_RIVER_CHANNEL_DEPTH_M;
  const sharedChannelFloorY = sharedWaterlineY - GROUND_RIVER_CHANNEL_DEPTH_M;

  const decks: GroundDeck[] = [];

  // Causeway strips.
  const stripCount = Math.max(1, Math.ceil(crossing.spanM / FORD_STRIP_LEN_M));
  const stripLen = crossing.spanM / stripCount;
  for (let s = 0; s < stripCount; s += 1) {
    const a0 = -halfSpan + s * stripLen;
    const a1 = a0 + stripLen;
    let bedMin = Number.POSITIVE_INFINITY;
    let bedMax = Number.NEGATIVE_INFINITY;
    let touchesWater = false;
    for (const alongM of [a0, (a0 + a1) / 2, a1]) {
      const p = at(alongM, 0);
      const y = surfaceYAt(p.x, p.z);
      bedMin = Math.min(bedMin, y);
      bedMax = Math.max(bedMax, y);
      if (isWaterAt(p.x, p.z)) touchesWater = true;
    }
    // Dry landing — the trail's job, not the causeway's.
    if (!touchesWater && bedMin > sharedChannelFloorY + FORD_WET_MARGIN_M)
      continue;

    const topY = Math.max(
      sharedChannelFloorY + FORD_BAR_PROUD_M,
      bedMax + FORD_BAR_BED_CLEAR_M,
    );
    // 0 = full crown standing over deep water (dry sand), 1 = bed at the
    // crown (awash, wet sand). Small per-strip brightness jitter breaks the
    // single-flat-quad read the same way the 2D painter's mottling does.
    const wetness = Math.min(
      1,
      Math.max(0, 1 - (topY - bedMax) / FORD_BAR_PROUD_M),
    );
    decks.push({
      cornersM: [
        at(a0, -barHalfWidth),
        at(a1, -barHalfWidth),
        at(a1, barHalfWidth),
        at(a0, barHalfWidth),
      ],
      topY,
      kind: "ford",
      color: tintLerp(
        FORD_DRY_SAND_RGB,
        FORD_WET_SAND_RGB,
        wetness,
        0.96 + fhash01(seed + 300 + s, 17) * 0.08,
      ),
      sourceCrossingId: crossing.id,
    });
  }
  // Nothing wet along the whole span → no visible river to ford here.
  if (decks.length === 0) return [];

  // Stepping stones: irregular sizes, drunk spacing, ~1 in 5 washed away —
  // mirrors the 2D painter's stone line. Side of the bar is a deterministic
  // coin flip (Ground carries no flow direction to call "upstream"). Stones
  // exist only in the wet zone — on dry bank they read as fence posts.
  const side = fhash01(seed, 41) < 0.5 ? -1 : 1;
  let alongM = -halfSpan + 0.6;
  let stoneIdx = 0;
  while (alongM < halfSpan - 0.6 && stoneIdx < FORD_STONE_MAX) {
    stoneIdx += 1;
    const step = FORD_STONE_STEP_M * (0.75 + fhash01(seed + stoneIdx, 7) * 0.8);
    if (fhash01(seed + stoneIdx, 6) >= 0.2) {
      const acrossM =
        side *
        (barHalfWidth +
          FORD_STONE_OFFSET_M +
          (fhash01(seed + stoneIdx, 9) - 0.5) * 1.2);
      const center = at(alongM, acrossM);
      const bedY = surfaceYAt(center.x, center.z);
      if (
        !isWaterAt(center.x, center.z) &&
        bedY > sharedChannelFloorY + FORD_WET_MARGIN_M
      ) {
        alongM += step;
        continue;
      }
      const radius = 0.2 + fhash01(seed + stoneIdx, 10) * 0.25;
      const rot = fhash01(seed + stoneIdx, 12) * Math.PI * 2;
      const cornersM = [0, 1, 2, 3, 4].map((k) => {
        const ang = rot + (k / 5) * Math.PI * 2;
        const r = radius * (0.75 + fhash01(seed + stoneIdx * 5 + k, 13) * 0.5);
        return {
          x: center.x + Math.cos(ang) * r,
          z: center.z + Math.sin(ang) * r,
        };
      });
      decks.push({
        cornersM,
        // Stones clear both their own bed and the visible surface, so their
        // tops remain legible while the lower body reads as submerged.
        topY: Math.max(
          bedY + 0.35 + fhash01(seed + stoneIdx, 14) * 0.2,
          (waterlineYAt(center.x, center.z) ?? sharedWaterlineY) +
            0.04 +
            fhash01(seed + stoneIdx, 14) * 0.1,
        ),
        kind: "fordStone",
        color: tintLerp(
          FORD_STONE_RGB,
          FORD_STONE_RGB,
          0,
          0.85 + fhash01(seed + stoneIdx, 15) * 0.3,
        ),
        sourceCrossingId: crossing.id,
      });
    }
    alongM += step;
  }

  return decks;
}

/**
 * Non-hostile atlas marker types (FMG `markers-generator`) that read as
 * discoverable off-map LANDMARKS, mapped to a `HiddenPlaceKind`. Hostile
 * marker types (brigands/pirates/dungeons/caves/…monsters/rifts/burials) are
 * intentionally absent — those already drive `generateGroundHostiles`, so a
 * dungeon/cave becomes a hostile spawn rather than a passive discovery site.
 *
 * This is the anchor that makes a revealed hidden place trace back to a real
 * worldmap fact (PV2): each site here BEGINS as a marker the atlas already
 * knows, not a per-window random point.
 */
/** Player-facing label per hidden-place kind (mirrors hiddenPlaces' KIND_NAME,
 * kept local to avoid a cross-module export just for marker-derived sites). */
const HIDDEN_KIND_NAME: Record<HiddenPlaceKind, string> = {
  ruin: "Ruins",
  cave: "Cave",
  shrine: "Shrine",
  camp: "Camp",
  grove: "Hidden Grove",
  wreck: "Wreck",
};

const MARKER_KIND_MAP: Record<string, HiddenPlaceKind> = {
  ruins: "ruin",
  statues: "ruin",
  battlefields: "ruin",
  libraries: "ruin",
  "sacred-mountains": "shrine",
  "sacred-forests": "grove",
  "sacred-pineries": "grove",
  "sacred-palm-groves": "grove",
  "hot-springs": "shrine",
  "water-sources": "grove",
  waterfalls: "grove",
  volcanoes: "cave",
  mines: "cave",
  portals: "shrine",
  lighthouses: "wreck",
  canoes: "wreck",
  inns: "camp",
  fairs: "camp",
  circuses: "camp",
  jousts: "camp",
  migration: "camp",
  // Forests campaign (T8b): forest POI markers (forestsPass) surface as
  // proximity discoveries through the existing kinds — no new machinery.
  "hunter-camp": "camp",
  "hermit-hollow": "camp",
  "forest-shrine": "shrine",
  "beast-den": "cave",
};

/**
 * Anchor hidden discovery sites to real atlas marker FACTS (PV2). Each
 * non-hostile region marker inside the local window (with a small margin)
 * becomes a `GroundHiddenSite` positioned at the marker's feet→meters spot,
 * so a place the player reveals by 3D proximity is a location the worldmap
 * actually carries — not a per-window random point.
 *
 * Deterministic: positions come straight from marker coords; the per-site
 * discovery radius is fixed. Returns at most one site per eligible marker,
 * preserving region marker order (itself deterministic from the seed path).
 */
function markerDerivedHiddenSites(
  markers: RegionMarker[] | undefined,
  local: LocalArtifact,
  discoveryRadiusFt: number,
): GroundHiddenSite[] {
  if (!markers?.length) return [];
  const { bounds } = local;
  const extentXM = bounds.width * FEET_TO_METERS;
  const extentZM = bounds.height * FEET_TO_METERS;
  // Accept markers a little outside the window so an off-screen-but-near
  // landmark still seeds a reachable discovery (matches the hostile margin).
  const MARGIN_M = 50;
  const out: GroundHiddenSite[] = [];
  let n = 0;
  for (const m of markers) {
    const kind = MARKER_KIND_MAP[m.type];
    if (!kind) continue; // hostile or non-discoverable marker — skip
    const xM = (m.x - bounds.x) * FEET_TO_METERS;
    const zM = (m.y - bounds.y) * FEET_TO_METERS;
    if (xM < -MARGIN_M || xM > extentXM + MARGIN_M) continue;
    if (zM < -MARGIN_M || zM > extentZM + MARGIN_M) continue;
    out.push({
      id: `wf-hidden-marker-${m.type}-${n++}`,
      kind,
      name: HIDDEN_KIND_NAME[kind],
      xM,
      zM,
      discoveryRadiusM: discoveryRadiusFt * FEET_TO_METERS,
    });
  }
  return out;
}

/**
 * Pure canopy resolution (forests Task 11): the window's legacy biome def +
 * named-forest kind → the `GroundWorld.canopy` payload, or null when the def
 * carries no canopyShade (open land, grassland, water). A def that shades
 * without naming a fog grade defaults to 'light'. Kept pure (defs passed in)
 * so it tests without the bridge atlas; production passes `BIOMES`.
 */
export function resolveCanopy(
  legacyBiomeId: string | undefined,
  forestKind: ForestKind | null,
  biomes: Record<
    string,
    {
      visibilityModifiers?: {
        fog?: "light" | "medium" | "heavy";
        canopyShade?: boolean;
      };
    }
  >,
): GroundCanopy | null {
  const vis = legacyBiomeId
    ? biomes[legacyBiomeId]?.visibilityModifiers
    : undefined;
  if (!vis?.canopyShade) return null;
  return { shade: true, fog: vis.fog ?? "light", forestKind };
}

/**
 * Latitude (degrees) of an anchor atlas cell, or `null` when the pack carries
 * no map coordinates. The bridge half of the snow-line seam (Task 10): it
 * reads the anchor cell's graph-y + the pack's `mapCoordinates` off the same
 * per-seed atlas cache the canopy seam uses, then defers the actual math to the
 * pure `latitudeAtGraphY` (unit-tested without the bridge).
 */
function anchorLatitudeDeg(seed: number, cellId: number): number | null {
  const atlas = getBridgeAtlas(seed);
  const p = atlas.pack.cells.p[cellId];
  if (!p) return null;
  return latitudeAtGraphY(p[1], atlas.graphHeight, atlas.mapCoordinates);
}

export interface MakeGroundWorldOptions {
  /** In-game hour 0–23: working adults stand at their work plot during
   * business hours (8–18), at home otherwise. Default noon. */
  hour?: number;
  /** Saved world deltas (B6/B7 plot edits) — replayed onto each town plan
   * before buildings/interiors/rosters derive from it, so the 3D village
   * reflects player edits. */
  deltas?: WorldDelta[];
  worldBusinesses?: Record<string, WorldBusiness>;
  generatedNpcs?: Record<string, RichNPC>;
  /** Sparse save-side building events, grouped by burg and canonical plot id. */
  buildingEventLogs?: BuildingEventLogsByBurg;
  /**
   * Staged 3D world entry (Stage A): skip the WAVE-1 props pass so terrain +
   * town assemble as fast as possible. A world built this way has `props: []`
   * and is otherwise identical to a full build; the props are added afterward by
   * a separate `computeGroundProps` call (Stage B). Default false = full build.
   */
  skipProps?: boolean;
  /**
   * Atlas cell the window anchors on (worldGenCore's entry cell). Enables the
   * per-window canopy resolution (forests Task 11); omitted (tests, legacy
   * callers) → `canopy: null`, behavior unchanged.
   */
  anchorCellId?: number;
}

/**
 * The WAVE-1 props pass, factored out so it can run on its own (staged 3D entry
 * Stage B) OR inside `makeGroundWorld` (full build). Both routes call THIS, so
 * the staged props are byte-identical to the full-build props. Pure and
 * deterministic per world + window.
 */
export function computeGroundProps(
  world: GroundWorld,
  seed: number,
  region?: RegionArtifact,
  opts: MakeGroundWorldOptions = {},
): PropInstance[] {
  return buildGroundProps(world, seed, region?.seedPath, opts.worldBusinesses);
}

export function makeGroundWorld(
  local: LocalArtifact,
  seed: number,
  region?: RegionArtifact,
  opts: MakeGroundWorldOptions = {},
): GroundWorld {
  const wd = localArtifactToWorldData(local, seed);
  const townContent = groundTowns(
    local,
    region,
    opts.hour ?? 12,
    opts.deltas ?? [],
    seed,
    opts,
    wd.gridSize.cols,
    wd.gridSize.rows,
  );

  // Each makeGroundWorld call receives a freshly allocated height array from
  // localArtifactToWorldData. Flattening mutates only that per-call array, so
  // the LocalArtifact terrain and any future makeGroundWorld calls stay clean.
  flattenBuildingTerrainPads(
    wd.heights,
    wd.gridSize.cols,
    wd.gridSize.rows,
    townContent.buildings,
  );

  // Carve a shallow basin under each town water body (so the flat water surface
  // reads with a shoreline) and resolve each body's surfaceY + deck's topY from
  // the surrounding shore height. Building footprint cells are protected, so
  // waterfront plots keep their level pads (buildings win over water).
  carveTownWaterBasins(
    wd.heights,
    wd.gridSize.cols,
    wd.gridSize.rows,
    townContent.planWaterBodies,
    townContent.planDecks,
    townContent.buildings,
  );

  const features: GroundFeature[] = local.features.map((f) => ({
    id: f.id,
    kind: f.kind,
    xM: (f.x - local.bounds.x) * FEET_TO_METERS,
    zM: (f.y - local.bounds.y) * FEET_TO_METERS,
  }));

  const extentX = wd.gridSize.cols * GROUND_METERS_PER_CELL;
  const extentZ = wd.gridSize.rows * GROUND_METERS_PER_CELL;
  const centerX = extentX / 2;
  const centerZ = extentZ / 2;

  // Derive hostile spawns from region markers/zones (HOSTILE-1).
  // Pure, deterministic, seeded. Empty when the window has no hostile
  // context — peaceful tiles spawn nothing (hard rule: no fallback hostiles).
  const hostiles: GroundHostile[] = generateGroundHostiles(
    region?.markers,
    region?.zones,
    seed,
    local.bounds.x,
    local.bounds.y,
    local.bounds.width,
    local.bounds.height,
  );

  // SP4 discovery (PV2): hidden/discovery places should BE real off-map
  // locations of the world, not spatially-random per local. So we ANCHOR them
  // to atlas FACTS first — each non-hostile region marker inside this window
  // becomes a discovery site at the marker's real position (a ruin/shrine/cave
  // the worldmap already knows). Only if there aren't enough markers to reach
  // the target count do we TOP UP with the seeded `generateHiddenPlaces`
  // scatter, keeping the discovery loop populated where the map is sparse.
  // Both halves are deterministic; markers come first so a revealed site
  // traces to a worldmap fact, with seeded scatter only as filler.
  const HIDDEN_COUNT = 6;
  const HIDDEN_RADIUS_FT = 250;
  const hiddenSites: GroundHiddenSite[] = markerDerivedHiddenSites(
    region?.markers,
    local,
    HIDDEN_RADIUS_FT,
  ).slice(0, HIDDEN_COUNT);

  // Top up with seeded scatter only if markers didn't fill the quota.
  const topUpNeeded = HIDDEN_COUNT - hiddenSites.length;
  if (topUpNeeded > 0) {
    const boundsPoly: Pt[] = [
      [local.bounds.x, local.bounds.y],
      [local.bounds.x + local.bounds.width, local.bounds.y],
      [
        local.bounds.x + local.bounds.width,
        local.bounds.y + local.bounds.height,
      ],
      [local.bounds.x, local.bounds.y + local.bounds.height],
    ];
    const hiddenSeed = childSeedPath(
      rootSeedPath(seed),
      `hidden:${Math.round(local.bounds.x)}:${Math.round(local.bounds.y)}`,
    );
    const scattered = generateHiddenPlaces(boundsPoly, hiddenSeed, {
      count: topUpNeeded,
      discoveryRadius: HIDDEN_RADIUS_FT, // feet
    }).map((hp) => ({
      id: hp.id,
      kind: hp.kind,
      name: hp.name,
      xM: (hp.position[0] - local.bounds.x) * FEET_TO_METERS,
      zM: (hp.position[1] - local.bounds.y) * FEET_TO_METERS,
      discoveryRadiusM: hp.discoveryRadius * FEET_TO_METERS,
    }));
    hiddenSites.push(...scattered);
  }

  // Pillar 2 (Task 6): world-grown dungeon ENTRANCES inside this window. The
  // dungeon-flavored FMG markers that used to feed surface hostiles now surface
  // as sealed doors here (the seam fix — groundHostiles skips those types), and
  // temple/sewer/civ sites surface the same way. Pure clip-and-rebase over the
  // seed's cached site list; empty when no site falls in the window.
  const dungeonEntrances = dungeonEntrancesForWindow(seed, local);

  // Canopy atmosphere (forests Task 11): resolved ONCE per window from the
  // anchor cell. Both cell lookups ride the bridge's per-seed atlas cache the
  // caller already warmed by resolving this window; without an anchor cell
  // (tests, legacy paths) the canopy is null and nothing downstream changes.
  const canopy =
    opts.anchorCellId != null
      ? resolveCanopy(
          biomeIdForCell(seed, opts.anchorCellId),
          forestKindForCell(seed, opts.anchorCellId),
          BIOMES,
        )
      : null;

  // Snow line (Task 10 MOUNTAINS, reworked 2026-07-21): resolved ONCE per
  // window from the anchor cell's atlas latitude (spec §5's 3-band table) as
  // ABSOLUTE local-elevation feet, then converted to this window's RELATIVE
  // encoded units — the adapter re-bases heights so the window's lowest point
  // sits at 0, and the old pack-h threshold compared against those re-based
  // heights could never fire (a window needed ~990 m of internal relief).
  // A window entirely below the snow line yields a threshold above 100 (no
  // snow); a summit window yields a low threshold (caps). Without an anchor
  // (tests/legacy) the old temperate pack-h baseline threads through unchanged.
  // Window floor in absolute local-elevation feet — the adapter's re-basing
  // datum. Shared by the snow-line conversion and the far shells.
  let baseElevFt = Infinity;
  {
    const elev = local.terrain.elevationFt;
    for (let i = 0; i < elev.length; i++) {
      if (elev[i] < baseElevFt) baseElevFt = elev[i];
    }
  }
  const anchorLat =
    opts.anchorCellId != null ? anchorLatitudeDeg(seed, opts.anchorCellId) : null;
  let snowLineH: number = SNOW_LINE_H;
  if (opts.anchorCellId != null) {
    const snowLineFt = resolveSnowLineFt(anchorLat);
    const heightDomainM =
      WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M * WORLD3D_CONFIG.VERTICAL_EXAGGERATION;
    snowLineH =
      (((snowLineFt - baseElevFt) * FEET_TO_METERS) / heightDomainM) * 100;
  }

  // Convert the two Region networks first, then bind their crossing receipts
  // to exact Ground run indexes. Regional bridge decks and tactical crossings
  // now descend from this one relationship instead of matching visual overlap.
  // A region window gets far shells (built below), which retire the sampler's
  // edge falloff — waterlines and decks must share that convention.
  const regionRivers = computeGroundRiverWaterlines(
    region ? regionPolylinesToGround(region.rivers, local, "river") : [],
    wd.heights,
    wd.gridSize.cols,
    wd.gridSize.rows,
    region == null,
  );
  const regionRoads = region
    ? regionPolylinesToGround(region.roads, local, "region-road", {
        crossings: region.crossings ?? [],
        biomeIds: wd.biomeIds,
        cols: wd.gridSize.cols,
        rows: wd.gridSize.rows,
      })
    : [];
  const roads = [...regionRoads, ...townContent.planStreets];
  const crossings = region
    ? regionCrossingsToGround(
        region.crossings ?? [],
        local,
        regionRoads,
        regionRivers,
      )
    : [];
  const decks = [
    ...townContent.planDecks,
    ...regionalBridgeDecks(
      crossings,
      regionRivers,
      wd.heights,
      wd.gridSize.cols,
      wd.gridSize.rows,
      wd.biomeIds,
      region == null,
    ),
  ];

  // Far-distance shells (2026-07-21): the region ring + atlas horizon ring
  // that replace the visible world edge. Built only when a region exists (the
  // game entry paths always have one; minimal test fixtures keep the legacy
  // edge-falloff look). The horizon needs the atlas's regular grid heightmap;
  // a pack without one (crafted worlds) gets the region ring alone.
  let farShells: FarShells | undefined;
  if (region) {
    const atlas = getBridgeAtlas(seed);
    const grid = (atlas as unknown as {
      grid?: { cellsX?: number; cellsY?: number; cells?: { h?: ArrayLike<number> } };
    }).grid;
    const horizonSource =
      grid?.cells?.h != null && grid.cellsX && grid.cellsY
        ? {
            gridH: grid.cells.h,
            cellsX: grid.cellsX,
            cellsY: grid.cellsY,
            graphWidth: atlas.graphWidth,
            graphHeight: atlas.graphHeight,
            feetPerPixel: FEET_PER_FMG_PIXEL,
          }
        : null;
    farShells = buildFarShells(
      region,
      local,
      baseElevFt,
      anchorLat,
      wd.heights,
      wd.gridSize.cols,
      wd.gridSize.rows,
      horizonSource,
    );
  }

  const world: GroundWorld = {
    cols: wd.gridSize.cols,
    rows: wd.gridSize.rows,
    heights: wd.heights,
    biomeIds: wd.biomeIds,
    extentMetersX: extentX,
    extentMetersZ: extentZ,
    features,
    props: [], // filled below once the world view is assembled
    hostiles,
    hiddenSites,
    dungeonEntrances,
    rivers: regionRivers,
    // Region routes + the town plan's own streets ride the same ribbon path.
    roads,
    crossings,
    walls: townContent.planWalls,
    waterBodies: townContent.planWaterBodies,
    waterRuns: waterRunsFromLevels(
      resolveGroundWater(
        wd.gridSize.cols,
        wd.gridSize.rows,
        wd.heights,
        townContent.planWaterBodies,
      ),
      wd.gridSize.cols,
      GROUND_METERS_PER_CELL,
    ),
    decks,
    gatehouses: townContent.planGatehouses,
    towns: townContent.towns,
    settlementDefenses: townContent.settlementDefenses,
    buildings: townContent.buildings,
    rosters: townContent.rosters,
    occupants: townContent.occupants,
    townPlans: townContent.townPlans,
    boundsFeet: { x: local.bounds.x, y: local.bounds.y },
    canopy,
    snowLineH,
    farShells,
  };

  // WAVE-1 props: deterministic dressing (market stalls, dock crates, wilderness
  // cover) derived from the assembled world's own plots/decks/roads/biomes. Rooted
  // at the region's seed path when present so props share the town's identity.
  // Staged 3D entry: Stage A skips this so terrain + town appear fast; Stage B
  // fills props in via computeGroundProps (the SAME call), keeping them identical.
  world.props = opts.skipProps
    ? []
    : computeGroundProps(world, seed, region, opts);

  return world;
}

/**
 * Flatten building plots directly into the encoded terrain grid.
 *
 * Buildings, their interior parts, and occupant markers all ask the same
 * GroundWorld for surface height later in the loader. Leveling this one height
 * array keeps every consumer in agreement without adding building-specific
 * exceptions to the chunk sampler or renderer.
 */
function flattenBuildingTerrainPads(
  heights: number[],
  cols: number,
  rows: number,
  buildings: GroundWorld["buildings"],
): void {
  // Pad heights are sampled from the original terrain before any plot changes.
  // This avoids construction order affecting nearby buildings.
  const originalHeights = heights.slice();
  const footprintPads = new Map<number, number>();
  const skirtPads = new Map<number, number[]>();

  // Sample every unmodified centroid first, then negotiate attached rows as a
  // group. Detached, courtyard, legacy, singleton, and overly steep groups
  // resolve to their exact historical sample.
  const rawPads = buildings.flatMap((building, order) => {
    if (building.cornersM.length < 3) return [];
    const centroid = {
      x:
        building.cornersM.reduce((sum, corner) => sum + corner.x, 0) /
        building.cornersM.length,
      z:
        building.cornersM.reduce((sum, corner) => sum + corner.z, 0) /
        building.cornersM.length,
    };
    return [
      {
        id: building.id,
        rawHeightEncoded: sampleEncodedHeight(
          originalHeights,
          cols,
          rows,
          centroid.x,
          centroid.z,
        ),
        order,
        blockKey: building.ensemble?.blockKey,
        ensembleKind: building.ensemble?.kind,
      },
    ];
  });
  const resolvedPads = resolveTerrainTerraces(rawPads);

  for (const building of buildings) {
    if (building.cornersM.length < 3) continue;

    // The pure resolver keeps the value in the terrain's encoded 0..100 domain.
    const resolved = resolvedPads.get(building.id);
    if (!resolved) continue;
    const padHeight = resolved.padHeightEncoded;
    building.terrainTerrace = resolved.terrace;
    const footprintIndexes = buildingFootprintCells(
      cols,
      rows,
      building.cornersM,
    );
    const footprintSet = new Set(footprintIndexes);

    // Every cell whose center falls inside the plot is made perfectly level.
    for (const index of footprintIndexes) {
      footprintPads.set(index, padHeight);
    }

    // A one-cell ring around the plot is blended halfway toward the pad. The
    // ring softens the join to the natural slope without widening the actual
    // level building footprint.
    for (const index of footprintIndexes) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const neighborCol = col + dx;
          const neighborRow = row + dz;
          if (
            neighborCol < 0 ||
            neighborCol >= cols ||
            neighborRow < 0 ||
            neighborRow >= rows
          )
            continue;
          const neighborIndex = neighborRow * cols + neighborCol;
          if (footprintSet.has(neighborIndex)) continue;
          const pads = skirtPads.get(neighborIndex) ?? [];
          pads.push(padHeight);
          skirtPads.set(neighborIndex, pads);
        }
      }
    }
  }

  // Footprints win over skirts so a neighboring building cannot slope another
  // building's interior. Overlapping skirt pads average their target height,
  // keeping the result deterministic if close plots share a transition cell.
  for (const [index, padHeight] of footprintPads) {
    heights[index] = padHeight;
  }
  for (const [index, padHeights] of skirtPads) {
    if (footprintPads.has(index)) continue;
    const averagePadHeight =
      padHeights.reduce((sum, height) => sum + height, 0) / padHeights.length;
    heights[index] =
      originalHeights[index] +
      (averagePadHeight - originalHeights[index]) * 0.5;
  }
}

/** Encoded-height drops (0..100 domain) that shape town water + its banks. */
// Water depths are authored in METERS. They used to be encoded-height units,
// which the ×VERTICAL_EXAGGERATION conversion multiplied by 18: a "shallow"
// 1.5-unit surface drop became 27 m and the 4-unit bed became a 72 m pit. Any
// town standing lower than 27 m then clamped its water to absolute sea level,
// which is what opened a 15 m chasm through burg Hajdured.
const WATER_SURFACE_DROP_M = 1.5; // water surface sits this far below its shore
const WATER_BED_DROP_M = 4; // carved bed sits this far below the water surface
const DECK_CLEARANCE_M = 0.4; // deck top stands this far above the water

/**
 * Walkable head clearance (meters) for the 2D combat-patch extractor (IN guard).
 * An interior part only blocks a floor tile if it intrudes BELOW this height — so
 * overhead parts (the door lintel at baseY 2.1, the ceiling slab near the shell
 * top, upper-floor slabs) clear a walker's head and never block the tile beneath
 * them. ~6.2 ft: above a tall figure, below a normal storey.
 */
const COMBAT_HEAD_CLEARANCE_M = 1.9;

/** Even-odd point-in-polygon on the X/Z plane (handles concave channels). */
function pointInPolygonXZ(
  px: number,
  pz: number,
  poly: Array<{ x: number; z: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a.z > pz !== b.z > pz &&
      px < ((b.x - a.x) * (pz - a.z)) / (b.z - a.z) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Grid cell indices whose centers fall inside a (possibly concave) polygon. */
function polygonCellIndices(
  cols: number,
  rows: number,
  poly: Array<{ x: number; z: number }>,
): number[] {
  if (poly.length < 3) return [];
  const minCol = Math.max(
    0,
    Math.floor(Math.min(...poly.map((p) => p.x)) / GROUND_METERS_PER_CELL) - 1,
  );
  const maxCol = Math.min(
    cols - 1,
    Math.ceil(Math.max(...poly.map((p) => p.x)) / GROUND_METERS_PER_CELL) + 1,
  );
  const minRow = Math.max(
    0,
    Math.floor(Math.min(...poly.map((p) => p.z)) / GROUND_METERS_PER_CELL) - 1,
  );
  const maxRow = Math.min(
    rows - 1,
    Math.ceil(Math.max(...poly.map((p) => p.z)) / GROUND_METERS_PER_CELL) + 1,
  );
  const out: number[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cxm = (col + 0.5) * GROUND_METERS_PER_CELL;
      const czm = (row + 0.5) * GROUND_METERS_PER_CELL;
      if (pointInPolygonXZ(cxm, czm, poly)) out.push(row * cols + col);
    }
  }
  return out;
}

/**
 * Carve a shallow basin under each town water body (so the flat surface reads
 * with a shoreline) and resolve every body's surfaceY + deck's topY from the
 * surrounding shore height. Mutates `heights` (lowering only) and the Y fields.
 */
function carveTownWaterBasins(
  heights: number[],
  cols: number,
  rows: number,
  waterBodies: GroundWaterBody[],
  decks: GroundDeck[],
  buildings: GroundWorld["buildings"],
): void {
  // NOTE: this pass shapes the BED and places decks. It deliberately does not
  // decide where water is — the carved channel changes the terrain, and
  // `deriveHydrology` then reads that terrain to work out what fills with water.
  const original = heights.slice();
  const centroidOf = (pts: Array<{ x: number; z: number }>) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / (pts.length || 1),
    z: pts.reduce((s, p) => s + p.z, 0) / (pts.length || 1),
  });

  // Building footprint cells are off-limits to carving — their level pads win,
  // so a waterfront plot never sinks into the carved channel beside it.
  const protectedCells = new Set<number>();
  for (const b of buildings) {
    if (b.cornersM.length < 3) continue;
    for (const idx of buildingFootprintCells(cols, rows, b.cornersM))
      protectedCells.add(idx);
  }

  const surfaceDropEnc = metersToHeight(WATER_SURFACE_DROP_M);
  const bedDropEnc = metersToHeight(WATER_BED_DROP_M);
  // One centroid sample cannot describe a polygon that spans real relief — a
  // harbour apron reaches 40% of the town's width. Take the lowest sample
  // around the ring so the surface never floats above ground on the low side.
  const lowestShoreEnc = (pts: Array<{ x: number; z: number }>): number => {
    let lowest = sampleEncodedHeight(original, cols, rows, ...(() => {
      const c = centroidOf(pts);
      return [c.x, c.z] as const;
    })());
    for (const p of pts) {
      lowest = Math.min(lowest, sampleEncodedHeight(original, cols, rows, p.x, p.z));
    }
    return lowest;
  };

  for (const body of waterBodies) {
    if (body.pointsM.length < 3) continue;

    if (body.kind === "sea") {
      // NOT zero. "Sea level is zero" holds in the world frame, but these
      // heights are the town artifact's LOCAL 0..100 grid, where one burg's
      // shore sits at ~16 m — pinning the apron to zero buried it 16 m under its
      // own beach (measured in-game: water quads at worldY 0 beneath terrain at
      // 16.4). Take the waterline from the shore edge the apron extends from,
      // never from its offshore corners, which sample ground far from the water.
      const shore = body.shoreEdgeM?.length ? body.shoreEdgeM : body.pointsM;
      let shoreEnc = Infinity;
      for (const p of shore) {
        shoreEnc = Math.min(shoreEnc, sampleEncodedHeight(original, cols, rows, p.x, p.z));
      }
      body.surfaceY = heightToMeters(Math.max(0, shoreEnc - surfaceDropEnc));
    } else if (body.kind === "river" && body.centerlineM?.length) {
      // A river descends. Resolve a height per centerline point from the land it
      // runs through, then force the series non-increasing downstream so the
      // surface can never flow uphill on an interpolation wobble.
      let ceiling = Infinity;
      for (const p of body.centerlineM) {
        const shoreEnc = sampleEncodedHeight(original, cols, rows, p.x, p.z);
        ceiling = Math.min(ceiling, Math.max(0, shoreEnc - surfaceDropEnc));
        p.surfaceY = heightToMeters(ceiling);
      }
      body.surfaceY = body.centerlineM.reduce((lo, p) => Math.min(lo, p.surfaceY), Infinity);
    } else {
      // Lake: one flat surface, at its OWN elevation rather than sea level.
      body.surfaceY = heightToMeters(
        Math.max(0, lowestShoreEnc(body.pointsM) - surfaceDropEnc),
      );
    }

    // Carve the bed under the body so the surface reads with a shoreline. The
    // reference is the body's own resolved water height, not a re-sampled shore,
    // so bed and surface can never disagree.
    const bedEnc = Math.max(0, metersToHeight(body.surfaceY) - bedDropEnc);
    const carveCell = (idx: number): void => {
      if (protectedCells.has(idx)) return; // buildings win — keep their level pad
      heights[idx] = Math.min(heights[idx], bedEnc); // lower only — never raise land
    };
    for (const idx of polygonCellIndices(cols, rows, body.pointsM)) carveCell(idx);

    // The channel ring is a plain left/right offset of the centerline with no
    // END CAPS, so the first and last centerline points sit exactly ON the ring
    // boundary and point-in-polygon leaves their cells uncarved — the river tail
    // keeps a lip of land standing above its own surface.
    //
    // Stamping only the containing cell is not enough: height is read back with
    // BILINEAR interpolation, so an uncarved neighbor drags the sampled surface
    // above the water again. Carve the 3x3 block around each centerline cell to
    // give the interpolation carved ground on every side.
    if (body.centerlineM) {
      for (const p of body.centerlineM) {
        const cx = Math.floor(p.x / GROUND_METERS_PER_CELL);
        const cy = Math.floor(p.z / GROUND_METERS_PER_CELL);
        for (let dy = -1; dy <= 1; dy++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = cx + dx;
            if (xx < 0 || xx >= cols) continue;
            carveCell(yy * cols + xx);
          }
        }
      }
    }
  }

  // A deck spans water, so it must clear the water it spans rather than a shore
  // sample that can disagree with the resolved water height.
  for (const deck of decks) {
    if (deck.cornersM.length < 3) continue;
    const c = centroidOf(deck.cornersM);
    let nearest: { d2: number; y: number } | null = null;
    for (const body of waterBodies) {
      for (const p of body.pointsM) {
        const d2 = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
        if (!nearest || d2 < nearest.d2) nearest = { d2, y: body.surfaceY };
      }
    }
    const waterY = nearest
      ? nearest.y
      : heightToMeters(
          Math.max(0, sampleEncodedHeight(original, cols, rows, c.x, c.z) - surfaceDropEnc),
        );
    deck.topY = waterY + DECK_CLEARANCE_M;
  }
}

/**
 * Split a closed wall ring (open vertex list, in ground meters) into OPEN runs
 * that skip a span of each gate's own radius `gapHalfM` around the gate point.
 * Gates are both river water-gates (TG7 — the river passes through an arch gap
 * instead of clipping solid stone) and road gatehouses (streets enter through
 * an opening instead of dead-ending into the rampart). The ring is densified so
 * a gate landing mid-segment (the common case — the ring is a sparse scaled
 * footprint) still carves a clean gap, and runs wrap across the closing seam so
 * a gate ON the seam still breaks cleanly.
 */
function splitWallRingAtGates(
  ring: Array<{ x: number; z: number }>,
  gates: Array<{ x: number; z: number; gapHalfM: number }>,
): Array<Array<{ x: number; z: number }>> {
  if (ring.length < 3) return [ring];
  const gated = (p: { x: number; z: number }): boolean => {
    for (const g of gates) {
      const dx = p.x - g.x;
      const dz = p.z - g.z;
      if (dx * dx + dz * dz <= g.gapHalfM * g.gapHalfM) return true;
    }
    return false;
  };

  // Densify the closed loop: emit each edge subdivided into steps small relative
  // to the SMALLEST gate gap so every gated/ungated boundary is resolved finely.
  const minGapHalf = gates.reduce((m, g) => Math.min(m, g.gapHalfM), Infinity);
  const step = Math.max(0.5, minGapHalf / 4);
  const dense: Array<{ x: number; z: number }> = [];
  const flags: boolean[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      dense.push(p);
      flags.push(gated(p));
    }
  }

  // No gate actually touches the densified ring → keep it closed.
  if (!flags.some(Boolean)) {
    const closed = ring.slice();
    closed.push(ring[0]);
    return [closed];
  }

  // Walk the closed loop once, starting at the first ungated sample, collecting
  // maximal runs of ungated points. Starting on an ungated point guarantees runs
  // that straddle the original closing seam are not split there.
  const N = dense.length;
  let start = flags.findIndex((f) => !f);
  if (start < 0) return []; // wholly gated — emit no wall
  const runs: Array<Array<{ x: number; z: number }>> = [];
  let current: Array<{ x: number; z: number }> = [];
  for (let s = 0; s <= N; s++) {
    const idx = (start + s) % N;
    if (s < N && !flags[idx]) {
      current.push(dense[idx]);
    } else {
      if (current.length >= 2) runs.push(current);
      current = [];
    }
  }
  return runs;
}

/** Yaw of the wall at the ring point nearest to `p` (segment direction). */
function wallTangentAt(
  ring: Array<{ x: number; z: number }>,
  p: { x: number; z: number },
): number {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const mx = (a.x + b.x) / 2,
      mz = (a.z + b.z) / 2;
    const d = (mx - p.x) ** 2 + (mz - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = Math.atan2(b.z - a.z, b.x - a.x);
    }
  }
  return best;
}

function buildingFootprintCells(
  cols: number,
  rows: number,
  corners: Array<{ x: number; z: number }>,
): number[] {
  // The bounds trim the scan to the plot's neighborhood; the quad test below
  // remains the source of truth for rotated or skewed footprints.
  const minCol = Math.max(
    0,
    Math.floor(
      Math.min(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL,
    ) - 1,
  );
  const maxCol = Math.min(
    cols - 1,
    Math.ceil(
      Math.max(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL,
    ) + 1,
  );
  const minRow = Math.max(
    0,
    Math.floor(
      Math.min(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL,
    ) - 1,
  );
  const maxRow = Math.min(
    rows - 1,
    Math.ceil(
      Math.max(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL,
    ) + 1,
  );
  const indexes: number[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const center = {
        x: (col + 0.5) * GROUND_METERS_PER_CELL,
        z: (row + 0.5) * GROUND_METERS_PER_CELL,
      };
      if (pointInsideConvexQuad(center, corners))
        indexes.push(row * cols + col);
    }
  }

  return indexes;
}

function pointInsideConvexQuad(
  point: { x: number; z: number },
  corners: Array<{ x: number; z: number }>,
): boolean {
  // Generated plot corners form convex quads. A point inside the plot stays on
  // the same side of every directed edge.
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function sampleEncodedHeight(
  heights: number[],
  cols: number,
  rows: number,
  wxM: number,
  wzM: number,
): number {
  // This mirrors groundSurfaceY's encoded-grid interpolation but intentionally
  // stops before heightToMeters because terrain pads are stored in 0..100.
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const gx = clampX(wxM / GROUND_METERS_PER_CELL);
  const gy = clampY(wzM / GROUND_METERS_PER_CELL);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h = (xx: number, yy: number) => heights[yy * cols + xx] ?? 0;
  const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
  const bottom = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Project a parametric BodyPlan (feet, BODY-1) into the renderer's OccupantBody
 * (meters + hex). Torso box depth derives from the chest girth treated as a
 * circumference (girth / π), so a stockier build reads as a deeper figure.
 */
function bodyPlanToOccupantBody(plan: BodyPlan): OccupantBody {
  const p = plan.proportions;
  return {
    heightM: p.height * FEET_TO_METERS,
    shoulderWidthM: p.shoulderWidth * FEET_TO_METERS,
    depthM: (p.torsoGirth / Math.PI) * FEET_TO_METERS,
    headSizeM: p.headSize * FEET_TO_METERS,
    skinToneHex: plan.skinToneHex,
    clothingHex: plan.clothingPrimaryHex,
  };
}

function getBusinessTypeForPlot(role: string, plotId: number): BusinessType {
  const types: BusinessType[] =
    role === "market"
      ? [
          "general_store",
          "tavern",
          "apothecary",
          "trading_company",
          "enchanter_shop",
        ]
      : ["smithy", "mine", "farm", "trading_company"];
  const index =
    Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
  return types[index];
}

/**
 * The canonical artifact town (plots + streets + walls) for a burg's
 * RegionTownSite — the SINGLE place the live pipeline derives a town's plot IDs.
 *
 * Generated once in the normalized frame (`getCanonicalTownPlan`, shared with
 * the 2D map drill), then scaled by population and placed at the burg's region
 * envelope. `groundTowns` (geometry + roster) AND `World3DWrapper`
 * (business/NPC pre-registration) both call THIS, so the plot IDs they key off
 * (`biz_burg_<id>_plot_<plotId>`) always refer to the same buildings — the
 * earlier divergence (registration ran the retired rect generator while the
 * renderer ran the canonical one) produced mismatched IDs and unbound shops.
 */
export function canonicalArtifactTownForSite(
  worldSeed: number,
  site: RegionTownSite,
): AdaptedTownPlan & { family: StyleFamily } {
  // Keep the historical public wrapper for registration and tests, but make
  // the Atlas-accepting town module the one implementation. Native Local
  // generation can now call that same implementation with its retained Atlas.
  return canonicalArtifactTownForSiteFromAtlas(
    getBridgeAtlas(worldSeed),
    worldSeed,
    site,
  );
}

/**
 * Town water bodies (filled surfaces) + dock/bridge deck quads for a site, in
 * ground meters. Derived from the SAME canonical plan + inherited water that
 * seated the 2D docks/bridges, transformed with the SAME placement as the town —
 * so the rendered water sits exactly under the piers. Surface/top Y are filled
 * later by the terrain-carve pass (heights aren't known here).
 */
export function canonicalTownWaterAndDecks(
  worldSeed: number,
  site: RegionTownSite,
  bounds: { x: number; y: number },
): { waterBodies: GroundWaterBody[]; decks: GroundDeck[] } {
  const townAtlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(townAtlas, worldSeed, site.burgId);
  const spanFt = townSpanFtForBurg(townAtlas, site.burgId);
  const placeScale = spanFt / CANON_TOWN_SPAN;
  const placeDx = site.envelope.x + site.envelope.width / 2;
  const placeDy = site.envelope.y + site.envelope.height / 2;
  const feetPlan = transformTownPlan(enginePlan, placeScale, placeDx, placeDy);

  const toM = (fx: number, fy: number) => ({
    x: (fx - bounds.x) * FEET_TO_METERS,
    z: (fy - bounds.y) * FEET_TO_METERS,
  });
  const toFeet = (line: Array<[number, number]>): Array<[number, number]> =>
    line.map(([x, y]) => [x * placeScale + placeDx, y * placeScale + placeDy]);

  // Footprint centroid (feet) → the inland reference for outward apron direction.
  const fp = feetPlan.footprint;
  const centroid: [number, number] = [
    fp.reduce((s, p) => s + p[0], 0) / (fp.length || 1),
    fp.reduce((s, p) => s + p[1], 0) / (fp.length || 1),
  ];

  const wf = getCanonicalTownWaterFeatures(townAtlas, site.burgId, worldSeed);
  const bodiesFt = buildTownWaterBodies({
    rivers: wf.rivers.map(toFeet),
    coast: wf.coast.map(toFeet),
    centroid,
    // 3% of the town's span PER SIDE scales with the settlement, so a large
    // burg got a 50 m river through its middle — the slabs Remy circled. A
    // river's width has nothing to do with how big the town beside it is, so
    // the share is capped at a river-sized channel.
    channelHalfWidth: Math.min(spanFt * 0.03, TOWN_RIVER_MAX_HALF_WIDTH_FT),
    apronDepth: spanFt * 0.4,
  });
  // Heights stay 0 here; carveTownWaterBasins resolves them from the shore.
  const waterBodies: GroundWaterBody[] = bodiesFt.map((body) => ({
    pointsM: body.points.map(([fx, fy]) => toM(fx, fy)),
    kind: body.kind,
    surfaceY: 0,
    ...(body.kind === "river" && body.centerline
      ? {
          centerlineM: body.centerline.map(([fx, fy]) => {
            const m = toM(fx, fy);
            return { x: m.x, z: m.z, surfaceY: 0 };
          }),
        }
      : {}),
    ...(body.shoreEdge
      ? { shoreEdgeM: body.shoreEdge.map(([fx, fy]) => toM(fx, fy)) }
      : {}),
  }));

  // The burg's architecture family (same resolution as canonicalArtifactTownForSite)
  // supplies the deck detailing — pilings/railings/arch — for docks AND bridges;
  // the renderer decides what applies per kind.
  const family = styleFamilyForCultureType(
    getBurgCultureType(worldSeed, site.burgId),
  );
  const decks: GroundDeck[] = [];
  for (const c of feetPlan.civic) {
    if (c.kind !== "dock" && c.kind !== "bridge") continue;
    // Preserve the civic kind end-to-end (TG5) — it tints the deck downstream.
    decks.push({
      cornersM: c.polygon.map(([fx, fy]) => toM(fx, fy)),
      topY: 0,
      kind: c.kind,
      detail: family.deckDetail,
    });
  }
  return { waterBodies, decks };
}

/**
 * Town content for the ground window: the site marker (label + keep box),
 * and — the C3 payoff — the town's GENERATED plan: streets become road
 * ribbons, plots become building boxes. Deterministic via the region's
 * seed path, so the 3D town matches the 2D town plan exactly.
 */
function groundTowns(
  local: LocalArtifact,
  region: RegionArtifact | undefined,
  hour: number,
  deltas: WorldDelta[],
  worldSeed: number,
  opts: MakeGroundWorldOptions = {},
  gridCols = 0,
  gridRows = 0,
): {
  towns: GroundWorld["towns"];
  buildings: GroundWorld["buildings"];
  planStreets: GroundPolyline[];
  planWalls: GroundPolyline[];
  planWaterBodies: GroundWaterBody[];
  planDecks: GroundDeck[];
  planGatehouses: GroundWorld["gatehouses"];
  settlementDefenses: GroundSettlementDefense[];
  rosters: TownRoster[];
  occupants: GroundOccupantSite[];
  townPlans: Array<{ burgId: number; plan: TownPlan }>;
} {
  const exX = local.bounds.width * FEET_TO_METERS;
  const exZ = local.bounds.height * FEET_TO_METERS;

  const towns: GroundWorld["towns"] = [];
  const buildings: GroundWorld["buildings"] = [];
  const planStreets: GroundPolyline[] = [];
  const planWalls: GroundPolyline[] = [];
  const planWaterBodies: GroundWaterBody[] = [];
  const planDecks: GroundDeck[] = [];
  const planGatehouses: GroundWorld["gatehouses"] = [];
  const settlementDefenses: GroundSettlementDefense[] = [];
  const rosters: TownRoster[] = [];
  const occupants: GroundOccupantSite[] = [];
  const townPlans: Array<{ burgId: number; plan: TownPlan }> = [];

  for (const t of region?.townSites ?? []) {
    const xM =
      (t.envelope.x + t.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const zM =
      (t.envelope.y + t.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const halfM =
      (Math.max(t.envelope.width, t.envelope.height) / 2) * FEET_TO_METERS;
    if (xM < -halfM || xM > exX + halfM || zM < -halfM || zM > exZ + halfM)
      continue;

    // Ground displays the Region site's Atlas-owned identity. The canonical
    // adapter below centralizes the legacy fallback, so current generation
    // never asks 3D to rediscover a second name from a separate world lookup.
    const adapted = canonicalArtifactTownForSite(worldSeed, t);
    const burgName = adapted.plan.identity?.name ?? `Burg ${t.burgId}`;
    towns.push({ burgId: t.burgId, name: burgName, xM, zM, halfM });

    // Keep the controlling state and stationed regiments beside the same town
    // geometry. Combat can later choose a patrol from these facts without
    // asking the renderer to infer guards from walls or gatehouse decoration.
    const settlementDefense = settlementDefenseForBurg(worldSeed, t.burgId);
    if (settlementDefense) settlementDefenses.push(settlementDefense);

    // CANONICAL town (Worldforge Option B): the SAME (atlas, burgId) plan the
    // 2D map drill renders — generated once in the normalized frame, then
    // scaled by population and placed into THIS town's envelope so the 3D town
    // is the same place. Shared with World3DWrapper's business/NPC registration
    // via `canonicalArtifactTownForSite`, so plot IDs never diverge.
    // Town water (filled surfaces) + dock/bridge decks from the SAME canonical
    // plan/water — surface/top Y filled by the terrain-carve pass below.
    const wd = canonicalTownWaterAndDecks(worldSeed, t, local.bounds);
    planWaterBodies.push(...wd.waterBodies);
    planDecks.push(...wd.decks);
    // Player edits replay over the regenerated plan (GROUND-DELTA-1): a
    // modified plot changes its interior, a removed one vanishes, an added
    // building appears — deterministic base + delta layer (decision #14).
    const basePlan = adapted.plan;
    const plan = deltas.length
      ? (localWithDeltas(local, basePlan, deltas).townPlan ?? basePlan)
      : basePlan;
    townPlans.push({ burgId: t.burgId, plan });
    for (const s of plan.streets) {
      planStreets.push({
        points: s.centerline.map(([fx, fy]) => ({
          x: (fx - local.bounds.x) * FEET_TO_METERS,
          z: (fy - local.bounds.y) * FEET_TO_METERS,
        })),
        // Shared street-width floor (single source: streetRibbons.STREET_MIN_WIDTH_M):
        // thinner ribbons vanish against grass at walking scale (Remy shot-1
        // review) — a village lane reads at ~8 ft.
        widthM: Math.max(STREET_MIN_WIDTH_M, s.widthFt * FEET_TO_METERS),
        sourceKind: "town-street",
        // Street tier tint (avenue/street/lane) → vertex-colored ribbon in 3D.
        colorHex: s.colorHex,
      });
    }
    // Defensive wall ring → ground polyline runs (3D renders each as an extruded
    // barrier). The ring is in region feet after the transform. Two gate kinds
    // break the ring into open runs: TG7 water-gates (an inherited river crosses
    // the ring — the river passes through an arch gap instead of clipping solid
    // stone) and ROAD gatehouses (streets enter through an opening instead of
    // dead-ending into the rampart).
    if (adapted.walls.ring.length >= 3) {
      const ringM = adapted.walls.ring.map(([fx, fy]) => ({
        x: (fx - local.bounds.x) * FEET_TO_METERS,
        z: (fy - local.bounds.y) * FEET_TO_METERS,
      }));
      // Water-gate gap wide enough to clear the river channel (channelHalfWidth
      // = spanFt*0.03, so full width ~spanFt*0.06) plus a little arch shoulder.
      const spanFt = townSpanFtForBurg(getBridgeAtlas(worldSeed), t.burgId);
      const waterGapHalfM = Math.max(3, spanFt * 0.04 * FEET_TO_METERS);
      const gatesM = (adapted.walls.waterGates ?? []).map(([fx, fy]) => ({
        x: (fx - local.bounds.x) * FEET_TO_METERS,
        z: (fy - local.bounds.y) * FEET_TO_METERS,
        gapHalfM: waterGapHalfM,
      }));
      const roadGatesM = (adapted.walls.gatehouses ?? []).map(([fx, fy]) => ({
        x: (fx - local.bounds.x) * FEET_TO_METERS,
        z: (fy - local.bounds.y) * FEET_TO_METERS,
        gapHalfM: 4, // street ribbons are >= 2.5 m; 4 m half-gap clears them with shoulder
      }));
      const allGates = [...gatesM, ...roadGatesM];
      if (allGates.length === 0) {
        ringM.push(ringM[0]); // no gate — keep the ring closed
        planWalls.push({
          points: ringM,
          widthM: 1.2,
          colorHex: adapted.family.wallTint,
        });
      } else {
        for (const run of splitWallRingAtGates(ringM, allGates)) {
          if (run.length >= 2)
            planWalls.push({
              points: run,
              widthM: 1.2,
              colorHex: adapted.family.wallTint,
            });
        }
      }
      // Record each road gate as a gatehouse placement (mesh task consumes
      // these): position + wall yaw + styled form from the burg's family.
      for (const [gi, g] of roadGatesM.entries()) {
        planGatehouses.push({
          xM: g.x,
          zM: g.z,
          angleRad: wallTangentAt(ringM, g),
          gapHalfM: g.gapHalfM,
          form: styledGatehouseForm(adapted.family, gi, t.burgId),
          colorHex: adapted.family.wallTint,
          burgId: t.burgId,
        });
      }
    }
    // Occupants live where the floor plans say they can (ROSTER-1), and
    // stand at work during business hours (time-of-day v0).
    // Culture-true names from the burg's culture (FMG Markov chains under a
    // scoped PRNG swap in getBurgNamer). No-fallback directive (2026-06-15):
    // getBurgNamer throws if the culture can't resolve — no syllable substitute.
    const nameFor = getBurgNamer(worldSeed, t.burgId);
    // The roster and lazy household must share the canonical TOWN seed. The
    // former region seed made roster servant names independent from the named
    // people whose schedules and bodies were generated below.
    const townSeed = canonicalTownSeedPath(worldSeed, t.burgId);
    const roster = generateTownRoster(plan, townSeed, { nameFor });

    // Sub-five-foot sliver plots are intentionally omitted from the ground
    // building bake below because they cover no terrain tile. Remove only their
    // newly named servants here so the roster cannot claim a servant whose home
    // has no live body or nameplate surface. Existing generic roster residents
    // retain their historical behavior outside this servant repair.
    const renderablePlotIds = new Set(
      plan.plots
        .filter((plot) => {
          if (gridCols <= 0 || gridRows <= 0) return true;
          const cornersM = plot.footprint.map(([fx, fy]) => ({
            x: (fx - local.bounds.x) * FEET_TO_METERS,
            z: (fy - local.bounds.y) * FEET_TO_METERS,
          }));
          return (
            buildingFootprintCells(gridCols, gridRows, cornersM).length > 0
          );
        })
        .map((plot) => plot.id),
    );
    roster.occupants = roster.occupants.filter(
      (occupant) =>
        occupant.householdMemberId === undefined ||
        renderablePlotIds.has(occupant.homePlotId),
    );

    // Post-process the roster: map each shopkeeper/artisan to the business owner name
    for (const o of roster.occupants) {
      if (o.workPlotId !== undefined) {
        const bizId = `biz_burg_${t.burgId}_plot_${o.workPlotId}`;
        const npcId = `npc_burg_${t.burgId}_plot_${o.workPlotId}`;
        let ownerNpc = opts.generatedNpcs?.[npcId];
        if (!ownerNpc) {
          const biz = opts.worldBusinesses?.[bizId];
          if (biz) {
            ownerNpc = opts.generatedNpcs?.[biz.ownerId];
          }
        }
        if (ownerNpc) {
          // The save-state business owner remains authoritative for a worker's
          // public name. The stable household key does not change, and the live
          // body below reads this same roster row, so both layers adopt the name
          // together instead of splitting owner identity from the interior.
          o.name = ownerNpc.name;
        } else {
          // Fallback deterministic name generation if not in state
          const seedValue = worldSeed + t.burgId + o.workPlotId;
          const rng = new SeededRandom(seedValue);
          const pPlot = plan.plots.find((pl) => pl.id === o.workPlotId);
          if (pPlot) {
            const tempNpcName = o.name || nameFor(rng);
            o.name = tempNpcName;
          }
        }
      }
    }

    // Named household servants carry one stable bridge key. Index them once so
    // the live-body bake can reuse the exact roster id and full name that later
    // become the close-range marker/nameplate site.
    const rosterByHouseholdMember = new Map(
      roster.occupants
        .filter((occupant) => occupant.householdMemberId !== undefined)
        .map((occupant) => [occupant.householdMemberId!, occupant] as const),
    );

    rosters.push(roster);
    const byPlot = new Map<
      number,
      Array<
        Occupant & {
          atWork: boolean;
          resolvedPlotId: number;
          activity: ActivityKind;
        }
      >
    >();
    for (const o of roster.occupants) {
      // Place via the CANONICAL schedule (`occupantLocationAt`) — the same source
      // of truth the 2D agent-sim uses — so the 3D scene and the overlay never
      // disagree about where someone is (was a cruder, divergent `isAtWork`).
      const block = occupantLocationAt(o, hour);
      const placeAt = block.plotId;
      const atWork = block.activity === "working";
      byPlot.set(placeAt, [
        ...(byPlot.get(placeAt) ?? []),
        { ...o, atWork, resolvedPlotId: placeAt, activity: block.activity },
      ]);
    }

    // Founding-household briefs (BGv2 Task 11): each building generates FROM the
    // family the town names for it. The town seed MUST match the one the 2D
    // tooltips key households on — canonicalTownSeedPath(worldSeed, burgId), the
    // same seed getCanonicalTownPlan feeds generateTownPlan (population pass) —
    // so the family in the 3D house IS the tooltip family. `pops` is the set of
    // population-tagged plots briefForPlot resolves workplace/proprietor
    // cross-references against; unpopulated towns carry no `pop`, so it is empty
    // and every building generates briefless exactly as before.
    const pops = householdPopulationsForPlan(plan);
    // Build the same canonical door graph used by street movement once per town.
    // Each building packet below carries its exact router endpoint into R3F.
    const streetGraph = buildStreetGraph(plan);

    // Architecture style context (BGv2 Task 7): the burg-level half of every
    // plot's StyleContext, resolved ONCE per town. cultureType is the SAME FMG
    // culture the styled EXTERIOR path already uses (getBurgCultureType, the
    // source feeding styleFamilyForCultureType at canonicalArtifactTownForSite),
    // so the solved-roof family matches the 2D map's family. climate comes from
    // the burg's own cell biome (atlas.pack.cells.biome[burg.cell]) mapped
    // through the closed BIOME_TO_CLIMATE table. Both throw on an unresolvable
    // burg / unknown biome (no-fallback). The per-plot wealth + ageBand are
    // folded in inside the plot loop. Populated towns always have a resolvable
    // burg + biome; this is the one real path, no style-less shortcut for them.
    const styleAtlas = getBridgeAtlas(worldSeed);
    const styleBurg = styleAtlas.pack.burgs?.[t.burgId] as
      { cell?: number } | undefined;
    const burgCultureType = getBurgCultureType(worldSeed, t.burgId);
    const burgBiomeId =
      styleBurg?.cell !== undefined
        ? styleAtlas.pack.cells.biome?.[styleBurg.cell]
        : undefined;
    if (burgBiomeId === undefined) {
      throw new Error(
        `groundChunkLoader: cannot resolve biome for burg ${t.burgId} in world ${worldSeed} ` +
          `(cell ${styleBurg?.cell ?? "none"}) — required for the building StyleContext.`,
      );
    }
    const burgClimate = climateForBiomeId(burgBiomeId);

    for (const p of plan.plots) {
      const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
      const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
      const xM = (cx - local.bounds.x) * FEET_TO_METERS;
      const zM = (cy - local.bounds.y) * FEET_TO_METERS;
      const frontDoor = frontDoorForPlot(streetGraph, p.id);
      const cornersM = p.footprint.map(([fx, fy]) => ({
        x: (fx - local.bounds.x) * FEET_TO_METERS,
        z: (fy - local.bounds.y) * FEET_TO_METERS,
      }));
      // Skip plots that cover no ground tile (sub-5ft slivers): they can't get a
      // level pad, so they'd render as ungrounded boxes. Every kept building is
      // guaranteed a pad (invariant the terrain-pad pass relies on).
      if (
        gridCols > 0 &&
        gridRows > 0 &&
        buildingFootprintCells(gridCols, gridRows, cornersM).length === 0
      )
        continue;
      const heightM = buildingShellHeightM(p.storeys ?? 1);

      const isBiz = p.role === "market" || p.role === "workshop";
      let bizName: string | undefined;

      if (isBiz) {
        const bizId = `biz_burg_${t.burgId}_plot_${p.id}`;
        const biz = opts.worldBusinesses?.[bizId];
        if (biz) {
          bizName = biz.name;
        } else {
          // Fallback deterministic name generation if not in state
          const seedValue = worldSeed + t.burgId + p.id;
          const rng = new SeededRandom(seedValue);
          const bizType = getBusinessTypeForPlot(p.role, p.id);
          bizName = generateBusinessName(bizType, rng);
        }
      }

      // The same byPlot map that feeds figure placement also feeds
      // nameplates, so home/work resolution cannot drift between systems.
      for (const occupant of byPlot.get(p.id) ?? []) {
        occupants.push({
          burgId: t.burgId,
          occupantId: occupant.id,
          name: occupant.name,
          xM,
          zM,
          activity: occupant.activity,
        });
      }

      // v2 (BGv2 Task 11): when the population pass tagged this plot, carry its
      // concrete building type (WINS over the role mapping) and its founding
      // household brief so the interior is designed for the real family. A plot
      // with no `pop` (unpopulated town) yields no type override and no brief —
      // briefless generation, byte-identical to before.
      // Rendering and save compaction share this exact household/style input;
      // otherwise a folded history could target a different canonical house.
      const plotInput: InteriorPlotInput = buildingPlotInput(
        plan,
        p,
        townSeed,
        {
          cultureType: burgCultureType,
          climate: burgClimate,
          eventLog: opts.buildingEventLogs?.[t.burgId]?.[p.id],
        },
      );
      // Carry this building's resolved architecture-first wealth beside its
      // population record. The full set above lets a proprietor workplace use
      // the owner's HOME wealth instead of its own cross-district stamp.
      const plotPopulation = householdPopulationForPlot(p);
      // Resolve the canonical plan exactly once at the building-load boundary.
      // Occupancy and 3D projection below receive this same object, so neither
      // consumer rebuilds household/style/history digest keys for a memo hit.
      const blueprint = blueprintForPlot(plotInput, townSeed);
      // LIVING interiors — live clock: a populated building bakes its OWN
      // family's FULL 24-hour schedule (which hours the windows glow, the hearth
      // is lit, and where each member stands every hour) instead of a single
      // entry-hour snapshot. The renderer re-resolves this against the live game
      // clock, so windows light at dusk and members move room-to-room without a
      // re-enter. It resolves the SAME household briefForPlot designs the house
      // for, so the family in the house IS the family the house was built for.
      // Unpopulated plots (no `p.pop`) fall back to the roster figures (the
      // agent-sim commuters), byte-identical to before.
      const schedule = plotPopulation
        ? occupancyScheduleForPlot(
            plotPopulation,
            pops,
            plotInput,
            townSeed,
            townSeed,
            blueprint,
          )
        : undefined;
      // Per-member render packets: reuse the EXACT body pipeline the old inline
      // bake used, keyed on the same stable per-member seed so a family's bodies
      // stay constant. Occupation is already resolved on the schedule.
      const occupantsRender: BuildingOccupantRender[] | undefined = schedule
        ? schedule.occupants.map((o) => {
            const member = schedule.household.members[o.memberIndex];
            const householdMemberId = member
              ? householdMemberIdentity(schedule.household, o.memberIndex)
              : undefined;
            const rosterMember = householdMemberId
              ? rosterByHouseholdMember.get(householdMemberId)
              : undefined;
            const occLike = {
              // Canonical named members reuse the roster id/name that feeds
              // their marker nameplate; other family bodies retain the older
              // deterministic plot/member identity until family unification.
              id: rosterMember?.id ?? p.id * 100 + o.memberIndex,
              name: rosterMember?.name ?? member?.name ?? o.name,
              // AgeBand-typed for generateBody: mirror the old inline bake
              // (member.ageBand, 'adult' when a member slot is missing).
              ageBand: member?.ageBand ?? "adult",
              homePlotId: p.id,
              occupation: o.occupation,
            };
            return {
              burgId: t.burgId,
              id: occLike.id,
              name: occLike.name,
              ...(householdMemberId ? { householdMemberId } : {}),
              ageBand: o.ageBand,
              // Ancestry group — the entity renderer turns it into a real body
              ...(member?.race ? { race: member.race } : {}),
              body: bodyPlanToOccupantBody(
                generateBody(
                  occLike,
                  childSeedPath(townSeed, `member:${p.id}:${o.memberIndex}`),
                ),
              ),
              stationsByHour: o.stationsByHour,
              // Joined roster members use the authored household schedule as
              // the door-handoff clock: meals/chores/sleep stay inside, while
              // work/out slots belong to the street simulation. This preserves
              // the canonical 07:00 meal before the 08:00 departure instead of
              // pulling the roster's earlier commute boundary into the house.
              ...(rosterMember
                ? {
                    interiorOwnedByHour: o.stationsByHour.map(
                      (station) =>
                        station !== null &&
                        station.activity !== "work" &&
                        station.activity !== "out",
                    ),
                  }
                : {}),
            };
          })
        : undefined;
      // Occupant bodies are baked live now, so populated plots inject NO figure
      // boxes into the static parts (pass an empty roster). Unpopulated plots
      // still bake the roster figures (agent-sim commuters), unchanged — each
      // gets a parametric body (BODY-1) from its own seed path.
      const occFigures: OccupantFigure[] = schedule
        ? []
        : (byPlot.get(p.id) ?? []).map((o) => ({
            id: o.id,
            ageBand: o.ageBand,
            atWork: o.atWork,
            body: bodyPlanToOccupantBody(
              generateBody(o, childSeedPath(region!.seedPath, `occ:${o.id}`)),
            ),
          }));
      // Wall envelope (≤ plot footprint) AND seamless interior parts (L4) from
      // the SAME canonical blueprint already used for occupancy. The canonical
      // TOWN seed is essential here:
      // plot ids restart at zero in every burg, so the former region seed made
      // plot 7 in two same-region towns generate the same bones. Town-scoped
      // seeds keep each burg's buildings distinct and also match the household
      // and occupancy paths above. The envelope still sizes roofs/floors so
      // eaves do not float past the walls. Supplying the plan prevents this
      // second projection from rebuilding the generator's memo digest key.
      // Window/hearth parts are now tagged with lightRole and the renderer
      // decides emissive live from the schedule — buildInterior no longer paints
      // lit flags, so pass false/false.
      const interior = buildInterior(
        plotInput,
        townSeed,
        heightM,
        occFigures,
        false,
        false,
        blueprint,
      );
      // Interior envelope in PLAN FEET (blueprint frame): the frame occupant
      // stations resolve in. envelope.wallWidthM equals blueprint.widthFt times
      // FEET_TO_METERS, so dividing recovers the exact plan-feet frame.
      const interiorWidthFt = interior.envelope.wallWidthM / FEET_TO_METERS;
      const interiorDepthFt = interior.envelope.wallDepthM / FEET_TO_METERS;
      buildings.push({
        id: `wf-plot-${t.burgId}-${p.id}`,
        xM,
        zM,
        cornersM,
        ...(p.ensemble ? { ensemble: { ...p.ensemble } } : {}),
        heightM,
        role: p.role ?? "house",
        // Style stamps from the canonical plan plot (architectureStyle slice);
        // the family flag says whether this burg's buildings get chimneys.
        wallColorHex: p.wallColorHex,
        roofColorHex: p.roofColorHex,
        roofForm: p.roofForm,
        chimney: adapted.family.chimneys,
        wallWidthM: interior.envelope.wallWidthM,
        wallDepthM: interior.envelope.wallDepthM,
        name: bizName,
        unlabeled: !isBiz,
        labelRangeM: 20,
        ...(frontDoor
          ? {
              frontDoorOffsetX: (frontDoor[0] - cx) * FEET_TO_METERS,
              frontDoorOffsetZ: (frontDoor[1] - cy) * FEET_TO_METERS,
            }
          : {}),
        parts: interior.parts,
        // Solved roof (BGv2 Task 5): undefined unless the blueprint resolved a
        // style — then the renderer draws it and skips the legacy roof prism.
        solvedRoof: interior.roof,
        // Living-interiors live clock: carry the baked 24-hour schedule +
        // occupant packets + plan-feet frame. Populated plots only.
        ...(schedule
          ? {
              litHours: schedule.litHours,
              hearthHours: schedule.hearthHours,
              occupants: occupantsRender,
              interiorWidthFt,
              interiorDepthFt,
              ...(interior.envelope.siteOriginXFt !== undefined
                ? {
                    interiorOriginXFt: interior.envelope.siteOriginXFt,
                    interiorOriginYFt: interior.envelope.siteOriginYFt,
                  }
                : {}),
            }
          : {}),
      });
    }
  }

  return {
    towns,
    buildings,
    planStreets,
    planWalls,
    planWaterBodies,
    planDecks,
    planGatehouses,
    settlementDefenses,
    rosters,
    occupants,
    townPlans,
  };
}

/** Encoded-height bilinear sample at world meters → true meters via heightToMeters. */
export function groundSurfaceY(
  ground: GroundWorld,
  wxM: number,
  wzM: number,
): number {
  const { cols, rows, heights: H } = ground;
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const gx = clampX(wxM / GROUND_METERS_PER_CELL);
  const gy = clampY(wzM / GROUND_METERS_PER_CELL);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h = (xx: number, yy: number) => H[yy * cols + xx] ?? 0;
  const enc =
    (h(x0, y0) * (1 - fx) + h(x1, y0) * fx) * (1 - fy) +
    (h(x0, y1) * (1 - fx) + h(x1, y1) * fx) * fy;
  return heightToMeters(enc);
}

/**
 * Per-occupant work hours (schedules v2): start 7–9, end 16–19, seeded by
 * occupant id — shops open and close staggered instead of the whole town
 * teleporting between home and work at 8:00 sharp.
 */
export function isAtWork(occupantId: number, hour: number): boolean {
  const start = 7 + ((Math.imul(occupantId + 11, 2654435761) >>> 8) % 3);
  const end = 16 + ((Math.imul(occupantId + 29, 2246822519) >>> 8) % 4);
  return hour >= start && hour < end;
}

/** Deterministic 0..1 from a feature id (scale/rotation jitter). */
function fhash01(id: number, salt: number): number {
  let h = Math.imul(id + 374761393, 668265263) ^ (salt | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/**
 * Ground-mode vegetation = the artifact's OWN tree/bush features inside the
 * chunk (chunk-local positions), replacing the generic per-vertex scatter —
 * which both honors the deterministic feature placement (delta-layer ids!)
 * and removes the lattice-row banding the scatter produced.
 */
export function buildGroundVegetation(
  ground: GroundWorld,
  cx: number,
  cy: number,
): { trees: VegetationScatter; bushes: VegetationScatter } {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const minX = cx * S;
  const minZ = cy * S;
  const tPos: number[] = [];
  const tScl: number[] = [];
  const tRot: number[] = [];
  const tCol: number[] = [];
  const bPos: number[] = [];
  const bScl: number[] = [];
  const bRot: number[] = [];
  const bCol: number[] = [];

  // Species palettes (tree-variety dispatch, 2026-06-12): 3 green variants
  // per kind picked by id hash — deterministic, instanced-friendly.
  const TREE_PALETTE: Array<[number, number, number]> = [
    [0.12, 0.3, 0.17],
    [0.18, 0.42, 0.25],
    [0.24, 0.48, 0.23],
  ];
  const BUSH_PALETTE: Array<[number, number, number]> = [
    [0.29, 0.42, 0.16],
    [0.35, 0.5, 0.25],
    [0.24, 0.55, 0.22],
  ];

  for (const f of ground.features) {
    if (f.kind !== "tree" && f.kind !== "bush") continue;
    if (f.xM < minX || f.xM >= minX + S || f.zM < minZ || f.zM >= minZ + S)
      continue;
    const surfaceY = groundSurfaceY(ground, f.xM, f.zM);
    const rot = fhash01(f.id, 11) * Math.PI * 2;
    if (f.kind === "tree") {
      tPos.push(f.xM - minX, surfaceY, f.zM - minZ);
      tScl.push(0.7 + fhash01(f.id, 7) * 1.1);
      tRot.push(rot);
      const tc = TREE_PALETTE[Math.floor(fhash01(f.id, 23) * 3)];
      tCol.push(tc[0], tc[1], tc[2]);
    } else {
      bPos.push(f.xM - minX, surfaceY, f.zM - minZ);
      bScl.push(0.35 + fhash01(f.id, 7) * 0.25);
      bRot.push(rot);
      const bc = BUSH_PALETTE[Math.floor(fhash01(f.id, 23) * 3)];
      bCol.push(bc[0], bc[1], bc[2]);
    }
  }

  return {
    trees: {
      positions: new Float32Array(tPos),
      scales: new Float32Array(tScl),
      rotations: new Float32Array(tRot),
      colors: new Float32Array(tCol),
      cacheKey: `ground-tree|${cx}|${cy}|${tPos.length}`,
    },
    bushes: {
      positions: new Float32Array(bPos),
      scales: new Float32Array(bScl),
      rotations: new Float32Array(bRot),
      colors: new Float32Array(bCol),
      cacheKey: `ground-bush|${cx}|${cy}|${bPos.length}`,
    },
  };
}

/**
 * Edge treatment shared by terrain sampling and ford decks: chunks beyond the
 * artifact window would otherwise extend the clamped border heights as an
 * infinite plateau. Instead terrain eases downward (and tints toward haze)
 * over EDGE_FALL_M past the border, so the detail window reads as land
 * falling away toward the horizon. `edgeFalloffT` is the eased 0..1 factor;
 * anything sampling heights for geometry that can sit outside the window
 * (ford bars/stones) must apply the SAME drop or it floats over the falloff.
 */
const EDGE_FALL_M = 256;
const EDGE_DROP_H = 14;

function edgeFalloffT(
  worldX: number,
  worldZ: number,
  extentX: number,
  extentZ: number,
): number {
  const ox = Math.max(0, -worldX, worldX - extentX);
  const oz = Math.max(0, -worldZ, worldZ - extentZ);
  if (ox <= 0 && oz <= 0) return 0;
  const t = Math.min(1, Math.hypot(ox, oz) / EDGE_FALL_M);
  return t * (2 - t);
}

/**
 * Ground-mode steepness → [0,1], CALIBRATED to agree with chunkGeometry's
 * normal-derived `1 − n·up` convention on a linear ramp.
 *
 * The mesh reads slope off the flat-shaded vertex normal: for a plane of world
 * gradient G (rise-meters / run-meters), `ny = 1/√(1+G²)` so its convention is
 * `slope01 = 1 − cos(atan(G))`. Here we approximate that with a linear
 * `min(1, G·SLOPE01_SCALE)`; picking SLOPE01_SCALE ≈ 1 − 1/√2 makes the two
 * match at a 45° ramp (G = 1) and stay within ±0.1 across the ~30–60° band
 * where the rock blend actually acts. See groundChunkLoader.test.ts.
 */
const SLOPE01_SCALE = 0.2929;

/**
 * Per-vertex steepness in [0,1] from the chunk's own encoded-height grid
 * (Task 10 MOUNTAINS — re-enables the written-but-bypassed slope→rock blend in
 * ground mode). Central finite difference of neighbor heights, converted to a
 * world-space rise/run so it is resolution-independent, then scaled to the
 * mesh's `1 − ny` convention (SLOPE01_SCALE). Edge vertices lack a neighbor on
 * one side; the index clamp degrades those to a (halved) one-sided difference —
 * a slight under-read of slope exactly where chunk skirts already hide the seam.
 */
export function groundSlope01(
  heights: Float32Array,
  i: number,
  j: number,
  resolution: number,
): number {
  if (resolution < 2) return 0;
  const spacingM = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / (resolution - 1);
  const mPerH = heightToMeters(1) - heightToMeters(0); // heightToMeters is linear
  const at = (ii: number, jj: number): number => {
    const ci = ii < 0 ? 0 : ii >= resolution ? resolution - 1 : ii;
    const cj = jj < 0 ? 0 : jj >= resolution ? resolution - 1 : jj;
    return heights[cj * resolution + ci];
  };
  const run = 2 * spacingM;
  const gx = ((at(i + 1, j) - at(i - 1, j)) * mPerH) / run;
  const gz = ((at(i, j + 1) - at(i, j - 1)) * mPerH) / run;
  const grad = Math.hypot(gx, gz); // world rise/run, dimensionless
  return Math.min(1, grad * SLOPE01_SCALE);
}

/**
 * Sample one chunk of ground terrain: vertex (i, j) sits at world meters
 * (cxÂ·S + i/(resâˆ’1)Â·S), mapped to fractional artifact cells at 1.524 m per
 * cell, with bilinear height interpolation and nearest-cell biomes.
 */
export function sampleGroundChunk(
  ground: GroundWorld,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const { cols, rows, heights: H, biomeIds } = ground;

  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const h = (xx: number, yy: number) => H[yy * cols + xx] ?? 0;

  const HAZE_RGB: [number, number, number] = [0.64, 0.67, 0.64];
  const extentX = cols * GROUND_METERS_PER_CELL;
  const extentZ = rows * GROUND_METERS_PER_CELL;

  const heights = new Float32Array(resolution * resolution);
  const outBiomes: string[] = new Array(resolution * resolution);
  const biomeColors = new Float32Array(resolution * resolution * 3);
  // Per-vertex edge falloff, carried to the color pass for the haze blend.
  const edgeTs = new Float32Array(resolution * resolution);
  // Snow line for this window (Task 10), resolved once in makeGroundWorld;
  // anchor-less/legacy builds fall back to the temperate baseline.
  const snowLineH = ground.snowLineH ?? SNOW_LINE_H;

  // Pass 1: heights + biomes + edge falloff. Colors follow in a second pass so
  // per-vertex SLOPE can read the finished neighbor heights (central difference).
  for (let j = 0; j < resolution; j++) {
    const tz = resolution === 1 ? 0 : j / (resolution - 1);
    const worldZ = (cy + tz) * S;
    const gy = clampY(worldZ / GROUND_METERS_PER_CELL);
    for (let i = 0; i < resolution; i++) {
      const txr = resolution === 1 ? 0 : i / (resolution - 1);
      const worldX = (cx + txr) * S;
      const gx = clampX(worldX / GROUND_METERS_PER_CELL);

      // Bilinear height over the 5-ft cell grid
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = clampX(x0 + 1);
      const y1 = clampY(y0 + 1);
      const fx = gx - x0;
      const fy = gy - y0;
      const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
      const bot = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
      let height = top * (1 - fy) + bot * fy;

      // Out-of-window falloff (eased) — 0 inside the artifact, 1 at
      // EDGE_FALL_M past its border. With far shells the world CONTINUES past
      // the border (the region ring is seam-blended to these exact edge
      // heights), so the drop is retired; legacy shell-less worlds keep it.
      const edgeT = ground.farShells
        ? 0
        : edgeFalloffT(worldX, worldZ, extentX, extentZ);
      if (edgeT > 0) {
        height = Math.max(0, height - EDGE_DROP_H * edgeT);
      }

      const idx = j * resolution + i;
      heights[idx] = height;
      edgeTs[idx] = edgeT;

      const bx = Math.round(gx);
      const by = Math.round(gy);
      const biomeId = biomeIds[clampY(by) * cols + clampX(bx)] ?? "plains";
      outBiomes[idx] = biomeId;
    }
  }

  // Pass 2: per-vertex tint. Uses the RAW encoded height (the relief-shading
  // unit-bug fix — was `height / 100`, which collapsed the shade swing to ~2%)
  // and the ground-mode slope (re-enabling the written slope→rock blend), then
  // caps high country with snow, and finally fades the window edge to haze.
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const idx = j * resolution + i;
      const height = heights[idx];
      const slope01 = groundSlope01(heights, i, j, resolution);
      let [r, g, b] = biomeColor(outBiomes[idx], height, slope01);

      // Snow cap: blend toward SNOW_RGB above the (latitude-banded) snow line.
      // Steep faces shed snow (2026-07-21): scale the blend down with slope so
      // crags and cliff walls stay rock — a summit window above the line reads
      // as snowfields broken by dark faces, not a featureless white blanket.
      if (height >= snowLineH) {
        // slope01 is ~0.29 at 45° (SLOPE01_SCALE), so ×3.2 zeroes snow there:
        // gentle fields stay white, 25°+ faces break through as rock.
        const shed = Math.max(0, 1 - slope01 * 3.2);
        const t = Math.min(1, (height - snowLineH) / SNOW_BAND) * shed;
        r += (SNOW_RGB[0] - r) * t;
        g += (SNOW_RGB[1] - g) * t;
        b += (SNOW_RGB[2] - b) * t;
      }

      // Window edge → haze (atmospheric fade of the falling-away horizon).
      const edgeT = edgeTs[idx];
      if (edgeT > 0) {
        const hz = edgeT * 0.65;
        r += (HAZE_RGB[0] - r) * hz;
        g += (HAZE_RGB[1] - g) * hz;
        b += (HAZE_RGB[2] - b) * hz;
      }
      biomeColors[idx * 3] = r;
      biomeColors[idx * 3 + 1] = g;
      biomeColors[idx * 3 + 2] = b;
    }
  }

  return {
    cx,
    cy,
    resolution,
    heights,
    biomeIds: outBiomes,
    biomeColors,
    rivers: ground.rivers.flatMap((r) => clipGroundPolylineToChunk(r, cx, cy)),
    roads: ground.roads.flatMap((r) => clipGroundPolylineToChunk(r, cx, cy)),
    walls: ground.walls.flatMap((w) => clipGroundPolylineToChunk(w, cx, cy)),
    // Water comes from two sources, because neither covers the other:
    //   - the LAND (waterRuns): hollows that fill and streams that collect,
    //     worked out by hydrology from the terrain itself;
    //   - the TOWN PLAN (waterBodies): the river the 2D town plan draws, with
    //     its bridges. Hydrology cannot invent that river — a town window is
    //     small and flat, so flow never builds up — and dropping these quads
    //     left burg Epicea with a river on its map and none in the world.
    // The quads' width is now capped (TOWN_RIVER_MAX_HALF_WIDTH_FT); their old
    // town-span share is what made the 52 m slabs.
    lakes: [
      ...waterRegionLakesForChunk(ground, cx, cy),
      ...ground.waterBodies.flatMap((b) => {
        const clipped = clipPolygonToChunk(b.pointsM, cx, cy);
        if (clipped.length < 3) return [];
        // The centerline is NOT clipped: a chunk can hold a slice of channel
        // whose nearest centerline points lie in the neighbouring chunk, and
        // dropping them would step the water height at every chunk seam.
        const centerline = b.centerlineM?.map((p) => {
          const g = pseudoGrid(p.x, p.z);
          return { x: g.x, y: g.y, surfaceY: p.surfaceY };
        });
        return [
          {
            points: clipped.map((p) => pseudoGrid(p.x, p.z)),
            surfaceY: b.surfaceY,
            kind: b.kind,
            ...(centerline?.length ? { centerline } : {}),
          },
        ];
      }),
    ],
    decks: ground.decks.flatMap((d) => {
      const clipped = clipPolygonToChunk(d.cornersM, cx, cy);
      // Carry the deck kind (TG5) and any per-deck tint through so the
      // geometry can color each deck (ford wet/dry strips, stone jitter).
      return clipped.length >= 3
        ? [
            {
              points: clipped.map((p) => pseudoGrid(p.x, p.z)),
              topY: d.topY,
              kind: d.kind,
              detail: d.detail,
              color: d.color,
            },
          ]
        : [];
    }),
    // Road-gate gatehouses whose center falls in this chunk (sampler
    // convention, same as sites). Positions ride the pseudo-grid trick; the
    // meters→grid conversion is a UNIFORM scale (÷ METERS_PER_CELL on both
    // axes), so angleRad passes through unchanged.
    gatehouses: ground.gatehouses
      .filter((g) => inChunk(g.xM, g.zM, cx, cy))
      .map((g) => ({
        ...pseudoGrid(g.xM, g.zM),
        angleRad: g.angleRad,
        gapHalfM: g.gapHalfM,
        form: g.form,
        colorHex: g.colorHex,
      })),
    // Sites whose center falls in this chunk (sampler convention):
    // town markers (label + keep box) and the town plan's building plots
    // as small 'ruin' boxes. Positions ride the pseudo-grid trick.
    sites: [
      ...ground.towns
        .filter((t) => inChunk(t.xM, t.zM, cx, cy))
        .map((t) => ({
          id: `wf-town-${t.burgId}`,
          kind: "town" as const,
          // Nameplates prefer `name` over the "Town - <id>" fallback text.
          name: t.name,
          position: pseudoGrid(t.xM, t.zM),
          footprint: [],
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, t.xM, t.zM),
          // The plot buildings ARE the town at this scale — keep the
          // nameplate, drop the population-scaled marker cube.
          markerOnly: true,
        })),
      ...ground.buildings
        .filter((b) => inChunk(b.xM, b.zM, cx, cy))
        .map((b) => ({
          id: b.id,
          kind: "ruin" as const,
          position: pseudoGrid(b.xM, b.zM),
          // 4-corner footprint → siteGeometry builds the oriented box
          // sized by the plot's true edges (pseudo-grid like everything)
          footprint: b.cornersM.map((c) => pseudoGrid(c.x, c.z)),
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, b.xM, b.zM),
          heightM: b.heightM,
          role: b.role,
          colorHex:
            b.wallColorHex ?? (b.role === "market" ? "#c8923f" : "#b09a72"), // legacy-compat for unstyled producers, not a style fallback
          roofForm: b.roofForm,
          roofColorHex: b.roofColorHex,
          chimney: b.chimney,
          // One label per settlement (the town marker) — not one per house.
          unlabeled: b.unlabeled ?? true,
          name: b.name,
          labelRangeM: b.labelRangeM ?? 20,
          // Seamless interior parts (meters, site-local) — when present the
          // renderer builds walls instead of a solid box.
          parts: b.parts,
          wallWidthM: b.wallWidthM,
          wallDepthM: b.wallDepthM,
          // Solved roof (BGv2 Task 5): present only when the plan resolved a
          // style; when set, the renderer draws it and skips the legacy prism.
          solvedRoof: b.solvedRoof,
          // Living-interiors live clock: carry the baked schedule + occupant
          // packets + plan-feet frame through to the render side (undefined for
          // unpopulated plots).
          litHours: b.litHours,
          hearthHours: b.hearthHours,
          occupants: b.occupants,
          interiorWidthFt: b.interiorWidthFt,
          interiorDepthFt: b.interiorDepthFt,
          interiorOriginXFt: b.interiorOriginXFt,
          interiorOriginYFt: b.interiorOriginYFt,
          frontDoorOffsetX: b.frontDoorOffsetX,
          frontDoorOffsetZ: b.frontDoorOffsetZ,
        })),
      // Mapped occupants (NPCs): these show where keepers or townsfolk are
      // standing inside their buildings during working/home hours. We guard this
      // with a fallback to an empty array in case the ground data was mocked
      // without rosters.
      ...(ground.occupants || [])
        .filter((o) => inChunk(o.xM, o.zM, cx, cy))
        .map((o) => ({
          id: `wf-occ-${o.burgId}-${o.occupantId}`,
          kind: "landmark" as const,
          position: pseudoGrid(o.xM, o.zM),
          footprint: [],
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, o.xM, o.zM),
          // Occupant bodies are already rendered as interior parts. This
          // marker carries only the close-range roster nameplate — enriched with
          // the person's current activity (from the unified schedule) so walking
          // up reads e.g. "Mara Fen · asleep".
          markerOnly: true,
          name: o.activity
            ? `${o.name} · ${ACTIVITY_LABEL[o.activity]}`
            : o.name,
          labelRangeM: 12,
        })),
      // Mapped hostiles: these render as high-contrast red boxes on the
      // ground map and carry nameplates so the player can spot them easily.
      // We guard this with a fallback to an empty array so tests modeling
      // older or simpler ground worlds without hostile placements don't crash.
      ...(ground.hostiles || [])
        .filter((h) => inChunk(h.xM, h.zM, cx, cy))
        .map((h) => ({
          id: h.id,
          kind: "monster" as const,
          position: pseudoGrid(h.xM, h.zM),
          footprint: [],
          walled: false,
          surfaceY: groundSurfaceY(ground, h.xM, h.zM),
          name: h.name,
          labelRangeM: 15,
        })),
    ],
  };
}

function inChunk(xM: number, zM: number, cx: number, cy: number): boolean {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  return xM >= cx * S && xM < (cx + 1) * S && zM >= cy * S && zM < (cy + 1) * S;
}

/**
 * The water sheets for one chunk, built from the ground world's wet cells.
 *
 * Each body's rows are merged into runs, clipped to the chunk rectangle, and
 * emitted as flat quads at that body's single level — so one lake reads as one
 * surface even where it crosses chunk boundaries.
 */
function waterRegionLakesForChunk(
  ground: GroundWorld,
  cx: number,
  cy: number,
): NonNullable<ChunkData["lakes"]> {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const minX = cx * S;
  const minZ = cy * S;
  const maxX = minX + S;
  const maxZ = minZ + S;
  const out: NonNullable<ChunkData["lakes"]> = [];

  for (const run of ground.waterRuns ?? []) {
    // Clip to the chunk box. Runs are axis-aligned, so this is a clamp.
    const x0 = Math.max(run.minX, minX);
    const x1 = Math.min(run.maxX, maxX);
    const z0 = Math.max(run.minZ, minZ);
    const z1 = Math.min(run.maxZ, maxZ);
    if (x1 <= x0 || z1 <= z0) continue;
    out.push({
      points: [
        pseudoGrid(x0, z0),
        pseudoGrid(x1, z0),
        pseudoGrid(x1, z1),
        pseudoGrid(x0, z1),
      ],
      surfaceY: heightToMeters(run.surfaceEnc),
      kind: "lake",
    });
  }
  return out;
}

/** How wide a town river runs, each side of its centerline. */
const TOWN_RIVER_HALF_WIDTH_M = 3;

/** Cap on a town river's half-width, in feet (~6 m, so a ~12 m river). */
const TOWN_RIVER_MAX_HALF_WIDTH_FT = 20;

/**
 * Where the water is, and how high — the land and the map together.
 *
 * Two sources, because neither alone is right:
 *   - The LAND decides standing water. Hollows fill to the height they would
 *     spill at, so a lake's flat surface falls out of the terrain rather than
 *     out of a rule, and flow accumulation finds streams where water collects.
 *   - The MAP decides a town's river course. Flow accumulation cannot find it
 *     inside a small, flat town window — switching to hydrology alone left burg
 *     Hajdured with a few ponds and no river, which is not what its atlas says.
 *     So the course is taken from the authored centerline.
 *
 * Height always comes from the land: a river cell sits just below the bank
 * beside it, which descends with the valley. That is what keeps the surface out
 * of the hillside — an earlier flat-level-per-body rule buried it under 13 m.
 */
function resolveGroundWater(
  cols: number,
  rows: number,
  heights: number[],
  waterBodies: GroundWaterBody[],
): Map<number, number> {
  const hydrology = deriveHydrology({ cols, rows, heights });
  const water = new Map(hydrology.water);

  // Authored river courses, rasterized from their centerlines.
  const riverCells = new Set<number>();
  for (const body of waterBodies) {
    if (body.kind !== "river" || !body.centerlineM?.length) continue;
    for (const idx of rasterizeChannel(
      body.centerlineM,
      TOWN_RIVER_HALF_WIDTH_M,
      cols,
      rows,
      GROUND_METERS_PER_CELL,
    )) {
      riverCells.add(idx);
    }
  }

  if (riverCells.size > 0) {
    // Resolve their heights from the banks. A synthetic wet grid lets the same
    // tested rule serve both sources.
    const wetGrid = new Array<string>(cols * rows).fill("grassland");
    for (const idx of riverCells) wetGrid[idx] = "water";
    const levels = waterLevelsByCell({
      cols,
      rows,
      biomeIds: wetGrid,
      heights,
      surfaceDropEnc: metersToHeight(WATER_SURFACE_DROP_M),
    });
    for (const [idx, level] of levels) water.set(idx, level);
  }

  return water;
}

function pseudoGrid(xM: number, zM: number): { x: number; y: number } {
  return {
    x: xM / WORLD3D_CONFIG.METERS_PER_CELL,
    y: zM / WORLD3D_CONFIG.METERS_PER_CELL,
  };
}

/**
 * Sutherland–Hodgman clip of a (meters) polygon to the chunk rectangle. The
 * clip region is convex (the chunk box), so this is exact for any subject
 * polygon; returns the clipped ring (meters) or [] if nothing survives.
 */
function clipPolygonToChunk(
  poly: Array<{ x: number; z: number }>,
  cx: number,
  cy: number,
): Array<{ x: number; z: number }> {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const minX = cx * S,
    minZ = cy * S,
    maxX = minX + S,
    maxZ = minZ + S;
  type P = { x: number; z: number };
  // inside-tests + intersection per rectangle edge (left, right, top, bottom).
  const clipEdge = (
    input: P[],
    inside: (p: P) => boolean,
    intersect: (a: P, b: P) => P,
  ): P[] => {
    const out: P[] = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur));
      }
    }
    return out;
  };
  const lerpX = (a: P, b: P, x: number): P => ({
    x,
    z: a.z + (b.z - a.z) * ((x - a.x) / (b.x - a.x)),
  });
  const lerpZ = (a: P, b: P, z: number): P => ({
    x: a.x + (b.x - a.x) * ((z - a.z) / (b.z - a.z)),
    z,
  });
  let ring: P[] = poly.map((p) => ({ x: p.x, z: p.z }));
  ring = clipEdge(
    ring,
    (p) => p.x >= minX,
    (a, b) => lerpX(a, b, minX),
  );
  if (ring.length < 3) return [];
  ring = clipEdge(
    ring,
    (p) => p.x <= maxX,
    (a, b) => lerpX(a, b, maxX),
  );
  if (ring.length < 3) return [];
  ring = clipEdge(
    ring,
    (p) => p.z >= minZ,
    (a, b) => lerpZ(a, b, minZ),
  );
  if (ring.length < 3) return [];
  ring = clipEdge(
    ring,
    (p) => p.z <= maxZ,
    (a, b) => lerpZ(a, b, maxZ),
  );
  return ring.length >= 3 ? ring : [];
}

/**
 * Clip a ground polyline (world meters) to a chunk and convert to the
 * builders' expected shape. UNIT TRICK: road/water geometry compute
 * `point·METERS_PER_CELL − chunkOrigin` and `width·METERS_PER_CELL`, so
 * emitting points as meters ÷ METERS_PER_CELL (pseudo-grid) makes the
 * continent-scale builders produce TRUE ground meters — same reasoning as
 * the terrain path, no core changes.
 */
function clipGroundPolylineToChunk(
  line: GroundPolyline,
  cx: number,
  cy: number,
): Array<{
  points: { x: number; y: number }[];
  width: number[];
  waterlineY?: number[];
  colorHex?: string;
}> {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const M = WORLD3D_CONFIG.METERS_PER_CELL;
  const minX = cx * S;
  const minZ = cy * S;
  const maxX = minX + S;
  const maxZ = minZ + S;
  const inside = (p: { x: number; z: number }) =>
    p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;

  // Segment-walk clip: inside points pass through; boundary crossings add
  // intersection points (incl. both-endpoints-outside pass-throughs).
  const out: Array<{ x: number; z: number; waterlineY?: number }> = [];
  const push = (p: { x: number; z: number; waterlineY?: number }) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.z - p.z) > 1e-6)
      out.push(p);
  };
  const edgeHits = (
    a: { x: number; z: number },
    b: { x: number; z: number },
  ) => {
    const hits: Array<{ t: number; x: number; z: number }> = [];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const tryEdge = (t: number) => {
      if (t <= 0 || t >= 1 || !Number.isFinite(t)) return;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      if (
        x >= minX - 1e-6 &&
        x <= maxX + 1e-6 &&
        z >= minZ - 1e-6 &&
        z <= maxZ + 1e-6
      ) {
        hits.push({ t, x, z });
      }
    };
    if (dx !== 0) {
      tryEdge((minX - a.x) / dx);
      tryEdge((maxX - a.x) / dx);
    }
    if (dz !== 0) {
      tryEdge((minZ - a.z) / dz);
      tryEdge((maxZ - a.z) / dz);
    }
    hits.sort((p, q) => p.t - q.t);
    return hits;
  };

  for (let i = 0; i < line.points.length; i++) {
    const p = line.points[i];
    const pointWaterlineY = line.waterlineY?.[i];
    if (inside(p)) push({ ...p, waterlineY: pointWaterlineY });
    if (i < line.points.length - 1) {
      for (const h of edgeHits(p, line.points[i + 1])) {
        const nextWaterlineY = line.waterlineY?.[i + 1];
        const waterlineY =
          pointWaterlineY == null || nextWaterlineY == null
            ? undefined
            : pointWaterlineY + (nextWaterlineY - pointWaterlineY) * h.t;
        push({ x: h.x, z: h.z, waterlineY });
      }
    }
  }

  if (out.length < 2) return [];
  const clippedWaterlineY =
    line.waterlineY && out.every((point) => point.waterlineY != null)
      ? out.map((point) => Number(point.waterlineY))
      : undefined;
  return [
    {
      points: out.map((p) => ({ x: p.x / M, y: p.z / M })),
      // The render surface extends one classified cell past each bank so the
      // water-biome terrain cannot peek out as a blue dry fringe. Physical
      // crossing/referee widths remain unchanged on GroundWorld.
      width: out.map(
        () =>
          (line.widthM +
            (line.sourceKind === "river"
              ? RIVER_SURFACE_BANK_OVERDRAW_M * 2
              : 0)) /
          M,
      ),
      ...(clippedWaterlineY ? { waterlineY: clippedWaterlineY } : {}),
      // Style-family tint (e.g. wall runs) rides through so wallGeometry can
      // vertex-color the extruded barrier per town.
      colorHex: line.colorHex,
    },
  ];
}

/**
 * Inline (main-thread) chunk loader for ground mode â€” same shape as the
 * demo's WorldData loader: (cx, cy) â†’ ChunkMeshBundle promise.
 */
export function createGroundChunkLoader(
  local: LocalArtifact,
  seed: number,
  region?: RegionArtifact,
  opts: MakeGroundWorldOptions = {},
) {
  const ground = makeGroundWorld(local, seed, region, opts);
  return {
    ground,
    loader: buildGroundLoaderFromWorld(ground),
  };
}

/**
 * Build the per-chunk mesh loader for an ALREADY-assembled GroundWorld.
 *
 * Split out of `createGroundChunkLoader` for staged 3D entry: a worker assembles
 * the `ground` data (which crosses the worker boundary as plain structured-clone
 * data) and the main thread rebuilds this cheap closure from it. The closure
 * captures only `ground`; both `sampleGroundChunk` and `buildGroundVegetation`
 * are pure functions of it, so a rebuilt loader is identical to the one
 * `createGroundChunkLoader` returns.
 */
export function buildGroundLoaderFromWorld(
  ground: GroundWorld,
): (cx: number, cy: number, lod?: LodTier) => Promise<ChunkMeshBundle> {
  // Delegates to handleGroundChunkRequest — the SAME core the ground mesh worker
  // runs — so the inline (main-thread) mesh and the worker mesh are identical.
  // Honors the requested LOD tier's resolution (W3D-G10 / T7): distant chunks
  // build coarser, near ones stay full-detail.
  return async (
    cx: number,
    cy: number,
    lod?: LodTier,
  ): Promise<ChunkMeshBundle> =>
    handleGroundChunkRequest(ground, {
      cx,
      cy,
      resolution: resolutionForLod(lod),
    });
}

// ============================================================================
// Terrain Patch Extraction
// ============================================================================
// This function extracts a 40x30 local region centered at the player's world
// meters position (playerX, playerZ) from the GroundWorld object. It samples
// elevations, determines biomes, detects obstacle collisions (features), and
// maps buildings/seamless interiors directly onto the BattleMap 3D tiles.
// ============================================================================

/** Squared distance from one world point to a finite polyline segment. */
function pointSegmentDistanceSq(
  px: number,
  pz: number,
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 1e-9) return (px - a.x) ** 2 + (pz - a.z) ** 2;

  const t = Math.max(
    0,
    Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / lengthSq),
  );
  const nearestX = a.x + dx * t;
  const nearestZ = a.z + dz * t;
  return (px - nearestX) ** 2 + (pz - nearestZ) ** 2;
}

/**
 * Resolve the WorldForge road footprint intersecting a five-foot referee cell.
 *
 * The half-cell diagonal expands the centerline radius just enough to include
 * cells touched at a corner. This avoids diagonal one-cell holes while keeping
 * the road width authored by the source run, not by the battle-map painter.
 */
function worldforgeRoadSurfaceAt(
  roads: GroundPolyline[],
  wx: number,
  wz: number,
): BattleMapSurface | undefined {
  const tileReachM = GROUND_METERS_PER_CELL * Math.SQRT1_2;

  for (let sourceIndex = 0; sourceIndex < roads.length; sourceIndex += 1) {
    const road = roads[sourceIndex];
    const hitRadiusM = Math.max(0, road.widthM / 2) + tileReachM;
    const hitRadiusSq = hitRadiusM * hitRadiusM;

    for (let pointIndex = 1; pointIndex < road.points.length; pointIndex += 1) {
      if (
        pointSegmentDistanceSq(
          wx,
          wz,
          road.points[pointIndex - 1],
          road.points[pointIndex],
        ) <= hitRadiusSq
      ) {
        return {
          kind: "road",
          source: "worldforge-road",
          sourceRole:
            road.sourceKind === "region-road"
              ? "regional-route"
              : road.sourceKind === "town-street"
                ? "town-street"
                : "unclassified",
          sourceIndex,
          widthMeters: road.widthM,
        };
      }
    }
  }

  return undefined;
}

/** Resolve a source crossing footprint touching one five-foot referee cell. */
function worldforgeCrossingAt(
  crossings: GroundCrossing[],
  wx: number,
  wz: number,
): BattleMapCrossing | undefined {
  const tileReachM = GROUND_METERS_PER_CELL * Math.SQRT1_2;

  for (const crossing of crossings) {
    const dx = wx - crossing.xM;
    const dz = wz - crossing.zM;
    const along = dx * crossing.roadDirection.x + dz * crossing.roadDirection.z;
    const across =
      dx * -crossing.roadDirection.z + dz * crossing.roadDirection.x;
    if (
      Math.abs(along) <= crossing.spanM / 2 + tileReachM &&
      Math.abs(across) <= crossing.widthM / 2 + tileReachM
    ) {
      return {
        kind: crossing.kind,
        source: "worldforge-crossing",
        sourceCrossingId: crossing.id,
        ...(crossing.roadSourceIndex == null
          ? {}
          : { roadSourceIndex: crossing.roadSourceIndex }),
        ...(crossing.riverSourceIndex == null
          ? {}
          : { riverSourceIndex: crossing.riverSourceIndex }),
        roadDirection: {
          x: crossing.roadDirection.x,
          y: crossing.roadDirection.z,
        },
        riverDirection: {
          x: crossing.riverDirection.x,
          y: crossing.riverDirection.z,
        },
        centerWorldMeters: { x: crossing.xM, z: crossing.zM },
        spanMeters: crossing.spanM,
        widthMeters: crossing.widthM,
      };
    }
  }

  return undefined;
}

// ============================================================================
// WorldForge Object Targets
// ============================================================================
// The tactical grid already paints natural features and catalog props. This
// section publishes those same source objects to spell targeting exactly once
// per source fact, preserving their world identity instead of guessing later
// from every decorated or material-bearing cell they happen to cover.
// ============================================================================

type TacticalNaturalFeatureKind = "tree" | "bush" | "boulder";

const NATURAL_FEATURE_TARGET_FACTS: Record<
  TacticalNaturalFeatureKind,
  {
    name: string;
    decoration: Exclude<BattleMapDecoration, null>;
    size: string;
    footprintRadiusM: number;
    blocksMovement: boolean;
    blocksLoS: boolean;
  }
> = {
  tree: {
    name: "Tree",
    decoration: "tree",
    size: "Large",
    footprintRadiusM: 1.2,
    blocksMovement: true,
    blocksLoS: true,
  },
  bush: {
    name: "Bush",
    decoration: "bush",
    size: "Small",
    footprintRadiusM: 0.8,
    blocksMovement: false,
    blocksLoS: false,
  },
  boulder: {
    name: "Boulder",
    decoration: "boulder",
    size: "Medium",
    footprintRadiusM: 1,
    blocksMovement: true,
    blocksLoS: true,
  },
};

const PROP_OBJECT_SIZE: Record<"S" | "M" | "L", string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
};

/** Return the typed natural-feature facts only for kinds combat currently paints. */
function naturalFeatureTargetFacts(kind: string) {
  return NATURAL_FEATURE_TARGET_FACTS[kind as TacticalNaturalFeatureKind];
}

/**
 * Snap one source anchor to its nearest referee cell. A footprint may touch the
 * crop while its center sits just beyond the edge, so those objects clamp to the
 * edge cell rather than disappearing from targeting while still affecting it.
 */
function tacticalPositionForWorldAnchor(
  worldX: number,
  worldZ: number,
  playerX: number,
  playerZ: number,
  width: number,
  height: number,
  footprintRadiusM: number,
): Position | null {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const exactX = centerX + (worldX - playerX) / GROUND_METERS_PER_CELL;
  const exactY = centerY + (worldZ - playerZ) / GROUND_METERS_PER_CELL;
  const footprintCells = footprintRadiusM / GROUND_METERS_PER_CELL;

  // Refuse objects whose full footprint lies beyond the tactical crop.
  if (
    exactX < -0.5 - footprintCells ||
    exactX > width - 0.5 + footprintCells ||
    exactY < -0.5 - footprintCells ||
    exactY > height - 0.5 + footprintCells
  ) {
    return null;
  }

  return {
    x: Math.max(0, Math.min(width - 1, Math.round(exactX))),
    y: Math.max(0, Math.min(height - 1, Math.round(exactY))),
  };
}

/**
 * Find the painted cell that actually represents a natural source object.
 * Route/building precedence can deliberately erase a stale tree, so a source
 * feature only becomes targetable when at least one cell still draws it.
 */
function representedNaturalFeaturePosition(
  feature: GroundFeature,
  facts: (typeof NATURAL_FEATURE_TARGET_FACTS)[TacticalNaturalFeatureKind],
  playerX: number,
  playerZ: number,
  width: number,
  height: number,
  tiles: Map<string, BattleMapTile>,
): Position | null {
  const snapped = tacticalPositionForWorldAnchor(
    feature.xM,
    feature.zM,
    playerX,
    playerZ,
    width,
    height,
    facts.footprintRadiusM,
  );
  if (!snapped) return null;

  let nearest: { position: Position; distance: number } | null = null;
  for (
    let y = Math.max(0, snapped.y - 2);
    y <= Math.min(height - 1, snapped.y + 2);
    y += 1
  ) {
    for (
      let x = Math.max(0, snapped.x - 2);
      x <= Math.min(width - 1, snapped.x + 2);
      x += 1
    ) {
      const tile = tiles.get(`${x}-${y}`);
      if (tile?.decoration !== facts.decoration) continue;
      const wx = playerX + (x - Math.floor(width / 2)) * GROUND_METERS_PER_CELL;
      const wz =
        playerZ + (y - Math.floor(height / 2)) * GROUND_METERS_PER_CELL;
      const distance = Math.hypot(wx - feature.xM, wz - feature.zM);
      if (
        distance <= facts.footprintRadiusM &&
        (!nearest || distance < nearest.distance)
      ) {
        nearest = { position: { x, y }, distance };
      }
    }
  }
  return nearest?.position ?? null;
}

/** Build the explicit spell-target registry from represented source objects. */
function projectWorldforgeTargetableObjects(
  ground: GroundWorld,
  playerX: number,
  playerZ: number,
  width: number,
  height: number,
  tiles: Map<string, BattleMapTile>,
): TargetableMapObject[] {
  const objects: TargetableMapObject[] = [];

  // Natural features have complete mobility facts: generated vegetation is
  // rooted and generated boulders are part of the terrain, never loose loot.
  for (const feature of ground.features) {
    const facts = naturalFeatureTargetFacts(feature.kind);
    if (!facts) continue;
    const position = representedNaturalFeaturePosition(
      feature,
      facts,
      playerX,
      playerZ,
      width,
      height,
      tiles,
    );
    if (!position) continue;
    const sourceId = `feature:${feature.id}`;
    objects.push({
      id: `worldforge-${sourceId}`,
      name: facts.name,
      position,
      size: facts.size,
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: true,
      source: {
        kind: "worldforge-feature",
        sourceId,
        sourceKind: feature.kind,
        worldMeters: { x: feature.xM, z: feature.zM },
      },
    });
  }

  // Catalog props supply identity, size, mundane status, and a physical
  // footprint. The catalog does not yet distinguish a loose crate from a fixed
  // fence or publish weight, so those fields remain absent instead of being
  // invented; restrictive spells treat unknown facts conservatively.
  for (const prop of ground.props) {
    const definition = PROPS_BY_ID.get(prop.defId);
    if (!definition) continue;
    const footprintRadiusM = propFootprintRadiusM(definition);
    const position = tacticalPositionForWorldAnchor(
      prop.xM,
      prop.zM,
      playerX,
      playerZ,
      width,
      height,
      footprintRadiusM,
    );
    if (!position) continue;
    const sourceId = [
      "prop",
      prop.defId,
      Math.round(prop.xM * 100),
      Math.round(prop.zM * 100),
      Math.round(prop.rotationRad * 1000),
    ].join(":");
    objects.push({
      id: `worldforge-${sourceId}`,
      name: definition.name,
      position,
      size: PROP_OBJECT_SIZE[definition.sizeClass],
      isWornOrCarried: false,
      isMagical: false,
      source: {
        kind: "worldforge-prop",
        sourceId,
        sourceKind: prop.defId,
        worldMeters: { x: prop.xM, z: prop.zM },
      },
    });
  }

  return objects;
}

/**
 * Project every named resident whose current source position touches the crop.
 * Multiple household members may share one cell; the map retains each identity
 * and lets the renderer cluster them instead of throwing away people here.
 */
function projectWorldforgeOccupants(
  occupants: readonly GroundOccupantProjectionInput[],
  playerX: number,
  playerZ: number,
  width: number,
  height: number,
  tiles: Map<string, BattleMapTile>,
): BattleMapWorldOccupant[] {
  const projected: BattleMapWorldOccupant[] = [];
  for (const occupant of occupants) {
    const sourcePosition = tacticalPositionForWorldAnchor(
      occupant.xM,
      occupant.zM,
      playerX,
      playerZ,
      width,
      height,
      0,
    );
    if (!sourcePosition) continue;

    // A meter-accurate resident can round onto a wall or blocking prop when the
    // five-foot referee grid discretizes a doorway or narrow interior. Keep the
    // exact source meters for provenance, but place the ambient marker on the
    // nearest legal cell so combatants never reserve an impossible location.
    const sourceTile = tiles.get(`${sourcePosition.x}-${sourcePosition.y}`);
    let position = sourcePosition;
    if (sourceTile?.blocksMovement) {
      let bestDistanceSq = Number.POSITIVE_INFINITY;
      for (const tile of tiles.values()) {
        if (tile.blocksMovement) continue;
        const dx = tile.coordinates.x - sourcePosition.x;
        const dy = tile.coordinates.y - sourcePosition.y;
        const distanceSq = dx * dx + dy * dy;
        if (
          distanceSq < bestDistanceSq ||
          (distanceSq === bestDistanceSq &&
            (tile.coordinates.y < position.y ||
              (tile.coordinates.y === position.y &&
                tile.coordinates.x < position.x)))
        ) {
          bestDistanceSq = distanceSq;
          position = tile.coordinates;
        }
      }
    }
    projected.push({
      id: `worldforge-occupant:${occupant.burgId}:${occupant.occupantId}`,
      name: occupant.name,
      position,
      activity: occupant.activity ?? "unknown",
      moving: occupant.moving ?? false,
      source: {
        kind: "worldforge-occupant",
        burgId: occupant.burgId,
        occupantId: occupant.occupantId,
        worldMeters: { x: occupant.xM, z: occupant.zM },
      },
    });
  }
  return projected;
}

/** Optional extraction facts beyond the referee patch dimensions. */
export interface ExtractLocalTerrainPatchOptions {
  width?: number;
  height?: number;
  /** Current live-clock residents; static GroundWorld sites remain the fallback. */
  occupants?: readonly GroundOccupantProjectionInput[];
}

export function extractLocalTerrainPatch(
  ground: GroundWorld,
  playerX: number,
  playerZ: number,
  biome: BattleMapBiome,
  seed: number,
  // Fight-in-place slice 1: the referee patch is CONTEXT-SIZED at extraction
  // (fip--referee-patch-sizing subspec). Dense town fights keep the compact
  // 40×30 default (200×150 ft); open/ranged encounters extract larger — up to
  // ~120×120 cells (600×600 ft) so longbow + spell ranges fit. Referee data
  // stays tiny at any size; the 2D board pans/zooms. The player always sits at
  // the geometric center tile, so callers may pass any positive dimensions.
  options?: ExtractLocalTerrainPatchOptions,
): BattleMapData {
  const width = options?.width ?? 40;
  const height = options?.height ?? 30;
  const tiles = new Map<string, BattleMapTile>();

  // The player is placed at the center tile of the BattleMap. For the default
  // 40×30 patch this is (20, 15) — the historic center — and it scales with any
  // context-sized patch so the fight always frames the player's spot.
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const tileId = `${tx}-${ty}`;

      // Compute the absolute ground world meters coordinates for this tile.
      // One tile in a BattleMap corresponds to 5 feet (1.524 meters).
      const dx = (tx - centerX) * GROUND_METERS_PER_CELL;
      const dz = (ty - centerY) * GROUND_METERS_PER_CELL;
      const wx = playerX + dx;
      const wz = playerZ + dz;

      // 1. Elevation calculation: Sample the ground surface height in meters,
      // then convert it back to the BattleMap's internal elevation units.
      // BattleMap stores relief in renderer units, so divide by the shared
      // metres-per-unit constant. TerrainMesh and the 2D player readout both
      // import this contract instead of repeating a magic 0.3 value.
      const realHeightM = groundSurfaceY(ground, wx, wz);
      const elevation = realHeightM / BATTLE_MAP_ELEVATION_METERS_PER_UNIT;

      // 2. Biome lookup: Sample the nearest biome from the GroundWorld grid.
      const bx = Math.max(
        0,
        Math.min(ground.cols - 1, Math.round(wx / GROUND_METERS_PER_CELL)),
      );
      const by = Math.max(
        0,
        Math.min(ground.rows - 1, Math.round(wz / GROUND_METERS_PER_CELL)),
      );
      const groundBiome = ground.biomeIds[by * ground.cols + bx] ?? "plains";

      // Map GroundWorld biome to a valid BattleMapTerrain value
      let terrain: BattleMapTerrain = "grass";
      if (groundBiome === "ocean" || groundBiome === "water") {
        terrain = "water";
      } else if (groundBiome === "desert") {
        terrain = "sand";
      } else if (groundBiome === "swamp" || groundBiome === "wetland") {
        terrain = "mud";
      } else if (groundBiome === "mountain" || groundBiome === "tundra") {
        terrain = "rock";
      }

      // Roads are source-backed surfaces laid over the base material. Ordinary
      // water suppresses them; only a Region-authored crossing receipt may
      // continue the route and make those cells traversable.
      const candidateCrossing = worldforgeCrossingAt(
        ground.crossings ?? [],
        wx,
        wz,
      );
      const candidateRoadSurface =
        terrain === "water" && !candidateCrossing
          ? undefined
          : worldforgeRoadSurfaceAt(ground.roads, wx, wz);

      // Initialize default properties for the tile
      let blocksMovement = terrain === "water";
      let blocksLoS = false;
      let decoration: BattleMapDecoration = null;

      // 3. Natural obstacles: Check if this tile overlaps any trees, bushes, or boulders
      // within reasonable collision ranges.
      if (!candidateRoadSurface && !candidateCrossing) {
        for (const f of ground.features) {
          const dist = Math.hypot(wx - f.xM, wz - f.zM);
          const featureFacts = naturalFeatureTargetFacts(f.kind);
          if (!featureFacts || dist >= featureFacts.footprintRadiusM) continue;
          decoration = featureFacts.decoration;
          if (featureFacts.blocksMovement) blocksMovement = true;
          if (featureFacts.blocksLoS) blocksLoS = true;
        }
      }

      // 3b. WAVE-1 props: a placed prop whose footprint covers this tile imprints
      // its FULL referee data (blocksMovement / blocksLoS / cover / material +
      // thickness / a fitting decoration). This is where a crate is BORN combat-
      // legible. We stage the referee flags on the tile below (after building the
      // base tile) via imprintPropOnTile so a prop can also raise cover/material
      // fields the natural-obstacle pass above doesn't set.

      // 4. Buildings and interior parts: If the tile overlaps a building plot footprint,
      // it becomes a floor tile. If it overlaps a wall part, it blocks movement and LoS.
      for (const b of ground.buildings) {
        if (b.cornersM.length < 3) continue;

        // Perform the convex polygon point-in-polygon check
        if (pointInsideConvexQuad({ x: wx, z: wz }, b.cornersM)) {
          // Inside a building boundary: make it a floor tile and remove nature decorations.
          terrain = "floor";
          blocksMovement = false;
          blocksLoS = false;
          decoration = null;

          // Convert world coords to building-local coordinate space to check
          // walls and furniture. The yaw + street-face sign come from the ONE
          // shared convention (siteOrientationFromQuad) the renderer uses, and
          // the world->local inverse (worldOffsetToSiteLocal) is the exact
          // inverse of the render yaw — so `lz` lands in the SAME render-local
          // frame the renderer draws each part in. See sitePartTransform.ts.
          const { rotationY, doorZSign } = siteOrientationFromQuad(b.cornersM);
          const { lx, lz } = worldOffsetToSiteLocal(
            wx - b.xM,
            wz - b.zM,
            rotationY,
          );

          // Iterate through interior parts (walls and furniture)
          for (const p of b.parts) {
            // Role motifs, material courses/shutters, weathering, and permanent-
            // history evidence are exterior presentation dressing. They may
            // overlap the shell, but none may turn a valid floor cell into a
            // blocked tactical tile or alter line of sight.
            if (
              p.tag === MOTIF_PART_TAG ||
              p.tag === MATERIAL_PART_TAG ||
              p.tag === WEATHERING_PART_TAG ||
              p.tag === ENSEMBLE_PART_TAG ||
              p.tag === HISTORY_PART_TAG
            )
              continue;

            // The part's render-local center: sitePartLocalOffset applies the
            // SAME -doorZSign z-flip the renderer draws with, so the walkability
            // band matches the drawn cells (not their mirror through the origin).
            const off = sitePartLocalOffset(p, doorZSign);
            // Add a small 0.1m tolerance buffer to ensure adjacent cells align cleanly
            const inX =
              lx >= off.x - p.w / 2 - 0.1 && lx <= off.x + p.w / 2 + 0.1;
            const inZ =
              lz >= off.z - p.d / 2 - 0.1 && lz <= off.z + p.d / 2 + 0.1;

            // IN guard: only parts that intrude into the walkable band below head
            // height block the floor tile. Overhead parts — the door lintel
            // (baseY 2.1), the flat ceiling slab (baseY near the shell top), and
            // upper-floor slabs — sit entirely above the walker and must NOT block
            // the tile beneath them, or the new dressing would seal the doorway.
            const partBaseY = p.baseY ?? 0;
            // Below-grade parts (basement walls/stairs top out AT the ground
            // slab, baseY = -storeyHeight) sit entirely under the walker and
            // must not block the ground tile above them — require the part's
            // TOP to rise above the floor as well as its base to sit below
            // head height.
            const intrudesWalkBand =
              partBaseY < COMBAT_HEAD_CLEARANCE_M && partBaseY + p.h > 0.05;
            // The door leaf fills the entry gap but is the door itself — a doorway
            // must stay passable in tactical combat, so it never blocks movement.
            const isDoorLeaf = p.colorHex === DOOR_LEAF_COLOR;

            if (inX && inZ && p.h > 0.5 && intrudesWalkBand && !isDoorLeaf) {
              blocksMovement = true;
              // Check if this part has a wall-colored hex code to determine LoS blocking
              const isWall =
                p.colorHex === "#cfc7b8" ||
                p.colorHex === "#c8923f" ||
                p.colorHex === "#b09a72";
              if (isWall) {
                terrain = "wall";
                blocksLoS = true;
              }
            }
          }
        }
      }

      // Structures retain precedence where a coarse source road footprint and
      // a building overlap. Open road cells remain clear and normal-cost; props
      // imprint afterward and may still obstruct a road when that obstruction
      // is itself a source-world fact.
      const surface =
        candidateRoadSurface && terrain !== "floor" && terrain !== "wall"
          ? candidateRoadSurface
          : undefined;
      if (surface) {
        decoration = null;
        blocksMovement = false;
        blocksLoS = false;
      }

      // A crossing is independently source-authored and may therefore make
      // base water traversable. Structures retain precedence; explicit props
      // still imprint afterward and can obstruct the deck when the world says so.
      const crossing =
        candidateCrossing && terrain !== "floor" && terrain !== "wall"
          ? candidateCrossing
          : undefined;
      if (crossing) {
        decoration = null;
        blocksMovement = false;
        blocksLoS = false;
      }

      const tile: BattleMapTile = {
        id: tileId,
        coordinates: { x: tx, y: ty },
        terrain,
        elevation,
        movementCost: blocksMovement ? 0 : crossing?.kind === "ford" ? 2 : 1,
        blocksLoS,
        blocksMovement,
        decoration,
        surface,
        crossing,
        effects: [],
      };

      // Prop imprint (step 3b): stamp referee data from any WAVE-1 prop covering
      // this tile. Runs AFTER the building pass so a plot's floor doesn't erase a
      // prop's block/cover, and props inside a building (crate on a shop floor)
      // still read as cover. A building WALL already set material, so the guard in
      // imprintPropOnTile keeps the heavier structural material.
      for (const prop of ground.props || []) {
        imprintPropOnTile(tile, prop, wx, wz);
      }

      tiles.set(tileId, tile);
    }
  }

  // Publish one spell-target record per represented source object after the
  // grid is complete, so deliberate road/building precedence is respected.
  const targetableObjects = projectWorldforgeTargetableObjects(
    ground,
    playerX,
    playerZ,
    width,
    height,
    tiles,
  );
  // Scenario harnesses and live 3D handoffs can supply fractional-clock agent
  // positions. Older callers still receive the schedule-derived Ground sites,
  // so production maps do not silently lose resident identity.
  const worldOccupants = projectWorldforgeOccupants(
    options?.occupants ?? ground.occupants,
    playerX,
    playerZ,
    width,
    height,
    tiles,
  );

  return {
    dimensions: { width, height },
    tiles,
    targetableObjects,
    worldOccupants,
    theme: biome,
    seed,
  };
}
