// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 17/07/2026, 23:24:45
 * Dependents: components/World3D/InWorldHUD.tsx, components/World3D/World3DWrapper.tsx, components/World3D/createWorldGenClient.ts, components/World3D/worldGenCore.ts, components/Worldforge/AtlasDemo.tsx, components/Worldforge/LocalMapView.tsx, components/Worldforge/RegionMapView.tsx, components/Worldforge/TownAgentSnapshotView.tsx, components/Worldforge/localDraw.ts, components/Worldforge/regionDraw.ts, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/spells/ai/MaterialTagService.ts, systems/worldforge/adapter/atlasArtifact.ts, systems/worldforge/bridge/dungeonEntrances.ts, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/groundDeltas.ts, systems/worldforge/bridge/groundHostiles.ts, systems/worldforge/bridge/groundWorldAdapter.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/bridge/seamProbe.ts, systems/worldforge/delta/applyDeltas.ts, systems/worldforge/delta/types.ts, systems/worldforge/generate.ts, systems/worldforge/index.ts, systems/worldforge/leaf3d/atlasGroundDrilldown.ts, systems/worldforge/local/generateLocal.ts, systems/worldforge/local/stitchLocalArtifacts.ts, systems/worldforge/provenance/groundProvenance.ts, systems/worldforge/region/generateRegion.ts, systems/worldforge/roster/agentPath.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/roster/townSnapshot.ts, systems/worldforge/roster/types.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/town/demoTownPlan.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/town/voronoiTownAdapter.ts, systems/worldforge/townsim/keyNpcs.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file artifacts.ts — Worldforge layer artifact types.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4. The five layers (atlas, region,
 * local, ground, interior-as-pass-of-ground) each produce a pure-data
 * artifact: renderable by 2D cartography or 3D, never containing renderer
 * state. Artifacts are seed-addressed (seedPath) and versioned
 * (schemaVersion) so the deterministic-base + delta persistence model
 * (decision #14) can detect regeneration compatibility.
 *
 * These shapes are deliberately MINIMAL-BUT-REAL: enough structure for the
 * spine's contracts and tests, with expansion-first field growth expected as
 * each generator lands (FMG port → AtlasArtifact fields, town passes →
 * TownPlan fields, etc.). Do not treat missing fields as design rejections —
 * they are simply not yet needed by a landed generator.
 *
 * What changed: new module (build-order item 1).
 * Preserved: existing world types (src/types/world.ts MapData etc.) are
 * untouched; Worldforge artifacts are the NEW canonical geography contract
 * (Decision Blitz D2) and adapters will bridge legacy consumers at cutover.
 */
import { BoundsFt, Feet } from './units';
import { SeedPath } from './seedPath';

/**
 * Bump ONLY on breaking shape changes; loaders treat a version mismatch as
 * "regenerate from seed" (safe because the base is deterministic — deltas
 * carry their own versioning when that layer lands).
 */
export const WORLDFORGE_SCHEMA_VERSION = 1;

export type LayerId = 'atlas' | 'region' | 'local' | 'ground';

/** Common envelope every layer artifact carries. */
export interface WorldforgeArtifact {
  layer: LayerId;
  schemaVersion: number;
  /** Identity + randomness root for this artifact (see seedPath.ts). */
  seedPath: SeedPath;
  /** World-feet bounds this artifact covers. */
  bounds: BoundsFt;
}

// ---------------------------------------------------------------------------
// L0 ATLAS — the continent (ported FMG output). SPEC §4 L0.
// ---------------------------------------------------------------------------

export interface AtlasCell {
  id: number;
  /** Cell site (Voronoi seed point), world feet. */
  x: Feet;
  y: Feet;
  /** Normalized 0..1 height (FMG convention preserved at import). */
  height: number;
  biomeId: number;
  /** Owning state/culture ids (0 = none), matching ported-FMG semantics. */
  stateId: number;
  cultureId: number;
  /** Ids of rivers crossing this cell, if any. */
  riverIds: number[];
  /** Burg (settlement) id occupying this cell, 0 = none. */
  burgId: number;
}

export interface AtlasBurg {
  id: number;
  name: string;
  cellId: number;
  x: Feet;
  y: Feet;
  population: number;
  /** Feature flags the town generator consumes (SPEC §6 pass 4). */
  isCapital: boolean;
  isPort: boolean;
}

export interface AtlasRiver {
  id: number;
  /** Downstream-ordered cell ids. */
  cellIds: number[];
  /** Discharge proxy used to widen banks at L1. */
  flux: number;
}

export interface AtlasRoute {
  id: number;
  /** Ordered cell ids the route passes through. */
  cellIds: number[];
  /** Tier vocabulary (road-systems Task 5): highway = capital trunk, road =
   * town link, trail = village link, path = forest spur (Task 7), searoute. */
  kind: 'highway' | 'road' | 'trail' | 'path' | 'searoute';
}

export interface AtlasForest {
  id: number;
  /** Culture-flavored name, e.g. "Angshire Wildwood" (forests Task 2). */
  name: string;
  /** Per-forest character; drives tint, encounters, nav DCs (spec §1/§3). */
  kind: 'ordinary' | 'ancient' | 'haunted' | 'fey';
  /** Member cell ids (cell-space kept raw, the AtlasRoute convention). */
  cellIds: number[];
  /** Label anchor (pole of inaccessibility), world feet — point data
   * converts like AtlasBurg x/y. */
  pole: [Feet, Feet];
}

export interface AtlasRange {
  id: number;
  /** Culture-flavored name, e.g. "Elden Spine" (mountains Task 2; unique per
   * atlas after the geographic dedup). */
  name: string;
  /** Per-range character; drives naming banks, glyph flavor, encounter hooks
   * (spec 2026-07-11-mountains-design §1). */
  kind: 'range' | 'highlands' | 'volcanic';
  /** Member cell ids (cell-space kept raw, the AtlasRoute convention). */
  cellIds: number[];
  /** The core-mountain (h >= 70) subset of cellIds. */
  coreCellIds: number[];
  /** Label anchor (pole of inaccessibility), world feet — point data
   * converts like AtlasBurg x/y. */
  pole: [Feet, Feet];
}

export interface AtlasPeak {
  id: number;
  /** Owning AtlasRange id. */
  rangeId: number;
  cellId: number;
  /** Encoded pack height (0–100 scale, FMG convention) at the peak cell. */
  h: number;
  /** Adopted volcano/sacred-mountain legend name ("Mount X") or a fresh
   * culture+form name; twins tolerated (peaks skip the dedup). */
  name: string;
}

export interface AtlasPass {
  id: number;
  /** The AtlasRange this pass crosses. */
  rangeId: number;
  /** The crossing's highest route cell. */
  cellId: number;
  name: string;
  /** AtlasRoute ids that cross through this pass. */
  routeIds: number[];
}

export interface AtlasArtifact extends WorldforgeArtifact {
  layer: 'atlas';
  cells: AtlasCell[];
  burgs: AtlasBurg[];
  rivers: AtlasRiver[];
  routes: AtlasRoute[];
  forests: AtlasForest[];
  ranges: AtlasRange[];
  peaks: AtlasPeak[];
  /** Empty until the passes task (mountains Task 4) fills pack.passes. */
  passes: AtlasPass[];
}

// ---------------------------------------------------------------------------
// L1 REGION — neighborhood of atlas cells, refined. SPEC §4 L1.
// ---------------------------------------------------------------------------

export interface RegionHeightfield {
  /** Samples per row (grid is row-major, bounds-aligned). */
  width: number;
  height: number;
  /** Cell size between samples, feet. */
  resolutionFt: Feet;
  /** Normalized 0..1 heights, length = width * height. */
  samples: Float32Array;
}

export interface RegionRiverBank {
  riverId: number;
  /** Polyline of [x, y] feet pairs along the channel center. */
  centerline: Array<[Feet, Feet]>;
  widthFt: Feet;
}

export interface RegionRoad {
  routeId: number;
  centerline: Array<[Feet, Feet]>;
  widthFt: Feet;
  /** Land tier (road-systems Task 5); searoutes are not region roads. */
  kind: 'highway' | 'road' | 'trail' | 'path';
}

/**
 * Stable player-facing identity for one generated settlement.
 *
 * The Atlas burg is the owner of the name and source id. Region, Local, and
 * Ground carry this same receipt instead of asking each renderer to invent a
 * label. Relationship flags are generated facts used to keep the Local map,
 * entry controls, and 3D HUD visually honest about ports, rivers, and roads.
 */
export interface CanonicalTownIdentity {
  kind: 'town';
  sourceKind: 'atlas-burg';
  sourceId: number;
  name: string;
  settlementType: 'capital' | 'port' | 'town';
  biomeId: number;
  hasRoadAccess: boolean;
  hasRiverAccess: boolean;
  isCoastal: boolean;
}

/**
 * A route/river relationship authored at Region scale.
 *
 * Tactical and 3D consumers must not independently infer a plausible crossing
 * from overlapping paint. This receipt records the exact source runs, crossing
 * point, orientation, and chosen traversal form once in the generated world.
 */
export interface RegionCrossing {
  id: string;
  kind: 'bridge' | 'ford';
  roadRouteId: number;
  riverId: number;
  point: [Feet, Feet];
  /** Unit vectors in region x/y coordinates. */
  roadDirection: [number, number];
  riverDirection: [number, number];
  /** Full route-aligned crossing footprint. */
  spanFt: Feet;
  widthFt: Feet;
}

export interface RegionTownSite {
  burgId: number;
  /** Canonical Atlas-owned identity; optional only for older fixtures/saves. */
  identity?: CanonicalTownIdentity;
  /** Envelope the town generator may build within (SPEC §6 pass 1). */
  envelope: BoundsFt;
  /** Route entry points on the envelope edge, feet. */
  gates: Array<[Feet, Feet]>;
}

/** A point of interest inherited from the atlas marker layer, in feet. */
export interface RegionMarker {
  type: string;
  icon: string;
  x: Feet;
  y: Feet;
}

/** A world event/danger zone the region window lies inside (or overlaps). */
export interface RegionZone {
  type: string;
  name: string;
}

export interface RegionArtifact extends WorldforgeArtifact {
  layer: 'region';
  heightfield: RegionHeightfield;
  rivers: RegionRiverBank[];
  roads: RegionRoad[];
  /** Additive for older serialized regions; current generation always emits it. */
  crossings?: RegionCrossing[];
  townSites: RegionTownSite[];
  /**
   * Markers/zones flow down from the atlas world when generateRegion gets
   * the `world` option (detail-density pass, 2026-06-11). Optional and
   * additive: schemaVersion unchanged; absent on atlas-only regions.
   */
  markers?: RegionMarker[];
  zones?: RegionZone[];
  /**
   * Member-cell biome tint sites for multi-biome blending (additive,
   * 2026-06-12): atlas cell centers in feet with their biome colors. The
   * renderer IDW-blends these so land near a biome border shades toward
   * the neighbor instead of wearing the anchor's color wall-to-wall.
   */
  biomeSites?: Array<{ x: Feet; y: Feet; color: string }>;
}

// ---------------------------------------------------------------------------
// L2 LOCAL — the playable area (replaces the submap). SPEC §4 L2.
// THE handoff artifact: 2D cartography and 3D ground both consume this.
// ---------------------------------------------------------------------------

export type TerrainMaterial =
  | 'grass' | 'dirt' | 'rock' | 'sand' | 'wetland' | 'water' | 'paved' | 'floor'
  // APPEND-ONLY (golden safety): `ice` is added at the END so every existing
  // MATERIALS index is unchanged (glacier windows, Task 10 MOUNTAINS).
  | 'ice';

export interface LocalTerrain {
  /** 5 ft cells, row-major, bounds-aligned. */
  widthCells: number;
  heightCells: number;
  /** Per-cell elevation, feet. */
  elevationFt: Float32Array;
  /** Per-cell surface material index into `materials`. */
  materialIndex: Uint8Array;
  materials: TerrainMaterial[];
}

export interface LocalFeature {
  /** Stable id within the artifact (delta layer keys off this). */
  id: number;
  kind: 'tree' | 'bush' | 'boulder' | 'water-body' | 'path' | 'poi' | 'building';
  x: Feet;
  y: Feet;
  /** Kind-specific payload; concretized as generators land. */
  data?: Record<string, unknown>;
}

export interface LocalArtifact extends WorldforgeArtifact {
  layer: 'local';
  terrain: LocalTerrain;
  features: LocalFeature[];
  /** Present when this local area contains (part of) a town. SPEC §6. */
  townPlan?: TownPlan;
}

/**
 * Town plan skeleton — pass outputs of SPEC §6. Streets/plots land with the
 * town generator; declared now so LocalArtifact's shape is honest about
 * where towns live in the hierarchy.
 */
export interface TownPlotArchitecture {
  /** Stable spatial district identity, independent of wealth or display label. */
  districtKey: string;
  /** Human-readable district name for inspectors and debug tooling. */
  districtLabel: string;
  /** Stable building identity assigned before adapter filtering. */
  buildingKey: string;
  /** Ward finish tier, present even when civic plots have no population record. */
  wealth: import('./interior/blueprintTypes').BriefWealth;
  /** Construction age from the town's radial growth rings. */
  ageBand: import('./interior/blueprintTypes').BuildingAgeBand;
  /** Resolved district recipe token shared by every building in the district. */
  districtSignature: string;
  /** Resolved individual token proving neighboring buildings are not clones. */
  buildingVariant: string;
  /** Roof silhouette factors; row ensembles repeat these at block scope. */
  pitchScale: number;
  eaveOffsetFt: number;
  /** Facade grammar shared with the blueprint and production 3D bridge. */
  facadePattern: import('./interior/blueprintTypes').FacadePattern;
  /** Physical construction kit shared with inspectors and production 3D. */
  construction: import('./interior/blueprintTypes').BuildingConstruction;
}

export interface TownPlan {
  burgId: number;
  /**
   * The exact Region-site identity represented by this plan. Current native
   * generation always supplies it; optionality preserves legacy authoring and
   * old test fixtures that predate Atlas-owned names.
   */
  identity?: CanonicalTownIdentity;
  /**
   * Organic street centerlines, feet. `colorHex` carries the street's tier tint
   * (avenue / street / lane) so the 3D bake vertex-colors each ribbon; absent =
   * default packed dirt.
   */
  streets: Array<{ id: number; centerline: Array<[Feet, Feet]>; widthFt: Feet; colorHex?: string }>;
  /**
   * Shared residential-block courts. Optional for legacy and player-authored
   * plans; canonical generated towns always provide the array.
   */
  courtyards?: Array<{
    id: string;
    blockKey: string;
    center: [Feet, Feet];
    radiusFt: Feet;
    districtKey: string;
    wealth: import('./interior/blueprintTypes').BriefWealth;
    amenity: import('./town/courtyardSpaces').CourtyardAmenity;
    courtyardSignature: string;
  }>;
  /** Building plots with role + polygon footprint (the L3/L4 contract input). */
  plots: Array<{
    id: number;
    /** Closed polygon, [x, y] feet, wound clockwise. */
    footprint: Array<[Feet, Feet]>;
    role: string;
    storeys: number;
    /** Architecture-style stamps (2026-07-01). Optional: legacy plans omit them. */
    wallColorHex?: string;
    roofColorHex?: string;
    roofForm?: 'gable' | 'hip' | 'steep' | 'flat';
    /** Durable district/building identity plus resolved dialect evidence. */
    architecture?: TownPlotArchitecture;
    /** Canonical row/courtyard/arcade membership from the town block composer. */
    ensemble?: import('./interior/blueprintTypes').BuildingEnsemble;
    /** Population-pass fields (2026-07-07, BGv2 Task 11), carried so the 3D bake
     *  can rebuild the founding household brief for each building. Present only
     *  when the town was generated with a population; absent for unpopulated
     *  towns (buildings then generate briefless, exactly as before). */
    pop?: import('./town/townEngine').TownPlotPopulation;
  }>;
}

// ---------------------------------------------------------------------------
// L3 GROUND — 3D world realization of a LocalArtifact. SPEC §4 L3/L4.
// Skeletal: concretized when the ground-mode generator lands (build item 5).
// ---------------------------------------------------------------------------

export interface GroundArtifact extends WorldforgeArtifact {
  layer: 'ground';
  /** Seed path of the LocalArtifact this realizes (parent linkage). */
  localSeedPath: SeedPath;
}

export type AnyWorldforgeArtifact =
  | AtlasArtifact
  | RegionArtifact
  | LocalArtifact
  | GroundArtifact;
