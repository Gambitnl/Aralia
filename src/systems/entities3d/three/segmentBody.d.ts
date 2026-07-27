/**
 * @file segmentBody.ts — the body v2 renderer: one rigid mesh per skeleton
 * segment, re-transformed every frame.
 *
 * Drivers (and chain parts) write segments/balls into the sink each frame.
 * The first time an id appears its geometry is built (radii are
 * frame-constant per id by contract); afterwards only position, orientation,
 * and length change — no geometry work at runtime, which is what makes this
 * strictly cheaper than the old metaball field.
 *
 * Looks:
 *  - solid: shared toon material + an inverse-hull ink outline per node;
 *    joint spheres round the elbows/knees (mannequin style).
 *  - wireframe: LineSegments over EdgesGeometry per node — clean edge lines,
 *    no fill, no joint spheres (lines read connected without them).
 */
import { Group, Object3D } from 'three';
import type { SegmentSink } from '../types';
import { type EntityRenderMode } from './toon';
export interface SegmentBodyOptions {
    renderMode: EntityRenderMode;
    colorHex: string;
    /** Countershaded underside for swept tubes (plan-driven bodies); omitted =
     * uniform colorHex everywhere. Solid mode only. */
    bellyHex?: string;
    /** Energy rings and other glow accents render in this color, unlit. */
    accentHex?: string;
    /** Inverse-hull outline thickness (solid mode), meters. */
    outlineThickness: number;
    /** Body translucency (< 1 = ghosts, oozes). Solid mode only; wireframe ignores. */
    opacity?: number;
}
export interface SegmentBody {
    readonly root: Group;
    readonly sink: SegmentSink;
    /** Mark all cached nodes unseen; call before the frame's sink writes. */
    beginFrame(): void;
    /** Hide nodes that were not written this frame (chains can shrink). */
    finishFrame(): void;
    segmentCount(): number;
    triangles(): number;
    dispose(): void;
}
export declare function createSegmentBody(options: SegmentBodyOptions): SegmentBody;
/** Convert a mesh-part object to clean edge lines in place (wireframe mode).
 * Every Mesh is replaced by LineSegments over its EdgesGeometry, colored from
 * the mesh's material, preserving transforms and group structure (wing groups
 * keep their names, so flap animation still works). */
export declare function wireframeifyPart(object: Object3D): void;
