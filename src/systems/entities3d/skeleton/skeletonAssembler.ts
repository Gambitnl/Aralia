/**
 * @file skeletonAssembler.ts — Skeleton Assembler Module for procedural creature generation.
 *
 * Converts a CreatureGenome (hierarchical bone definition) into a Three.js
 * Bone hierarchy with joint constraints, bind-pose transforms, and chain
 * identification for procedural locomotion.
 *
 * Capabilities:
 * - Recursive bone hierarchy construction with automatic left/right mirroring
 * - Unit conversion from feet to meters (all genome lengths are in feet)
 * - Rest-pose quaternion computation from pitch/yaw/roll degrees
 * - Joint constraint mapping per bone
 * - World-space bind poses for IK and animation systems
 * - Automatic identification of limb chains, spine, and tail for gait generation
 */

import { Bone, Skeleton, Vector3, Quaternion, Matrix4 } from 'three';
import type { CreatureGenome, BoneNode } from '../genome/creatureGenomeSchema';
import { JointConstraint, createConstraintFromGenome } from './jointConstraints';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** Conversion factor: feet to meters (1 ft = 0.3048 m) */
const FT_TO_M = 0.3048;

export interface LimbChain {
  name: string;               // e.g. "leg_front_L", "arm_R", "tail"
  boneIndices: number[];      // Parent to tip index sequence (e.g. [hip, thigh, shin, foot])
  ikType: '2bone' | 'fabrik'; // 2bone for simple 2-link limbs, fabrik for 3+ link chains
  groundContact: boolean;     // True if end effector contacts ground (legs), false for arms/tails
  side: 'left' | 'right' | 'center';
  phaseOffset: number;        // Locomotion gait phase offset (0-1)
}

export interface AssembledSkeleton {
  root: Bone;
  bones: Bone[];
  skeleton: Skeleton;           // THREE.Skeleton bound instance
  boneIndex: Map<string, number>;       // bone id -> index in bones array
  constraints: Map<number, JointConstraint>; // bone index -> JointConstraint
  restQuats: Quaternion[];      // bind-pose local rotation per bone
  restPositions: Vector3[];     // bind-pose local position per bone
  bindWorldPos: Vector3[];      // bind-pose world position per bone (meters)
  bindWorldQuat: Quaternion[];  // bind-pose world rotation per bone
  limbChains: LimbChain[];      // identified leg and arm chains
  spineChain: number[];         // bone indices forming the spine (root to neck/head)
  tailChain: number[];          // bone indices forming the tail (if present)
}

interface AssemblyState {
  bones: Bone[];
  boneIndex: Map<string, number>;
  constraints: Map<number, JointConstraint>;
  restQuats: Quaternion[];
  restPositions: Vector3[];
  bindWorldPos: Vector3[];
  bindWorldQuat: Quaternion[];
  parentWorldMatrix: Matrix4;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}

function eulerDegToQuaternion(pitchDeg: number, yawDeg: number, rollDeg: number): Quaternion {
  const pitchRad = degToRad(pitchDeg);
  const yawRad = degToRad(yawDeg);
  const rollRad = degToRad(rollDeg);
  
  const cy = Math.cos(yawRad * 0.5);
  const sy = Math.sin(yawRad * 0.5);
  const cp = Math.cos(pitchRad * 0.5);
  const sp = Math.sin(pitchRad * 0.5);
  const cr = Math.cos(rollRad * 0.5);
  const sr = Math.sin(rollRad * 0.5);
  
  const w = cr * cp * cy + sr * sp * sy;
  const x = cr * sp * cy + sr * cp * sy;
  const y = cr * cp * sy - sr * sp * cy;
  const z = sr * cp * cy - cr * sp * sy;
  
  return new Quaternion(x, y, z, w);
}

function mirrorQuaternionX(quat: Quaternion): Quaternion {
  return new Quaternion(-quat.x, quat.y, -quat.z, quat.w);
}

function isLimbBone(name: string): boolean {
  return /leg|arm|limb|foot|hand|paw|hoof/i.test(name);
}

function isSpineBone(name: string): boolean {
  return /spine|back|torso|chest|neck|head|skull/i.test(name);
}

function isTailBone(name: string): boolean {
  return /tail|appendage/i.test(name);
}

function getBoneSide(name: string): 'left' | 'right' | 'center' {
  if (/_L$|_left$|left/i.test(name)) return 'left';
  if (/_R$|_right$|right/i.test(name)) return 'right';
  return 'center';
}

function isGroundContact(name: string): boolean {
  return /leg|foot|paw|hoof/i.test(name);
}

// ============================================================================
// RECURSIVE BONE CONSTRUCTION
// ============================================================================

function constructBoneHierarchy(
  node: BoneNode,
  parent: Bone | null,
  state: AssemblyState,
  side: 'left' | 'right' | 'center',
  isMirrored: boolean
): void {
  const boneName = node.name || (side !== 'center' ? `${node.id}_${side === 'left' ? 'L' : 'R'}` : node.id);
  const boneLength = (node.length || 0) * FT_TO_M;
  
  const rot = node.restRotation ?? [0, 0, 0];
  const restQuat = eulerDegToQuaternion(rot[0], rot[1], rot[2]);
  const finalRestQuat = isMirrored ? mirrorQuaternionX(restQuat) : restQuat;
  
  const bonePosition = new Vector3(0, boneLength, 0);
  if (isMirrored) {
    bonePosition.x = -bonePosition.x;
  }
  
  const bone = new Bone();
  bone.name = boneName;
  bone.position.copy(bonePosition);
  bone.quaternion.copy(finalRestQuat);
  
  if (parent) {
    parent.add(bone);
  }
  
  const localMatrix = new Matrix4().compose(bonePosition, finalRestQuat, new Vector3(1, 1, 1));
  const worldMatrix = parent ? state.parentWorldMatrix.clone().multiply(localMatrix) : localMatrix.clone();
  bone.matrix.copy(worldMatrix);
  
  const boneIndex = state.bones.length;
  state.bones.push(bone);
  state.boneIndex.set(boneName, boneIndex);
  state.restQuats.push(finalRestQuat.clone());
  state.restPositions.push(bonePosition.clone());
  
  const worldPos = new Vector3();
  const worldQuat = new Quaternion();
  worldMatrix.decompose(worldPos, worldQuat, new Vector3());
  state.bindWorldPos.push(worldPos);
  state.bindWorldQuat.push(worldQuat);
  
  if (node.joint) {
    const constraint = createConstraintFromGenome(node.joint);
    state.constraints.set(boneIndex, constraint);
  }
  
  const childParentWorldMatrix = worldMatrix.clone();
  
  if (node.children) {
    for (const child of node.children) {
      if (child.mirror && side === 'center') {
        const leftState = { ...state, parentWorldMatrix: childParentWorldMatrix };
        constructBoneHierarchy({ ...child, mirror: false }, bone, leftState, 'left', false);
        
        const rightState = { ...state, parentWorldMatrix: childParentWorldMatrix };
        constructBoneHierarchy({ ...child, mirror: false }, bone, rightState, 'right', true);
      } else {
        const childState = { ...state, parentWorldMatrix: childParentWorldMatrix };
        constructBoneHierarchy(child, bone, childState, side, isMirrored);
      }
    }
  }
}

// ============================================================================
// CHAIN IDENTIFICATION
// ============================================================================

function identifyLimbChains(
  bones: Bone[],
  boneIndex: Map<string, number>,
  rootBone: Bone
): LimbChain[] {
  const chains: LimbChain[] = [];
  
  for (const [name, index] of boneIndex) {
    if (/pelvis|hip|shoulder|scapula/i.test(name)) {
      const bone = bones[index];
      const side = getBoneSide(name);
      
      const chainIndices: number[] = [];
      let currentBone: Bone | null = bone;
      
      while (currentBone) {
        chainIndices.push(boneIndex.get(currentBone.name)!);
        const children = currentBone.children.filter(child => isLimbBone(child.name));
        if (children.length === 0) break;
        currentBone = children.sort((a, b) => 
          (b.children?.length || 0) - (a.children?.length || 0)
        )[0] as Bone;
      }
      
      if (chainIndices.length >= 2) {
        const isLeg = isGroundContact(name);
        const phaseOffset = side === 'left' ? 0 : 0.5;
        
        chains.push({
          name: name.replace(/_L|_R$/, ''),
          boneIndices: chainIndices,
          ikType: chainIndices.length <= 3 ? '2bone' : 'fabrik',
          groundContact: isLeg,
          side,
          phaseOffset
        });
      }
    }
  }
  
  return chains;
}

function identifySpineChain(
  bones: Bone[],
  boneIndex: Map<string, number>
): number[] {
  const spineChain: number[] = [];
  const rootIndex = boneIndex.get('root') ?? 0;
  
  let currentBone: Bone | null = bones[rootIndex];
  
  while (currentBone) {
    const index = boneIndex.get(currentBone.name);
    if (index === undefined) break;
    spineChain.push(index);
    
    const spineChildren = currentBone.children.filter(child => isSpineBone(child.name));
    if (spineChildren.length === 0) break;
    currentBone = spineChildren.sort((a, b) => 
      (b.children?.length || 0) - (a.children?.length || 0)
    )[0] as Bone;
  }
  
  return spineChain;
}

function identifyTailChain(
  bones: Bone[],
  boneIndex: Map<string, number>
): number[] {
  const tailChain: number[] = [];
  
  for (const [name, index] of boneIndex) {
    if (isTailBone(name)) {
      let currentBone: Bone | null = bones[index];
      while (currentBone) {
        const currentIndex = boneIndex.get(currentBone.name);
        if (currentIndex === undefined) break;
        tailChain.push(currentIndex);
        
        const tailChildren = currentBone.children.filter(child => isTailBone(child.name));
        if (tailChildren.length === 0) break;
        currentBone = tailChildren[0] as Bone;
      }
      break;
    }
  }
  
  return tailChain;
}

// ============================================================================
// MAIN ASSEMBLY FUNCTION
// ============================================================================

export function assembleFromGenome(genome: CreatureGenome): AssembledSkeleton {
  const state: AssemblyState = {
    bones: [],
    boneIndex: new Map(),
    constraints: new Map(),
    restQuats: [],
    restPositions: [],
    bindWorldPos: [],
    bindWorldQuat: [],
    parentWorldMatrix: new Matrix4()
  };
  
  constructBoneHierarchy(genome.rootBone, null, state, 'center', false);
  
  const root = state.bones[0];
  const skeleton = new Skeleton(state.bones);
  
  const limbChains = identifyLimbChains(state.bones, state.boneIndex, root);
  const spineChain = identifySpineChain(state.bones, state.boneIndex);
  const tailChain = identifyTailChain(state.bones, state.boneIndex);

  return {
    root,
    bones: state.bones,
    skeleton,
    boneIndex: state.boneIndex,
    constraints: state.constraints,
    restQuats: state.restQuats,
    restPositions: state.restPositions,
    bindWorldPos: state.bindWorldPos,
    bindWorldQuat: state.bindWorldQuat,
    limbChains,
    spineChain,
    tailChain,
  };
}
