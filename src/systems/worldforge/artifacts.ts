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
  kind: 'road' | 'trail' | 'searoute';
}

export interface AtlasArtifact extends WorldforgeArtifact {
  layer: 'atlas';
  cells: AtlasCell[];
  burgs: AtlasBurg[];
  rivers: AtlasRiver[];
  routes: AtlasRoute[];
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
  kind: 'road' | 'trail';
}

export interface RegionTownSite {
  burgId: number;
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
  | 'grass' | 'dirt' | 'rock' | 'sand' | 'wetland' | 'water' | 'paved' | 'floor';

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
export interface TownPlan {
  burgId: number;
  /**
   * Organic street centerlines, feet. `colorHex` carries the street's tier tint
   * (avenue / street / lane) so the 3D bake vertex-colors each ribbon; absent =
   * default packed dirt.
   */
  streets: Array<{ id: number; centerline: Array<[Feet, Feet]>; widthFt: Feet; colorHex?: string }>;
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
