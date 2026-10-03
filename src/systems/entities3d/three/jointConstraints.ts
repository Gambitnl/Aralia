/**
 * @file jointConstraints.ts — anatomical rotation limits for rig bones.
 *
 * A solver places a bone. A constraint then clamps that placement to a legal
 * range, so a knee cannot bend backwards and a shoulder cannot spin freely.
 * Run `enforce` AFTER the solver writes the bone, before `updateMatrixWorld`.
 *
 * Each constraint mutates a bone's LOCAL quaternion in place. It measures the
 * bone against its bind-pose local rotation (`restQuat`), which is the zero
 * position, so the limits are stated relative to rest and stay correct for any
 * rig proportions.
 *
 * The math per joint type:
 * - hinge — single-axis decomposition, wobble off every other axis is dropped.
 * - ball-and-socket — swing-twist decomposition, cone limit plus a roll limit.
 * - saddle — independent pitch and yaw limits, no roll.
 * - pivot — twist about the bone axis only.
 * - fixed — welded to rest.
 *
 * The bone axis convention is +Y along the bone, which matches
 * `skeletonBuilder.ts` and `fabrik.ts`.
 *
 * Salvaged from the retired Creature Lab prototype (`entities3d/skeleton/`),
 * retyped against the live rig. The live stack had no joint limits before this.
 */

import { Quaternion, Vector3, MathUtils, type Bone } from 'three';

/** +Y is along the bone, so twist is measured about +Y. */
const TWIST_AXIS = new Vector3(0, 1, 0);
const PITCH_AXIS = new Vector3(1, 0, 0);
const YAW_AXIS = new Vector3(0, 0, 1);

export interface JointConstraint {
  readonly type: 'hinge' | 'ball_and_socket' | 'saddle' | 'pivot' | 'fixed';
  /**
   * Clamp `localQuat` (the bone's current local rotation) to this joint's legal
   * range. `restQuat` is the bone's bind-pose local rotation. Mutates
   * `localQuat` in place.
   */
  enforce(localQuat: Quaternion, restQuat: Quaternion): void;
}

function degToRad(deg: number): number {
  return deg * MathUtils.DEG2RAD;
}

/** Wrap to (-PI, PI], then clamp. A min above max means the range wraps. */
function clampAngle(value: number, min: number, max: number): number {
  value = MathUtils.euclideanModulo(value + Math.PI, Math.PI * 2) - Math.PI;
  if (min > max) {
    if (value >= min || value <= max) return value;
    return value > 0 ? max : min;
  }
  return Math.max(min, Math.min(max, value));
}

/** Signed rotation of `quat` about `axis`. Zero when the quaternion is identity. */
function extractAxisAngle(quat: Quaternion, axis: Vector3): number {
  const angle = 2 * Math.acos(MathUtils.clamp(quat.w, -1, 1));
  const quatAxis = new Vector3(quat.x, quat.y, quat.z);
  if (quatAxis.length() < 1e-6) return 0;
  quatAxis.normalize();
  return angle * Math.sign(quatAxis.dot(axis));
}

/**
 * Pull an angle toward the middle of its range. Stiffness 0 leaves the solver
 * result alone; 1 welds the joint to mid-range. Use it for joints that resist
 * motion, such as a spine segment.
 */
function applyStiffness(angle: number, min: number, max: number, stiffness: number): number {
  if (stiffness <= 0) return angle;
  const center = (min + max) / 2;
  if (stiffness >= 1) return center;
  return MathUtils.lerp(angle, center, stiffness);
}

/** Knees, elbows, finger joints — rotation about ONE axis. */
export class HingeConstraint implements JointConstraint {
  readonly type = 'hinge' as const;
  private readonly axis: Vector3;
  private readonly minAngle: number;
  private readonly maxAngle: number;
  private readonly stiffness: number;

  constructor(axis: Vector3, minAngleDeg: number, maxAngleDeg: number, stiffness = 0) {
    this.axis = axis.clone().normalize();
    this.minAngle = degToRad(minAngleDeg);
    this.maxAngle = degToRad(maxAngleDeg);
    this.stiffness = stiffness;
  }

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    const relative = localQuat.clone().multiply(restQuat.clone().invert());
    let angle = extractAxisAngle(relative, this.axis);
    angle = clampAngle(angle, this.minAngle, this.maxAngle);
    angle = applyStiffness(angle, this.minAngle, this.maxAngle, this.stiffness);
    localQuat.copy(new Quaternion().setFromAxisAngle(this.axis, angle).multiply(restQuat));
  }
}

/** Shoulders, hips — free rotation inside a cone, plus a limited roll. */
export class BallSocketConstraint implements JointConstraint {
  readonly type = 'ball_and_socket' as const;
  private readonly coneAngle: number;
  private readonly twistMin: number;
  private readonly twistMax: number;
  private readonly stiffness: number;

  constructor(coneAngleDeg: number, twistMinDeg: number, twistMaxDeg: number, stiffness = 0) {
    this.coneAngle = degToRad(coneAngleDeg);
    this.twistMin = degToRad(twistMinDeg);
    this.twistMax = degToRad(twistMaxDeg);
    this.stiffness = stiffness;
  }

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    const relative = localQuat.clone().multiply(restQuat.clone().invert());

    // Swing-twist split: project the rotation axis onto the bone axis to get
    // the twist part, then divide it out to leave the swing part.
    const twistDot =
      relative.x * TWIST_AXIS.x + relative.y * TWIST_AXIS.y + relative.z * TWIST_AXIS.z;
    const twistQuat = new Quaternion(
      TWIST_AXIS.x * twistDot,
      TWIST_AXIS.y * twistDot,
      TWIST_AXIS.z * twistDot,
      relative.w,
    );
    if (twistQuat.lengthSq() < 1e-6) twistQuat.identity();
    else twistQuat.normalize();

    const swingQuat = relative.clone().multiply(twistQuat.clone().invert());

    const swingAngle = 2 * Math.acos(MathUtils.clamp(swingQuat.w, -1, 1));
    if (swingAngle > this.coneAngle) {
      const swingAxis = new Vector3(swingQuat.x, swingQuat.y, swingQuat.z);
      if (swingAxis.lengthSq() > 1e-6) {
        swingQuat.setFromAxisAngle(swingAxis.normalize(), this.coneAngle);
      } else {
        swingQuat.identity();
      }
    }

    let twistAngle = extractAxisAngle(twistQuat, TWIST_AXIS);
    twistAngle = clampAngle(twistAngle, this.twistMin, this.twistMax);
    twistAngle = applyStiffness(twistAngle, this.twistMin, this.twistMax, this.stiffness);
    twistQuat.setFromAxisAngle(TWIST_AXIS, twistAngle);

    localQuat.copy(swingQuat.multiply(twistQuat).multiply(restQuat));
  }
}

/** Wrists, ankles — pitch and yaw, no roll. */
export class SaddleConstraint implements JointConstraint {
  readonly type = 'saddle' as const;
  private readonly pitchMin: number;
  private readonly pitchMax: number;
  private readonly yawMin: number;
  private readonly yawMax: number;
  private readonly stiffness: number;

  constructor(pitchRangeDeg: [number, number], yawRangeDeg: [number, number], stiffness = 0) {
    this.pitchMin = degToRad(pitchRangeDeg[0]);
    this.pitchMax = degToRad(pitchRangeDeg[1]);
    this.yawMin = degToRad(yawRangeDeg[0]);
    this.yawMax = degToRad(yawRangeDeg[1]);
    this.stiffness = stiffness;
  }

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    const relative = localQuat.clone().multiply(restQuat.clone().invert());

    let pitch = clampAngle(extractAxisAngle(relative, PITCH_AXIS), this.pitchMin, this.pitchMax);
    let yaw = clampAngle(extractAxisAngle(relative, YAW_AXIS), this.yawMin, this.yawMax);
    pitch = applyStiffness(pitch, this.pitchMin, this.pitchMax, this.stiffness);
    yaw = applyStiffness(yaw, this.yawMin, this.yawMax, this.stiffness);

    const pitchQuat = new Quaternion().setFromAxisAngle(PITCH_AXIS, pitch);
    const yawQuat = new Quaternion().setFromAxisAngle(YAW_AXIS, yaw);
    localQuat.copy(pitchQuat.multiply(yawQuat).multiply(restQuat));
  }
}

/** Neck atlas, forearm pronation — twist about the bone axis only. */
export class PivotConstraint implements JointConstraint {
  readonly type = 'pivot' as const;
  private readonly twistMin: number;
  private readonly twistMax: number;
  private readonly stiffness: number;

  constructor(twistMinDeg: number, twistMaxDeg: number, stiffness = 0) {
    this.twistMin = degToRad(twistMinDeg);
    this.twistMax = degToRad(twistMaxDeg);
    this.stiffness = stiffness;
  }

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    const relative = localQuat.clone().multiply(restQuat.clone().invert());
    let twist = clampAngle(extractAxisAngle(relative, TWIST_AXIS), this.twistMin, this.twistMax);
    twist = applyStiffness(twist, this.twistMin, this.twistMax, this.stiffness);
    localQuat.copy(new Quaternion().setFromAxisAngle(TWIST_AXIS, twist).multiply(restQuat));
  }
}

/** Welded — locks the bone to its rest rotation. */
export class FixedConstraint implements JointConstraint {
  readonly type = 'fixed' as const;

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    localQuat.copy(restQuat);
  }
}

/** Declarative joint description, one variant per joint type. */
export type JointSpec =
  | { type: 'hinge'; axis?: Vector3; minDeg?: number; maxDeg?: number; stiffness?: number }
  | { type: 'ball_and_socket'; coneDeg?: number; twistDeg?: number; stiffness?: number }
  | {
      type: 'saddle';
      pitchDeg?: number | [number, number];
      yawDeg?: number | [number, number];
      stiffness?: number;
    }
  | { type: 'pivot'; twistDeg?: number; stiffness?: number }
  | { type: 'fixed' };

function toRange(v: number | [number, number] | undefined, fallback: [number, number]): [number, number] {
  if (v === undefined) return fallback;
  return typeof v === 'number' ? [-v, v] : v;
}

/** Build a constraint from a plain description. Stiffness defaults to 0 (free). */
export function createJointConstraint(spec: JointSpec): JointConstraint {
  switch (spec.type) {
    case 'hinge':
      return new HingeConstraint(
        spec.axis ?? new Vector3(-1, 0, 0),
        spec.minDeg ?? 0,
        spec.maxDeg ?? 130,
        spec.stiffness ?? 0,
      );
    case 'ball_and_socket': {
      const twist = spec.twistDeg ?? 45;
      return new BallSocketConstraint(spec.coneDeg ?? 90, -twist, twist, spec.stiffness ?? 0);
    }
    case 'saddle':
      return new SaddleConstraint(
        toRange(spec.pitchDeg, [-45, 45]),
        toRange(spec.yawDeg, [-30, 30]),
        spec.stiffness ?? 0,
      );
    case 'pivot': {
      const twist = spec.twistDeg ?? 45;
      return new PivotConstraint(-twist, twist, spec.stiffness ?? 0);
    }
    case 'fixed':
      return new FixedConstraint();
  }
}

/**
 * Clamp a whole rig in one pass. `constraints` and `restQuats` are indexed the
 * same way as `bones`, so a `BuiltSkeleton` can pass its arrays straight in.
 * Bones with no constraint are left alone.
 */
export function enforceAllConstraints(
  bones: Bone[],
  constraints: ReadonlyMap<number, JointConstraint>,
  restQuats: readonly Quaternion[],
): void {
  for (let i = 0; i < bones.length; i++) {
    const constraint = constraints.get(i);
    if (constraint && restQuats[i]) constraint.enforce(bones[i].quaternion, restQuats[i]);
  }
}
