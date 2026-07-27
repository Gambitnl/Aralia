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
import { type Pt } from '../submap/submapEngine';
import type { GroundPoint } from './leafHandoff';
export interface LeafAtlasAnchor {
    /** Leaf bounds center in atlas graph coords (the ground-local origin). */
    atlasCenter: Pt;
    /** Ground world-units per atlas graph unit (matches the handoff unitScale). */
    unitScale: number;
}
/** Build the anchor from a leaf cell polygon (atlas graph coords). */
export declare function leafAtlasAnchor(leafPolygon: Pt[], unitScale?: number): LeafAtlasAnchor;
/** Ground-local meters → atlas graph coords (inverse of the handoff mapping). */
export declare function groundToAtlas(anchor: LeafAtlasAnchor, p: GroundPoint): Pt;
/** Atlas graph coords → ground-local meters (matches the handoff mapping). */
export declare function atlasToGround(anchor: LeafAtlasAnchor, p: Pt): GroundPoint;
