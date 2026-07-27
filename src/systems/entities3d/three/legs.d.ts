/**
 * @file legs.ts — treadmill leg for externally driven locomotion.
 *
 * The blobfolk prototype pinned feet in WORLD space along its own fixed
 * path. Game entities are moved by outside systems, so legs here run in
 * LOCAL space instead: while a foot is in stance it slides backward at
 * ground speed (which reads as world-pinned once the body moves forward),
 * and in swing it arcs to the next plant. Standing still, stride collapses
 * to zero and feet rest under the hips.
 */
import { Vector3 } from 'three';
export interface LegOptions {
    /** Fraction of the cycle spent planted. */
    duty?: number;
    /** Peak swing lift in meters. */
    liftH?: number;
}
export declare class TreadmillLeg {
    private readonly restX;
    private readonly restZ;
    private readonly phaseOffset;
    readonly pos: Vector3;
    private readonly duty;
    private readonly liftH;
    constructor(restX: number, restZ: number, phaseOffset: number, opts?: LegOptions);
    /** Advance to the given gait phase. `strideHalfM` = half stride length. */
    update(gaitPhase: number, strideHalfM: number): void;
}
