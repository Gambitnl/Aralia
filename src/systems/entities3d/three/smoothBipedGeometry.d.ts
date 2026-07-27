/**
 * @file smoothBipedGeometry.ts — slice 3 of the entity skeleton pivot: the
 * one-piece smooth biped. Each bone chain (torso column, each arm, each leg)
 * lofts as ONE continuous tube whose vertices blend between the two adjacent
 * bones across a smoothstep zone at every interior joint — elbows and knees
 * crease instead of shearing apart. Terminal pieces (head, hands, feet) stay
 * rigid spheres, merged into the same geometry.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-23-skeleton-smooth-bodies.md
 *
 * What changed: new file. Why: rigid weights (slice 1) reproduce the segment
 * look; the smooth look needs different geometry AND weights, kept behind
 * skinnedBody's `weights: 'smooth'` option until the eyeball gate passes.
 * Winding guard: each closed tube's signed volume is measured after build and
 * the index order flipped if negative — the Emberwing inside-out lesson as
 * code, not vigilance.
 */
import { BufferGeometry } from 'three';
import type { BipedBoneName, BipedRestPose } from './skeletonBuilder';
export interface ChainDef {
    /** Rest segment ids in root→tip order; segment k is owned by its own bone. */
    segIds: string[];
}
/** The five chains of the smooth biped, in build order. */
export declare const SMOOTH_CHAINS: readonly ChainDef[];
export declare function buildSmoothBipedGeometry(restPose: BipedRestPose, boneIndex: ReadonlyMap<BipedBoneName, number>): BufferGeometry;
