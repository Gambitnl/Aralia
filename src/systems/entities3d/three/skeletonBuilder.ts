// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:41:25
 * Dependents: systems/entities3d/three/skinnedBody.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  // round 4 (humanoid-anatomy): thick-necked frames emit a trapezius wedge
  // between chest and skull; it rides the neck bone (the neck segment,
  // emitted after it, drives the bone transform — same pattern as the palm)
  'torso.traps': 'neck',
  neck: 'neck',
  'armL.upper': 'upperArmL',
  'armL.fore': 'foreArmL',
  // round 2 (humanoid-anatomy): mitt hands — palm + thumb segments replace
  // the hand balls; both ride the hand bone (the palm, emitted last, drives
  // its transform)
  'handL.thumb': 'handL',
  'handL.palm': 'handL',
  'armR.upper': 'upperArmR',
  'armR.fore': 'foreArmR',
  'handR.thumb': 'handR',
  'handR.palm': 'handR',
  'legL.thigh': 'thighL',
  'legL.shin': 'shinL',
  'legR.thigh': 'thighR',
  'legR.shin': 'shinR',
  // round 5 (humanoid-anatomy): feet are heel-to-toe wedge SEGMENTS now (the
  // nub balls are gone); each drives its foot bone the segment way (bone at
  // the heel, +Y along heel→toe)
  footL: 'footL',
  footR: 'footR',
};

/** Which bone owns each driver ball id (round lump pieces). */
export const BALL_BONE: Readonly<Record<string, BipedBoneName>> = {
  head: 'head',
  // round 2 (humanoid-anatomy): deltoid mass balls at the arm roots (the
  // upper-arm segment, emitted after each ball, drives the bone transform);
  // the old handL/handR balloon-fist balls are gone — hands are segments now
  deltoidL: 'upperArmL',
  deltoidR: 'upperArmR',
  // round 5 (humanoid-anatomy): footL/footR left this table — feet are wedge
  // segments (SEGMENT_BONE) now, not balls
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

/** round 6 (humanoid-anatomy): the drawn biped skull radius — ONE formula
 * shared by the driver (gaits.ts BipedDriver), the rest pose below, head-worn
 * gear (parts/gearArmor.ts), and the sculpted head mount (assembleEntity), so
 * the helmet shrinks with the skull it sits on.
 * round 7 (humanoid-anatomy): the radius is now calibrated for the SCULPTED
 * humanoid head (headForms.buildHumanoidHead), whose vertical span is ~1.47
 * radii (crown 0.88, chin −0.59) — no longer the 2-radius ball. Slim frames:
 * 1.47 × 0.88 × headRadiusM ≈ height/7, the reference head-to-body ratio the
 * round-6 verdict demanded; bulk eases the ratio up to 0.97 by bulk 1.3 so
 * the orc's head keeps presence without regrowing the balloon dome. */
export function bipedSkullRadiusM(frame: Frame): number {
  return headRadiusM(frame) * Math.min(0.97, 0.88 + 0.3 * Math.max(0, frame.bulk - 1));
}

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
  // round 1 (humanoid-anatomy): stance widened 1.12x — mirror of the
  // BipedDriver constructor's TreadmillLeg rest x
  // round 2 (humanoid-anatomy): bulk-independent stance floor (hM * 0.089)
  // round 4 (humanoid-anatomy): shoulder-derived stance floor — feet plant at
  // 68% of the visual shoulder span (deltoid outer edge), which puts the
  // thigh roots (0.85x) at the pelvis mass edge. Mirror: BipedDriver
  // constructor.
  // round 5 (humanoid-anatomy): feet plant DIRECTLY under the thigh roots —
  // the 0.85 narrowing moved into the stance itself, so hip, knee, and ankle
  // share one vertical line in the front view. Mirror: BipedDriver
  // constructor.
  const armRForStance = Math.max(r * 0.3, armLen * 0.085);
  const shoulderVisualHalf = (frame.shoulderWidthFt * FT_TO_M) / 2 + armRForStance * 1.6;
  const stanceHalf = Math.max(((frame.stanceWidthFt * FT_TO_M) / 2) * 1.12, shoulderVisualHalf * 0.68) * 0.85;

  // rest heights (bob = 0)
  // round 5 (humanoid-anatomy): upright idle — the pelvis rides at 0.96 of
  // full leg reach (1.04 legLen) plus the hip-socket drop, leaving only a
  // slight forward knee break instead of the round-4 half-squat. Mirror:
  // BipedDriver.advance idlePelvisY (speed 0).
  const pelvisY = legLen * 1.04 * 0.96 + r * 0.3;
  const chestY = pelvisY + (hM - legLen) * 0.45;
  // round 3 (humanoid-anatomy): real neck — the head rises when a bulky or
  // big-headed frame leaves no daylight between the chest top and the skull
  // base. The minimum visible neck height scales with the head too
  // (hM * 0.04 + hr * 0.25): a bigger skull needs a taller gap to read, and
  // gear collars (vest) eat the lowest part. Mirror: BipedDriver.advance.
  const chestTopY = chestY + r * 0.35;
  // round 6 (humanoid-anatomy): the whole head ladder runs on the drawn
  // skull radius (skullR ≤ hr) — mirror of BipedDriver.advance headY
  const skullR = bipedSkullRadiusM(frame);
  // round 10 (humanoid-anatomy): SEAT the head — collar-driven mount. The
  // loft chin (headY − 0.59 skullR) rides `neckLift` skull radii above the
  // chest top; the lift shrinks with bulk (human ≈ 0.46, orc/dwarf ≈ 0.2 —
  // jaw settles into the traps), hard-capped 0.55. The old hM floor and
  // skull-stack minimum are gone. Mirror of the driver (BipedDriver.advance
  // headY; bob = 0 here).
  // round 13 (humanoid-anatomy): lift floor 0.2, slope 0.45 — every frame
  // keeps a visible neck (the orc's was swallowed). Mirror: BipedDriver.
  const neckLift = Math.min(0.55, Math.max(0.2, 0.46 - 0.45 * Math.max(0, frame.bulk - 1)));
  const headY = chestTopY + skullR * (0.59 + neckLift);
  // round 13 (humanoid-anatomy): the torso break sits at the BELT line (0.32
  // of pelvis→chest), not midY — mirror of BipedDriver.buildBody beltY.
  const beltY = pelvisY + (chestY - pelvisY) * 0.32;
  const headZ = skullR * 0.25;

  // round 13 (humanoid-anatomy): bulk-driven outward arm push — mirror of
  // BipedDriver advance()/buildBody shoulderOut.
  const shoulderOut = r * 0.22 * Math.max(0, frame.bulk - 1);
  // rest hands (arm swing = 0): x uses the ANCHOR shoulder width (+0.35r),
  // exactly as the driver's advance() does for hand anchors
  const shoulderXAnchor = (frame.shoulderWidthFt * FT_TO_M) / 2 + r * 0.35 + shoulderOut;
  const handY = pelvisY + hM * 0.015;
  const handZ = hM * 0.045;

  // buildBody uses the BARE half shoulder width for the shoulder joint
  const shoulderXBody = (frame.shoulderWidthFt * FT_TO_M) / 2 + shoulderOut;
  const armR = Math.max(r * 0.3, armLen * 0.085);
  // round 6 (humanoid-anatomy): near 3:1 shoulder-to-wrist taper + palm-block
  // hand — mirror of the BipedDriver.buildBody arm loop (the stance formulas
  // above keep the round-4 armR * 1.6 term; the deltoid ball itself is 1.7)
  const shoulderR = armR * 1.48;
  const elbowR = armR * 0.8;
  const wristR = armR * 0.52;
  const palmLen = armR * 1.9;
  // round 1 (humanoid-anatomy): near 2:1 thigh-to-calf taper — mirror of the
  // BipedDriver.buildBody leg radii
  const legR = Math.max(r * 0.36, legLen * 0.105);
  // round 13 (humanoid-anatomy): torso-derived thigh-root floor (0.58 r) so
  // bulky frames' legs match their torso; knee keeps half the root. Mirror:
  // BipedDriver.buildBody leg radii.
  const thighR = Math.max(legR * 1.32, r * 0.58);
  const kneeR = Math.max(legR * 0.72, thighR * 0.5);
  const ankleR = legR * 0.5;

  const segments: RestSegment[] = [];
  const balls: RestBall[] = [];

  // torso + head — emission order matches BipedDriver.buildBody
  // round 13 (humanoid-anatomy): THE PELVIS BREAK — three torso masses that
  // meet at the belt: glute/hip mass (1.14 r at its base, root raised to
  // −0.2 r for the loft's glute tuck), pinched waist (0.68 r at beltY), and
  // a ribcage swelling back to 1.02 r. Mirror of BipedDriver.buildBody.
  segments.push({ id: 'torso.pelvis', bone: 'pelvis', a: [0, pelvisY - r * 0.2, 0], b: [0, beltY, 0.007], r0: r * 1.14, r1: r * 0.68 });
  segments.push({ id: 'torso.chest', bone: 'chest', a: [0, beltY, 0.007], b: [0, chestTopY, 0.02], r0: r * 0.68, r1: r * 1.02 });
  // round 3 (humanoid-anatomy): the neck roots EXACTLY at the chest top (no
  // loft step) and buries its tip deep inside the skull (headY - hr * 0.35).
  // round 4 (humanoid-anatomy): tip radius climbs with bulk (r * 0.55, floor
  // 0.42 hr, cap 0.72 hr); frames whose neck reaches 0.62 hr also emit a
  // trapezius wedge to the skull equator that swallows the head-socket
  // outline step. Mirror: BipedDriver.buildBody.
  // round 6 (humanoid-anatomy): skull-radius neck terms + traps threshold
  // 0.62 → 0.55 (mid-bulk frames earn the trap ramp) — mirror of the driver
  // round 7 (humanoid-anatomy): the sculpted head has a real jawline (jaw
  // half-width 0.46 skullR), so the neck tip caps at 0.58 skullR (0.72 buried
  // the jaw in neck) and the traps wedge stops at the NECK BASE
  // (headY − 0.55 skullR, r1 0.62 skullR) instead of the skull equator — the
  // orc's round-6 "no neck at all" was the 0.82-radius wedge swallowing the
  // whole gap. A visible neck cylinder now runs wedge-top → skull underside.
  // Mirror of the driver.
  // round 9 (humanoid-anatomy): drawn neck tip caps at 0.42 skullR and the
  // tip bury is −0.45 skullR so the taper finishes BELOW the jaw. Traps
  // threshold keeps the UNCAPPED thickness.
  // round 10 (humanoid-anatomy): traps RISE to meet the seated head — wedge
  // roots inside the upper chest (chestTop − 0.55 r); top bury 0.95 → 0.47
  // skullR with bulk (peak clears the −0.59 chin on bulked frames, jaw sits
  // INTO the trapezius); peak widens 0.54 → 0.82 skullR to bracket the lower
  // skull sides. Mirror of the driver.
  const neckThickR = Math.max(skullR * 0.42, r * 0.55);
  const neckTipR = Math.min(neckThickR, skullR * 0.42);
  if (neckThickR >= skullR * 0.55) {
    const trapsBury = Math.max(0.47, 0.95 - 1.2 * Math.max(0, frame.bulk - 1));
    const trapsR1 = Math.min(0.82, 0.54 + 0.55 * Math.max(0, frame.bulk - 1));
    segments.push({ id: 'torso.traps', bone: 'neck', a: [0, chestTopY - r * 0.55, 0.02], b: [0, headY - skullR * trapsBury, headZ * 0.6], r0: r * 0.88, r1: skullR * trapsR1 });
  }
  segments.push({ id: 'neck', bone: 'neck', a: [0, chestTopY, 0.02], b: [0, headY - skullR * 0.45, headZ * 0.85], r0: r * 0.52, r1: neckTipR });
  balls.push({ id: 'head', bone: 'head', center: [0, headY, headZ], r: skullR });

  const shoulder = new Vector3();
  const hip = new Vector3();
  const target = new Vector3();
  const bend = new Vector3();
  const joint = new Vector3();

  // arms, L then R (the driver iterates sgn of [-1, 1])
  // round 6 (humanoid-anatomy): palm-block hand + opposed thumb. The thumb's
  // offsets are CONSTANT local coordinates in the palm bone's canonical frame
  // — setFromUnitVectors(UP, palmDir), the exact rule bindWorld and the pose
  // sink apply to the hand bone — so the thumb is rigid to the bone in every
  // walk phase (round 6b rescue: a hand-built Gram-Schmidt basis twisted off
  // the bone's canonical transport by ~1 cm mid-swing). The frame is well
  // conditioned: the palm cocks ~18° forward (z += 0.32), keeping palmDir
  // clear of the degenerate straight-down antipode. Local axes at rest:
  // +Y fingers, +X ≈ world X (sgn mirrors it outward), −Z ≈ knuckle front.
  // Exact mirror of the BipedDriver.buildBody arm loop.
  const palmDir = new Vector3();
  const palmQuat = new Quaternion();
  const thumbPt = new Vector3();
  for (const sgn of [-1, 1] as const) {
    const side = sgn < 0 ? 'L' : 'R';
    const hand: [number, number, number] = [sgn * (shoulderXAnchor + r * 0.05), handY, handZ];
    shoulder.set(sgn * shoulderXBody, chestY + r * 0.45, 0.02);
    bend.set(sgn, 0, -0.4).normalize();
    solveKnee(shoulder, target.set(hand[0], hand[1], hand[2]), armLen * 0.52, armLen * 0.52, bend, joint);
    // deltoid ball before the upper segment — same order as the driver
    balls.push({ id: `deltoid${side}`, bone: `upperArm${side}` as BipedBoneName, center: [shoulder.x, shoulder.y, shoulder.z], r: armR * 1.7 });
    segments.push({
      id: `arm${side}.upper`,
      bone: `upperArm${side}` as BipedBoneName,
      a: [shoulder.x, shoulder.y, shoulder.z],
      b: [joint.x, joint.y, joint.z],
      r0: shoulderR,
      r1: elbowR,
    });
    segments.push({
      id: `arm${side}.fore`,
      bone: `foreArm${side}` as BipedBoneName,
      a: [joint.x, joint.y, joint.z],
      b: hand,
      r0: elbowR,
      r1: wristR,
    });
    // hand: thumb first, palm last (the palm drives the hand bone — bindWorld
    // picks the LAST segment per bone to match the pose sink's write order)
    palmDir.set(hand[0] - joint.x, hand[1] - joint.y, hand[2] - joint.z).normalize();
    palmDir.z += 0.32;
    palmDir.normalize();
    palmQuat.setFromUnitVectors(UP, palmDir);
    thumbPt.set(sgn * armR * 0.8, armR * 0.3, -armR * 0.2).applyQuaternion(palmQuat);
    const thumbA: [number, number, number] = [hand[0] + thumbPt.x, hand[1] + thumbPt.y, hand[2] + thumbPt.z];
    thumbPt.set(sgn * armR * 1.05, armR * 1.15, -armR * 0.8).applyQuaternion(palmQuat);
    const thumbB: [number, number, number] = [hand[0] + thumbPt.x, hand[1] + thumbPt.y, hand[2] + thumbPt.z];
    segments.push({
      id: `hand${side}.thumb`,
      bone: `hand${side}` as BipedBoneName,
      a: thumbA,
      b: thumbB,
      r0: armR * 0.45,
      r1: armR * 0.3,
    });
    segments.push({
      id: `hand${side}.palm`,
      bone: `hand${side}` as BipedBoneName,
      a: hand,
      b: [hand[0] + palmDir.x * palmLen, hand[1] + palmDir.y * palmLen, hand[2] + palmDir.z * palmLen],
      r0: armR * 1.02,
      r1: armR * 0.94,
    });
  }

  // legs, L then R (driver leg[0] rests at -stance; both feet rest at z 0.01)
  // round 5 (humanoid-anatomy): hips directly over the feet (factor 1.0 — the
  // narrowing moved into stanceHalf), exact x-mirrored knee bend vectors with
  // a small outward lean (0.1), and heel-to-toe wedge feet as segments —
  // mirror of BipedDriver.buildBody leg loop
  const heelR = legR * 0.62;
  const toeR = legR * 0.5;
  for (const sgn of [-1, 1] as const) {
    const side = sgn < 0 ? 'L' : 'R';
    const foot: [number, number, number] = [sgn * stanceHalf, 0, 0.01];
    hip.set(sgn * stanceHalf, pelvisY - r * 0.3, 0);
    bend.set(sgn * 0.1, 0, 1).normalize();
    solveKnee(hip, target.set(foot[0], foot[1], foot[2]), legLen * 0.52, legLen * 0.52, bend, joint);
    segments.push({
      id: `leg${side}.thigh`,
      bone: `thigh${side}` as BipedBoneName,
      a: [hip.x, hip.y, hip.z],
      b: [joint.x, joint.y, joint.z],
      r0: thighR,
      r1: kneeR,
    });
    segments.push({
      id: `leg${side}.shin`,
      bone: `shin${side}` as BipedBoneName,
      a: [joint.x, joint.y, joint.z],
      b: foot,
      r0: kneeR,
      r1: ankleR,
    });
    segments.push({
      id: `foot${side}`,
      bone: `foot${side}` as BipedBoneName,
      a: [foot[0], foot[1] + heelR, foot[2] - legR * 0.7],
      b: [foot[0], foot[1] + toeR, foot[2] + legR * 1.75],
      r0: heelR,
      r1: toeR,
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
  // round 2 (humanoid-anatomy): pick the LAST segment owned by the bone —
  // the hand bone owns thumb AND palm, and the pose sink's last write (the
  // palm) is the one that drives the live bone, so the bind must match it
  let seg: RestSegment | undefined;
  for (let i = restPose.segments.length - 1; i >= 0; i--) {
    if (restPose.segments[i].bone === name) {
      seg = restPose.segments[i];
      break;
    }
  }
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
      // round 2 (humanoid-anatomy): balls set position only. Ball-only bones
      // (head, feet) keep their identity quat from init, and mass balls that
      // share a bone with a segment (the deltoids on the upper arms) must
      // not clobber the segment's orientation regardless of emission order.
      worldPos[i].set(x, y, z);
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
