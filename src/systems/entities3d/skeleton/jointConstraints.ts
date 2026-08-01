/**
 * @file jointConstraints.ts — Joint constraint enforcement system for procedural creature skeletons.
 *
 * This module runs AFTER IK solving to clamp bone rotations to anatomically valid ranges.
 * Each constraint type models a different joint articulation (hinge, ball-and-socket,
 * saddle, pivot, fixed) and provides an `enforce` method that mutates a bone's local
 * quaternion in-place to bring it within legal rotation limits.
 *
 * Mathematical mechanisms:
 * - Swing-twist decomposition for ball-and-socket joints (cone angle + roll clamp)
 * - Single-axis decomposition for hinge and pivot joints (zeroes out wobble)
 * - Independent pitch/yaw decomposition for saddle joints
 * - Stiffness damping towards neutral pose
 */

import { Quaternion, Vector3, Bone, MathUtils } from 'three';

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

export interface JointConstraint {
  readonly type: 'hinge' | 'ball_and_socket' | 'saddle' | 'pivot' | 'fixed';
  /** Clamp localQuat (the bone's current local rotation) to the legal range
   *  defined by this constraint. restQuat is the bone's bind-pose local rotation
   *  (the "zero" position). Mutates localQuat in-place. */
  enforce(localQuat: Quaternion, restQuat: Quaternion): void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function degToRad(deg: number): number {
  return deg * MathUtils.DEG2RAD;
}

function clampAngle(value: number, min: number, max: number): number {
  value = MathUtils.euclideanModulo(value + Math.PI, Math.PI * 2) - Math.PI;
  if (min > max) {
    if (value >= min || value <= max) {
      return value;
    }
    return (value > 0) ? max : min;
  }
  return Math.max(min, Math.min(max, value));
}

function extractAxisAngle(quat: Quaternion, axis: Vector3): number {
  const angle = 2 * Math.acos(MathUtils.clamp(quat.w, -1, 1));
  const quatAxis = new Vector3(quat.x, quat.y, quat.z);
  const quatAxisLen = quatAxis.length();
  
  if (quatAxisLen < 1e-6) {
    return 0;
  }
  
  quatAxis.normalize();
  const dot = quatAxis.dot(axis);
  return angle * Math.sign(dot);
}

function applyStiffness(angle: number, min: number, max: number, stiffness: number): number {
  if (stiffness <= 0) return angle;
  if (stiffness >= 1) return (min + max) / 2;
  const center = (min + max) / 2;
  return MathUtils.lerp(angle, center, stiffness);
}

// ============================================================================
// HINGE CONSTRAINT
// ============================================================================

/**
 * Models knees, elbows, finger joints — rotation around ONE axis only.
 */
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
    const relativeQuat = localQuat.clone().multiply(restQuat.clone().invert());
    let angle = extractAxisAngle(relativeQuat, this.axis);
    angle = clampAngle(angle, this.minAngle, this.maxAngle);
    angle = applyStiffness(angle, this.minAngle, this.maxAngle, this.stiffness);
    const clampedQuat = new Quaternion().setFromAxisAngle(this.axis, angle);
    localQuat.copy(clampedQuat.multiply(restQuat));
  }
}

// ============================================================================
// BALL AND SOCKET CONSTRAINT
// ============================================================================

/**
 * Models shoulders, hips — full rotation within a cone + limited twist.
 * Uses swing-twist decomposition.
 */
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
    const relativeQuat = localQuat.clone().multiply(restQuat.clone().invert());
    const twistAxis = new Vector3(0, 1, 0);
    
    const twistDot = relativeQuat.x * twistAxis.x + relativeQuat.y * twistAxis.y + relativeQuat.z * twistAxis.z;
    const twistQuat = new Quaternion(
      twistAxis.x * twistDot,
      twistAxis.y * twistDot,
      twistAxis.z * twistDot,
      relativeQuat.w
    );
    
    if (twistQuat.lengthSq() < 1e-6) {
      twistQuat.identity();
    } else {
      twistQuat.normalize();
    }
    
    const swingQuat = relativeQuat.clone().multiply(twistQuat.clone().invert());
    
    let swingAngle = 2 * Math.acos(MathUtils.clamp(swingQuat.w, -1, 1));
    if (swingAngle > this.coneAngle) {
      const swingAxis = new Vector3(swingQuat.x, swingQuat.y, swingQuat.z);
      if (swingAxis.lengthSq() > 1e-6) {
        swingAxis.normalize();
        swingAngle = this.coneAngle;
        swingQuat.setFromAxisAngle(swingAxis, swingAngle);
      } else {
        swingQuat.identity();
      }
    }
    
    let twistAngle = extractAxisAngle(twistQuat, twistAxis);
    twistAngle = clampAngle(twistAngle, this.twistMin, this.twistMax);
    twistAngle = applyStiffness(twistAngle, this.twistMin, this.twistMax, this.stiffness);
    twistQuat.setFromAxisAngle(twistAxis, twistAngle);
    
    const clampedQuat = swingQuat.multiply(twistQuat);
    localQuat.copy(clampedQuat.multiply(restQuat));
  }
}

// ============================================================================
// SADDLE CONSTRAINT
// ============================================================================

/**
 * Models wrists, ankles — 2 degrees of freedom (pitch and yaw), no roll.
 */
export class SaddleConstraint implements JointConstraint {
  readonly type = 'saddle' as const;
  private readonly pitchMin: number;
  private readonly pitchMax: number;
  private readonly yawMin: number;
  private readonly yawMax: number;
  private readonly stiffness: number;

  constructor(
    pitchRangeDeg: [number, number],
    yawRangeDeg: [number, number],
    stiffness = 0
  ) {
    this.pitchMin = degToRad(pitchRangeDeg[0]);
    this.pitchMax = degToRad(pitchRangeDeg[1]);
    this.yawMin = degToRad(yawRangeDeg[0]);
    this.yawMax = degToRad(yawRangeDeg[1]);
    this.stiffness = stiffness;
  }

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    const relativeQuat = localQuat.clone().multiply(restQuat.clone().invert());
    const pitchAxis = new Vector3(1, 0, 0);
    const yawAxis = new Vector3(0, 0, 1);
    
    let pitch = extractAxisAngle(relativeQuat, pitchAxis);
    let yaw = extractAxisAngle(relativeQuat, yawAxis);
    
    pitch = clampAngle(pitch, this.pitchMin, this.pitchMax);
    yaw = clampAngle(yaw, this.yawMin, this.yawMax);
    
    pitch = applyStiffness(pitch, this.pitchMin, this.pitchMax, this.stiffness);
    yaw = applyStiffness(yaw, this.yawMin, this.yawMax, this.stiffness);
    
    const pitchQuat = new Quaternion().setFromAxisAngle(pitchAxis, pitch);
    const yawQuat = new Quaternion().setFromAxisAngle(yawAxis, yaw);
    
    const clampedQuat = pitchQuat.multiply(yawQuat);
    localQuat.copy(clampedQuat.multiply(restQuat));
  }
}

// ============================================================================
// PIVOT CONSTRAINT
// ============================================================================

/**
 * Models neck atlas, forearm pronation — twist around bone axis only.
 */
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
    const relativeQuat = localQuat.clone().multiply(restQuat.clone().invert());
    const twistAxis = new Vector3(0, 1, 0);
    
    let twist = extractAxisAngle(relativeQuat, twistAxis);
    twist = clampAngle(twist, this.twistMin, this.twistMax);
    twist = applyStiffness(twist, this.twistMin, this.twistMax, this.stiffness);
    
    const clampedQuat = new Quaternion().setFromAxisAngle(twistAxis, twist);
    localQuat.copy(clampedQuat.multiply(restQuat));
  }
}

// ============================================================================
// FIXED CONSTRAINT
// ============================================================================

/**
 * Welded joint — locks bone strictly to its rest rotation.
 */
export class FixedConstraint implements JointConstraint {
  readonly type = 'fixed' as const;

  enforce(localQuat: Quaternion, restQuat: Quaternion): void {
    localQuat.copy(restQuat);
  }
}

// ============================================================================
// FACTORY AND BATCH ENFORCEMENT
// ============================================================================

export function createConstraintFromGenome(jointDef: {
  type: 'hinge' | 'ball_and_socket' | 'saddle' | 'pivot' | 'fixed';
  minDegrees?: [number, number, number] | number;
  maxDegrees?: [number, number, number] | number;
  axis?: 'forward' | 'backward';
  coneAngle?: number;
  twistLimit?: number;
  pitchRange?: number | [number, number];
  yawRange?: number | [number, number];
  twistRange?: number;
  stiffness?: number;
}): JointConstraint {
  const stiffness = jointDef.stiffness ?? 0.5;

  switch (jointDef.type) {
    case 'hinge': {
      const axis = jointDef.axis === 'backward' ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
      const minAngle = typeof jointDef.minDegrees === 'number' ? jointDef.minDegrees : 0;
      const maxAngle = typeof jointDef.maxDegrees === 'number' ? jointDef.maxDegrees : 130;
      return new HingeConstraint(axis, minAngle, maxAngle, stiffness);
    }
    case 'ball_and_socket': {
      const cone = jointDef.coneAngle ?? 90;
      const twist = jointDef.twistLimit ?? 45;
      return new BallSocketConstraint(cone, -twist, twist, stiffness);
    }
    case 'saddle': {
      const pitch: [number, number] = typeof jointDef.pitchRange === 'number'
        ? [-jointDef.pitchRange, jointDef.pitchRange]
        : jointDef.pitchRange ?? [-45, 45];
      const yaw: [number, number] = typeof jointDef.yawRange === 'number'
        ? [-jointDef.yawRange, jointDef.yawRange]
        : jointDef.yawRange ?? [-30, 30];
      return new SaddleConstraint(pitch, yaw, stiffness);
    }
    case 'pivot': {
      const twist = jointDef.twistRange ?? 45;
      return new PivotConstraint(-twist, twist, stiffness);
    }
    case 'fixed':
    default:
      return new FixedConstraint();
  }
}

export function enforceAllConstraints(
  bones: Bone[],
  constraints: Map<number, JointConstraint>,
  restQuats: Quaternion[]
): void {
  for (let i = 0; i < bones.length; i++) {
    const constraint = constraints.get(i);
    if (constraint && restQuats[i]) {
      constraint.enforce(bones[i].quaternion, restQuats[i]);
    }
  }
}
