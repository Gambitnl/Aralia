/**
 * @file ik.ts — two-bone IK, ported from the blobfolk prototype
 * (public/blobfolk/index.html) and typed. Law-of-cosines knee placement.
 */
import { Vector3 } from 'three';
/**
 * Place the middle joint of a two-bone chain (hip→knee→foot).
 * Clamps to full extension when the target is out of reach.
 * `bendDir` biases which way the joint folds. Returns `out`.
 */
export declare function solveKnee(hip: Vector3, foot: Vector3, l1: number, l2: number, bendDir: Vector3, out: Vector3): Vector3;
/** Smoothstep, shared by gait swing curves. */
export declare function smooth(s: number): number;
