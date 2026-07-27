/**
 * @file gaits.ts — the six locomotion drivers, generalized from the blobfolk
 * prototype's hardcoded critters to any Frame.
 *
 * A driver owns the per-frame skeleton math: it advances the gait cycle,
 * emits the body's bone segments (buildBody — body v2: rigid tapered segments
 * between the IK joints, not metaballs), and maintains the Pose — the named
 * anchor transforms that modular parts attach to. Locomotion (where the
 * entity is, which way it faces, how fast it moves) comes from the caller;
 * drivers only need `speed` (and expose `verticalOffsetM` for airborne body
 * lift, applied by the assembler to the body root).
 */
import { Quaternion, Vector3 } from 'three';
import type { Anchor, Frame, Gait, PlanSpec, SegmentSink } from '../types';
export interface LocomotionState {
    position: Vector3;
    heading: Vector3;
    /** Ground speed in m/s (or air speed for flyers). */
    speed: number;
}
export interface PoseAnchor {
    pos: Vector3;
    quat: Quaternion;
}
export interface Pose {
    anchors: Record<Anchor, PoseAnchor>;
}
/** A planned head's live position + look direction (for per-socket eyes). */
export interface PlanHeadSocket {
    x: number;
    y: number;
    z: number;
    /** Head ball radius in meters. */
    r: number;
    /** Unit look direction (where the face points). */
    fx: number;
    fy: number;
    fz: number;
    eyes: {
        count: number;
        sizeScale: number;
    };
}
export interface GaitDriver {
    update(t: number, dt: number, loco: LocomotionState): void;
    /** Emit this frame's body skeleton (entity-local meters, ground at y=0):
     * tapered bone segments + round lumps (head, hands, feet). Segment ids are
     * stable across frames and radii are frame-constant per id. */
    buildBody(sink: SegmentSink): void;
    readonly pose: Pose;
    readonly gaitPhase: number;
    /** Debugger scrub: jump the gait cycle to `phase` (wrapped into 0–1). */
    setPhase(phase: number): void;
    /** Wing flap angle in radians. Flyers own the power stroke; grounded
     * gaits emit a gentle speed-scaled wing beat (harmless on wingless
     * bodies — the assembler only applies flap to parts with wingL/wingR
     * groups); hopper stays 0 (no winged hopper profiles exist). */
    readonly flap: number;
    /** Extra body lift (hopper airtime, flyer altitude), applied by the assembler. */
    readonly verticalOffsetM: number;
    /** Plan-driven bodies: live head positions for per-socket eye placement. */
    headSockets?(): PlanHeadSocket[];
}
export declare function createGaitDriver(gait: Gait, frame: Frame, planSpec?: PlanSpec, 
/** Body-level facts the driver cannot derive from a Frame. `winged`: the
 * blueprint carries wing mesh parts (garnish) — plan drivers need this to
 * beat wings that are not chain appendages. */
opts?: {
    winged?: boolean;
}): GaitDriver;
