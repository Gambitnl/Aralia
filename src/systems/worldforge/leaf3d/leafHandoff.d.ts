/**
 * @file leafHandoff.ts — SP3 leaf→3D handoff, iteration #1 (headless).
 *
 * When the recursive drill reaches a LEAF tier (the deepest submap cell), the
 * player enters the streamed 3D ground world. This module builds the deterministic
 * HANDOFF DESCRIPTOR the 3D layer consumes: the ground extent, a spawn point, and
 * the inherited payload (biome, set pieces, rivers/roads, and SP4 hidden places)
 * all re-expressed in ground-LOCAL coordinates (origin centered, y→z) so the 3D
 * world is a faithful, seamless continuation of the 2D leaf cell.
 *
 * Pure: no React/Three.js. Deterministic from the leaf's seed-path. This is the
 * hybrid "2D map ⇄ 3D at the leaf" contract from SPEC §11.
 *
 * North star: docs/projects/worldforge/subprojects/sp3-leaf-to-3d/NORTH_STAR.md
 */
import { type Pt } from '../submap/submapEngine';
import type { SubmapFeature, SubmapPolyline } from '../submap/submapEngine';
import type { SeedPath } from '../seedPath';
import { type HiddenPlaceKind } from '../discovery/hiddenPlaces';
/** A leaf submap cell + its inherited context — the input to the 3D handoff. */
export interface LeafContext {
    /** Leaf cell polygon (graph coords). */
    polygon: Pt[];
    seedPath: SeedPath;
    biome?: string;
    features?: SubmapFeature[];
    polylines?: SubmapPolyline[];
}
/** Ground-local 2D point (origin centered on the leaf; x east, z south). */
export interface GroundPoint {
    x: number;
    z: number;
}
export interface Leaf3DHandoff {
    seedPath: SeedPath;
    biome?: string;
    /** Ground extent in world units (graph units × unitScale). */
    groundExtent: {
        width: number;
        height: number;
    };
    /** Deterministic spawn point (ground-local). */
    spawn: GroundPoint;
    /** Inherited set pieces (burg/junctions) in ground-local coords. */
    setPieces: Array<{
        kind: SubmapFeature['kind'];
        name?: string;
        id?: number;
    } & GroundPoint>;
    /** Inherited rivers/roads in ground-local coords (terrain carving / road mesh). */
    paths: Array<{
        kind: SubmapPolyline['kind'];
        points: GroundPoint[];
    }>;
    /** SP4 hidden places for this leaf, ground-local (placed in 3D, revealed by proximity). */
    hidden: Array<{
        id: string;
        kind: HiddenPlaceKind;
    } & GroundPoint>;
}
export interface LeafHandoffOptions {
    /** Graph-unit → world-unit (feet) scale. Default 1. */
    unitScale?: number;
    /** Hidden-place count for this leaf. Default 6. */
    hiddenCount?: number;
}
/**
 * Build the deterministic 3D handoff descriptor for a leaf cell. All inherited
 * geometry is re-centered on the leaf and scaled to world units; the spawn lands
 * on the burg if the leaf carries one, else at the cell's interior mean.
 */
export declare function buildLeaf3DHandoff(leaf: LeafContext, opts?: LeafHandoffOptions): Leaf3DHandoff;
