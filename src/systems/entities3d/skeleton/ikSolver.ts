/**
 * @file ikSolver.ts — IK Solver Module for procedural creature animation.
 *
 * Provides inverse kinematics solvers for the Aralia creature animation system:
 * 1. Analytical 2-bone IK (law of cosines) for simple legs/arms with 2 segments (hip -> knee -> foot).
 * 2. FABRIK (Forward And Backward Reaching Inverse Kinematics) for 3+ bone chains (spines, tails, tentacles).
 * 3. High-level `solveAllChains` orchestration that solves limb/spine/tail chains and enforces joint constraints parent-first.
 *
 * Safe Quaternion unit vector rotation prevents anti-parallel 180-degree singularities.
 */

import { Vector3, Quaternion, Object3D } from 'three';
import type { AssembledSkeleton, LimbChain } from './skeletonAssembler';
import { enforceAllConstraints } from './jointConstraints';
import { solveKnee } from '../three/ik';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_TOLERANCE = 0.001;
const EPSILON = 1e-6;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function safeNormalize(v: Vector3): Vector3 {
  const len = v.length();
  if (len < EPSILON) return new Vector3(0, 1, 0);
  return v.clone().divideScalar(len);
}

function segmentLength(a: Vector3, b: Vector3): number {
  return a.distanceTo(b);
}

function getWorldPosition(bone: Object3D): Vector3 {
  const worldPos = new Vector3();
  bone.getWorldPosition(worldPos);
  return worldPos;
}

function getWorldQuaternion(bone: Object3D | null): Quaternion {
  if (!bone) return new Quaternion();
  const worldQuat = new Quaternion();
  bone.getWorldQuaternion(worldQuat);
  return worldQuat;
}

function worldToLocalQuat(worldQuat: Quaternion, parentWorldQuat: Quaternion): Quaternion {
  return parentWorldQuat.clone().invert().multiply(worldQuat);
}

/**
 * Safe quaternion setFromUnitVectors that handles anti-parallel (180-degree)
 * vectors without producing degenerate zero quaternions or NaN.
 */
function quatFromUnitVectors(vFrom: Vector3, vTo: Vector3): Quaternion {
  const q = new Quaternion();
  const r = vFrom.dot(vTo) + 1;
  if (r < EPSILON) {
    if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
      q.set(-vFrom.y, vFrom.x, 0, 0).normalize();
    } else {
      q.set(0, -vFrom.z, vFrom.y, 0).normalize();
    }
  } else {
    q.setFromUnitVectors(vFrom, vTo);
  }
  return q;
}

// ============================================================================
// ANALYTICAL 2-BONE IK
// ============================================================================

export function solveAnalytical2Bone(
  chain: LimbChain,
  skeleton: AssembledSkeleton,
  targetPos: Vector3,
  bendDirection?: Vector3
): void {
  if (chain.boneIndices.length < 3) return;
  
  const [hipIdx, kneeIdx, footIdx] = chain.boneIndices;
  const hipBone = skeleton.bones[hipIdx];
  const kneeBone = skeleton.bones[kneeIdx];
  const footBone = skeleton.bones[footIdx];
  
  const hipPos = getWorldPosition(hipBone);
  const kneePos = getWorldPosition(kneeBone);
  const footPos = getWorldPosition(footBone);
  
  const upperLength = segmentLength(hipPos, kneePos);
  const lowerLength = segmentLength(kneePos, footPos);
  
  if (upperLength < EPSILON || lowerLength < EPSILON) return;
  
  let bendDir: Vector3;
  if (bendDirection) {
    bendDir = bendDirection.clone().normalize();
  } else {
    const sideSign = chain.side === 'left' ? -1 : 1;
    bendDir = new Vector3(sideSign, 0, 0);
  }
  
  const kneeTargetPos = new Vector3();
  solveKnee(hipPos, targetPos, upperLength, lowerLength, bendDir, kneeTargetPos);
  
  const hipToKnee = safeNormalize(kneeTargetPos.clone().sub(hipPos));
  const hipWorldQuat = quatFromUnitVectors(new Vector3(0, 1, 0), hipToKnee);
  
  const kneeToFoot = safeNormalize(targetPos.clone().sub(kneeTargetPos));
  const kneeWorldQuat = quatFromUnitVectors(new Vector3(0, 1, 0), kneeToFoot);
  
  const hipParentWorldQuat = getWorldQuaternion(hipBone.parent);
  const kneeParentWorldQuat = getWorldQuaternion(kneeBone.parent);
  
  const hipLocalQuat = worldToLocalQuat(hipWorldQuat, hipParentWorldQuat);
  const kneeLocalQuat = worldToLocalQuat(kneeWorldQuat, kneeParentWorldQuat);
  
  hipBone.quaternion.copy(hipLocalQuat);
  kneeBone.quaternion.copy(kneeLocalQuat);
  
  const hipConstraint = skeleton.constraints.get(hipIdx);
  if (hipConstraint) {
    hipConstraint.enforce(hipBone.quaternion, skeleton.restQuats[hipIdx]);
  }
  
  const kneeConstraint = skeleton.constraints.get(kneeIdx);
  if (kneeConstraint) {
    kneeConstraint.enforce(kneeBone.quaternion, skeleton.restQuats[kneeIdx]);
  }
  
  hipBone.updateMatrixWorld();
  kneeBone.updateMatrixWorld();
  footBone.updateMatrixWorld();
}

// ============================================================================
// FABRIK SOLVER
// ============================================================================

export function solveFABRIK(
  boneIndices: number[],
  skeleton: AssembledSkeleton,
  targetPos: Vector3,
  maxIterations: number = DEFAULT_MAX_ITERATIONS,
  tolerance: number = DEFAULT_TOLERANCE
): void {
  if (boneIndices.length < 2) return;
  
  const bones = boneIndices.map(idx => skeleton.bones[idx]);
  const positions = bones.map(bone => getWorldPosition(bone));
  const rootPos = positions[0].clone();
  
  const lengths: number[] = [];
  for (let i = 0; i < positions.length - 1; i++) {
    lengths.push(segmentLength(positions[i], positions[i + 1]));
  }
  
  if (lengths.some(len => len < EPSILON)) return;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    positions[positions.length - 1].copy(targetPos);
    
    for (let i = positions.length - 2; i >= 0; i--) {
      const dir = safeNormalize(positions[i + 1].clone().sub(positions[i]));
      positions[i].copy(positions[i + 1]).addScaledVector(dir, -lengths[i]);
    }
    
    positions[0].copy(rootPos);
    
    for (let i = 0; i < positions.length - 1; i++) {
      const dir = safeNormalize(positions[i + 1].clone().sub(positions[i]));
      positions[i + 1].copy(positions[i]).addScaledVector(dir, lengths[i]);
    }
    
    const tipError = positions[positions.length - 1].distanceTo(targetPos);
    if (tipError < tolerance) break;
  }
  
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    
    if (i < bones.length - 1) {
      const nextPos = positions[i + 1];
      const currentPos = positions[i];
      const direction = safeNormalize(nextPos.clone().sub(currentPos));
      
      const worldQuat = quatFromUnitVectors(new Vector3(0, 1, 0), direction);
      const parentWorldQuat = getWorldQuaternion(bone.parent);
      const localQuat = worldToLocalQuat(worldQuat, parentWorldQuat);
      
      bone.quaternion.copy(localQuat);
    }
    
    const constraint = skeleton.constraints.get(boneIndices[i]);
    if (constraint) {
      constraint.enforce(bone.quaternion, skeleton.restQuats[boneIndices[i]]);
    }
  }
  
  for (const bone of bones) {
    bone.updateMatrixWorld();
  }
}

// ============================================================================
// HIGH-LEVEL BATCH SOLVER
// ============================================================================

export function solveAllChains(
  skeleton: AssembledSkeleton,
  targets: Map<string, Vector3>,
  bendHints?: Map<string, Vector3>
): void {
  for (const chain of skeleton.limbChains) {
    const target = targets.get(chain.name);
    if (!target) continue;
    
    const bendHint = bendHints?.get(chain.name);
    
    if (chain.ikType === '2bone' && chain.boneIndices.length >= 3) {
      solveAnalytical2Bone(chain, skeleton, target, bendHint);
    } else {
      solveFABRIK(chain.boneIndices, skeleton, target);
    }
  }
  
  if (skeleton.spineChain.length > 0) {
    const spineTarget = targets.get('spine');
    if (spineTarget) {
      solveFABRIK(skeleton.spineChain, skeleton, spineTarget);
    }
  }
  
  if (skeleton.tailChain.length > 0) {
    const tailTarget = targets.get('tail');
    if (tailTarget) {
      solveFABRIK(skeleton.tailChain, skeleton, tailTarget);
    }
  }
  
  enforceAllConstraints(skeleton.bones, skeleton.constraints, skeleton.restQuats);
}
