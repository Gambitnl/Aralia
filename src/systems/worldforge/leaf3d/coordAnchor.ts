/**
 * @file coordAnchor.ts — SP3 leaf↔atlas coordinate anchor.
 *
 * `buildLeaf3DHandoff` re-centers a leaf cell's geometry on its bounds and scales
 * to world units: ground = (atlasGraph − leafCenter) × unitScale (with y→z). This
 * module is the inverse/bridge: given a leaf's atlas footprint, convert any point
 * between GROUND-local meters and ATLAS graph coords. It is the keystone both SP4
 * (pin a discovered ground site back on the atlas) and SP3 (report the leaf's
 * atlas position) depend on.
 *
 * Pure: no React/Three.js. The anchor is data derived once per leaf entry.
 */
import { polygonBounds, type Pt } from '../submap/submapEngine';
import type { GroundPoint } from './leafHandoff';

export interface LeafAtlasAnchor {
  /** Leaf bounds center in atlas graph coords (the ground-local origin). */
  atlasCenter: Pt;
  /** Ground world-units per atlas graph unit (matches the handoff unitScale). */
  unitScale: number;
}

/** Build the anchor from a leaf cell polygon (atlas graph coords). */
export function leafAtlasAnchor(leafPolygon: Pt[], unitScale = 1): LeafAtlasAnchor {
  const b = polygonBounds(leafPolygon);
  return {
    atlasCenter: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2],
    unitScale: unitScale || 1,
  };
}

/** Ground-local meters → atlas graph coords (inverse of the handoff mapping). */
export function groundToAtlas(anchor: LeafAtlasAnchor, p: GroundPoint): Pt {
  return [
    anchor.atlasCenter[0] + p.x / anchor.unitScale,
    anchor.atlasCenter[1] + p.z / anchor.unitScale,
  ];
}

/** Atlas graph coords → ground-local meters (matches the handoff mapping). */
export function atlasToGround(anchor: LeafAtlasAnchor, p: Pt): GroundPoint {
  return {
    x: (p[0] - anchor.atlasCenter[0]) * anchor.unitScale,
    z: (p[1] - anchor.atlasCenter[1]) * anchor.unitScale,
  };
}
