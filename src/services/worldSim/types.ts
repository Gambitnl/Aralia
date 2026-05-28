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

  // Polygons
  coastlines: Polygon[];
  lakes: Polygon[];
  biomeZones: BiomeZone[];
}
