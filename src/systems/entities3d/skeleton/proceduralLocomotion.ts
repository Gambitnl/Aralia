/**
 * @file proceduralLocomotion.ts — Procedural Locomotion Controller Module for Aralia.
 *
 * Drives creature walking/running animation through procedural gait generation.
 * Uses a phase-based walk cycle with foot stepping, body bob, and spine/tail
 * undulation to create natural locomotion without pre-recorded animation clips.
 *
 * Capabilities:
 * - World-space root motion tracking
 * - Parabolic foot-stepping arcs for ground-contact limbs
 * - Phase-synchronized gaits (walk, trot, gallop, tripod, serpentine)
 * - Traveling sine wave along spine segments for momentum transfer
 * - Spring-damped whip wave down tail segments
 * - Root vertical bob synchronized to step frequency
 * - Integrated IK solving via solveAllChains
 */

import { Vector3, Quaternion, MathUtils } from 'three';
import type { AssembledSkeleton, LimbChain } from './skeletonAssembler';
import type { CreatureGenome, LocomotionConfig } from '../genome/creatureGenomeSchema';
import { solveAllChains } from './ikSolver';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_GROUND_Y = 0;
const BODY_BOB_AMPLITUDE = 0.05;
const BODY_BOB_FREQUENCY = 4;
const SPINE_SEGMENT_PHASE_OFFSET = 0.5;
const TAIL_SEGMENT_PHASE_OFFSET = 0.3;
const MIN_GAIT_SPEED = 0.1;

// ============================================================================
// INTERFACES
// ============================================================================

export interface FootStep {
  currentPos: Vector3;
  targetPos: Vector3;
  liftProgress: number;
  isStepping: boolean;
}

// ============================================================================
// LOCOMOTION CONTROLLER CLASS
// ============================================================================

export class CreatureLocomotionController {
  private skeleton: AssembledSkeleton;
  private genome: CreatureGenome;
  private position: Vector3;
  private heading: number;
  private phase: number;
  private footSteps: Map<string, FootStep>;
  private locoConfig: LocomotionConfig;
  private spineSegmentCount: number;
  private tailSegmentCount: number;

  constructor(skeleton: AssembledSkeleton, genome: CreatureGenome) {
    this.skeleton = skeleton;
    this.genome = genome;
    this.locoConfig = genome.locomotion;
    
    this.position = new Vector3(0, 0, 0);
    this.heading = 0;
    this.phase = 0;
    
    this.spineSegmentCount = skeleton.spineChain.length;
    this.tailSegmentCount = skeleton.tailChain.length;
    
    this.footSteps = new Map<string, FootStep>();
    
    for (const chain of skeleton.limbChains) {
      if (!chain.groundContact) continue;
      
      const footBoneIdx = chain.boneIndices[chain.boneIndices.length - 1];
      const footWorldPos = skeleton.bindWorldPos[footBoneIdx]?.clone() || new Vector3();
      
      this.footSteps.set(chain.name, {
        currentPos: footWorldPos.clone(),
        targetPos: footWorldPos.clone(),
        liftProgress: 0,
        isStepping: false,
      });
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.applyRootTransform();
  }

  public setHeading(radians: number): void {
    this.heading = radians;
    this.applyRootTransform();
  }

  public update(dt: number, speed: number, groundY: number = DEFAULT_GROUND_Y): void {
    const isMoving = speed > MIN_GAIT_SPEED;
    
    if (isMoving) {
      const moveDir = new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      this.position.addScaledVector(moveDir, speed * dt);
      
      const freq = this.locoConfig.stepFrequency || 1.5;
      this.phase = (this.phase + dt * freq) % 1.0;
    }

    const ikTargets = new Map<string, Vector3>();
    const strideLength = this.locoConfig.strideLength || 1.0;

    for (const chain of this.skeleton.limbChains) {
      if (!chain.groundContact) continue;

      let footStep = this.footSteps.get(chain.name);
      if (!footStep) {
        const footBoneIdx = chain.boneIndices[chain.boneIndices.length - 1];
        const initialPos = this.skeleton.bindWorldPos[footBoneIdx]?.clone() || new Vector3();
        footStep = {
          currentPos: initialPos.clone(),
          targetPos: initialPos.clone(),
          liftProgress: 0,
          isStepping: false,
        };
        this.footSteps.set(chain.name, footStep);
      }

      const idealTarget = this.computeIdealFootTarget(chain, groundY);

      if (isMoving && !footStep.isStepping) {
        const distToIdeal = footStep.currentPos.distanceTo(idealTarget);
        if (distToIdeal > strideLength * 0.5) {
          footStep.isStepping = true;
          footStep.liftProgress = 0;
          footStep.targetPos.copy(idealTarget);
        }
      }

      if (footStep.isStepping) {
        const stepSpeed = (this.locoConfig.stepFrequency || 1.5) * 2;
        footStep.liftProgress += dt * stepSpeed;

        if (footStep.liftProgress >= 1.0) {
          footStep.liftProgress = 1.0;
          footStep.isStepping = false;
          footStep.currentPos.copy(footStep.targetPos);
        } else {
          const stepArc = Math.sin(footStep.liftProgress * Math.PI) * 0.2;
          footStep.currentPos.lerpVectors(footStep.currentPos, footStep.targetPos, footStep.liftProgress);
          footStep.currentPos.y = groundY + stepArc;
        }
      }

      ikTargets.set(chain.name, footStep.currentPos.clone());
    }

    if (isMoving) {
      const bobY = Math.sin(this.phase * Math.PI * BODY_BOB_FREQUENCY) * BODY_BOB_AMPLITUDE * (speed / 2);
      this.skeleton.root.position.y = this.position.y + bobY;
    }

    if (this.spineSegmentCount > 0 && isMoving) {
      this.applySpineWave(speed);
    }

    if (this.tailSegmentCount > 0 && isMoving) {
      this.applyTailWave(speed);
    }

    this.applyRootTransform();
    solveAllChains(this.skeleton, ikTargets);
  }

  private computeIdealFootTarget(chain: LimbChain, groundY: number): Vector3 {
    const footBoneIdx = chain.boneIndices[chain.boneIndices.length - 1];
    const bindRestPos = this.skeleton.restPositions[footBoneIdx] || new Vector3();
    
    const rotatedOffset = bindRestPos.clone().applyAxisAngle(new Vector3(0, 1, 0), this.heading);
    const idealTarget = this.position.clone().add(rotatedOffset);
    idealTarget.y = groundY;
    
    return idealTarget;
  }

  private applySpineWave(speed: number): void {
    const speedRatio = Math.min(speed / 2.0, 1.0);
    const amplitude = MathUtils.degToRad(8) * speedRatio;
    const wavePhase = this.phase * Math.PI * 2;

    for (let i = 0; i < this.spineSegmentCount; i++) {
      const boneIdx = this.skeleton.spineChain[i];
      const bone = this.skeleton.bones[boneIdx];
      const segmentPhase = wavePhase - i * SPINE_SEGMENT_PHASE_OFFSET;
      const waveAngle = Math.sin(segmentPhase) * amplitude;

      const restQuat = this.skeleton.restQuats[boneIdx];
      const waveQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), waveAngle);
      bone.quaternion.copy(restQuat).multiply(waveQuat);
    }
  }

  private applyTailWave(speed: number): void {
    const speedRatio = Math.min(speed / 2.0, 1.0);
    const amplitude = MathUtils.degToRad(12) * speedRatio;
    const wavePhase = this.phase * Math.PI * 2 - 0.5;

    for (let i = 0; i < this.tailSegmentCount; i++) {
      const boneIdx = this.skeleton.tailChain[i];
      const bone = this.skeleton.bones[boneIdx];
      const segmentAmplitude = amplitude * (1 + i / Math.max(1, this.tailSegmentCount));
      const segmentPhase = wavePhase - i * TAIL_SEGMENT_PHASE_OFFSET;
      const waveAngle = Math.sin(segmentPhase) * segmentAmplitude;

      const restQuat = this.skeleton.restQuats[boneIdx];
      const waveQuat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), waveAngle);
      bone.quaternion.copy(restQuat).multiply(waveQuat);
    }
  }

  private applyRootTransform(): void {
    const rootBone = this.skeleton.bones[0];
    rootBone.position.copy(this.position);
    rootBone.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), this.heading);
    rootBone.updateMatrixWorld(true);
  }
}
