/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:41:25
 * Dependents: systems/entities3d/three/skinnedBody.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file skeletonBuilder.ts — slice 1 of the entity skeleton pivot: a real
 * THREE.Bone hierarchy for biped frames, plus the per-frame pose adapter that
 * drives it from the gait driver's segment emissions.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-18-entity-skeleton-pivot-slice1.md
 *
 * What changed: nothing existed here before — this file introduces the first
 * skeleton in the codebase. Why: standard animation clips (slice 2, Mixamo)
 * need bones; the segment renderer has none. What is preserved: BipedDriver's
 * math is UNTOUCHED — the rest pose below mirrors its hardcoded proportions
 * (gaits.ts BipedDriver) constant for constant, and at runtime the driver's
 * own buildBody(sink) emissions drive the bones, so the skeleton can never
 * drift from the driver. Deferred: creature/plan skeletons (slice 4), smooth
 * weights (slice 3), clip playback (slice 2).
 *
 * Three parts:
 *   1. bipedRestPose(frame)      — pure data: the exact segments + balls the
 *      driver emits at rest (gaitPhase 0, speed 0 → bob 0, sway 0), each
 *      tagged with the bone that owns it. This is the bind pose.
 *   2. buildBipedSkeleton(frame) — Bone hierarchy in bind pose (17 bones).
 *   3. createBipedPoseSink(...)  — a SegmentSink the assembler hands to
 *      driver.buildBody() instead of the segment renderer; converts emitted
 *      joint positions to bone world transforms, then resolves locals
 *      parent-first. Bones are rigid (no per-frame scale): link lengths are
 *      constant in normal animation (solveKnee returns exact 0.52-limb
 *      links), and the rare IK overstretch gap hides inside joint spheres.
 */
import { Bone, Quaternion, Vector3 } from 'three';
import type { Frame, SegmentSink } from '../types';
/** The 17 biped bones, parent-first (index 0 = root). */
export declare const BIPED_BONE_NAMES: readonly ["root", "pelvis", "chest", "neck", "head", "upperArmL", "foreArmL", "handL", "upperArmR", "foreArmR", "handR", "thighL", "shinL", "footL", "thighR", "shinR", "footR"];
export type BipedBoneName = (typeof BIPED_BONE_NAMES)[number];
/** Parent of each bone (root has none). */
export declare const BIPED_BONE_PARENT: Readonly<Record<BipedBoneName, BipedBoneName | null>>;
/** Which bone owns each driver segment id (tapered cylinder pieces). */
export declare const SEGMENT_BONE: Readonly<Record<string, BipedBoneName>>;
/** Which bone owns each driver ball id (round lump pieces). */
export declare const BALL_BONE: Readonly<Record<string, BipedBoneName>>;
export interface RestSegment {
    id: string;
    bone: BipedBoneName;
    a: [number, number, number];
    b: [number, number, number];
    r0: number;
    r1: number;
}
export interface RestBall {
    id: string;
    bone: BipedBoneName;
    center: [number, number, number];
    r: number;
}
/** The bind pose as driver emissions: same ids, positions, radii, and ORDER
 * as BipedDriver.buildBody at rest — tests pin this against the real driver. */
export interface BipedRestPose {
    segments: RestSegment[];
    balls: RestBall[];
}
/**
 * The biped driver's rest pose, computed analytically. Every constant below
 * is a mirror of BipedDriver (three/gaits.ts) with gaitPhase 0 and speed 0,
 * which zero out bob, sway, stride, and arm swing. Do not "simplify" these
 * numbers — parity with the driver is the whole point, and the tests compare
 * against a live driver stepped with dt = 0.
 */
export declare function bipedRestPose(frame: Frame): BipedRestPose;
export interface BuiltSkeleton {
    /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
    root: Bone;
    /** All 17 bones, parent-first, in BIPED_BONE_NAMES order. */
    bones: Bone[];
    /** Bone index by name — skin indices and the pose sink both use this. */
    index: ReadonlyMap<BipedBoneName, number>;
    /** The bind pose the bones were placed from (shared with skinnedBody). */
    restPose: BipedRestPose;
    /** Bind world transform per bone (entity-local), kept for the pose sink. */
    bindWorldPos: Vector3[];
    bindWorldQuat: Quaternion[];
}
/** Frame in, bone hierarchy out — pure (no scene, no renderer). */
export declare function buildBipedSkeleton(frame: Frame): BuiltSkeleton;
export interface BipedPoseSink {
    /** Hand this to driver.buildBody() each frame instead of the segment renderer's sink. */
    sink: SegmentSink;
    /** Resolve the received world transforms into local bone transforms (parents first). */
    finishFrame(): void;
}
/**
 * The pose adapter: driver joint positions in, bone transforms out. Each
 * seg(id, …) sets the owning bone's world position to the A joint and its
 * world orientation to +Y-along-the-segment — the identical rule the segment
 * renderer applies to its nodes — and each ball(id, …) sets position only.
 * finishFrame() converts those world targets to local bone transforms down
 * the hierarchy. Unknown ids throw: if a driver ever emits something new,
 * this fails loudly instead of silently dropping body parts.
 */
export declare function createBipedPoseSink(skeleton: BuiltSkeleton): BipedPoseSink;
