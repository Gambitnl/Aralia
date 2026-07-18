/**
 * @file skeletonBuilder.ts — slice 1 of the entity skeleton pivot: a real
 * THREE.Bone hierarchy for biped frames, plus the per-frame pose adapter that
 * drives it from the gait driver's segment emissions.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-18-entity-skeleton-pivot-slice1.md
 *
 * What changed: nothing existed here before — this file introduces the first
 * skeleton in the codebase. Why: standard animation clips (slice 2, Mixamo)
 * need bones; the segment renderer has none. What is preserved: BipedDriver's
 * math is UNTOUCHED — the rest pose below mirrors its hardcoded proportions
 * (gaits.ts BipedDriver) constant for constant, and at runtime the driver's
 * own buildBody(sink) emissions drive the bones, so the skeleton can never
 * drift from the driver. Deferred: creature/plan skeletons (slice 4), smooth
 * weights (slice 3), clip playback (slice 2).
 *
 * Three parts:
 *   1. bipedRestPose(frame)      — pure data: the exact segments + balls the
 *      driver emits at rest (gaitPhase 0, speed 0 → bob 0, sway 0), each
 *      tagged with the bone that owns it. This is the bind pose.
 *   2. buildBipedSkeleton(frame) — Bone hierarchy in bind pose (17 bones).
 *   3. createBipedPoseSink(...)  — a SegmentSink the assembler hands to
 *      driver.buildBody() instead of the segment renderer; converts emitted
 *      joint positions to bone world transforms, then resolves locals
 *      parent-first. Bones are rigid (no per-frame scale): link lengths are
 *      constant in normal animation (solveKnee returns exact 0.52-limb
 *      links), and the rare IK overstretch gap hides inside joint spheres.
 */
import { Bone, Quaternion, Vector3 } from 'three';
import type { Frame, SegmentSink } from '../types';
import { FT_TO_M, headRadiusM, heightM } from '../types';
import { solveKnee } from './ik';

/** The 17 biped bones, parent-first (index 0 = root). */
export const BIPED_BONE_NAMES = [
  'root',
  'pelvis',
  'chest',
  'neck',
  'head',
  'upperArmL',
  'foreArmL',
  'handL',
  'upperArmR',
  'foreArmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const;

export type BipedBoneName = (typeof BIPED_BONE_NAMES)[number];

/** Parent of each bone (root has none). */
export const BIPED_BONE_PARENT: Readonly<Record<BipedBoneName, BipedBoneName | null>> = {
  root: null,
  pelvis: 'root',
  chest: 'pelvis',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest',
  foreArmL: 'upperArmL',
  handL: 'foreArmL',
  upperArmR: 'chest',
  foreArmR: 'upperArmR',
  handR: 'foreArmR',
  thighL: 'pelvis',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'pelvis',
  shinR: 'thighR',
  footR: 'shinR',
};

/** Which bone owns each driver segment id (tapered cylinder pieces). */
export const SEGMENT_BONE: Readonly<Record<string, BipedBoneName>> = {
  'torso.pelvis': 'pelvis',
  'torso.chest': 'chest',
  neck: 'neck',
  'armL.upper': 'upperArmL',
  'armL.fore': 'foreArmL',
  'armR.upper': 'upperArmR',
  'armR.fore': 'foreArmR',
  'legL.thigh': 'thighL',
  'legL.shin': 'shinL',
  'legR.thigh': 'thighR',
  'legR.shin': 'shinR',
};

/** Which bone owns each driver ball id (round lump pieces). */
export const BALL_BONE: Readonly<Record<string, BipedBoneName>> = {
  head: 'head',
  handL: 'handL',
  handR: 'handR',
  footL: 'footL',
  footR: 'footR',
};

export interface RestSegment {
  id: string;
  bone: BipedBoneName;
  a: [number, number, number];
  b: [number, number, number];
  r0: number;
  r1: number;
}

export interface RestBall {
  id: string;
  bone: BipedBoneName;
  center: [number, number, number];
  r: number;
}

/** The bind pose as driver emissions: same ids, positions, radii, and ORDER
 * as BipedDriver.buildBody at rest — tests pin this against the real driver. */
export interface BipedRestPose {
  segments: RestSegment[];
  balls: RestBall[];
}

const UP = new Vector3(0, 1, 0);

/**
 * The biped driver's rest pose, computed analytically. Every constant below
 * is a mirror of BipedDriver (three/gaits.ts) with gaitPhase 0 and speed 0,
 * which zero out bob, sway, stride, and arm swing. Do not "simplify" these
 * numbers — parity with the driver is the whole point, and the tests compare
 * against a live driver stepped with dt = 0.
 */
export function bipedRestPose(frame: Frame): BipedRestPose {
  const hM = heightM(frame);
  const hr = headRadiusM(frame);
  const r = hM * 0.105 * frame.bulk; // BaseDriver.baseR
  const legLen = frame.limbLengthFt * FT_TO_M;
  const armLen = frame.armLengthFt * FT_TO_M;
  const stanceHalf = (frame.stanceWidthFt * FT_TO_M) / 2;

  // rest heights (bob = 0)
  const pelvisY = legLen * 1.0;
  const chestY = pelvisY + (hM - legLen) * 0.45;
  const headY = hM - hr * 0.7;
  const midY = pelvisY + (chestY - pelvisY) * 0.5;
  const headZ = hr * 0.25;

  // rest hands (arm swing = 0): x uses the ANCHOR shoulder width (+0.35r),
  // exactly as the driver's advance() does for hand anchors
  const shoulderXAnchor = (frame.shoulderWidthFt * FT_TO_M) / 2 + r * 0.35;
  const handY = pelvisY + hM * 0.015;
  const handZ = hM * 0.045;

  // buildBody uses the BARE half shoulder width for the shoulder joint
  const shoulderXBody = (frame.shoulderWidthFt * FT_TO_M) / 2;
  const armR = Math.max(r * 0.3, armLen * 0.085);
  const legR = Math.max(r * 0.36, legLen * 0.105);

  const segments: RestSegment[] = [];
  const balls: RestBall[] = [];

  // torso + head — emission order matches BipedDriver.buildBody
  segments.push({ id: 'torso.pelvis', bone: 'pelvis', a: [0, pelvisY - r * 0.35, 0], b: [0, midY, 0.01], r0: r * 0.92, r1: r * 0.8 });
  segments.push({ id: 'torso.chest', bone: 'chest', a: [0, midY, 0.01], b: [0, chestY + r * 0.35, 0.02], r0: r * 0.8, r1: r * 0.95 });
  segments.push({ id: 'neck', bone: 'neck', a: [0, chestY + r * 0.3, 0.02], b: [0, headY - hr * 0.55, headZ * 0.7], r0: r * 0.34, r1: r * 0.3 });
  balls.push({ id: 'head', bone: 'head', center: [0, headY, headZ], r: hr });

  const shoulder = new Vector3();
  const hip = new Vector3();
  const target = new Vector3();
  const bend = new Vector3();
  const joint = new Vector3();

  // arms, L then R (the driver iterates sgn of [-1, 1])
  for (const sgn of [-1, 1] as const) {
    const side = sgn < 0 ? 'L' : 'R';
    const hand: [number, number, number] = [sgn * (shoulderXAnchor + r * 0.05), handY, handZ];
    shoulder.set(sgn * shoulderXBody, chestY + r * 0.45, 0.02);
    bend.set(sgn, 0, -0.4).normalize();
    solveKnee(shoulder, target.set(hand[0], hand[1], hand[2]), armLen * 0.52, armLen * 0.52, bend, joint);
    segments.push({
      id: `arm${side}.upper`,
      bone: `upperArm${side}` as BipedBoneName,
      a: [shoulder.x, shoulder.y, shoulder.z],
      b: [joint.x, joint.y, joint.z],
      r0: armR,
      r1: armR * 0.85,
    });
    segments.push({
      id: `arm${side}.fore`,
      bone: `foreArm${side}` as BipedBoneName,
      a: [joint.x, joint.y, joint.z],
      b: hand,
      r0: armR * 0.85,
      r1: armR * 0.7,
    });
    balls.push({ id: `hand${side}`, bone: `hand${side}` as BipedBoneName, center: hand, r: armR * 1.15 });
  }

  // legs, L then R (driver leg[0] rests at -stance; both feet rest at z 0.01)
  for (const sgn of [-1, 1] as const) {
    const side = sgn < 0 ? 'L' : 'R';
    const foot: [number, number, number] = [sgn * stanceHalf, 0, 0.01];
    hip.set(sgn * stanceHalf * 0.8, pelvisY - r * 0.2, 0);
    bend.set(0, 0, 1);
    solveKnee(hip, target.set(foot[0], foot[1], foot[2]), legLen * 0.52, legLen * 0.52, bend, joint);
    segments.push({
      id: `leg${side}.thigh`,
      bone: `thigh${side}` as BipedBoneName,
      a: [hip.x, hip.y, hip.z],
      b: [joint.x, joint.y, joint.z],
      r0: legR,
      r1: legR * 0.85,
    });
    segments.push({
      id: `leg${side}.shin`,
      bone: `shin${side}` as BipedBoneName,
      a: [joint.x, joint.y, joint.z],
      b: foot,
      r0: legR * 0.85,
      r1: legR * 0.6,
    });
    balls.push({
      id: `foot${side}`,
      bone: `foot${side}` as BipedBoneName,
      center: [foot[0], foot[1] + legR * 0.35, foot[2] + legR * 0.55],
      r: legR * 0.85,
    });
  }

  return { segments, balls };
}

export interface BuiltSkeleton {
  /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
  root: Bone;
  /** All 17 bones, parent-first, in BIPED_BONE_NAMES order. */
  bones: Bone[];
  /** Bone index by name — skin indices and the pose sink both use this. */
  index: ReadonlyMap<BipedBoneName, number>;
  /** The bind pose the bones were placed from (shared with skinnedBody). */
  restPose: BipedRestPose;
  /** Bind world transform per bone (entity-local), kept for the pose sink. */
  bindWorldPos: Vector3[];
  bindWorldQuat: Quaternion[];
}

/** World transform of a bone in bind pose: segment bones sit at their A joint
 * with +Y along the segment (same orientation rule as the segment renderer);
 * ball bones sit at the ball center, unrotated (segment nodes for balls never
 * rotate either). */
function bindWorld(restPose: BipedRestPose, name: BipedBoneName, outPos: Vector3, outQuat: Quaternion): void {
  if (name === 'root') {
    outPos.set(0, 0, 0);
    outQuat.identity();
    return;
  }
  const seg = restPose.segments.find((s) => s.bone === name);
  if (seg) {
    outPos.set(seg.a[0], seg.a[1], seg.a[2]);
    const dir = new Vector3(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
    if (dir.lengthSq() < 1e-12) dir.copy(UP); // defensive; rest segments are never degenerate
    outQuat.setFromUnitVectors(UP, dir.normalize());
    return;
  }
  const ball = restPose.balls.find((k) => k.bone === name);
  if (!ball) throw new Error(`bindWorld: no rest piece for bone "${name}"`);
  outPos.set(ball.center[0], ball.center[1], ball.center[2]);
  outQuat.identity();
}

/** Frame in, bone hierarchy out — pure (no scene, no renderer). */
export function buildBipedSkeleton(frame: Frame): BuiltSkeleton {
  const restPose = bipedRestPose(frame);
  const bones: Bone[] = [];
  const index = new Map<BipedBoneName, number>();
  const bindWorldPos: Vector3[] = [];
  const bindWorldQuat: Quaternion[] = [];
  const invQuat = new Quaternion();

  for (const [i, name] of BIPED_BONE_NAMES.entries()) {
    const bone = new Bone();
    bone.name = name;
    const pos = new Vector3();
    const quat = new Quaternion();
    bindWorld(restPose, name, pos, quat);
    bindWorldPos.push(pos);
    bindWorldQuat.push(quat);

    const parentName = BIPED_BONE_PARENT[name];
    if (parentName === null) {
      bone.position.copy(pos);
      bone.quaternion.copy(quat);
    } else {
      const p = index.get(parentName)!;
      // local = parentWorld⁻¹ ∘ world (all transforms rigid, so quaternion
      // math is exact — no matrix decompose, no shear)
      invQuat.copy(bindWorldQuat[p]).invert();
      bone.position.copy(pos).sub(bindWorldPos[p]).applyQuaternion(invQuat);
      bone.quaternion.copy(invQuat).multiply(quat);
      bones[p].add(bone);
    }
    bones.push(bone);
    index.set(name, i);
  }

  return { root: bones[0], bones, index, restPose, bindWorldPos, bindWorldQuat };
}

export interface BipedPoseSink {
  /** Hand this to driver.buildBody() each frame instead of the segment renderer's sink. */
  sink: SegmentSink;
  /** Resolve the received world transforms into local bone transforms (parents first). */
  finishFrame(): void;
}

const DIR = new Vector3();
const INV = new Quaternion();

/**
 * The pose adapter: driver joint positions in, bone transforms out. Each
 * seg(id, …) sets the owning bone's world position to the A joint and its
 * world orientation to +Y-along-the-segment — the identical rule the segment
 * renderer applies to its nodes — and each ball(id, …) sets position only.
 * finishFrame() converts those world targets to local bone transforms down
 * the hierarchy. Unknown ids throw: if a driver ever emits something new,
 * this fails loudly instead of silently dropping body parts.
 */
export function createBipedPoseSink(skeleton: BuiltSkeleton): BipedPoseSink {
  const n = skeleton.bones.length;
  const worldPos: Vector3[] = Array.from({ length: n }, () => new Vector3());
  const worldQuat: Quaternion[] = Array.from({ length: n }, () => new Quaternion());
  // root never receives emissions; it stays at the entity-local origin
  const written: boolean[] = new Array(n).fill(false);
  written[0] = true;

  const boneFor = (table: Readonly<Record<string, BipedBoneName>>, id: string): number => {
    const name = table[id];
    if (!name) throw new Error(`biped pose sink: no bone mapped for emission id "${id}"`);
    return skeleton.index.get(name)!;
  };

  const sink: SegmentSink = {
    seg(id, ax, ay, az, bx, by, bz) {
      const i = boneFor(SEGMENT_BONE, id);
      worldPos[i].set(ax, ay, az);
      DIR.set(bx - ax, by - ay, bz - az);
      if (DIR.lengthSq() < 1e-12) DIR.copy(UP);
      worldQuat[i].setFromUnitVectors(UP, DIR.normalize());
      written[i] = true;
    },
    ball(id, x, y, z) {
      const i = boneFor(BALL_BONE, id);
      worldPos[i].set(x, y, z);
      worldQuat[i].identity();
      written[i] = true;
    },
    // ring/box/tube are intentionally absent: the biped driver never emits
    // them, and a non-biped driver reaching this sink should fail loudly.
  };

  function finishFrame(): void {
    // parent-first order is guaranteed by BIPED_BONE_NAMES; bones whose id was
    // not written this frame keep their previous local transform
    for (let i = 1; i < n; i++) {
      if (!written[i]) continue;
      const parent = skeleton.bones[i].parent;
      if (!parent || !(parent as Bone).isBone) {
        skeleton.bones[i].position.copy(worldPos[i]);
        skeleton.bones[i].quaternion.copy(worldQuat[i]);
        continue;
      }
      const p = skeleton.index.get(parent.name as BipedBoneName)!;
      INV.copy(worldQuat[p]).invert();
      skeleton.bones[i].position.copy(worldPos[i]).sub(worldPos[p]).applyQuaternion(INV);
      skeleton.bones[i].quaternion.copy(INV).multiply(worldQuat[i]);
      written[i] = false;
    }
  }

  return { sink, finishFrame };
}
