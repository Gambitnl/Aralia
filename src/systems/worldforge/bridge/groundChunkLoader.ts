// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/06/2026, 14:09:00
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 18 files
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
import type { ChunkData, ChunkMeshBundle, VegetationScatter, LodTier } from "../../world3d/types";
import { buildChunkBundle } from "../../world3d/chunkBundle";
import { WORLD3D_CONFIG, heightToMeters, resolutionForLod } from "../../world3d/config";
import { biomeColor } from "../../world3d/terrainColor";
import type { LocalArtifact, RegionArtifact, RegionTownSite, RegionMarker } from "../artifacts";
import { localArtifactToWorldData, GROUND_METERS_PER_CELL } from "./groundWorldAdapter";
import { getCanonicalTownPlan, transformTownPlan, townSpanFtForBurg, CANON_TOWN_SPAN, getCanonicalTownWaterFeatures, canonicalTownSeedPath } from "../town/canonicalTown";
import { briefForPlot } from "../town/householdBrief";
import { occupancyForPlot } from "./buildingOccupancy";
import type { TownPlotPopulation } from "../town/townEngine";
import type { InteriorPlotInput } from "../interior/generateInterior";
import { buildTownWaterBodies } from "../town/townWaterBodies";
import { toArtifactPlan, type AdaptedTownPlan } from "../town/townPlanAdapter";
import type { TownPlan } from "../artifacts";
import { buildInterior, DOOR_LEAF_COLOR, type SitePart, type OccupantBody } from "./interiorParts";
import { generateTownRoster } from "../roster/generateTownRoster";
import { occupantLocationAt, type ActivityKind } from "../roster/occupantSchedule";
import type { TownRoster, Occupant } from "../roster/types";
import { generateBody } from "../body/generateBody";
import type { BodyPlan } from "../body/types";
import { childSeedPath, rootSeedPath } from "../seedPath";
import { generateHiddenPlaces, type HiddenPlaceKind } from "../discovery/hiddenPlaces";
import type { Pt } from "../submap/submapEngine";
import { localWithDeltas } from "./groundDeltas";
import type { WorldDelta } from "../delta/types";
import { getBurgNamer, getBridgeAtlas, getBurgCultureType } from "./legacySubmapBridge";
import { styleFamilyForCultureType, styledGatehouseForm, climateForBiomeId, type StyleFamily, type GatehouseForm } from "../town/architectureStyle";
import type { StyleContext } from "../interior/blueprintTypes";
import { SeededRandom } from "../../../utils/random/seededRandom";
import { generateBusinessName } from "../../economy/NpcBusinessManager";
import type { BusinessType, WorldBusiness } from "../../../types/business";
import type { RichNPC } from "../../../types/world";
import type { BattleMapBiome, BattleMapData, BattleMapTile, BattleMapTerrain, BattleMapDecoration } from "@/types/combat";
import { generateGroundHostiles } from "./groundHostiles";
import { buildGroundProps, imprintPropOnTile } from "./groundProps";
import type { PropInstance } from "../props/propSchema";
import type { EntranceKind } from "../dungeon/world/dungeonSites";
import { dungeonEntrancesForWindow } from "./dungeonEntrances";

/** A polyline in ground world-meters with a uniform width (meters). */
interface GroundPolyline {
  points: Array<{ x: number; z: number }>;
  widthM: number;
  /** Optional tint (e.g. town-wall runs carry the style family's wallTint). */
  colorHex?: string;
}

/** A filled town water body (river channel / harbour apron), ground meters. */
export interface GroundWaterBody {
  pointsM: Array<{ x: number; z: number }>;
  /** Flat water-surface Y in world meters (set by the terrain-carve pass). */
  surfaceY: number;
}

/** A dock pier / bridge span deck (convex quad), ground meters. */
export interface GroundDeck {
  cornersM: Array<{ x: number; z: number }>;
  /** Deck-top Y in world meters, just above the adjacent water (carve pass). */
  topY: number;
  /**
   * Civic role of the deck (TG5). Carried from the canonical plan's civic kind so
   * the 3D renderer can tint a weathered-timber quay distinctly from a lighter
   * bridge span — they must not share one identical slab material.
   */
  kind: 'dock' | 'bridge';
  /**
   * Style-family deck detailing (piling spacing / railing / bridge-arch rise),
   * stamped from the burg's architecture family so a coastal-timber quay and a
   * highland-stone bridge read differently in 3D.
   */
  detail?: { pilingSpacingM: number; railing: boolean; archRiseM: number };
}

/** A roster person resolved to the plot center where their figure is rendered. */
interface GroundOccupantSite {
  burgId: number;
  occupantId: number;
  name: string;
  xM: number;
  zM: number;
  /** Schedule activity at the bake hour (drives the close-range nameplate). */
  activity?: ActivityKind;
}

/** Player-facing label for a townsperson's current activity. */
const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  sleeping: 'asleep',
  home: 'at home',
  working: 'working',
  out: 'out & about',
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
  /** Town defensive wall rings (closed polylines), ground meters. */
  walls: GroundPolyline[];
  /** Town water bodies (rivers/harbour), filled flat surfaces, ground meters. */
  waterBodies: GroundWaterBody[];
  /** Town dock/bridge deck slabs, ground meters. */
  decks: GroundDeck[];
  /** Town road-gate placements (ground meters) for gatehouse meshes (styled-architecture slice). */
  gatehouses: Array<{ xM: number; zM: number; angleRad: number; gapHalfM: number; form: GatehouseForm; colorHex: string; burgId: number }>;
  /** Town sites overlapping the artifact, center in ground meters. */
  towns: Array<{ burgId: number; name: string; xM: number; zM: number; halfM: number }>;
  /** Town-plan building plots (C3 generateTownPlan), centers in meters. */
  buildings: Array<{
    id: string;
    xM: number;
    zM: number;
    /** Plot footprint corners, ground meters (quad order from the plan). */
    cornersM: Array<{ x: number; z: number }>;
    /** Building height, meters (storeys × 3). */
    heightM: number;
    role: string;
    /** Architecture-style stamps (Task 7): absent on legacy/unstyled plans. */
    wallColorHex?: string;
    roofColorHex?: string;
    roofForm?: 'gable' | 'hip' | 'steep' | 'flat';
    /** The burg's style family builds chimneys. */
    chimney?: boolean;
    /** Interior wall envelope, meters (≤ plot; roofs/floors fit THIS). */
    wallWidthM: number;
    wallDepthM: number;
    /** L4 interior: walls + furnishings as site-local boxes (seamless). */
    parts: SitePart[];
    /** Solved roof group, site-local meters (BGv2 Task 5); undefined until a
     *  style resolves. When set, the renderer skips the legacy roof prism. */
    solvedRoof?: { positions: Float32Array; indices: Uint32Array; normals: Float32Array; colorHex: string };
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
}

const FEET_TO_METERS = 0.3048;

/** Region polylines (feet, world space) → ground meters, kept if any point
 * lands inside the artifact window (fine clipping happens per chunk). */
function regionPolylinesToGround(
  lines: Array<{ centerline: Array<[number, number]>; widthFt: number }>,
  local: LocalArtifact,
): GroundPolyline[] {
  const { bounds } = local;
  const out: GroundPolyline[] = [];
  for (const line of lines) {
    const pts = line.centerline.map(([fx, fy]) => ({
      x: (fx - bounds.x) * FEET_TO_METERS,
      z: (fy - bounds.y) * FEET_TO_METERS,
    }));
    const extentX = bounds.width * FEET_TO_METERS;
    const extentZ = bounds.height * FEET_TO_METERS;
    const touches = pts.some(
      (p) => p.x >= -50 && p.x <= extentX + 50 && p.z >= -50 && p.z <= extentZ + 50,
    );
    if (touches && pts.length >= 2) {
      out.push({ points: pts, widthM: Math.max(1, line.widthFt * FEET_TO_METERS) });
    }
  }
  return out;
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
  ruin: 'Ruins',
  cave: 'Cave',
  shrine: 'Shrine',
  camp: 'Camp',
  grove: 'Hidden Grove',
  wreck: 'Wreck',
};

const MARKER_KIND_MAP: Record<string, HiddenPlaceKind> = {
  ruins: 'ruin',
  statues: 'ruin',
  battlefields: 'ruin',
  libraries: 'ruin',
  'sacred-mountains': 'shrine',
  'sacred-forests': 'grove',
  'sacred-pineries': 'grove',
  'sacred-palm-groves': 'grove',
  'hot-springs': 'shrine',
  'water-sources': 'grove',
  waterfalls: 'grove',
  volcanoes: 'cave',
  mines: 'cave',
  portals: 'shrine',
  lighthouses: 'wreck',
  canoes: 'wreck',
  inns: 'camp',
  fairs: 'camp',
  circuses: 'camp',
  jousts: 'camp',
  migration: 'camp',
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
  /**
   * Staged 3D world entry (Stage A): skip the WAVE-1 props pass so terrain +
   * town assemble as fast as possible. A world built this way has `props: []`
   * and is otherwise identical to a full build; the props are added afterward by
   * a separate `computeGroundProps` call (Stage B). Default false = full build.
   */
  skipProps?: boolean;
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
  const townContent = groundTowns(local, region, opts.hour ?? 12, opts.deltas ?? [], seed, opts, wd.gridSize.cols, wd.gridSize.rows);

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
      [local.bounds.x + local.bounds.width, local.bounds.y + local.bounds.height],
      [local.bounds.x, local.bounds.y + local.bounds.height],
    ];
    const hiddenSeed = childSeedPath(rootSeedPath(seed), `hidden:${Math.round(local.bounds.x)}:${Math.round(local.bounds.y)}`);
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
    rivers: region ? regionPolylinesToGround(region.rivers, local) : [],
    // Region routes + the town plan's own streets ride the same ribbon path
    roads: [
      ...(region ? regionPolylinesToGround(region.roads, local) : []),
      ...townContent.planStreets,
    ],
    walls: townContent.planWalls,
    waterBodies: townContent.planWaterBodies,
    decks: townContent.planDecks,
    gatehouses: townContent.planGatehouses,
    towns: townContent.towns,
    buildings: townContent.buildings,
    rosters: townContent.rosters,
    occupants: townContent.occupants,
    townPlans: townContent.townPlans,
    boundsFeet: { x: local.bounds.x, y: local.bounds.y },
  };

  // WAVE-1 props: deterministic dressing (market stalls, dock crates, wilderness
  // cover) derived from the assembled world's own plots/decks/roads/biomes. Rooted
  // at the region's seed path when present so props share the town's identity.
  // Staged 3D entry: Stage A skips this so terrain + town appear fast; Stage B
  // fills props in via computeGroundProps (the SAME call), keeping them identical.
  world.props = opts.skipProps ? [] : computeGroundProps(world, seed, region, opts);

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

  for (const building of buildings) {
    if (building.cornersM.length < 3) continue;

    // The plot centroid is the construction elevation. Keeping it in the
    // 0..100 encoded domain avoids unit conversions and matches the ground
    // sampler's later input.
    const centroid = {
      x: building.cornersM.reduce((sum, corner) => sum + corner.x, 0) / building.cornersM.length,
      z: building.cornersM.reduce((sum, corner) => sum + corner.z, 0) / building.cornersM.length,
    };
    const padHeight = sampleEncodedHeight(
      originalHeights,
      cols,
      rows,
      centroid.x,
      centroid.z,
    );
    const footprintIndexes = buildingFootprintCells(cols, rows, building.cornersM);
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
          if (neighborCol < 0 || neighborCol >= cols || neighborRow < 0 || neighborRow >= rows) continue;
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
    const averagePadHeight = padHeights.reduce((sum, height) => sum + height, 0) / padHeights.length;
    heights[index] = originalHeights[index] + (averagePadHeight - originalHeights[index]) * 0.5;
  }
}

/** Encoded-height drops (0..100 domain) that shape town water + its banks. */
const WATER_SURFACE_DROP_ENC = 1.5; // water surface sits this far below the shore
const WATER_BED_DROP_ENC = 4;       // carved bed sits this far below the shore
const DECK_CLEARANCE_M = 0.4;       // deck top stands this far above the water

/**
 * Walkable head clearance (meters) for the 2D combat-patch extractor (IN guard).
 * An interior part only blocks a floor tile if it intrudes BELOW this height — so
 * overhead parts (the door lintel at baseY 2.1, the ceiling slab near the shell
 * top, upper-floor slabs) clear a walker's head and never block the tile beneath
 * them. ~6.2 ft: above a tall figure, below a normal storey.
 */
const COMBAT_HEAD_CLEARANCE_M = 1.9;

/** Even-odd point-in-polygon on the X/Z plane (handles concave channels). */
function pointInPolygonXZ(px: number, pz: number, poly: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > pz) !== (b.z > pz) &&
        px < ((b.x - a.x) * (pz - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Grid cell indices whose centers fall inside a (possibly concave) polygon. */
function polygonCellIndices(cols: number, rows: number, poly: Array<{ x: number; z: number }>): number[] {
  if (poly.length < 3) return [];
  const minCol = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x)) / GROUND_METERS_PER_CELL) - 1);
  const maxCol = Math.min(cols - 1, Math.ceil(Math.max(...poly.map((p) => p.x)) / GROUND_METERS_PER_CELL) + 1);
  const minRow = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.z)) / GROUND_METERS_PER_CELL) - 1);
  const maxRow = Math.min(rows - 1, Math.ceil(Math.max(...poly.map((p) => p.z)) / GROUND_METERS_PER_CELL) + 1);
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
    for (const idx of buildingFootprintCells(cols, rows, b.cornersM)) protectedCells.add(idx);
  }

  for (const body of waterBodies) {
    if (body.pointsM.length < 3) continue;
    const c = centroidOf(body.pointsM);
    const shoreEnc = sampleEncodedHeight(original, cols, rows, c.x, c.z);
    body.surfaceY = heightToMeters(Math.max(0, shoreEnc - WATER_SURFACE_DROP_ENC));
    const bedEnc = Math.max(0, shoreEnc - WATER_BED_DROP_ENC);
    for (const idx of polygonCellIndices(cols, rows, body.pointsM)) {
      if (protectedCells.has(idx)) continue; // buildings win — keep their level pad
      heights[idx] = Math.min(heights[idx], bedEnc); // lower only — never raise land
    }
  }

  for (const deck of decks) {
    if (deck.cornersM.length < 3) continue;
    const c = centroidOf(deck.cornersM);
    const shoreEnc = sampleEncodedHeight(original, cols, rows, c.x, c.z);
    deck.topY = heightToMeters(Math.max(0, shoreEnc - WATER_SURFACE_DROP_ENC)) + DECK_CLEARANCE_M;
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
function wallTangentAt(ring: Array<{ x: number; z: number }>, p: { x: number; z: number }): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const d = (mx - p.x) ** 2 + (mz - p.z) ** 2;
    if (d < bestD) { bestD = d; best = Math.atan2(b.z - a.z, b.x - a.x); }
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
  const minCol = Math.max(0, Math.floor(Math.min(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL) - 1);
  const maxCol = Math.min(cols - 1, Math.ceil(Math.max(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL) + 1);
  const minRow = Math.max(0, Math.floor(Math.min(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL) - 1);
  const maxRow = Math.min(rows - 1, Math.ceil(Math.max(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL) + 1);
  const indexes: number[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const center = {
        x: (col + 0.5) * GROUND_METERS_PER_CELL,
        z: (row + 0.5) * GROUND_METERS_PER_CELL,
      };
      if (pointInsideConvexQuad(center, corners)) indexes.push(row * cols + col);
    }
  }

  return indexes;
}

function pointInsideConvexQuad(point: { x: number; z: number }, corners: Array<{ x: number; z: number }>): boolean {
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
  const types: BusinessType[] = role === 'market'
    ? ['general_store', 'tavern', 'apothecary', 'trading_company', 'enchanter_shop']
    : ['smithy', 'mine', 'farm', 'trading_company'];
  const index = Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
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
  const townAtlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(townAtlas, worldSeed, site.burgId);
  const spanFt = townSpanFtForBurg(townAtlas, site.burgId);
  const placeScale = spanFt / CANON_TOWN_SPAN;
  const placeDx = site.envelope.x + site.envelope.width / 2;
  const placeDy = site.envelope.y + site.envelope.height / 2;
  const feetPlan = transformTownPlan(enginePlan, placeScale, placeDx, placeDy);
  // Architecture style: the burg's FMG culture TYPE picks the family; per-plot
  // stamps are hashed frame-invariantly so the 2D map picks the same styles.
  const family = styleFamilyForCultureType(getBurgCultureType(worldSeed, site.burgId));
  const adapted = toArtifactPlan(feetPlan, site.burgId, family);
  return { ...adapted, family };
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

  const wf = getCanonicalTownWaterFeatures(townAtlas, site.burgId);
  const bodiesFt = buildTownWaterBodies({
    rivers: wf.rivers.map(toFeet),
    coast: wf.coast.map(toFeet),
    centroid,
    channelHalfWidth: spanFt * 0.03,
    apronDepth: spanFt * 0.4,
  });
  const waterBodies: GroundWaterBody[] = bodiesFt.map((poly) => ({
    pointsM: poly.map(([fx, fy]) => toM(fx, fy)),
    surfaceY: 0,
  }));

  // The burg's architecture family (same resolution as canonicalArtifactTownForSite)
  // supplies the deck detailing — pilings/railings/arch — for docks AND bridges;
  // the renderer decides what applies per kind.
  const family = styleFamilyForCultureType(getBurgCultureType(worldSeed, site.burgId));
  const decks: GroundDeck[] = [];
  for (const c of feetPlan.civic) {
    if (c.kind !== 'dock' && c.kind !== 'bridge') continue;
    // Preserve the civic kind end-to-end (TG5) — it tints the deck downstream.
    decks.push({ cornersM: c.polygon.map(([fx, fy]) => toM(fx, fy)), topY: 0, kind: c.kind, detail: family.deckDetail });
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
  const rosters: TownRoster[] = [];
  const occupants: GroundOccupantSite[] = [];
  const townPlans: Array<{ burgId: number; plan: TownPlan }> = [];

  for (const t of region?.townSites ?? []) {
    const xM = (t.envelope.x + t.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const zM = (t.envelope.y + t.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const halfM = (Math.max(t.envelope.width, t.envelope.height) / 2) * FEET_TO_METERS;
    if (xM < -halfM || xM > exX + halfM || zM < -halfM || zM > exZ + halfM) continue;

    // Real burg name from the bridge atlas so 3D surfaces (nameplates) can
    // show "Stren" instead of the internal "Town - wf-town-15" id.
    const burgName = getBridgeAtlas(worldSeed).pack.burgs?.[t.burgId]?.name ?? `Burg ${t.burgId}`;
    towns.push({ burgId: t.burgId, name: burgName, xM, zM, halfM });

    // CANONICAL town (Worldforge Option B): the SAME (atlas, burgId) plan the
    // 2D map drill renders — generated once in the normalized frame, then
    // scaled by population and placed into THIS town's envelope so the 3D town
    // is the same place. Shared with World3DWrapper's business/NPC registration
    // via `canonicalArtifactTownForSite`, so plot IDs never diverge.
    const adapted = canonicalArtifactTownForSite(worldSeed, t);
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
        // 2.5 m floor: thinner ribbons vanish against grass at walking
        // scale (Remy shot-1 review) — a village lane reads at ~8 ft.
        widthM: Math.max(2.5, s.widthFt * FEET_TO_METERS),
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
        planWalls.push({ points: ringM, widthM: 1.2, colorHex: adapted.family.wallTint });
      } else {
        for (const run of splitWallRingAtGates(ringM, allGates)) {
          if (run.length >= 2) planWalls.push({ points: run, widthM: 1.2, colorHex: adapted.family.wallTint });
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
    const roster = generateTownRoster(plan, region!.seedPath, { nameFor });

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
          o.name = ownerNpc.name;
        } else {
          // Fallback deterministic name generation if not in state
          const seedValue = worldSeed + t.burgId + o.workPlotId;
          const rng = new SeededRandom(seedValue);
          const pPlot = plan.plots.find(pl => pl.id === o.workPlotId);
          if (pPlot) {
            const tempNpcName = o.name || nameFor(rng);
            o.name = tempNpcName;
          }
        }
      }
    }

    rosters.push(roster);
    const byPlot = new Map<number, Array<Occupant & { atWork: boolean; resolvedPlotId: number; activity: ActivityKind }>>();
    for (const o of roster.occupants) {
      // Place via the CANONICAL schedule (`occupantLocationAt`) — the same source
      // of truth the 2D agent-sim uses — so the 3D scene and the overlay never
      // disagree about where someone is (was a cruder, divergent `isAtWork`).
      const block = occupantLocationAt(o, hour);
      const placeAt = block.plotId;
      const atWork = block.activity === 'working';
      byPlot.set(placeAt, [...(byPlot.get(placeAt) ?? []), { ...o, atWork, resolvedPlotId: placeAt, activity: block.activity }]);
    }

    // Founding-household briefs (BGv2 Task 11): each building generates FROM the
    // family the town names for it. The town seed MUST match the one the 2D
    // tooltips key households on — canonicalTownSeedPath(worldSeed, burgId), the
    // same seed getCanonicalTownPlan feeds generateTownPlan (population pass) —
    // so the family in the 3D house IS the tooltip family. `pops` is the set of
    // population-tagged plots briefForPlot resolves workplace/proprietor
    // cross-references against; unpopulated towns carry no `pop`, so it is empty
    // and every building generates briefless exactly as before.
    const townSeed = canonicalTownSeedPath(worldSeed, t.burgId);
    const pops: TownPlotPopulation[] = plan.plots
      .map((pl) => pl.pop)
      .filter((pop): pop is TownPlotPopulation => pop !== undefined);

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
    const styleBurg = styleAtlas.pack.burgs?.[t.burgId] as { cell?: number } | undefined;
    const burgCultureType = getBurgCultureType(worldSeed, t.burgId);
    const burgBiomeId =
      styleBurg?.cell !== undefined ? styleAtlas.pack.cells.biome?.[styleBurg.cell] : undefined;
    if (burgBiomeId === undefined) {
      throw new Error(
        `groundChunkLoader: cannot resolve biome for burg ${t.burgId} in world ${worldSeed} ` +
        `(cell ${styleBurg?.cell ?? 'none'}) — required for the building StyleContext.`,
      );
    }
    const burgClimate = climateForBiomeId(burgBiomeId);

    for (const p of plan.plots) {
      const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
      const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
      const xM = (cx - local.bounds.x) * FEET_TO_METERS;
      const zM = (cy - local.bounds.y) * FEET_TO_METERS;
      const cornersM = p.footprint.map(([fx, fy]) => ({
        x: (fx - local.bounds.x) * FEET_TO_METERS,
        z: (fy - local.bounds.y) * FEET_TO_METERS,
      }));
      // Skip plots that cover no ground tile (sub-5ft slivers): they can't get a
      // level pad, so they'd render as ungrounded boxes. Every kept building is
      // guaranteed a pad (invariant the terrain-pad pass relies on).
      if (gridCols > 0 && gridRows > 0 && buildingFootprintCells(gridCols, gridRows, cornersM).length === 0) continue;
      const heightM = Math.max(1, (p.storeys ?? 1)) * 3;

      const isBiz = p.role === 'market' || p.role === 'workshop';
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
      const household = p.pop ? briefForPlot(p.pop, pops, townSeed) : undefined;
      // Style context (BGv2 Task 7): burg culture + climate (resolved once above)
      // plus this plot's ward wealth (WardWealth from the population pass, common
      // when no district was tagged) and the Phase-3 age stub. Attached so the
      // building raises its solved roof (dropping the legacy prism). Plots keep
      // the SAME conditional-spread pattern as buildingType/household.
      const style: StyleContext = {
        cultureType: burgCultureType,
        climate: burgClimate,
        wealth: p.pop?.district ?? 'common',
        ageBand: 'new',
      };
      const plotInput: InteriorPlotInput = {
        id: p.id,
        footprint: p.footprint,
        role: p.role ?? 'house',
        storeys: p.storeys ?? 1,
        ...(p.pop?.buildingType ? { buildingType: p.pop.buildingType } : {}),
        ...(household ? { household } : {}),
        style,
      };
      // LIVING overlay (BGv2 Task 14): a populated building shows its OWN family
      // standing at their hourly stations — the smith at the forge, the spouse
      // in the house, everyone abed at night — and lights the hearth after dusk.
      // This is the 3D twin of the 2D blueprint overlay: it resolves the SAME
      // household briefForPlot designs the house for, so the family in the house
      // IS the family the house was built for. Members who are OUT this hour get
      // no body. Unpopulated plots (no `p.pop`) fall back to the roster figures
      // (the agent-sim commuters), byte-identical to before.
      const living = p.pop
        ? occupancyForPlot(p.pop, pops, plotInput, region!.seedPath, townSeed, hour)
        : undefined;
      let occFigures;
      let hearthLit = false;
      // Interior-lighting slice: window panes glow when the family is home at a
      // dusk/night bake hour (living.litWindows). Reads town-wide from the
      // street; emissive-only, no light cast. Daytime / unpopulated → dark glass.
      let litWindows = false;
      if (living) {
        hearthLit = living.hearthLit;
        litWindows = living.litWindows;
        occFigures = living.stations.map((st) => {
          // Synthesize the parametric body from the household member's identity
          // (BODY-1): a stable per-member seed keeps a family's bodies constant.
          const member = living.household.members[st.memberIndex];
          // Map the family member's free-text trade onto the body system's
          // closed Occupation set (drives clothing palette). Breadwinners read as
          // shopkeeper/artisan by trade keyword; everyone else is a resident.
          const trade = (member?.occupation ?? '').toLowerCase();
          const occupation =
            member?.role === 'head' || member?.role === 'spouse'
              ? /keep|shop|innkeep|tavern|clerk|official|merchant/.test(trade)
                ? 'shopkeeper'
                : /smith|artisan|wright|journey|apprentice|craft|brew|forge/.test(trade)
                  ? 'artisan'
                  : 'resident'
              : 'resident';
          const occLike = {
            id: p.id * 100 + st.memberIndex,
            name: member?.name ?? st.name,
            ageBand: member?.ageBand ?? 'adult',
            homePlotId: p.id,
            occupation: occupation as 'resident' | 'shopkeeper' | 'artisan',
          };
          return {
            id: occLike.id,
            ageBand: occLike.ageBand,
            body: bodyPlanToOccupantBody(
              generateBody(occLike, childSeedPath(townSeed, `member:${p.id}:${st.memberIndex}`)),
            ),
            station: { xFt: st.x, yFt: st.y, level: st.level },
          };
        });
      } else {
        // Each occupant gets a parametric body (BODY-1) from its own seed path, so
        // villagers vary in height/build/palette deterministically.
        occFigures = (byPlot.get(p.id) ?? []).map((o) => ({
          id: o.id,
          ageBand: o.ageBand,
          atWork: o.atWork,
          body: bodyPlanToOccupantBody(
            generateBody(o, childSeedPath(region!.seedPath, `occ:${o.id}`)),
          ),
        }));
      }
      // Wall envelope (≤ plot footprint) AND seamless interior parts (L4) from ONE
      // interior generation — the envelope sizes roofs/floors so eaves don't float
      // past the walls (construction v2); the parts use the same seed path as the
      // town plan so plan, shell, rooms AND household all agree. (Was two
      // generateInterior calls per plot — wasteful for large capitals.)
      const interior = buildInterior(plotInput, region!.seedPath, heightM, occFigures, hearthLit, litWindows);
      buildings.push({
        id: `wf-plot-${t.burgId}-${p.id}`,
        xM,
        zM,
        cornersM,
        heightM,
        role: p.role ?? 'house',
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
        parts: interior.parts,
        // Solved roof (BGv2 Task 5): undefined unless the blueprint resolved a
        // style — then the renderer draws it and skips the legacy roof prism.
        solvedRoof: interior.roof,
      });
    }
  }

  return { towns, buildings, planStreets, planWalls, planWaterBodies, planDecks, planGatehouses, rosters, occupants, townPlans };
}

/** Encoded-height bilinear sample at world meters → true meters via heightToMeters. */
export function groundSurfaceY(ground: GroundWorld, wxM: number, wzM: number): number {
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
  const enc = (h(x0, y0) * (1 - fx) + h(x1, y0) * fx) * (1 - fy) +
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
    if (f.xM < minX || f.xM >= minX + S || f.zM < minZ || f.zM >= minZ + S) continue;
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

  // Edge treatment: chunks beyond the artifact window would otherwise
  // extend the clamped border heights as an infinite plateau. Instead, ease
  // terrain downward and blend the tint toward haze over EDGE_FALL_M, so
  // the detail window reads as land falling away toward the horizon.
  const EDGE_FALL_M = 256;
  const EDGE_DROP_H = 14;
  const HAZE_RGB: [number, number, number] = [0.64, 0.67, 0.64];
  const extentX = cols * GROUND_METERS_PER_CELL;
  const extentZ = rows * GROUND_METERS_PER_CELL;

  const heights = new Float32Array(resolution * resolution);
  const outBiomes: string[] = new Array(resolution * resolution);
  const biomeColors = new Float32Array(resolution * resolution * 3);

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
      // EDGE_FALL_M past its border.
      const ox = Math.max(0, -worldX, worldX - extentX);
      const oz = Math.max(0, -worldZ, worldZ - extentZ);
      let edgeT = 0;
      if (ox > 0 || oz > 0) {
        const t = Math.min(1, Math.hypot(ox, oz) / EDGE_FALL_M);
        edgeT = t * (2 - t);
        height = Math.max(0, height - EDGE_DROP_H * edgeT);
      }

      const idx = j * resolution + i;
      heights[idx] = height;

      const bx = Math.round(gx);
      const by = Math.round(gy);
      const biomeId = biomeIds[clampY(by) * cols + clampX(bx)] ?? "plains";
      outBiomes[idx] = biomeId;

      let [r, g, b] = biomeColor(biomeId, height / 100);
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
    // Town water bodies → filled lake surfaces; dock/bridge decks → timber slabs.
    // Both clipped to the chunk rectangle and emitted in pseudo-grid (meters/M).
    lakes: ground.waterBodies.flatMap((b) => {
      const clipped = clipPolygonToChunk(b.pointsM, cx, cy);
      return clipped.length >= 3
        ? [{ points: clipped.map((p) => pseudoGrid(p.x, p.z)), surfaceY: b.surfaceY }]
        : [];
    }),
    decks: ground.decks.flatMap((d) => {
      const clipped = clipPolygonToChunk(d.cornersM, cx, cy);
      // Carry the dock/bridge kind through (TG5) so the geometry tints each deck.
      return clipped.length >= 3
        ? [{ points: clipped.map((p) => pseudoGrid(p.x, p.z)), topY: d.topY, kind: d.kind, detail: d.detail }]
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
          colorHex: b.wallColorHex ?? (b.role === 'market' ? '#c8923f' : '#b09a72'), // legacy-compat for unstyled producers, not a style fallback
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
          name: o.activity ? `${o.name} · ${ACTIVITY_LABEL[o.activity]}` : o.name,
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
  const minX = cx * S, minZ = cy * S, maxX = minX + S, maxZ = minZ + S;
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
  const lerpX = (a: P, b: P, x: number): P => ({ x, z: a.z + (b.z - a.z) * ((x - a.x) / (b.x - a.x)) });
  const lerpZ = (a: P, b: P, z: number): P => ({ x: a.x + (b.x - a.x) * ((z - a.z) / (b.z - a.z)), z });
  let ring: P[] = poly.map((p) => ({ x: p.x, z: p.z }));
  ring = clipEdge(ring, (p) => p.x >= minX, (a, b) => lerpX(a, b, minX));
  if (ring.length < 3) return [];
  ring = clipEdge(ring, (p) => p.x <= maxX, (a, b) => lerpX(a, b, maxX));
  if (ring.length < 3) return [];
  ring = clipEdge(ring, (p) => p.z >= minZ, (a, b) => lerpZ(a, b, minZ));
  if (ring.length < 3) return [];
  ring = clipEdge(ring, (p) => p.z <= maxZ, (a, b) => lerpZ(a, b, maxZ));
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
): Array<{ points: { x: number; y: number }[]; width: number[]; colorHex?: string }> {
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
  const out: Array<{ x: number; z: number }> = [];
  const push = (p: { x: number; z: number }) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.z - p.z) > 1e-6) out.push(p);
  };
  const edgeHits = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const hits: Array<{ t: number; x: number; z: number }> = [];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const tryEdge = (t: number) => {
      if (t <= 0 || t >= 1 || !Number.isFinite(t)) return;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      if (x >= minX - 1e-6 && x <= maxX + 1e-6 && z >= minZ - 1e-6 && z <= maxZ + 1e-6) {
        hits.push({ t, x, z });
      }
    };
    if (dx !== 0) { tryEdge((minX - a.x) / dx); tryEdge((maxX - a.x) / dx); }
    if (dz !== 0) { tryEdge((minZ - a.z) / dz); tryEdge((maxZ - a.z) / dz); }
    hits.sort((p, q) => p.t - q.t);
    return hits;
  };

  for (let i = 0; i < line.points.length; i++) {
    const p = line.points[i];
    if (inside(p)) push(p);
    if (i < line.points.length - 1) {
      for (const h of edgeHits(p, line.points[i + 1])) push({ x: h.x, z: h.z });
    }
  }

  if (out.length < 2) return [];
  return [{
    points: out.map((p) => ({ x: p.x / M, y: p.z / M })),
    width: out.map(() => line.widthM / M),
    // Style-family tint (e.g. wall runs) rides through so wallGeometry can
    // vertex-color the extruded barrier per town.
    colorHex: line.colorHex,
  }];
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
  return async (cx: number, cy: number, lod?: LodTier): Promise<ChunkMeshBundle> => {
    // Honor the requested LOD tier's mesh resolution (W3D-G10 / T7); distant
    // ground chunks build coarser, near ones stay full-detail.
    const bundle = buildChunkBundle(
      sampleGroundChunk(ground, cx, cy, resolutionForLod(lod)),
    );
    // Artifact features replace the generic per-vertex scatter (see
    // buildGroundVegetation — determinism + no lattice banding). Trees
    // and bushes are separate instanced layers (variety dispatch).
    const { trees, bushes } = buildGroundVegetation(ground, cx, cy);
    return {
      ...bundle,
      vegetation: trees.positions.length > 0 ? trees : undefined,
      bushes: bushes.positions.length > 0 ? bushes : undefined,
    };
  };
}

// ============================================================================
// Terrain Patch Extraction
// ============================================================================
// This function extracts a 40x30 local region centered at the player's world
// meters position (playerX, playerZ) from the GroundWorld object. It samples
// elevations, determines biomes, detects obstacle collisions (features), and
// maps buildings/seamless interiors directly onto the BattleMap 3D tiles.
// ============================================================================
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
  dimensions?: { width: number; height: number },
): BattleMapData {
  const width = dimensions?.width ?? 40;
  const height = dimensions?.height ?? 30;
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
      // BattleMap renders with a vertical ELEVATION_SCALE of 0.3, so we divide
      // the real height in meters by 0.3.
      const realHeightM = groundSurfaceY(ground, wx, wz);
      const elevation = realHeightM / 0.3;

      // 2. Biome lookup: Sample the nearest biome from the GroundWorld grid.
      const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(wx / GROUND_METERS_PER_CELL)));
      const by = Math.max(0, Math.min(ground.rows - 1, Math.round(wz / GROUND_METERS_PER_CELL)));
      const groundBiome = ground.biomeIds[by * ground.cols + bx] ?? "plains";

      // Map GroundWorld biome to a valid BattleMapTerrain value
      let terrain: BattleMapTerrain = 'grass';
      if (groundBiome === 'ocean' || groundBiome === 'water') {
        terrain = 'water';
      } else if (groundBiome === 'desert') {
        terrain = 'sand';
      } else if (groundBiome === 'swamp' || groundBiome === 'wetland') {
        terrain = 'mud';
      } else if (groundBiome === 'mountain' || groundBiome === 'tundra') {
        terrain = 'rock';
      }

      // Initialize default properties for the tile
      let blocksMovement = terrain === 'water';
      let blocksLoS = false;
      let decoration: BattleMapDecoration = null;

      // 3. Natural obstacles: Check if this tile overlaps any trees, bushes, or boulders
      // within reasonable collision ranges.
      for (const f of ground.features) {
        const dist = Math.hypot(wx - f.xM, wz - f.zM);
        if (f.kind === 'tree' && dist < 1.2) {
          decoration = 'tree';
          blocksMovement = true;
          blocksLoS = true;
        } else if (f.kind === 'bush' && dist < 0.8) {
          decoration = 'bush';
        } else if (f.kind === 'boulder' && dist < 1.0) {
          decoration = 'boulder';
          blocksMovement = true;
          blocksLoS = true;
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
          terrain = 'floor';
          blocksMovement = false;
          blocksLoS = false;
          decoration = null;

          // Convert world coords to building-local coordinate space to check walls and furniture
          const c = b.cornersM;
          const e1x = c[1].x - c[0].x;
          const e1z = c[1].z - c[0].z;
          const e2x = c[3].x - c[0].x;
          const e2z = c[3].z - c[0].z;
          const rotationY = -Math.atan2(e1z, e1x);
          const cross = e1x * e2z - e1z * e2x;
          const doorZSign = cross >= 0 ? -1 : 1;

          const dxLocal = wx - b.xM;
          const dzLocal = wz - b.zM;
          const lx = dxLocal * Math.cos(rotationY) - dzLocal * Math.sin(rotationY);
          const lz = dxLocal * Math.sin(rotationY) + dzLocal * Math.cos(rotationY);

          // Iterate through interior parts (walls and furniture)
          for (const p of b.parts) {
            const lzScene = p.z * doorZSign;
            // Add a small 0.1m tolerance buffer to ensure adjacent cells align cleanly
            const inX = lx >= p.x - p.w / 2 - 0.1 && lx <= p.x + p.w / 2 + 0.1;
            const inZ = lz >= lzScene - p.d / 2 - 0.1 && lz <= lzScene + p.d / 2 + 0.1;

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
              const isWall = p.colorHex === '#cfc7b8' || p.colorHex === '#c8923f' || p.colorHex === '#b09a72';
              if (isWall) {
                terrain = 'wall';
                blocksLoS = true;
              }
            }
          }
        }
      }

      const tile: BattleMapTile = {
        id: tileId,
        coordinates: { x: tx, y: ty },
        terrain,
        elevation,
        movementCost: blocksMovement ? 0 : 1,
        blocksLoS,
        blocksMovement,
        decoration,
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

  return {
    dimensions: { width, height },
    tiles,
    theme: biome,
    seed,
  };
}
