// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 19/06/2026, 00:45:39
 * Dependents: components/World3D/InWorldHUD.tsx, components/World3D/World3DMinimap.tsx, components/World3D/World3DWrapper.tsx, components/World3D/chunkWorker.ts, components/World3D/createWorkerChunkLoader.ts, services/azgaarDerivedMapService.ts, services/worldSim/biomeZones.ts, services/worldSim/coastlinesAndLakes.ts, services/worldSim/index.ts, services/worldSim/marchingSquares.ts, services/worldSim/rivers.ts, services/worldSim/roads.ts, services/worldSim/sites.ts, systems/world3d/chunkSampler.ts, systems/world3d/chunkWorkerCore.ts, systems/world3d/coords.ts, systems/worldforge/bridge/groundWorldAdapter.ts, types/index.ts, types/world.ts, utils/mapDataToWorldData.ts, utils/world/worldGeographyAdapter.ts, utils/worldCoords.ts
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
 * Type definitions for the world-sim pipeline output (WorldData) and its artifacts.
 *
 * WorldData is produced once per worldSeed at world creation and persisted in the save.
 * Both the 2D Azgaar atlas and the future 3D streamed world read from this single source.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type Polygon = Vec2[];

export interface River {
  id: string;
  /** Polyline vertices, ordered source → mouth, in grid coords. */
  points: Vec2[];
  /**
   * Width at each polyline point (length === points.length).
   * The value at index i is the river width at points[i]; the last
   * entry duplicates the second-to-last because no segment starts at
   * the mouth.
   */
  width: number[];
  /**
   * Flow volume at each polyline point (length === points.length).
   * Same indexing convention as `width`. Used by water shader strength
   * and audio gating.
   */
  discharge: number[];
  /** Parent river id if this is a tributary. */
  parentId?: string;
}

export interface Road {
  id: string;
  points: Vec2[];
  type: 'major' | 'minor' | 'trail';
  fromSiteId: string;
  toSiteId: string;
}

export interface Site {
  id: string;
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
  position: Vec2;
  footprint: Polygon;
  population?: number;
  walled?: boolean;
  townSeed?: number;
}

export interface BiomeZone {
  biomeId: string;
  polygon: Polygon;
}

// ============================================================================
// Canonical Feature Hints
// ============================================================================
// This section carries feature truth from the atlas generator into WorldData.
// The generated polylines below still exist for current render/runtime behavior,
// but these hints record which upstream feature source should be trusted when
// later bridge work reconciles rivers, roads, and sites.
// ============================================================================

export interface WorldFeatureSiteHint {
  id: string;
  kind: Site['kind'];
  position: Vec2;
}

export interface WorldFeatureRoadHint {
  id: string;
  points: Vec2[];
  type: Road['type'];
}

export interface WorldFeatureHints {
  source: 'azgaar';
  /** Per-cell river mask from the canonical Azgaar atlas layer. */
  rivers: boolean[];
  /** Canonical site hints; empty until the Azgaar producer emits richer site data. */
  sites: WorldFeatureSiteHint[];
  /** Canonical road hints; empty until the Azgaar producer emits richer road data. */
  roads: WorldFeatureRoadHint[];
}

export interface WorldData {
  version: 2;
  seed: number;
  templateId: string;
  gridSize: { rows: number; cols: number };

  // Per-cell scalars (mirror of existing azgaarWorld layers)
  heights: number[];
  temperatures: number[];
  moisture: number[];
  biomeIds: string[];

  // Polyline networks
  rivers: River[];
  roads: Road[];

  // Site placements
  sites: Site[];

  // Canonical feature hints
  featureHints?: WorldFeatureHints;

  // Polygons
  coastlines: Polygon[];
  lakes: Polygon[];
  biomeZones: BiomeZone[];
}
