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

/** The 39 biped bones, parent-first (index 0 = root). Real-finger update:
 * each hand carries a two-link thumb chain and four two-link finger chains,
 * so a held weapon gets WRAPPED by posed digits instead of a grip band.
 * Clavicle update (Remy: "shoulders skeleton shape looks a bit weird"): each
 * arm hangs off a clavicle bone that runs chest top → shoulder joint, so the
 * bones overlay draws a T instead of a belt-to-shoulder V, and Mixamo
 * clavicle tracks have a bone to land on. No flesh binds to the clavicles. */
export const BIPED_BONE_NAMES = [
  'root',
  'pelvis',
  'chest',
  'neck',
  'head',
  'clavicleL',
  'upperArmL',
  'foreArmL',
  'handL',
  'clavicleR',
  'upperArmR',
  'foreArmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
  'thumbLa',
  'thumbLb',
  'fingerL0a',
  'fingerL0b',
  'fingerL1a',
  'fingerL1b',
  'fingerL2a',
  'fingerL2b',
  'fingerL3a',
  'fingerL3b',
  'thumbRa',
  'thumbRb',
  'fingerR0a',
  'fingerR0b',
  'fingerR1a',
  'fingerR1b',
  'fingerR2a',
  'fingerR2b',
  'fingerR3a',
  'fingerR3b',
] as const;

export type BipedBoneName = (typeof BIPED_BONE_NAMES)[number];

/** Parent of each bone (root has none). */
export const BIPED_BONE_PARENT: Readonly<Record<BipedBoneName, BipedBoneName | null>> = {
  root: null,
  pelvis: 'root',
  chest: 'pelvis',
  neck: 'chest',
  head: 'neck',
  clavicleL: 'chest',
  upperArmL: 'clavicleL',
  foreArmL: 'upperArmL',
  handL: 'foreArmL',
  clavicleR: 'chest',
  upperArmR: 'clavicleR',
  foreArmR: 'upperArmR',
  handR: 'foreArmR',
  thighL: 'pelvis',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'pelvis',
  shinR: 'thighR',
  footR: 'shinR',
  thumbLa: 'handL',
  thumbLb: 'thumbLa',
  fingerL0a: 'handL',
  fingerL0b: 'fingerL0a',
  fingerL1a: 'handL',
  fingerL1b: 'fingerL1a',
  fingerL2a: 'handL',
  fingerL2b: 'fingerL2a',
  fingerL3a: 'handL',
  fingerL3b: 'fingerL3a',
  thumbRa: 'handR',
  thumbRb: 'thumbRa',
  fingerR0a: 'handR',
  fingerR0b: 'fingerR0a',
  fingerR1a: 'handR',
  fingerR1b: 'fingerR1a',
  fingerR2a: 'handR',
  fingerR2b: 'fingerR2a',
  fingerR3a: 'handR',
  fingerR3b: 'fingerR3a',
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
  // the hand balls; the palm rides (and drives) the hand bone.
  // real-finger update: the round-15 curled FINGERS mass is gone — each hand
  // now emits a thumb link and four two-link fingers, each on its OWN bone,
  // so a grip pose can wrap them around a weapon haft per frame.
  // thenar rings 0-1 are palm-rigid; the DISTAL ring (thenar2) rides the
  // thumb root bone, so the pad follows the thumb through the grip wrap and
  // the wave's 180° digit roll (Remy circled the pad as a thumbless lump on
  // the waving palm). The no-twist transport gives thenar2 a known, bounded
  // ~2mm drift at walk amplitude — the parity test carries a widened
  // tolerance for thenar ids. The thumba emission arrives after thenar2 and
  // overwrites the bone transform, so thumba stays the true driver.
  'handL.thenar0': 'handL',
  'handL.thenar1': 'handL',
  'handL.thenar2': 'thumbLa',
  'handL.thumba': 'thumbLa',
  'handL.thumbb': 'thumbLb',
  'handL.finger0a': 'fingerL0a',
  'handL.finger0b': 'fingerL0b',
  'handL.finger1a': 'fingerL1a',
  'handL.finger1b': 'fingerL1b',
  'handL.finger2a': 'fingerL2a',
  'handL.finger2b': 'fingerL2b',
  'handL.finger3a': 'fingerL3a',
  'handL.finger3b': 'fingerL3b',
  'handL.palm': 'handL',
  'armR.upper': 'upperArmR',
  'armR.fore': 'foreArmR',
  'handR.thenar0': 'handR',
  'handR.thenar1': 'handR',
  'handR.thenar2': 'thumbRa',
  'handR.thumba': 'thumbRa',
  'handR.thumbb': 'thumbRb',
  'handR.finger0a': 'fingerR0a',
  'handR.finger0b': 'fingerR0b',
  'handR.finger1a': 'fingerR1a',
  'handR.finger1b': 'fingerR1b',
  'handR.finger2a': 'fingerR2a',
  'handR.finger2b': 'fingerR2b',
  'handR.finger3a': 'fingerR3a',
  'handR.finger3b': 'fingerR3b',
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

/**
 * Clavicle aim (shared by bindWorld and the live pose sink — one function, so
 * bind/live parity holds by construction). The clavicle roots at the chest
 * top and points at the shoulder joint — PLUS an elevation term: when the
 * upper arm rises above horizontal, the aim pulls toward the elbow, so the
 * deltoid (skinned to the clavicle) tilts with an abduction instead of the
 * raised arm exiting sideways through a static boulder (Remy's wave back
 * view: an ink ring around the bicep). A hanging or swinging arm keeps the
 * elbow below the shoulder, so the term is ZERO at rest and through the walk
 * cycle — the walk-popout fix stays exact.
 */
function aimClavicle(
  chestTop: { x: number; y: number; z: number },
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  outDir: Vector3,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const e = Math.max(0, dy / len) * 0.45;
  outDir.set(ax + e * dx - chestTop.x, ay + e * dy - chestTop.y, az + e * dz - chestTop.z);
  if (outDir.lengthSq() < 1e-12) outDir.copy(UP);
  outDir.normalize();
}

/** round 17 (humanoid-anatomy): biped arm link fraction of armLengthFt per
 * link (upper = fore). 0.52 gave ape reach (0.44 h shoulder→wrist) that the
 * idle IK could only absorb as a ~77° folded elbow — the "boulder fist welded
 * near the elbow" the round-16 verdict named. 0.4 puts shoulder→wrist at
 * ~0.33 h, the reference human ratio. Shared with the driver (gaits.ts
 * BipedDriver) — parity lockstep. */
export const ARM_LINK_K = 0.4;

/** round 22 (humanoid-anatomy): THE SLIM-FRAME FLOOR.
 *
 * Round 21's verdict: the dwarf ties the WoW grunt and the HUMAN is the
 * outlier — "shoulder span reads about 1.1x the pelvis and the arm is one
 * constant-diameter tube". The cause is structural, not a tuning miss: every
 * mass feature added since round 13 (shoulderOut, the taper-contrast term
 * armBulkT, the deltoid growth, the waist pinch, the stance plant) is written
 * as `max(0, bulk - 1)`, so a frame at bulk 1.0 receives EXACTLY ZERO of it.
 * The dwarf reads because it carries frameMods (bulk 1.35-1.55, shoulder
 * x1.22); the human got a scaled-down version of nothing.
 *
 * `bipedSlimT` is the mirror-image knob: 1 for every slim frame (bulk <= 1.15
 * — human, elf, halfling, tiefling ...), 0 for every bulky one (bulk >= 1.25 —
 * orc, dwarf, goliath, bulky), linear between. Bulky frames are therefore
 * BIT-IDENTICAL to round 21 everywhere it is used, which is what protects the
 * dwarf tie and the orc's praised shoulder mass.
 *
 * Shared by the driver (gaits.ts BipedDriver), the rest pose below, the loft
 * (smoothBipedGeometry) and worn gear (parts/gearArmor.ts) — one formula, no
 * mirrors to drift.
 */
export function bipedSlimT(frame: Frame): number {
  return Math.min(1, Math.max(0, (1.25 - frame.bulk) / 0.1));
}

/** round 22 (humanoid-anatomy): outward push of the shoulder JOINT — the
 * deltoid ball, the upper-arm root, and the pauldron that caps them.
 *
 * The bulky half (r * 0.22 per unit of bulk over 1) is round 13's, untouched.
 * The slim half is new: a flat 0.5 baseR push that only slim frames collect,
 * which is what finally separates the human's shoulder line from his hips. The
 * hand anchor takes only HALF of it (see shoulderXAnchor), so the upper arm
 * slants inward from a wide shoulder to a narrow wrist — the grunt's V, not a
 * wider figure. */
export function bipedShoulderOutM(frame: Frame): number {
  const r = heightM(frame) * 0.105 * frame.bulk;
  return r * 0.22 * Math.max(0, frame.bulk - 1) + r * 0.5 * bipedSlimT(frame);
}

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

/** Real-finger update: digit layout of the biped hand, in the palm bone's
 * canonical frame (+Y along the palm, sgn·X lateral toward the thumb, −Z
 * knuckle front). ONE source for the driver (gaits.ts BipedDriver) and the
 * rest pose below. The link lengths MUST match between the rest pose and
 * every posed frame — the skinned bones are rigid — so the driver's grip
 * curl re-aims these exact links instead of inventing new lengths. */
export interface HandDigitLayout {
  /** Two-link thumb (ChatGPT hand-research round 2): root at the thenar
   * crest, relaxed pose = the fist lock (tip crossing toward the index). */
  thumb: { a: Vector3; j1: Vector3; tip: Vector3; len0: number; len1: number; r0: number; r1: number; r2: number };
  /** Thenar wedge ring centers + lateral half-widths, palm-local, emitted as
   * a 3-segment loft buried into the palm's lateral-front corner. */
  thenar: Array<{ p: Vector3; r: number }>;
  /** pinky → index. Knuckle root (rigid to the hand bone), the relaxed-curl
   * mid joint and tip, the two link lengths, the source column (pose tables
   * for the wave splay live there), and the three ring radii. */
  fingers: Array<{
    root: Vector3;
    j1: Vector3;
    tip: Vector3;
    len0: number;
    len1: number;
    col: FingerCol;
    r0: number;
    r1: number;
    r2: number;
  }>;
}

/** Knuckle columns pinky → index (ChatGPT hand-research round, 2026-08-17).
 * The old uniform digits totaled 121% of the palm width — the open hand was
 * mathematically a fused paddle. The new set follows the researched bands:
 * - lateral half-widths rx 0.19–0.225 handR (total occupancy 84%)
 * - ANISOTROPY: digits run deeper (rz) than wide — fist volume without
 *   eating the open-hand gaps (flatOf carries rz/rx into the loft)
 * - a LENGTH CASCADE (pinky 0.96 → middle 1.19 palm lengths)
 * - a KNUCKLE ARC via per-digit root y offsets (no fence-flat root line)
 * - relaxed-fist curl STAGGER: the pinky curls deepest, the index least,
 *   with a small convergence toward the hand's centerline.
 * x, dy, len0, len1, rx in handR units; angles in degrees. */
export const FINGER_COLS = [
  // round 4: relaxed flex OPENED ~10° (flexP −6, flexD −10) — the deep tuck
  // buried every tip inside the palm envelope and the whole fist quantized
  // into a featureless ball (Remy: "fat balls"); visible tip pads restore
  // the hand read at panel distance.
  { x: -0.72, dy: -0.1, len0: 0.76, len1: 0.54, rx: 0.19, flexP: 63.5, flexD: 90, conv: 7, waveSplay: -14, waveFlex: 12 },
  { x: -0.24, dy: 0.03, len0: 0.89, len1: 0.65, rx: 0.21, flexP: 58.5, flexD: 84.5, conv: 3, waveSplay: -5, waveFlex: 8 },
  { x: 0.24, dy: 0.08, len0: 0.93, len1: 0.67, rx: 0.225, flexP: 53.5, flexD: 79.5, conv: 2, waveSplay: 1, waveFlex: 5 },
  { x: 0.72, dy: 0.0, len0: 0.87, len1: 0.63, rx: 0.215, flexP: 49, flexD: 74.5, conv: 4, waveSplay: 8, waveFlex: 7 },
] as const;
export type FingerCol = (typeof FINGER_COLS)[number];
/** Depth-to-width ratio of a digit cross-section (the anisotropy above). */
export const FINGER_DEPTH_RATIO = 1.18;
const DEG = Math.PI / 180;
/** Palm-local digit direction from a flex angle (0° = along the palm +Y,
 * 90° = toward the knuckle front −Z) plus a small centerline convergence. */
function digitDir(sgn: 1 | -1, col: FingerCol, flexDeg: number): Vector3 {
  const f = flexDeg * DEG;
  return new Vector3(-Math.sign(col.x) * sgn * Math.sin(col.conv * DEG), Math.cos(f), -Math.sin(f)).normalize();
}

export function bipedHandDigits(sgn: 1 | -1, handR: number, palmLen: number, fingerLen: number): HandDigitLayout {
  // ChatGPT hand-research round 2: the old ONE-LINK 0.62R thumb tube was "a
  // second palm lobe" (tip 2.6× the index tip). Its mass moved into the
  // THENAR WEDGE below; the articulated thumb is a two-link chain with
  // digit-scale radii. Relaxed pose = the fist lock: the distal link crosses
  // inward over the index toward the middle finger.
  // hands campaign close (part-quality GOAL, 2026-08-21): the relaxed thumb
  // opens. The old chain was the FIST LOCK (tip crossing inward over the
  // index) — tuned for the lofted finger-mass fist. On the licensed
  // reference mesh (mergeReferenceHand digit wrap) a crossed thumb collapses
  // into a nub against the palm; a neutral thumb rides beside the index,
  // moderately flexed toward the palm plane. Link lengths unchanged, so
  // every driver pose (grips, wave) re-aims the same links.
  const thumb = {
    a: new Vector3(sgn * 0.96 * handR, 0.58 * handR, -0.24 * handR),
    j1: new Vector3(sgn * 1.19 * handR, 1.04 * handR, -0.59 * handR),
    tip: new Vector3(sgn * 1.16 * handR, 1.45 * handR, -0.94 * handR),
    len0: 0.62 * handR,
    len1: 0.54 * handR,
    r0: 0.3 * handR,
    r1: 0.255 * handR,
    r2: 0.205 * handR,
  };
  const thenar = [
    { p: new Vector3(sgn * 0.46 * handR, 0.16 * handR, -0.08 * handR), r: 0.2 * handR },
    { p: new Vector3(sgn * 0.66 * handR, 0.33 * handR, -0.15 * handR), r: 0.34 * handR },
    { p: new Vector3(sgn * 0.85 * handR, 0.49 * handR, -0.21 * handR), r: 0.36 * handR },
    { p: new Vector3(sgn * 0.96 * handR, 0.58 * handR, -0.24 * handR), r: 0.3 * handR },
  ];
  const fingers = FINGER_COLS.map((c) => {
    const len0 = c.len0 * handR;
    const len1 = c.len1 * handR;
    // knuckle ARC: per-digit root y offset breaks the fence-flat root line
    const root = new Vector3(sgn * c.x * handR, palmLen + c.dy * handR, -handR * 0.1);
    // relaxed-fist curl with the researched STAGGER (pinky deepest)
    const j1 = root.clone().addScaledVector(digitDir(sgn, c, c.flexP), len0);
    const tip = j1.clone().addScaledVector(digitDir(sgn, c, c.flexD), len1);
    // taper to ~0.8 of the root width — enough to read as a digit, not
    // enough to vanish into tip wrinkles at panel distance
    return { root, j1, tip, len0, len1, col: c, r0: c.rx * handR, r1: c.rx * handR * 0.94, r2: c.rx * handR * 0.8 };
  });
  return { thumb, thenar, fingers };
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
  // round 20 (humanoid-anatomy): PLANT the bulky stance — the round-19 dwarf
  // "bows outward in a straddle so wide he reads as riding an invisible
  // barrel". The 0.68 shoulder ratio came from slim references; a broad,
  // SHORT frame multiplies it against a span that is huge relative to its leg
  // length and the feet land outside the pelvis. The floor tightens with bulk
  // (human 0.68, orc ≈0.60, dwarf ≈0.57). Mirror: BipedDriver constructor.
  // round 22 (humanoid-anatomy): slim frames PULL THEIR FEET IN (0.68 → 0.58).
  // The shoulder-derived stance is the trap that ate every previous attempt at
  // the human's mass hierarchy: widening the shoulders also widens the stance
  // that is derived from them, so the hip/leg span grows in lockstep and the
  // ratio never moves. Decoupling the slim stance from the widened slim
  // shoulder is half of the round-21 gap fix. Mirror: BipedDriver constructor.
  const slimT = bipedSlimT(frame);
  const stanceFloorK = 0.68 - 0.34 * Math.min(0.5, Math.max(0, frame.bulk - 1)) - 0.1 * slimT;
  const stanceHalf = Math.max(((frame.stanceWidthFt * FT_TO_M) / 2) * 1.12, shoulderVisualHalf * stanceFloorK) * 0.85;

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
  // round 14 (humanoid-anatomy): floor 0.26, slope 0.38 — the orc head still
  // sat directly on the chest; a touch more lift gives the widened traps
  // wedge vertical run to read as a slope. Mirror: BipedDriver.
  // round 21 (humanoid-anatomy): slim frames SHORTEN the neck (0.46 → 0.36
  // lift) — round 20: "a long column neck". Mirror: BipedDriver.advance.
  // round 23 (humanoid-anatomy): the hunch no longer eats the neck — see the
  // full diagnosis on the mirror in gaits.ts (BipedDriver.advance). Visible
  // neck was 0.05 skullR on the orc against 0.35 on the human.
  const hunchForNeck = frame.hunch ?? 0;
  // round 24 (humanoid-anatomy): UPRIGHT BIG HEADS KEEP THEIR CHIN. The dwarf
  // (headScale 1.18, bulk 1.35+) sat on the 0.26 lift floor while its chin dug
  // 0.59 of a LARGER skull, and the 0.47 traps-bury floor put the wedge peak
  // ABOVE the chin — verdict: "uh? chin? neck?". The lift floor and the traps
  // bury floor now rise with the skull excess, gated by (1 − 1.5·hunch) so the
  // orc's seated-jaw grunt read (hunch 0.6, headScale 1.24) keeps its approved
  // look. Mirror: BipedDriver.advance + buildBody.
  const bigHead = Math.max(0, frame.headScale - 1) * Math.max(0, 1 - 1.5 * hunchForNeck);
  const neckLift = Math.min(0.62, Math.max(0.26 + 1.0 * bigHead, 0.36 - 0.28 * Math.max(0, frame.bulk - 1)) + 0.35 * hunchForNeck);
  // round 18 (humanoid-anatomy): FORWARD HUNCH — per-species idle posture
  // (speciesProfiles.hunch → Frame.hunch; the orc's trapezius-dominant lean —
  // round 17: ours "stands bolt upright"). Chest top, shoulders, wrists, and
  // head all shift forward by hunchZ-scaled terms and the head settles down
  // into the traps. hunch is 0 on frames without the param, so every term is
  // a no-op there. Mirror: BipedDriver.advance/buildBody.
  const hunch = frame.hunch ?? 0;
  const hunchZ = hM * 0.09 * hunch;
  const headY = chestTopY + skullR * (0.59 + neckLift) - skullR * 0.35 * hunch;
  // round 13 (humanoid-anatomy): the torso break sits at the BELT line (0.32
  // of pelvis→chest), not midY — mirror of BipedDriver.buildBody beltY.
  const beltY = pelvisY + (chestY - pelvisY) * 0.32;
  const headZ = skullR * 0.25 + hunchZ * 1.4;

  // round 13 (humanoid-anatomy): bulk-driven outward arm push — mirror of
  // BipedDriver advance()/buildBody shoulderOut.
  // round 22 (humanoid-anatomy): the push now carries a SLIM FLOOR as well —
  // see bipedShoulderOutM. Bulky frames get exactly the round-13 number.
  const shoulderOut = bipedShoulderOutM(frame);
  // rest hands (arm swing = 0): x uses the ANCHOR shoulder width (+0.35r),
  // exactly as the driver's advance() does for hand anchors.
  // round 22 (humanoid-anatomy): the hand takes only HALF the slim push, so a
  // slim frame's upper arm slants inward from the widened shoulder joint to a
  // wrist that stays near the hip — the taper the round-21 verdict demanded
  // ("2:1 shoulder to wrist"), instead of a uniformly wider figure. Bulky
  // frames have no slim push, so this is a no-op for them.
  const shoulderXAnchor = (frame.shoulderWidthFt * FT_TO_M) / 2 + r * 0.35
    + r * 0.22 * Math.max(0, frame.bulk - 1) + r * 0.34 * slimT;
  // round 17 (humanoid-anatomy): HANG the arm — the wrist drops to wherever
  // the idle chord equals 0.95 of full reach (2 × 0.4 armLen links), a ~145°
  // near-straight elbow instead of the old ~77° fold that parked the fist at
  // belt height. Mirror: BipedDriver.advance handY.
  const armLink = armLen * ARM_LINK_K;
  const dxRest = r * 0.4;
  const dzRest = hM * 0.045 - 0.02;
  const idleChord = 0.95 * 2 * armLink;
  const handY = chestY + r * 0.45
    - Math.sqrt(Math.max(idleChord * idleChord - dxRest * dxRest - dzRest * dzRest, armLink * armLink * 0.25));
  // round 18 (humanoid-anatomy): the wrist rides forward with the hunched
  // shoulders (same hunchZ both sides keeps dzRest — the hang solve — exact).
  const handZ = hM * 0.045 + hunchZ;

  // buildBody uses the BARE half shoulder width for the shoulder joint
  const shoulderXBody = (frame.shoulderWidthFt * FT_TO_M) / 2 + shoulderOut;
  const armR = Math.max(r * 0.3, armLen * 0.085);
  // round 6 (humanoid-anatomy): near 3:1 shoulder-to-wrist taper + palm-block
  // hand — mirror of the BipedDriver.buildBody arm loop (the stance formulas
  // above keep the round-4 armR * 1.6 term; the deltoid ball itself is 1.7)
  // round 17 (humanoid-anatomy): four silhouette stations — deltoid ball →
  // elbow NARROWING (0.68) → loft forearm flare → wrist narrowest (0.55),
  // fist attaching at the wrist. Mirror: BipedDriver.buildBody.
  // round 20 (humanoid-anatomy): TAPER CONTRAST scales with bulk — round 19's
  // orc "near-constant-width arms look inflated". The round-17 numbers were
  // tuned on the human, so bulky frames scaled every station by the same armR
  // and kept one width down the arm. Shoulder grows, elbow/wrist shrink with
  // bulk; the human wrist narrows too (0.55 → 0.49, the "tube arms with no
  // forearm-to-wrist taper" read). Mirror: BipedDriver.buildBody arm loop.
  // round 22 (humanoid-anatomy): SLIM FRAMES GET THE SAME TREATMENT. armBulkT
  // is 0 at bulk 1, so every station above was one armR wide on the human —
  // literally the round-21 verdict's "one constant-diameter tube from deltoid
  // to wrist". The slim term widens the shoulder and tightens the wrist by the
  // same amounts the bulky term does, which puts the human's shoulder:wrist at
  // ≈4:1 on the segment and its deltoid at ≈2× the forearm — the grunt ratio
  // the dwarf already hits. Mirror: BipedDriver.buildBody arm loop.
  const armBulkT = Math.min(0.6, Math.max(0, frame.bulk - 1));
  const shoulderR = armR * (1.48 + 0.5 * armBulkT + 0.42 * slimT);
  const elbowR = armR * (0.68 - 0.12 * armBulkT - 0.06 * slimT);
  const wristR = armR * (0.49 - 0.06 * armBulkT - 0.04 * slimT);
  // round 15 (humanoid-anatomy): FIST SCALE — the round-14 verdict's "plain
  // spheres" were hands at 0.38–0.44 of skull width; the references block
  // fists at ~0.6–0.7. The fist half-width now carries a skull-derived floor
  // (0.6 skullR ⇒ fist width = 0.6 skull width), and the hand splits into a
  // palm block plus a curled finger mass. Mirror: BipedDriver.buildBody.
  // round 19 (humanoid-anatomy): fist floor 0.6 → 0.45 skullR — Remy's live
  // eyeball: the dwarf's free hand was "a giant flat slab, near head-size".
  // With palm+finger run ~2.3 handR, 0.6 skullR put total fist length at
  // ~0.87 of the head height; 0.45 lands it at ~0.65, the reference blocky
  // fist that no longer out-masses the skull. Mirror: BipedDriver.buildBody.
  // hand-research round 4: fist scale-down (see the mirror note in
  // BipedDriver.buildBody — real digits grew the envelope past the round-19
  // budget and the dwarf fist read as a fat ball).
  const handR = Math.max(armR * 1.0, skullR * 0.4);
  const palmLen = handR * 1.28;
  const fingerLen = handR * 0.95;
  // round 1 (humanoid-anatomy): near 2:1 thigh-to-calf taper — mirror of the
  // BipedDriver.buildBody leg radii
  const legR = Math.max(r * 0.36, legLen * 0.105);
  // round 13 (humanoid-anatomy): torso-derived thigh-root floor (0.58 r) so
  // bulky frames' legs match their torso; knee keeps half the root. Mirror:
  // BipedDriver.buildBody leg radii.
  const thighR = Math.max(legR * 1.32, r * 0.58);
  // round 14 (humanoid-anatomy): knee 0.72 legR → 0.62 (and the thigh-root
  // fraction 0.5 → 0.44) — the round-13 thighs read as "constant-width
  // tubes"; the reference thighs narrow visibly toward the knee. Mirror:
  // BipedDriver.buildBody leg radii.
  // round 18 (humanoid-anatomy): THE KNEE NECK. Round 17: "legs are
  // featureless cones ... no knee station and no calf bulge". Same method as
  // the round-17 arm stations — the joint pinches in the driver radii (knee
  // 0.62 → 0.52 legR, root fraction 0.44 → 0.4) and the ankle narrows
  // (0.5 → 0.36 legR) so the loft's calf swell (smoothBipedGeometry .shin
  // stations) has somewhere to rise from and fall to. Front outline now runs
  // quad mass → pinched knee → calf swell → ankle → boot. Mirror:
  // BipedDriver.buildBody leg radii.
  // round 21 (humanoid-anatomy): knee pinches again (0.52 → 0.46 legR, root
  // fraction 0.4 → 0.35) — round 20: "thigh and shin are close to the same
  // width ... reference thighs taper hard into the knee". Mirror:
  // BipedDriver.buildBody leg radii.
  const kneeR = Math.max(legR * 0.46, thighR * 0.35);
  // round 19 (humanoid-anatomy): ankle 0.36 → 0.44 legR — Remy's live
  // eyeball: "pinched ankles" snapping into the boot lump; the calf bell
  // (smoothBipedGeometry .shin stations) now lands on a real ankle. Mirror:
  // BipedDriver.buildBody.
  const ankleR = legR * 0.44;

  const segments: RestSegment[] = [];
  const balls: RestBall[] = [];

  // torso + head — emission order matches BipedDriver.buildBody
  // round 13 (humanoid-anatomy): THE PELVIS BREAK — three torso masses that
  // meet at the belt. round 14: the round-13 masses were INVERTED — hips
  // 1.14 r over ribcage 1.02 r gave every figure the "pear/diaper" read. The
  // reference relationship is chest-dominant: ribcage 1.12 r is the widest
  // torso mass, hips 0.9 r (~80% of it), waist pinch 0.68 r at the belt.
  // Mirror of BipedDriver.buildBody.
  // round 16 (humanoid-anatomy): the waist pinch DEEPENS with bulk (0.68 →
  // ~0.60 at dwarf/orc bulk, floor 0.56). At bulk 1.35+ the fixed 0.68 ratio
  // rides a huge r, and the belt blend zones smeared what was left — the
  // dwarf's round-15 "unpinched cylinder" belt. Mirror: BipedDriver.buildBody.
  const waistK = Math.max(0.56, 0.68 - 0.18 * Math.max(0, frame.bulk - 1));
  segments.push({ id: 'torso.pelvis', bone: 'pelvis', a: [0, pelvisY - r * 0.2, 0], b: [0, beltY, 0.007], r0: r * 0.9, r1: r * waistK });
  // round 18 (humanoid-anatomy): the chest TOP carries the hunch forward —
  // the whole spine above the belt leans as one line. Mirror: BipedDriver.
  // round 22 (humanoid-anatomy): slim frames widen the UPPER CHEST (1.12 →
  // 1.20 r). The round-21 verdict asked for "deltoid/upper-chest volume" on
  // the human specifically; the waist pinch is untouched, so what grows is the
  // ribcage-over-waist V and nothing else. Mirror: BipedDriver.buildBody.
  segments.push({ id: 'torso.chest', bone: 'chest', a: [0, beltY, 0.007], b: [0, chestTopY, 0.02 + hunchZ], r0: r * waistK, r1: r * (1.12 + 0.08 * slimT) });
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
    // round 24 (humanoid-anatomy): the peak stays BELOW the chin (−0.59) on
    // upright big-headed frames — the 0.47 floor topped the dwarf's jaw. See
    // the bigHead note at neckLift. Mirror: BipedDriver.buildBody.
    const trapsBury = Math.max(0.47 + 1.6 * bigHead, 0.95 - 1.2 * Math.max(0, frame.bulk - 1));
    // round 21 (humanoid-anatomy): the slim trapezius narrows (0.54 → 0.46).
    // Mirror: BipedDriver.buildBody.
    const trapsR1 = Math.min(0.82, 0.46 + 0.8 * Math.max(0, frame.bulk - 1));
    // round 14 (humanoid-anatomy): traps root 0.88 r → 1.04 r. The round-9
    // wedge never READ because its root sat INSIDE the chest silhouette
    // (chest top is 1.12 r wide here) — the slope only exists where it owns
    // the outline. Rooting the wedge just proud of the ribcage puts the
    // trapezius line on the silhouette between deltoid and skull.
    segments.push({ id: 'torso.traps', bone: 'neck', a: [0, chestTopY - r * 0.55, 0.02 + hunchZ], b: [0, headY - skullR * trapsBury, headZ * 0.6], r0: r * 1.04, r1: skullR * trapsR1 });
  }
  segments.push({ id: 'neck', bone: 'neck', a: [0, chestTopY, 0.02 + hunchZ], b: [0, headY - skullR * 0.45, headZ * 0.85], r0: r * 0.52, r1: neckTipR });
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
    // round 18 (humanoid-anatomy): shoulders ROLL FORWARD with the hunch —
    // the deltoid balls ride the same hunchZ the chest top does. Mirror:
    // BipedDriver.buildBody.
    shoulder.set(sgn * shoulderXBody, chestY + r * 0.45, 0.02 + hunchZ);
    // round 14 (humanoid-anatomy): elbow bend re-aimed mostly BACKWARD
    // (sgn·0.45, 0, −1) — the old sideways bend (sgn, 0, −0.4) pushed the
    // elbow out laterally, arcing the whole arm into the critic's "banana
    // bow"; a rear-tucked elbow hangs the arm straight in the front view.
    // Mirror: BipedDriver.buildBody.
    bend.set(sgn * 0.45, 0, -1).normalize();
    // round 17 (humanoid-anatomy): links 0.4 armLen (ARM_LINK_K)
    solveKnee(shoulder, target.set(hand[0], hand[1], hand[2]), armLen * ARM_LINK_K, armLen * ARM_LINK_K, bend, joint);
    // deltoid ball before the upper segment — same order as the driver
    // round 20 (humanoid-anatomy): the deltoid grows with the same bulk term
    // as shoulderR — the boulder shoulder the WoW grunt leads with. Mirror:
    // BipedDriver.buildBody deltoid ball.
    // round 22 (humanoid-anatomy): + the slim floor (see bipedSlimT) — the
    // human's deltoid ball was the round-17 number with zero bulk bonus.
    // clavicle update (Remy: "shoulder does a weird popout during walking"):
    // the deltoid SKINS to the clavicle, not the upper arm. The round-21
    // ellipsoid centroid sits 0.34 r inboard of the shoulder joint, so 100%
    // upperArm weights made the whole mass ORBIT the joint with every arm
    // swing. The clavicle holds it against the torso, lifts it on the wave
    // shoulder raise, and receives Mixamo shoulder tracks. The pose sink's
    // emission table (BALL_BONE) keeps upperArm — that write is position-only
    // and the arm.upper segment overwrites it.
    balls.push({ id: `deltoid${side}`, bone: `clavicle${side}` as BipedBoneName, center: [shoulder.x, shoulder.y, shoulder.z], r: armR * (1.7 + 0.5 * armBulkT + 0.5 * slimT) });
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
    // hand: thumb first, fingers second, palm LAST (the palm drives the hand
    // bone — bindWorld picks the LAST segment per bone to match the pose
    // sink's write order)
    palmDir.set(hand[0] - joint.x, hand[1] - joint.y, hand[2] - joint.z).normalize();
    // round 4 (hand research): near-neutral hang — the round-16/18
    // camera-aimed cocks served the painted thumb; real digits carry their
    // own silhouette. Mirror: BipedDriver.buildBody arm loop.
    palmDir.z += 0.24;
    palmDir.x += sgn * 0.08;
    palmDir.normalize();
    palmQuat.setFromUnitVectors(UP, palmDir);
    // real-finger update: the round-15 thumb lobe and curled finger mass are
    // replaced by REAL DIGITS from the shared layout (bipedHandDigits) — a
    // thumb link plus four two-link fingers, each on its own bone. Emission
    // order per hand: thumb, finger0a..finger3b, palm LAST (the palm still
    // drives the hand bone). Mirror: BipedDriver.buildBody arm loop.
    const digits = bipedHandDigits(sgn, handR, palmLen, fingerLen);
    const toWorld = (v: Vector3): [number, number, number] => {
      thumbPt.copy(v).applyQuaternion(palmQuat);
      return [hand[0] + thumbPt.x, hand[1] + thumbPt.y, hand[2] + thumbPt.z];
    };
    // thenar wedge: rings 0-1 palm-rigid, the distal ring on the thumb root
    // (see the SEGMENT_BONE thenar note — the pad follows the thumb)
    for (let ti = 0; ti < 3; ti++) {
      segments.push({
        id: `hand${side}.thenar${ti}`,
        bone: (ti === 2 ? `thumb${side}a` : `hand${side}`) as BipedBoneName,
        a: toWorld(digits.thenar[ti].p),
        b: toWorld(digits.thenar[ti + 1].p),
        r0: digits.thenar[ti].r,
        r1: digits.thenar[ti + 1].r,
      });
    }
    segments.push({
      id: `hand${side}.thumba`,
      bone: `thumb${side}a` as BipedBoneName,
      a: toWorld(digits.thumb.a),
      b: toWorld(digits.thumb.j1),
      r0: digits.thumb.r0,
      r1: digits.thumb.r1,
    });
    segments.push({
      id: `hand${side}.thumbb`,
      bone: `thumb${side}b` as BipedBoneName,
      a: toWorld(digits.thumb.j1),
      b: toWorld(digits.thumb.tip),
      r0: digits.thumb.r1,
      r1: digits.thumb.r2,
    });
    for (const [fi, f] of digits.fingers.entries()) {
      // hands round 2 (part-quality campaign): the drawn digit root extends
      // ~0.35 handR back into the palm along its own axis — the root-embed
      // rule. Mirror of BipedDriver.buildBody finger emission.
      const buried = f.root.clone().sub(f.j1).normalize().multiplyScalar(handR * 0.35).add(f.root);
      segments.push({
        id: `hand${side}.finger${fi}a`,
        bone: `finger${side}${fi}a` as BipedBoneName,
        a: toWorld(buried),
        b: toWorld(f.j1),
        r0: f.r0,
        r1: f.r1,
      });
      segments.push({
        id: `hand${side}.finger${fi}b`,
        bone: `finger${side}${fi}b` as BipedBoneName,
        a: toWorld(f.j1),
        b: toWorld(f.tip),
        r0: f.r1,
        r1: f.r2,
      });
    }
    const palmTip: [number, number, number] = [
      hand[0] + palmDir.x * palmLen, hand[1] + palmDir.y * palmLen, hand[2] + palmDir.z * palmLen,
    ];
    segments.push({
      id: `hand${side}.palm`,
      bone: `hand${side}` as BipedBoneName,
      a: hand,
      b: palmTip,
      r0: handR * 0.88,
      r1: handR,
    });
  }

  // legs, L then R (driver leg[0] rests at -stance; both feet rest at z 0.01)
  // round 5 (humanoid-anatomy): hips directly over the feet (factor 1.0 — the
  // narrowing moved into stanceHalf), exact x-mirrored knee bend vectors with
  // a small outward lean (0.1), and heel-to-toe wedge feet as segments —
  // mirror of BipedDriver.buildBody leg loop
  // round 21 (humanoid-anatomy): THE BOOT — see smoothBipedGeometry
  // footStations for the full diagnosis. The loft radius on a +Z chain is the
  // foot's X HALF-WIDTH, so it now carries ≈1.8× the ankle (the round-20 gap:
  // "zero width gain past the ankle"), the height is solved per station from
  // the heel/toe line so the sole stays flat, and each toe SPLAYS outward so
  // the foot's length profiles to the front camera instead of pointing
  // straight at it. Mirror: BipedDriver.buildBody leg loop.
  // round 22 (humanoid-anatomy): the round-21 boot landed on the DWARF ("boots
  // that read as FEET in the front panel") and missed the human ("small
  // rounded nubs barely wider than the ankle with no toe splay"). The reason is
  // the same slim-frame blind spot: the boot's width floor runs off ankleR,
  // and the slim ankle is the narrowest of the three subjects, so the same
  // multiplier bought the human the least width. Slim frames now carry their
  // own wider floor and a bigger toe splay. Bulky frames are unchanged.
  const footHalfW = Math.max(ankleR * (1.78 + 0.5 * slimT), legR * (0.8 + 0.14 * slimT));
  const heelBack = legR * 0.9;
  const toeFwd = legR * 2.1;
  const heelH = legR * 0.62;
  const toeH = legR * 0.34;
  // round 23 (humanoid-anatomy): the toes SPLAY harder. Round 22 read "no
  // left/right difference" on every boot, and a mirrored toe-out is the only
  // thing that can produce one from a front camera — two feet that both point
  // straight at the lens are the same shape. The bulky base was 0.5 legR (about
  // 6° on a 2.1-legR foot), which reads as manufacturing tolerance, not stance.
  const toeOutX = legR * (0.85 + 0.1 * slimT);
  for (const sgn of [-1, 1] as const) {
    const side = sgn < 0 ? 'L' : 'R';
    const foot: [number, number, number] = [sgn * stanceHalf, 0, 0.01];
    hip.set(sgn * stanceHalf, pelvisY - r * 0.3, 0);
    // round 14 (humanoid-anatomy): knee bend outward lean 0.1 → 0.02 — the
    // orc's knees bowed outward and the dwarf's shins bowed with them; the
    // knee now tracks almost straight forward over the foot. Mirror:
    // BipedDriver.buildBody leg loop.
    bend.set(sgn * 0.02, 0, 1).normalize();
    solveKnee(hip, target.set(foot[0], foot[1], foot[2]), legLen * 0.52, legLen * 0.52, bend, joint);
    segments.push({
      id: `leg${side}.thigh`,
      bone: `thigh${side}` as BipedBoneName,
      a: [hip.x, hip.y, hip.z],
      b: [joint.x, joint.y, joint.z],
      r0: thighR,
      r1: kneeR,
    });
    // round 21 (humanoid-anatomy): the drawn shin STOPS at the ankle instead
    // of running to the floor. Round 20 read "the shin cylinder runs straight
    // to the ground and stops" — literally true: the shin tip sat at y 0, its
    // end cap coplanar with the sole. It now ends inside the boot shaft (the
    // heel form rises to 2× heelH), which is what turns the ankle into a
    // visible forward BREAK. leg.pos is untouched, so IK and foot planting are
    // unchanged. Mirror: BipedDriver.buildBody leg loop.
    segments.push({
      id: `leg${side}.shin`,
      bone: `shin${side}` as BipedBoneName,
      a: [joint.x, joint.y, joint.z],
      b: [foot[0], foot[1] + legR * 0.34, foot[2]],
      r0: kneeR,
      r1: ankleR,
    });
    segments.push({
      id: `foot${side}`,
      bone: `foot${side}` as BipedBoneName,
      a: [foot[0], foot[1] + heelH, foot[2] - heelBack],
      b: [foot[0] + sgn * toeOutX, foot[1] + toeH, foot[2] + toeFwd],
      r0: footHalfW,
      r1: footHalfW * 0.72,
    });
  }

  return { segments, balls };
}

export interface BuiltSkeleton {
  /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
  root: Bone;
  /** All 39 bones, parent-first, in BIPED_BONE_NAMES order. */
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
  // Clavicles have no flesh piece of their own — they DERIVE from two pieces
  // that already exist: root at the chest top ('torso.chest' B), +Y toward
  // the shoulder joint ('arm.upper' A). The live sink applies the identical
  // rule, so parity is automatic.
  if (name === 'clavicleL' || name === 'clavicleR') {
    const chest = restPose.segments.find((s) => s.id === 'torso.chest');
    const upper = restPose.segments.find((s) => s.id === (name === 'clavicleL' ? 'armL.upper' : 'armR.upper'));
    if (!chest || !upper) throw new Error(`bindWorld: missing torso.chest/arm.upper for "${name}"`);
    outPos.set(chest.b[0], chest.b[1], chest.b[2]);
    const dir = new Vector3();
    aimClavicle(
      { x: chest.b[0], y: chest.b[1], z: chest.b[2] },
      upper.a[0], upper.a[1], upper.a[2],
      upper.b[0], upper.b[1], upper.b[2],
      dir,
    );
    outQuat.setFromUnitVectors(UP, dir);
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
export interface BipedPoseSinkOptions {
  /** Forward kinematics (foreign rigs, 2026-08-22): every bone keeps its own
   * BIND offset from its parent and takes only the driver's rotation; the
   * pelvis alone takes the driver's position. The rig's limb lengths — its
   * shape — never change under animation. Default false: the procedural
   * body takes the driver's absolute joint positions (its own lengths). */
  fk?: boolean;
}

export function createBipedPoseSink(skeleton: BuiltSkeleton, options: BipedPoseSinkOptions = {}): BipedPoseSink {
  const n = skeleton.bones.length;
  const worldPos: Vector3[] = Array.from({ length: n }, () => new Vector3());
  const worldQuat: Quaternion[] = Array.from({ length: n }, () => new Quaternion());
  // FK (foreign rigs): a bone's frame is its BIND frame swung by the smallest
  // rotation from its bind direction to the driver's direction. The absolute
  // "+Y onto direction" frame adds an uncontrolled roll when a bone swings
  // far from its bind (a T-pose arm to hanging = 90°), and the shoulder skin
  // twisted with it (Remy's warped torso, 2026-08-23).
  // FK (foreign rigs) = a RETARGET by local delta. The driver's absolute
  // frames are computed as for our own body (+Y onto direction), but what
  // reaches the rig is each bone's LOCAL rotation change from the driver's
  // own rest pose, applied onto the rig's bind local. A straight bind stays
  // straight in idle whatever its bone axes do (the female's centered chest
  // axis tilted, and the earlier "swing the bind axis onto the target" rule
  // turned that into an 18° forward lean, 2026-08-23); roll behaves as it
  // does on our own body, because the deltas are the same ones.
  const parentOf: number[] = skeleton.bones.map((b) => (b.parent && (b.parent as Bone).isBone ? skeleton.index.get(b.parent.name as BipedBoneName)! : -1));
  const restQ: Quaternion[] = options.fk
    ? skeleton.bones.map((b) => {
        const q = new Quaternion();
        bindWorld(skeleton.restPose, b.name as BipedBoneName, new Vector3(), q);
        return q;
      })
    : [];
  // Static alignment: each rig bone's BIND direction swung onto the driver's
  // REST direction, once. For a T-pose arm that is the 90° frontal-plane
  // swing onto the hanging arm (two perpendicular directions — no axis
  // ambiguity); for spine, legs, and hanging arms it is near identity.
  // After that the rig behaves as a body whose bind IS the driver's rest,
  // and the driver's absolute frames move it exactly as they move our own.
  const restInv: Quaternion[] = options.fk ? restQ.map((q) => q.clone().invert()) : [];
  const alignedBind: Quaternion[] = options.fk
    ? skeleton.bindWorldQuat.map((qb, i) => {
        const bindDir = UP.clone().applyQuaternion(qb).normalize();
        const restDir = UP.clone().applyQuaternion(restQ[i]).normalize();
        const S = new Quaternion().setFromUnitVectors(bindDir, restDir);
        return S.multiply(qb); // S × bind: the bind frame re-aimed onto the rest direction
      })
    : [];
  const nowQ: Quaternion[] = options.fk ? restQ.map((q) => q.clone()) : [];
  const hasDir: boolean[] = new Array(n).fill(false);
  const DELTA = new Quaternion();
  const aim = (i: number, dir: Vector3): void => {
    if (options.fk) {
      nowQ[i].setFromUnitVectors(UP, dir);
      hasDir[i] = true;
    } else {
      worldQuat[i].setFromUnitVectors(UP, dir);
    }
  };
  // root never receives emissions; it stays at the entity-local origin
  const written: boolean[] = new Array(n).fill(false);
  written[0] = true;

  const boneFor = (table: Readonly<Record<string, BipedBoneName>>, id: string): number => {
    const name = table[id];
    if (!name) throw new Error(`biped pose sink: no bone mapped for emission id "${id}"`);
    return skeleton.index.get(name)!;
  };

  // Clavicle derivation state: the chest top ('torso.chest' B) arrives before
  // the arm segments in buildBody order; each 'arm.upper' A is the shoulder.
  const chestTop = new Vector3();
  // FK: several emissions share one bone (the trapezius wedge and the neck
  // both own `neck`; the thenar pieces and the palm own `hand`). The rigid
  // segment body wants the LAST piece; a foreign rig wants the bone's own
  // limb direction, so only the primary emission aims it.
  const FK_PRIMARY: Partial<Record<BipedBoneName, string>> = {
    neck: 'neck',
    handL: 'handL.palm',
    handR: 'handR.palm',
    thumbLa: 'handL.thumba',
    thumbRa: 'handR.thumba',
  };
  const sink: SegmentSink = {
    seg(id, ax, ay, az, bx, by, bz) {
      const i = boneFor(SEGMENT_BONE, id);
      if (options.fk) {
        const primary = FK_PRIMARY[skeleton.bones[i].name as BipedBoneName];
        if (primary && primary !== id) return;
      }
      worldPos[i].set(ax, ay, az);
      DIR.set(bx - ax, by - ay, bz - az);
      if (DIR.lengthSq() < 1e-12) DIR.copy(UP);
      aim(i, DIR.normalize());
      written[i] = true;
      // Clavicles carry no flesh, so no emission drives them directly. They
      // derive here by the same rule bindWorld uses: root at the chest top,
      // +Y toward the shoulder joint. Identical inputs → automatic parity.
      if (id === 'torso.chest') {
        chestTop.set(bx, by, bz);
      } else if (id === 'armL.upper' || id === 'armR.upper') {
        const c = skeleton.index.get(id === 'armL.upper' ? 'clavicleL' : 'clavicleR')!;
        worldPos[c].copy(chestTop);
        aimClavicle(chestTop, ax, ay, az, bx, by, bz, DIR);
        aim(c, DIR);
        written[c] = true;
      }
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
    if (options.fk) {
      // parents first (BIPED_BONE_NAMES order); a bone without an emission
      // this frame keeps the driver's rest frame, so its delta is identity
      worldQuat[0].copy(skeleton.bindWorldQuat[0]);
      for (let i = 1; i < n; i++) {
        const p = parentOf[i];
        if (!hasDir[i]) nowQ[i].copy(restQ[i]);
        // world = (driver now × driver rest⁻¹) × aligned bind — the driver's
        // absolute change from its rest, on the rig bone aligned to that rest
        DELTA.copy(nowQ[i]).multiply(restInv[i]);
        worldQuat[i].copy(DELTA).multiply(alignedBind[i]);
        const pq = p < 0 ? skeleton.bindWorldQuat[0] : worldQuat[p];
        INV.copy(pq).invert();
        skeleton.bones[i].quaternion.copy(INV).multiply(worldQuat[i]);
        if (skeleton.bones[i].name === 'pelvis' && written[i]) {
          skeleton.bones[i].position.copy(worldPos[i]).applyQuaternion(INV);
        }
        hasDir[i] = false;
        written[i] = false;
      }
      return;
    }
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
      if (!options.fk || skeleton.bones[i].name === 'pelvis') {
        skeleton.bones[i].position.copy(worldPos[i]).sub(worldPos[p]).applyQuaternion(INV);
      }
      skeleton.bones[i].quaternion.copy(INV).multiply(worldQuat[i]);
      written[i] = false;
    }
  }

  return { sink, finishFrame };
}
