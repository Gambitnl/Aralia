// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 12/06/2026, 07:04:41
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DNameplates.tsx, components/World3D/World3DScene.tsx, components/World3D/createWorkerChunkLoader.ts, components/World3D/useChunkStreaming.ts, components/World3D/vegetationInstanceMatrices.ts, systems/world3d/chunkBundle.ts, systems/world3d/chunkGeometry.ts, systems/world3d/chunkManager.ts, systems/world3d/chunkSampler.ts, systems/world3d/chunkStreamer.ts, systems/world3d/chunkWorkerCore.ts, systems/world3d/coords.ts, systems/world3d/lod.ts, systems/world3d/polylineClip.ts, systems/world3d/roadGeometry.ts, systems/world3d/siteGeometry.ts, systems/world3d/vegetationScatter.ts, systems/world3d/waterGeometry.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file types.ts
 * @description Shared types for the 3D world streaming system.
 *
 * Why this is built this way:
 * - ChunkCoord simplifies coordinate math.
 * - ChunkGeometryArrays uses typed arrays (Float32Array and Uint32Array) to allow transferability,
 *   enabling zero-copy message transfers from Web Workers to the main thread.
 * - ChunkLoader provides an abstract producer interface so streaming can run in-worker or in-process (tests).
 */

// Living-interiors live clock: the baked occupant render packet references the
// occupancy resolver's plan-feet station point and the interior body shape.
// Type-only imports — erased at compile, so they add no runtime dependency.
import type { StationFeetPoint } from "../worldforge/bridge/buildingOccupancy";
import type { OccupantBody } from "../worldforge/bridge/interiorParts";

/**
 * A household member baked as a live-render packet (living-interiors slice).
 * The renderer resolves the member's position each integer game hour from
 * `stationsByHour` (plan feet, blueprint frame; null = OUT that hour) and draws
 * the parametric `body`. Present only on populated building sites — it replaces
 * the old static occupant boxes that were baked into `parts`.
 */
export interface BuildingOccupantRender {
  /** Stable per-member id: plotId * 100 + memberIndex. */
  id: number;
  /** Age band ('child' | 'adult' | 'elder'). */
  ageBand: string;
  /** Parametric body (per-person proportions + palette). */
  body: OccupantBody;
  /** stationsByHour[h] = the member's station at hour h (plan feet), or null when OUT. */
  stationsByHour: (StationFeetPoint | null)[];
}

/** Integer chunk coordinate on the chunk grid. */
export interface ChunkCoord {
  cx: number;
  cy: number;
}

/**
 * The slice of WorldData needed to build one chunk's geometry.
 * Plan 3 extends this with intersecting rivers/roads/lakes and contained sites.
 */
export interface ChunkData {
  cx: number;
  cy: number;
  /** Vertices per edge (square grid). */
  resolution: number;
  /** Sampled heights (0..100), length resolution*resolution, row-major. */
  heights: Float32Array;
  /** Per-vertex biome id, length resolution*resolution, nearest-neighbor sampled. */
  biomeIds: string[];
  /**
   * Optional per-vertex RGB biome tint (0..1), precomputed as blended samples.
   * Existing callers that only need nearest biome IDs can keep using `biomeIds`.
   */
  biomeColors?: Float32Array;
  /** River polylines clipped to this chunk (grid space). */
  rivers: ClippedPolyline[];
  /** Road polylines clipped to this chunk (grid space). */
  roads: ClippedPolyline[];
  /** Town wall rings clipped to this chunk (grid space), rendered as extruded barriers. */
  walls?: ClippedPolyline[];
  /**
   * Town dock/bridge deck quads clipped to this chunk (grid-space corners) with a
   * flat top in world-meters Y, rendered as low timber slabs over town water.
   * `kind` carries the civic role end-to-end (TG5) so the renderer can tint a
   * weathered-timber quay distinctly from a lighter bridge span — a dock and a
   * bridge must not look identical.
   */
  decks?: {
    points: { x: number; y: number }[];
    topY: number;
    kind: 'dock' | 'bridge';
    /**
     * Style-family deck detailing (styled-architecture slice): support-piling
     * spacing, edge railings, and parabolic bridge-arch rise. Absent decks
     * keep the plain flat slab.
     */
    detail?: { pilingSpacingM: number; railing: boolean; archRiseM: number };
  }[];
  /**
   * Lake polygons clipped to this chunk (grid space) with a shared flat water surface.
   * Lakes are filled meshes, not ribbons, so the builder can triangulate them directly.
   */
  lakes?: { points: { x: number; y: number }[]; surfaceY: number }[];
  /** Town road-gate gatehouse placements in this chunk (grid space), meshed by gateGeometry. */
  gatehouses?: Array<{ x: number; y: number; angleRad: number; gapHalfM: number; form: 'twinTowers' | 'tunnelBlock' | 'singleTower'; colorHex: string }>;
  /** Sites whose center falls within this chunk (grid space). */
  sites: {
    id: string;
    /**
     * The type of site. Extended to include 'monster' to support rendering
     * hostile creatures as site-like markers in 3D ground mode.
     */
    kind: 'town' | 'dungeon' | 'ruin' | 'landmark' | 'monster';
    position: { x: number; y: number };
    footprint: { x: number; y: number }[];
    walled: boolean;
    /**
     * Optional display text for HUD labels. When absent, World3D keeps the
     * older "Kind - id" fallback so existing towns and ruins read the same.
     */
    name?: string;
    /**
     * Optional per-site label distance in world meters. Roster occupants use
     * this to appear only at walking range without shrinking town labels.
     */
    labelRangeM?: number;
    population?: number;
    surfaceY: number;
    /**
     * Optional explicit building height in METERS (e.g. town-plan plots:
     * storeys Ã— 3 m). Without it the renderer keeps the kind-radius cube
     * (legacy). Added 2026-06-11 for Worldforge ground mode.
     */
    heightM?: number;
    /** Optional explicit render color (e.g. role tints from town plans). */
    colorHex?: string;
    /** Explicit role for texture/label semantics (replaces colorHex sniffing). */
    role?: string;
    /** Styled-architecture roof (absent = legacy hip + default brown). */
    roofForm?: 'gable' | 'hip' | 'steep' | 'flat';
    roofColorHex?: string;
    /** Family builds chimneys (solid-shell, non-flat roofs only). */
    chimney?: boolean;
    /**
     * Suppress the HUD nameplate for this site. Town-plan building plots
     * arrive as dozens of 'ruin' sites per settlement — labeling each one
     * buries the scene in chips, so only the town marker keeps its label.
     */
    unlabeled?: boolean;
    /**
     * Render no mesh for this site — nameplate only. At walking scale the
     * settlement's plot buildings ARE the town; the population-scaled
     * marker cube would dwarf them.
     */
    markerOnly?: boolean;
    /**
     * Seamless-interior parts (Worldforge L4): site-local boxes in METERS
     * (x along the footprint frontage, z inward from the street, y on the
     * ground). When present the renderer draws these walls/furnishings
     * instead of the solid footprint box — the building is enterable.
     */
    parts?: Array<{ x: number; z: number; w: number; d: number; h: number; colorHex: string; baseY?: number; emissiveHex?: string; tag?: string; lightRole?: 'window' | 'hearth' }>;
    /**
     * Interior wall envelope in meters (≤ plot footprint). Roofs and floor
     * slabs must size to THIS, not the footprint box — the plot is up to
     * 5 ft larger per axis (construction v2, 2026-06-12 visual review).
     */
    wallWidthM?: number;
    wallDepthM?: number;
    /**
     * Living-interiors live clock (baked once at world-gen). Length-24 schedules
     * the renderer re-resolves against the live game hour: `litHours[h]` = the
     * windows glow at hour h; `hearthHours[h]` = the hearth is lit. Present only
     * for populated plots (a resolved household); absent otherwise.
     */
    litHours?: boolean[];
    hearthHours?: boolean[];
    /** Baked occupant render packets — the family, resolved live per hour.
     *  Present only for populated plots. */
    occupants?: BuildingOccupantRender[];
    /** Interior envelope in PLAN FEET — the frame occupant stations resolve in
     *  (blueprint frame; matches litHours/occupants). Present only when occupants are. */
    interiorWidthFt?: number;
    interiorDepthFt?: number;
    /**
     * Solved roof (BGv2 Task 5): the triangulated roof planes + tower caps as
     * ONE geometry group in site-local METERS (Y up). Present only for
     * blueprint-driven buildings whose plan carried a resolved style. When set,
     * the renderer draws this mesh AND skips the legacy whole-rect roof prism.
     */
    solvedRoof?: { positions: Float32Array; indices: Uint32Array; normals: Float32Array; colorHex: string };
  }[];
}

/** Transferable geometry buffers for a chunk mesh, local to the chunk origin. */
export interface ChunkGeometryArrays {
  /** 3 floats (x,y,z) per vertex, local-space (chunk origin at 0,0). */
  positions: Float32Array;
  /** Triangle indices into positions. */
  indices: Uint32Array;
  /** 3 floats per vertex. */
  normals: Float32Array;
}

/** LOD tier for a loaded chunk, by chunk-distance from the camera. */
export type LodTier = 'full' | 'mid' | 'low' | 'culled';

/** Terrain mesh: heightfield geometry plus per-vertex RGB for biome tinting. */
export interface TerrainMesh extends ChunkGeometryArrays {
  /** 3 floats (r,g,b) per vertex, parallel to positions. */
  colors: Float32Array;
  /**
   * Per-edge skirt strips (stitched grids only). Interior seams are
   * bit-identical watertight, so a wall there can only ever rasterize as an
   * MSAA dotted-hairline artifact — the scene draws each strip ONLY while
   * that edge has no loaded neighbour (the streaming-window frontier).
   */
  skirts?: TerrainSkirts;
}

/** One skirt wall strip hanging from a chunk edge's anchor vertices. */
export interface TerrainEdgeSkirt extends ChunkGeometryArrays {
  colors: Float32Array;
}

/** The four per-edge skirt strips of a stitched terrain chunk. */
export interface TerrainSkirts {
  north: TerrainEdgeSkirt;
  east: TerrainEdgeSkirt;
  south: TerrainEdgeSkirt;
  west: TerrainEdgeSkirt;
}

/** A polyline (grid-space) clipped to a chunk, carrying per-point width in grid units. */
export interface ClippedPolyline {
  points: { x: number; y: number }[];
  /** Width in grid units, one per point (length === points.length). */
  width: number[];
  /**
   * Optional render tint. Town wall-ring runs carry their style family's
   * wallTint (styled-architecture slice) so wallGeometry can vertex-color them.
   */
  colorHex?: string;
}

/** A site contained in a chunk, with chunk-local placement for geometry. */
export interface ChunkSite {
  id: string;
  /**
   * The type of site. Extended to include 'monster' to support rendering
   * hostile creatures as site-like markers in 3D ground mode.
   */
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark' | 'monster';
  localX: number;
  localZ: number;
  /** Surface Y in world-space meters (heightToMeters applied), matching terrain exaggeration. */
  surfaceY: number;
  population?: number;
  radius: number;
  walled: boolean;
  /**
   * Optional HUD label text carried through from ChunkData. This lets ground
   * mode show a villager's roster name while older sites keep their fallback.
   */
  name?: string;
  /**
   * Optional per-site label range in world meters. It overrides only the
   * nameplate distance gate for this site, not geometry or streaming.
   */
  labelRangeM?: number;
  /**
   * Oriented-box footprint (2026-06-11, Worldforge ground mode): present
   * when the site arrived with a 4-corner footprint â€” the renderer then
   * draws a rotated boxWidth Ã— boxHeight Ã— boxDepth building instead of
   * the kind-radius cube. All meters; rotationY in radians.
   */
  colorHex?: string;
  /** Explicit role for texture/label semantics (replaces colorHex sniffing). */
  role?: string;
  /** Styled-architecture roof (absent = legacy hip + default brown). */
  roofForm?: 'gable' | 'hip' | 'steep' | 'flat';
  roofColorHex?: string;
  /** Family builds chimneys (solid-shell, non-flat roofs only). */
  chimney?: boolean;
  /** Suppress the HUD nameplate (see ChunkData.sites.unlabeled). */
  unlabeled?: boolean;
  /** Render no mesh — nameplate only (see ChunkData.sites.markerOnly). */
  markerOnly?: boolean;
  /** Seamless-interior boxes, site-local meters (see ChunkData.sites.parts). */
  parts?: Array<{ x: number; z: number; w: number; d: number; h: number; colorHex: string; baseY?: number; emissiveHex?: string; tag?: string; lightRole?: 'window' | 'hearth' }>;
  /** Interior wall envelope, meters (see ChunkData.sites.wallWidthM). */
  wallWidthM?: number;
  wallDepthM?: number;
  /** Living-interiors live clock: length-24 window-lit / hearth-lit schedules
   *  the renderer re-resolves against the live hour (see ChunkData.sites). */
  litHours?: boolean[];
  hearthHours?: boolean[];
  /** Baked occupant render packets — resolved live per hour (populated plots only). */
  occupants?: BuildingOccupantRender[];
  /** Interior envelope in PLAN FEET (blueprint frame) — occupant station frame. */
  interiorWidthFt?: number;
  interiorDepthFt?: number;
  /** Solved roof group, site-local meters (see ChunkData.sites.solvedRoof).
   *  When set, the renderer draws it and skips the legacy roof prism. */
  solvedRoof?: { positions: Float32Array; indices: Uint32Array; normals: Float32Array; colorHex: string };
  boxWidth?: number;
  boxDepth?: number;
  boxHeight?: number;
  rotationY?: number;
  /**
   * Which local-Z face of the oriented box fronts the street (+1 or −1).
   * Town-plan footprints wind oppositely on the two sides of a street, so
   * the renderer can't assume a fixed face for the door.
   */
  doorZSign?: number;
}

/** Instanced vegetation transforms for a chunk. */
export interface VegetationScatter {
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  /** Optional per-instance RGB (3 floats per instance) for color variety. */
  colors?: Float32Array;
  /**
   * Stable payload fingerprint for the chunk that produced these buffers.
   * The renderer uses this to skip rewriting instance matrices when a worker
   * hands back a fresh wrapper for the same vegetation scatter payload.
   */
  cacheKey: string;
}

/** The full set of meshes for one chunk. terrain is always present; the rest optional. */
export interface ChunkMeshBundle {
  cx: number;
  cy: number;
  terrain: TerrainMesh;
  water?: ChunkGeometryArrays;
  /**
   * Roads/streets carry per-vertex `colors` so RoadPiece renders with
   * `vertexColors`: town streets tier their tint (avenue/street/lane) while
   * inherited regional roads fall back to packed dirt — one shared material.
   */
  roads?: ChunkGeometryArrays & { colors?: Float32Array };
  /**
   * Extruded town wall-ring barriers (Worldforge Option B). Carries optional
   * per-vertex `colors` (styled-architecture slice) so each town's ramparts
   * take their style family's wall tint under one vertex-colored material.
   */
  walls?: ChunkGeometryArrays & { colors?: Float32Array };
  /**
   * Gatehouse models at town road-gate openings (styled-architecture slice),
   * vertex-tinted with the burg's wall color like `walls`.
   */
  gates?: ChunkGeometryArrays & { colors?: Float32Array };
  /**
   * Town dock/bridge deck slabs over water (Worldforge Option B). Carries
   * per-vertex `colors` (TG5) so docks and bridges read distinctly under one
   * vertex-colored material.
   */
  decks?: ChunkGeometryArrays & { colors?: Float32Array };
  sites: ChunkSite[];
  vegetation?: VegetationScatter;
  /** Second vegetation layer (ground mode): bushes, rendered as their own
   * instanced mesh so trees and bushes can differ in geometry/palette. */
  bushes?: VegetationScatter;
}

/**
 * Async producer of a chunk's full mesh bundle. Worker-backed in production,
 * inline in tests. The optional `lod` carries the requested LOD tier so the
 * loader can sample/build the chunk at the matching mesh resolution
 * (W3D-G10 / T7); loaders fall back to full resolution when it is omitted.
 */
export type ChunkLoader = (cx: number, cy: number, lod?: LodTier) => Promise<ChunkMeshBundle>;

/** A chunk currently held in memory by the streamer. */
export interface LoadedChunk {
  cx: number;
  cy: number;
  bundle: ChunkMeshBundle;
  lod: LodTier;
}

