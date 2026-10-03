/**
 * @file fabrik.ts — FABRIK inverse kinematics for chains of 3 or more bones.
 *
 * `ik.ts` solves a 2-bone chain (hip → knee → foot) with the law of cosines.
 * That closed form does not extend past two bones. FABRIK (Forward And
 * Backward Reaching Inverse Kinematics) handles the long chains the closed form
 * cannot: spines, necks, tails, tentacles, and wings.
 *
 * FABRIK is iterative and positional. Each pass:
 * 1. Backward — pin the tip to the target, then walk to the root, keeping every
 *    segment at its original length.
 * 2. Forward — pin the root back to its true position, then walk to the tip,
 *    again keeping every segment length.
 * The chain converges toward the target in a few passes, or stops early once
 * the tip is inside `tolerance`.
 *
 * Only then are the joint positions turned back into bone rotations, with the
 * same +Y-along-the-bone convention `skeletonBuilder.ts` uses. Constraints from
 * `jointConstraints.ts` are applied per bone as the rotations are written.
 *
 * Salvaged from the retired Creature Lab prototype (`entities3d/skeleton/`),
 * retyped against the live rig. The live stack had no chain solver before this.
 */

import { Vector3, Quaternion, type Bone, type Object3D } from 'three';
import type { JointConstraint } from './jointConstraints';

const EPSILON = 1e-6;
const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_TOLERANCE = 0.001;

/** Bones are oriented +Y along their own length, as `skeletonBuilder` binds them. */
const BONE_AXIS = new Vector3(0, 1, 0);
/** A joint limit measures against "straight", so its rest rotation is identity. */
const IDENTITY = new Quaternion();

export interface FabrikChain {
  /**
   * The chain, root first, each bone the parent of the next. The last entry is
   * the tip, and its position is what reaches the target — the tip itself is
   * never rotated by the solver.
   */
  bones: Bone[];
  /** Optional per-bone limit, indexed like `bones`. Use null for a free bone. */
  constraints?: readonly (JointConstraint | null | undefined)[];
  /** Bind-pose local rotations, indexed like `bones`. Required with `constraints`. */
  restQuats?: readonly Quaternion[];
}

export interface FabrikOptions {
  maxIterations?: number;
  /** Stop once the tip is within this distance of the target, in meters. */
  tolerance?: number;
  /**
   * Per-joint bend limit, indexed by the joint the link leaves from. Entry `j`
   * limits how far link `j` may turn away from link `j - 1`, so entry 0 is
   * never used (the root link has nothing to turn away from).
   *
   * Each limit is measured in a frame where +Y lies along the incoming link and
   * the rest rotation is identity, which means "straight". A hinge therefore
   * reads as a knee, and a ball-and-socket cone reads as a maximum kink.
   */
  jointLimits?: readonly (JointConstraint | null | undefined)[];
}

function safeNormalize(v: Vector3): Vector3 {
  const len = v.length();
  if (len < EPSILON) return new Vector3(0, 1, 0);
  return v.divideScalar(len);
}

function worldQuaternionOf(node: Object3D | null): Quaternion {
  const q = new Quaternion();
  if (node) node.getWorldQuaternion(q);
  return q;
}

/**
 * Rotate `vFrom` onto `vTo`. Three's own `setFromUnitVectors` degenerates when
 * the two vectors are anti-parallel, so pick a perpendicular axis by hand in
 * that case. Both inputs must already be unit length.
 */
function quatFromUnitVectors(vFrom: Vector3, vTo: Vector3): Quaternion {
  const q = new Quaternion();
  if (vFrom.dot(vTo) + 1 < EPSILON) {
    if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) q.set(-vFrom.y, vFrom.x, 0, 0).normalize();
    else q.set(0, -vFrom.z, vFrom.y, 0).normalize();
    return q;
  }
  return q.setFromUnitVectors(vFrom, vTo);
}

/**
 * Apply a joint limit to the link that leaves `points[j]`, then rewrite
 * `points[j + 1]`. The limit is evaluated in a frame where +Y lies along the
 * incoming link, which is the convention `jointConstraints.ts` documents.
 */
function limitJoint(
  points: Vector3[],
  lengths: readonly number[],
  j: number,
  limit: JointConstraint,
): void {
  const incoming = safeNormalize(points[j].clone().sub(points[j - 1]));
  const outgoing = safeNormalize(points[j + 1].clone().sub(points[j]));

  // Rotate the world so the incoming link points along +Y, clamp there, rotate back.
  const toLocal = quatFromUnitVectors(incoming, BONE_AXIS);
  const outLocal = outgoing.clone().applyQuaternion(toLocal);
  const jointQuat = quatFromUnitVectors(BONE_AXIS, outLocal);

  limit.enforce(jointQuat, IDENTITY);

  const clamped = BONE_AXIS.clone()
    .applyQuaternion(jointQuat)
    .applyQuaternion(toLocal.invert());
  points[j + 1].copy(points[j]).addScaledVector(safeNormalize(clamped), lengths[j]);
}

/**
 * The positional core: reach `target` with the last point, keeping every
 * segment at the length given in `lengths`. `points` is mutated in place, and
 * `points[0]` never moves. Returns the remaining tip error in meters.
 *
 * Use this when a caller works in joint positions rather than bones, which is
 * how the plan driver poses limbs.
 */
export function solveFabrikPoints(
  points: Vector3[],
  lengths: readonly number[],
  target: Vector3,
  options: FabrikOptions = {},
): number {
  const last = points.length - 1;
  if (last < 1 || lengths.length < last) return Infinity;
  // A zero-length segment has no direction to solve for, so the chain is unusable.
  for (let i = 0; i < last; i++) if (lengths[i] < EPSILON) return Infinity;

  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const jointLimits = options.jointLimits;
  const rootPos = points[0].clone();

  let tipError = Infinity;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Backward pass — tip to the target, root drifts.
    points[last].copy(target);
    for (let i = last - 1; i >= 0; i--) {
      const dir = safeNormalize(points[i].clone().sub(points[i + 1]));
      points[i].copy(points[i + 1]).addScaledVector(dir, lengths[i]);
    }

    // Forward pass — root back where it belongs, tip drifts toward the target.
    points[0].copy(rootPos);
    for (let i = 0; i < last; i++) {
      const dir = safeNormalize(points[i + 1].clone().sub(points[i]));
      points[i + 1].copy(points[i]).addScaledVector(dir, lengths[i]);
      // Clamp the joint we just left, once it has an incoming link to measure.
      const limit = i > 0 ? jointLimits?.[i] : null;
      if (limit) limitJoint(points, lengths, i, limit);
    }

    tipError = points[last].distanceTo(target);
    if (tipError < tolerance) break;
  }

  return tipError;
}

/**
 * Reach `targetPos` (world space) with the tip of `chain`, then write the
 * result back as bone rotations. Returns the remaining tip error in meters, so
 * a caller can tell a real reach from an out-of-range stretch.
 *
 * The chain root does not move. A target beyond total chain length leaves the
 * chain fully extended toward it.
 */
export function solveFabrik(
  chain: FabrikChain,
  targetPos: Vector3,
  options: FabrikOptions = {},
): number {
  const { bones, constraints, restQuats } = chain;
  if (bones.length < 2) return Infinity;

  const positions = bones.map((bone) => bone.getWorldPosition(new Vector3()));
  const last = positions.length - 1;

  const lengths: number[] = [];
  for (let i = 0; i < last; i++) lengths.push(positions[i].distanceTo(positions[i + 1]));

  const tipError = solveFabrikPoints(positions, lengths, targetPos, options);
  if (!Number.isFinite(tipError)) return Infinity;

  // Positions back to rotations, parent first — each bone must have its final
  // world transform before its child reads the parent's world quaternion.
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    if (i < last) {
      const direction = safeNormalize(positions[i + 1].clone().sub(positions[i]));
      const worldQuat = quatFromUnitVectors(BONE_AXIS, direction);
      const parentWorldQuat = worldQuaternionOf(bone.parent);
      bone.quaternion.copy(parentWorldQuat.invert().multiply(worldQuat));
    }

    const constraint = constraints?.[i];
    const restQuat = restQuats?.[i];
    if (constraint && restQuat) constraint.enforce(bone.quaternion, restQuat);

    bone.updateMatrixWorld(true);
  }

  return tipError;
}

/**
 * Build a `FabrikChain` from a `BuiltSkeleton`-style rig by bone index. The
 * indices must be root first and form an unbroken parent chain.
 */
export function fabrikChainFromIndices(
  bones: Bone[],
  indices: readonly number[],
  constraints?: ReadonlyMap<number, JointConstraint>,
  restQuats?: readonly Quaternion[],
): FabrikChain {
  return {
    bones: indices.map((i) => bones[i]),
    constraints: constraints ? indices.map((i) => constraints.get(i) ?? null) : undefined,
    restQuats: restQuats ? indices.map((i) => restQuats[i]) : undefined,
  };
}
