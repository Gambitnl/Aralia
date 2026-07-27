/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/07/2026, 00:51:43
 * Dependents: systems/entities3d/three/assembleEntity.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file skinnedBody.ts — slice 1 of the entity skeleton pivot: the rigid-weight
 * skinned biped body. One bind-pose BufferGeometry (the same tapered cylinders
 * and joint spheres the segment renderer builds, at the same radii and
 * tessellation), each vertex owned 100% by one bone, drawn as one fill
 * SkinnedMesh plus one inverse-hull ink shell SkinnedMesh — 2 draw calls where
 * the segment body needs ~60.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-18-entity-skeleton-pivot-slice1.md
 *
 * What changed: new file — the first SkinnedMesh in the codebase. Why: rigid
 * weights reproduce the segment look exactly, de-risking the skeleton chain
 * before smooth weights (slice 3) change the look. What is preserved: the
 * segment renderer (segmentBody.ts) is untouched and remains the default via
 * bodyTech: 'segments'; eyes, shadow, and parts keep the anchor pathway.
 * Deferred: smooth joint weights (slice 3), creature skeletons (slice 4).
 * Decided (Remy 2026-07-21): deforming bodies are SOLID SHADED — there is no
 * skinned wireframe path and none is planned; wireframe remains a
 * segment-body debug look until the segment renderer dies.
 *
 * Known micro-divergence, accepted for slice 1: the segment renderer inflates
 * a unit cylinder and then scales it to length, which squashes the ink shell's
 * lengthwise inflation; this geometry is built at real length, so its shell
 * inflates uniformly. Difference is a fraction of the outline thickness and
 * only on tapered slopes — the A/B eyeball gate judges it.
 */
import { BufferGeometry, Group } from 'three';
import type { Frame, SegmentSink } from '../types';
import { buildBipedSkeleton } from './skeletonBuilder';
export interface SkinnedBodyOptions {
    colorHex: string;
    /** Inverse-hull outline thickness, meters (same value the segment body uses). */
    outlineThickness: number;
    /** Body translucency (< 1 = ghosts). Mirrors segmentBody's solid-mode handling. */
    opacity?: number;
    /** 'rigid' (default) = slice-1 segment-look pieces; 'smooth' = slice-3
     * one-piece chain tubes with joint-blended weights. */
    weights?: 'rigid' | 'smooth';
}
export interface SkinnedBody {
    /** Add this under the entity's bodyRoot (holds fill mesh, ink shell, bones). */
    readonly root: Group;
    /** Hand this to driver.buildBody() each frame (the pose adapter). */
    readonly sink: SegmentSink;
    /** Resolve this frame's emissions into bone transforms — call after buildBody. */
    finishFrame(): void;
    /** Fill + shell triangles (2 draw calls total). */
    triangles(): number;
    dispose(): void;
}
/** Bind-pose geometry for a biped frame: cylinder + two joint spheres per rest
 * segment, one sphere per rest ball — segmentBody's solid-mode shapes exactly
 * (CylinderGeometry(r1, r0, len, 10, 1); joint SphereGeometry(r·0.98, 8, 6);
 * ball SphereGeometry(r, 12, 9)). Exported for the parity tests. */
export declare function buildBipedBindGeometry(frame: Frame, skeleton: ReturnType<typeof buildBipedSkeleton>): BufferGeometry;
export declare function createSkinnedBiped(frame: Frame, options: SkinnedBodyOptions): SkinnedBody;
