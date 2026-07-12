/**
 * @file ik.ts — two-bone IK, ported from the blobfolk prototype
 * (public/blobfolk/index.html) and typed. Law-of-cosines knee placement.
 */
import { Vector3 } from 'three';

const delta = new Vector3();
const bend = new Vector3();

/**
 * Place the middle joint of a two-bone chain (hip→knee→foot).
 * Clamps to full extension when the target is out of reach.
 * `bendDir` biases which way the joint folds. Returns `out`.
 */
export function solveKnee(
  hip: Vector3,
  foot: Vector3,
  l1: number,
  l2: number,
  bendDir: Vector3,
  out: Vector3,
): Vector3 {
  delta.subVectors(foot, hip);
  let d = delta.length();
  const maxL = l1 + l2 - 1e-4;
  if (d > maxL) d = maxL;
  if (d < 1e-5) d = 1e-5;
  const dir = delta.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  bend.copy(bendDir).addScaledVector(dir, -bendDir.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1);
  bend.normalize();
  return out.copy(hip).addScaledVector(dir, a).addScaledVector(bend, h);
}

/** Smoothstep, shared by gait swing curves. */
export function smooth(s: number): number {
  return s * s * (3 - 2 * s);
}
