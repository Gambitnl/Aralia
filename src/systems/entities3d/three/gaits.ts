// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/07/2026, 12:50:38
 * Dependents: components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx, systems/entities3d/three/Entity3D.tsx, systems/entities3d/three/assembleEntity.ts, systems/entities3d/three/crowdBake.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file gaits.ts — the six locomotion drivers, generalized from the blobfolk
 * prototype's hardcoded critters to any Frame.
 *
 * A driver owns the per-frame skeleton math: it advances the gait cycle,
 * emits the body's bone segments (buildBody — body v2: rigid tapered segments
 * between the IK joints, not metaballs), and maintains the Pose — the named
 * anchor transforms that modular parts attach to. Locomotion (where the
 * entity is, which way it faces, how fast it moves) comes from the caller;
 * drivers only need `speed` (and expose `verticalOffsetM` for airborne body
 * lift, applied by the assembler to the body root).
 */
import { Quaternion, Vector3, Euler } from 'three';
import type { Anchor, Frame, Gait, PlanSpec, SegmentSink } from '../types';
import { ANCHORS, FT_TO_M, headRadiusM, heightM } from '../types';
import { smooth, solveKnee } from './ik';
import { solveFabrikPoints } from './fabrik';
import { BallSocketConstraint, type JointConstraint } from './jointConstraints';
import { ARM_LINK_K, bipedSkullRadiusM } from './skeletonBuilder';
import { TreadmillLeg } from './legs';
import { spineRadiusAt } from '../textPlan/spineProfile';

export interface LocomotionState {
  position: Vector3;
  heading: Vector3;
  /** Ground speed in m/s (or air speed for flyers). */
  speed: number;
}

export interface PoseAnchor {
  pos: Vector3;
  quat: Quaternion;
}

export interface Pose {
  anchors: Record<Anchor, PoseAnchor>;
}

/** A planned head's live position + look direction (for per-socket eyes). */
export interface PlanHeadSocket {
  x: number;
  y: number;
  z: number;
  /** Head ball radius in meters. */
  r: number;
  /** Unit look direction (where the face points). */
  fx: number;
  fy: number;
  fz: number;
  eyes: { count: number; sizeScale: number };
}

export interface GaitDriver {
  update(t: number, dt: number, loco: LocomotionState): void;
  /** Emit this frame's body skeleton (entity-local meters, ground at y=0):
   * tapered bone segments + round lumps (head, hands, feet). Segment ids are
   * stable across frames and radii are frame-constant per id. */
  buildBody(sink: SegmentSink): void;
  readonly pose: Pose;
  readonly gaitPhase: number;
  /** Debugger scrub: jump the gait cycle to `phase` (wrapped into 0–1). */
  setPhase(phase: number): void;
  /** Wing flap angle in radians. Flyers own the power stroke; grounded
   * gaits emit a gentle speed-scaled wing beat (harmless on wingless
   * bodies — the assembler only applies flap to parts with wingL/wingR
   * groups); hopper stays 0 (no winged hopper profiles exist). */
  readonly flap: number;
  /** 0 spread … 1 folded along the body. Grounded winged gaits fold at rest
   * (idle dragons carry wings swept back, not vertical sails) and open as
   * speed builds; flyers stay 0. The assembler sweeps wingL/wingR by this. */
  readonly wingFold: number;
  /** Extra body lift (hopper airtime, flyer altitude), applied by the assembler. */
  readonly verticalOffsetM: number;
  /** Plan-driven bodies: live head positions for per-socket eye placement. */
  headSockets?(): PlanHeadSocket[];
}

function makePose(): Pose {
  return {
    anchors: Object.fromEntries(
      ANCHORS.map((a) => [a, { pos: new Vector3(), quat: new Quaternion() }]),
    ) as Record<Anchor, PoseAnchor>,
  };
}

// Body v2: bones go straight to the sink as segments — no interpolated balls.

const EULER = new Euler();
const V_HIP = new Vector3();
const V_KNEE = new Vector3();
const V_BEND = new Vector3();
const V_HAND = new Vector3();
const V_SH = new Vector3();
// round 2 (humanoid-anatomy): mitt-hand scratch vectors.
// round 6 (humanoid-anatomy, 6b rescue): the palm frame is the CANONICAL
// quaternion setFromUnitVectors(UP, palmDir) — the exact transport the
// skeleton pose sink applies to the hand bone — so the thumb (constant local
// coordinates in that frame) stays rigid to the bone in every walk phase. A
// hand-built Gram-Schmidt basis twisted off the canonical transport by ~1 cm
// mid-swing. The frame is well conditioned: the palm cocks ~18° forward
// (z += 0.32), keeping palmDir clear of the degenerate straight-down
// antipode. Mirror: skeletonBuilder.bipedRestPose arm loop.
const V_PALM_DIR = new Vector3();
const Q_PALM = new Quaternion();
// round 15 (humanoid-anatomy): fist scratch — palm tip (knuckle line) and
// curled-finger tip.
const V_PALM_TIP = new Vector3();
const V_FINGER_B = new Vector3();
const UP_Y = new Vector3(0, 1, 0);
const V_THUMB_A = new Vector3();
const V_THUMB_B = new Vector3();

abstract class BaseDriver implements GaitDriver {
  readonly pose = makePose();
  gaitPhase = 0;
  flap = 0;
  wingFold = 0;
  verticalOffsetM = 0;
  protected t = 0;
  protected speed = 0;
  protected speedFactor = 0;
  protected readonly hM: number;
  protected readonly hr: number;
  protected readonly baseR: number;
  protected readonly legLenM: number;

  constructor(protected readonly frame: Frame) {
    this.hM = heightM(frame);
    this.hr = headRadiusM(frame);
    this.baseR = this.hM * 0.105 * frame.bulk;
    this.legLenM = frame.limbLengthFt * FT_TO_M;
  }

  protected cadence(): number {
    if (this.speed < 0.01) return 1.2;
    return Math.min(1.5 + this.speed / Math.max(this.legLenM, 0.2) / 2.4, 3.0);
  }

  protected strideHalf(): number {
    if (this.speed < 0.01) return 0;
    return Math.min(this.speed / (2 * this.cadence()), this.legLenM * 0.42);
  }

  update(t: number, dt: number, loco: LocomotionState): void {
    this.t = t;
    this.speed = Math.max(0, loco.speed);
    this.speedFactor = Math.min(this.speed / 1.2, 1);
    this.gaitPhase += this.cadence() * Math.max(dt, 0);
    this.advance(t, dt);
  }

  setPhase(phase: number): void {
    this.gaitPhase = ((phase % 1) + 1) % 1;
  }

  /** Per-gait skeleton update; must refresh every pose anchor. */
  protected abstract advance(t: number, dt: number): void;
  abstract buildBody(sink: SegmentSink): void;

  protected setAnchor(a: Anchor, x: number, y: number, z: number): void {
    this.pose.anchors[a].pos.set(x, y, z);
  }

  /** Grounded wing beat: a slow sway at idle that deepens with speed. The
   * flyer's 9 rad/s power stroke stays airborne-only; this is the "alive on
   * the ground" beat for winged walkers (dragon, celestial, fiend, fairy,
   * aarakocra). Drivers without winged profiles leave flap at 0. The formula
   * matches the plan driver's wing beat so both dragon paths move alike. */
  protected groundedWingBeat(): number {
    return Math.sin(this.t * 6) * (0.25 + 0.45 * this.speedFactor);
  }

  /** Rest fold for grounded winged walkers: folded at idle, fully open by
   * ~30% speed. Harmless on wingless bodies (assembler no-ops without
   * wingL/wingR groups). */
  protected groundedWingFold(): number {
    return Math.min(1, Math.max(0, 1 - this.speedFactor * 3.5));
  }

  /** Standard head-cluster anchors around a head center. `r` defaults to the
   * frame head radius; drivers that draw a rescaled skull (BipedDriver round 6)
   * pass their drawn radius so head gear stays glued to the ball. */
  protected setHeadAnchors(hx: number, hy: number, hz: number, r: number = this.hr): void {
    this.setAnchor('head', hx, hy, hz);
    this.setAnchor('crown', hx, hy + r * 0.95, hz - r * 0.1);
    this.setAnchor('jaw', hx, hy - r * 0.55, hz + r * 0.45);
    this.setAnchor('browL', hx - r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('browR', hx + r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('earL', hx - r * 0.95, hy + r * 0.15, hz - r * 0.05);
    this.setAnchor('earR', hx + r * 0.95, hy + r * 0.15, hz - r * 0.05);
  }
}

/* ------------------------------------------------------------------ biped */

class BipedDriver extends BaseDriver {
  private readonly legs: [TreadmillLeg, TreadmillLeg];
  private pelvisY = 0;
  private chestY = 0;
  private headY = 0;
  private bob = 0;
  private sway = 0;
  /** round 6 (humanoid-anatomy): drawn skull radius — slim frames carry a
   * smaller skull than headRadiusM so the dome stops dwarfing the shoulders.
   * Mirror: skeletonBuilder.bipedSkullRadiusM (one shared formula). */
  private readonly skullR: number;
  /** round 6 (humanoid-anatomy): IK wrist targets, stashed in advance() —
   * buildBody() re-aims the public hand anchors at the FIST center (grip
   * point), so the anchors can no longer double as the next IK input. */
  private readonly wrist: [Vector3, Vector3] = [new Vector3(), new Vector3()];

  constructor(frame: Frame) {
    super(frame);
    this.skullR = bipedSkullRadiusM(frame);
    // round 1 (humanoid-anatomy): rest stance widened to hip-width-plus so the
    // legs drop straight from the hip sockets instead of converging inward.
    // round 2 (humanoid-anatomy): bulk-independent stance floor (hM * 0.089).
    // round 4 (humanoid-anatomy): the floor is now SHOULDER-derived — the
    // round-3 verdict measured hips/feet at ~45% of the visual shoulder span
    // (deltoid outer edge to deltoid outer edge) against ~75% in the
    // references. The feet plant at 68% of that span, which puts the thigh
    // roots (0.85x) right at the pelvis mass edge — legs drop under hips,
    // not under the spine. Mirror: skeletonBuilder.bipedRestPose stanceHalf.
    // round 5 (humanoid-anatomy): feet plant DIRECTLY under the thigh roots
    // (0.85x of the shoulder-derived stance) — round 4 planted the feet at the
    // full stance with hips at 0.85x, so every shin slanted outward and the
    // figure read splayed. Hip, knee, and ankle now share one vertical line in
    // the front view. Mirror: skeletonBuilder.bipedRestPose foot/hip x.
    const armLenM = frame.armLengthFt * FT_TO_M;
    const armR = Math.max(this.baseR * 0.3, armLenM * 0.085);
    const shoulderVisualHalf = (frame.shoulderWidthFt * FT_TO_M) / 2 + armR * 1.6;
    // round 20 (humanoid-anatomy): PLANT the bulky stance. Round 19's verdict
    // on the dwarf: "legs bow outward in a straddle so wide he reads as riding
    // an invisible barrel". The shoulder-derived floor (0.68) is a ratio taken
    // from slim references; a broad-shouldered SHORT frame multiplies it
    // against a span that is huge relative to its leg length, so the feet land
    // outside the pelvis. The floor now tightens with bulk (human 0.68, orc
    // ≈0.60, dwarf ≈0.58) — the references' planted stance, feet under the hip
    // sockets. Mirror: skeletonBuilder.bipedRestPose stanceHalf.
    const stanceFloorK = 0.68 - 0.34 * Math.min(0.5, Math.max(0, frame.bulk - 1));
    const stance = Math.max(((frame.stanceWidthFt * FT_TO_M) / 2) * 1.12, shoulderVisualHalf * stanceFloorK) * 0.85;
    this.legs = [
      new TreadmillLeg(-stance, 0.01, 0, { liftH: this.hM * 0.06 }),
      new TreadmillLeg(stance, 0.01, 0.5, { liftH: this.hM * 0.06 }),
    ];
  }

  protected advance(): void {
    const stride = this.strideHalf();
    // round 4 (humanoid-anatomy): the planted idle base is wide (feet under
    // hips at ~68% of the visual shoulder span); a walk cannot ride that wide
    // track without waddling, so the feet pull toward the centerline as speed
    // rises. TreadmillLeg.update rewrites pos every call, so scaling x here is
    // stateless — and at speed 0 the factor is exactly 1, preserving rest-pose
    // parity with skeletonBuilder.bipedRestPose.
    const track = 1 - 0.32 * this.speedFactor;
    for (const leg of this.legs) {
      leg.update(this.gaitPhase, stride);
      leg.pos.x *= track;
    }
    // grounded wing beat (celestial, fiend, fairy, aarakocra carry wing parts)
    this.flap = this.groundedWingBeat();
    this.wingFold = this.groundedWingFold();
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.014 * (0.4 + this.speedFactor);
    // round 5 (humanoid-anatomy): sway is a WALK motion — at idle it slid the
    // torso sideways over planted legs, so any captured frame showed one knee
    // apparently caving under the body while the other bowed out. Gating it by
    // speedFactor keeps the planted idle dead symmetric (and rest-pose parity
    // exact at any gaitPhase).
    this.sway = Math.sin(this.gaitPhase * Math.PI * 2) * this.hM * 0.011 * this.speedFactor;
    // round 5 (humanoid-anatomy): stand UP at idle. The round-4 pelvis sat at
    // legLen flat, which put the hip only ~90% of leg reach above the foot —
    // a permanent half-squat. At rest the pelvis now rides at 0.96 of full
    // leg reach (reach = 1.04 legLen: two 0.52 links), leaving only a slight
    // forward knee break; the walk blends back down to the old crouch as
    // speed rises so deep strides stay reachable. Mirror:
    // skeletonBuilder.bipedRestPose pelvisY.
    const idlePelvisY = this.legLenM * 1.04 * 0.96 + this.baseR * 0.3;
    const walkPelvisY = this.legLenM * 1.0;
    this.pelvisY = idlePelvisY + (walkPelvisY - idlePelvisY) * this.speedFactor + this.bob;
    this.chestY = this.pelvisY + (this.hM - this.legLenM) * 0.45;
    // round 3 (humanoid-anatomy): real neck — the head rises when a bulky or
    // big-headed frame leaves no daylight between the chest top and the skull
    // base. The minimum visible neck height scales with the head too
    // (hM * 0.04 + hr * 0.25): a bigger skull needs a taller gap to read, and
    // gear collars (vest) eat the lowest part. chestY already carries the
    // bob, so both branches bob together. Mirror: bipedRestPose headY.
    // round 6 (humanoid-anatomy): the head ladder runs on the drawn skull
    // radius (skullR ≤ hr) — a smaller skull also rides a touch higher, so
    // slim frames gain visible neck instead of a dome on the shoulders.
    // Mirror: bipedRestPose headY.
    // round 10 (humanoid-anatomy): SEAT the head. The round-9 verdict read
    // "lollipop heads on sticks" — both old branches stacked a full skull
    // radius (plus hM terms) of bare neck over the collar, and the hM floor
    // overshot canon height, so every chin floated a head-length above the
    // shoulder line. The mount is now COLLAR-DRIVEN: the loft chin
    // (headY − 0.59 skullR) rides `neckLift` skull radii above the chest
    // top, and the lift SHRINKS with bulk — human ≈ 0.46 skullR (≈0.3 skull
    // heights of visible neck), orc/dwarf ≈ 0.2 (the jaw settles into the
    // traps, the WoW-grunt read). Hard cap 0.55 keeps every frame under the
    // 0.4-skull-height ceiling. chestY carries the bob, so the head bobs
    // with the body. Mirror: bipedRestPose headY.
    // round 13 (humanoid-anatomy): lift floor 0.14 → 0.2 and slope 0.6 → 0.45
    // — the round-12 orc read "no neck ... pinhead sunk straight into it"; the
    // seated head keeps its bulk shrink but every frame keeps a visible neck.
    // Mirror: bipedRestPose headY.
    // round 14 (humanoid-anatomy): floor 0.26, slope 0.38 — the orc head
    // still sat directly on the chest; the widened traps wedge needs the
    // vertical run. Mirror: bipedRestPose neckLift.
    const neckLift = Math.min(0.55, Math.max(0.26, 0.46 - 0.38 * Math.max(0, this.frame.bulk - 1)));
    // round 18 (humanoid-anatomy): FORWARD HUNCH — per-species idle posture
    // (Frame.hunch, set from speciesProfiles; the orc's trapezius-dominant
    // lean — round 17: ours "stands bolt upright"). The head drops into the
    // traps and everything above the belt shifts forward (see buildBody).
    // Mirror: skeletonBuilder.bipedRestPose.
    const hunch = this.frame.hunch ?? 0;
    const hunchZ = this.hM * 0.09 * hunch;
    this.headY = this.chestY + this.baseR * 0.35 + this.skullR * (0.59 + neckLift) - this.skullR * 0.35 * hunch;
    // round 13 (humanoid-anatomy): bulky frames push the whole arm chain
    // outward (shoulderOut) — the round-12 orc's left arm fused into the
    // widened torso in the top panel. Mirror: bipedRestPose shoulder terms.
    const shoulderOut = this.baseR * 0.22 * Math.max(0, this.frame.bulk - 1);
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + this.baseR * 0.35 + shoulderOut;
    // round 17 (humanoid-anatomy): HANG the arm. The old wrist anchor
    // (pelvisY + 0.015 hM) sat so high against the 0.52+0.52 links that the
    // IK folded every idle elbow to ~77° — the fist parked at belt height
    // "welded near the elbow" and the forearm never read. Links are 0.4
    // armLen now (human shoulder→wrist ≈ 0.33 h, the reference ratio) and
    // the wrist DROPS to wherever the idle chord equals 0.95 of full reach —
    // a ~145° elbow, a near-straight hanging arm on every frame. Walk swing
    // still straightens it to full reach at peak. Mirror:
    // skeletonBuilder.bipedRestPose arm loop.
    const armLink = this.frame.armLengthFt * FT_TO_M * ARM_LINK_K;
    const dxRest = this.baseR * 0.4;
    const dzRest = this.hM * 0.045 - 0.02;
    const idleChord = 0.95 * 2 * armLink;
    const handY = this.chestY + this.baseR * 0.45
      - Math.sqrt(Math.max(idleChord * idleChord - dxRest * dxRest - dzRest * dzRest, armLink * armLink * 0.25));
    // arms: counter-swing to the legs; hang forward-and-easy when idle
    for (const sgn of [-1, 1] as const) {
      const phaseOff = sgn < 0 ? 0.5 : 0;
      const swing = Math.sin((this.gaitPhase + phaseOff) * Math.PI * 2) * 0.55 * this.speedFactor;
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'];
      hand.pos.set(
        sgn * (shoulderX + this.baseR * 0.05),
        handY,
        // round 18 (humanoid-anatomy): wrists ride forward with the hunched
        // shoulders (same hunchZ both sides keeps the hang solve exact)
        Math.sin(swing) * this.frame.armLengthFt * FT_TO_M * 0.42 + this.hM * 0.045 + hunchZ,
      );
      // round 6 (humanoid-anatomy): the anchor pos above is the WRIST (IK
      // target); buildBody() moves the public anchor to the fist center so
      // held gear roots inside the hand — stash the wrist for the IK solve.
      this.wrist[sgn < 0 ? 0 : 1].copy(hand.pos);
      // tilt held gear slightly forward and away from the body so it reads
      hand.quat.setFromEuler(EULER.set(swing * 0.5 + 0.22, 0, sgn * -0.3));
    }
    this.setAnchor('hips', this.sway, this.pelvisY, 0);
    // round 1 (humanoid-anatomy): hip anchors ride the widened thigh roots
    // round 5 (humanoid-anatomy): thigh roots sit directly over the feet
    // (factor 1.0; the 0.85 narrowing moved into the stance itself)
    this.setAnchor('hipL', -Math.abs(this.legs[0].pos.x), this.pelvisY - this.baseR * 0.3, 0);
    this.setAnchor('hipR', Math.abs(this.legs[1].pos.x), this.pelvisY - this.baseR * 0.3, 0);
    // round 18 (humanoid-anatomy): chest/back gear anchors lean with the hunch
    this.setAnchor('chest', this.sway * 0.6, this.chestY, this.baseR * 0.15 + hunchZ * 0.8);
    this.setAnchor('back', this.sway * 0.6, this.chestY + this.baseR * 0.15, -this.baseR * 0.85 + hunchZ * 0.8);
    this.setAnchor('tailRoot', this.sway, this.pelvisY - this.baseR * 0.2, -this.baseR * 0.8);
    this.setHeadAnchors(0, this.headY, this.skullR * 0.25 + hunchZ * 1.4, this.skullR);
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR;
    // round 13 (humanoid-anatomy): THE PELVIS BREAK. The round-12 verdict:
    // "the torso is one unbroken tube that ends in a straight skirt-hem at
    // mid-thigh". The torso now lofts THREE masses that meet at the belt
    // line: a glute/hip mass (widest 1.14 r at its base), a pinched waist
    // (0.68 r) at beltY — LOWER than the old midY so the break sits at the
    // belt, not the ribs — and a ribcage that swells back to 1.02 r at the
    // chest top. The hip:waist:chest width profile IS the silhouette break.
    // The pelvis root also rises (−0.5 r → −0.2 r): the smooth loft rounds a
    // glute tuck below it instead of ending in the flat skirt-hem disc.
    // Mirror: skeletonBuilder.bipedRestPose torso segments.
    // round 14 (humanoid-anatomy): masses FLIPPED — round 13's hips (1.14 r)
    // out-widened the ribcage (1.02 r) into the critic's "pear/diaper" read.
    // Chest-dominant now: ribcage 1.12 r widest, hips 0.9 r (~80%), waist
    // pinch 0.68 r at the belt. Mirror: bipedRestPose torso segments.
    const beltY = this.pelvisY + (this.chestY - this.pelvisY) * 0.32;
    // round 16 (humanoid-anatomy): waist pinch deepens with bulk (0.68 →
    // ~0.60 at dwarf/orc bulk, floor 0.56) — the dwarf's belt read as an
    // unpinched cylinder. Mirror: bipedRestPose torso segments.
    const waistK = Math.max(0.56, 0.68 - 0.18 * Math.max(0, this.frame.bulk - 1));
    // round 18 (humanoid-anatomy): forward hunch — chest top, traps, neck,
    // head, shoulders, and wrists all lean forward together. Mirror:
    // skeletonBuilder.bipedRestPose hunch terms.
    const hunch = this.frame.hunch ?? 0;
    const hunchZ = this.hM * 0.09 * hunch;
    sink.seg('torso.pelvis', this.sway, this.pelvisY - r * 0.2, 0, this.sway * 0.6, beltY, 0.007, r * 0.9, r * waistK);
    sink.seg('torso.chest', this.sway * 0.6, beltY, 0.007, 0, this.chestY + r * 0.35, 0.02 + hunchZ, r * waistK, r * 1.12);
    const headZ = this.skullR * 0.25 + hunchZ * 1.4;
    // round 3 (humanoid-anatomy): the neck roots EXACTLY at the chest top (no
    // loft step) and buries its tip deep inside the skull (headY - skullR * 0.35).
    // round 4 (humanoid-anatomy): the tip radius now climbs with bulk
    // (r * 0.55, floor 0.42 skullR, cap 0.72 skullR) so thick frames carry a
    // thick neck, and frames whose neck reaches the traps threshold also get a
    // trapezius wedge: one cone from the chest top to the skull equator that
    // swallows the hard outline step where the neck used to meet the head —
    // the orc's "head in a socket" read.
    // round 6 (humanoid-anatomy): every head term runs on the drawn skull
    // radius, and the traps threshold drops 0.62 → 0.55 so mid-bulk frames
    // (the human fighter) earn the trap ramp the orc already has. Mirror:
    // bipedRestPose neck + torso.traps.
    // round 7 (humanoid-anatomy): the sculpted head (buildHumanoidHead) has a
    // real jawline (jaw half-width 0.46 skullR), so the neck tip caps at
    // 0.58 skullR (0.72 buried the jaw in neck) and the traps wedge stops at
    // the NECK BASE (headY − 0.55 skullR, r1 0.62 skullR) instead of the
    // skull equator — the orc's round-6 "no neck at all" was the 0.82-radius
    // wedge swallowing the whole gap. A visible neck cylinder now runs
    // wedge-top → skull underside. Mirror: bipedRestPose.
    // round 9 (humanoid-anatomy): drawn neck tip caps at 0.42 skullR (0.58
    // matched the loft's cheek half-width, so no notch ever showed under the
    // jaw) and the tip bury is −0.45 skullR so the taper finishes BELOW the
    // jaw where it can read. The traps threshold keeps the UNCAPPED
    // thickness so bulky frames keep their trap ramp.
    // round 10 (humanoid-anatomy): traps RISE to meet the seated head. The
    // wedge now roots INSIDE the upper chest (chestTop − 0.55 r) so the
    // slope has vertical run under the dropped skull, and its top tracks
    // bulk: bury 0.95 → 0.47 skullR below head center as bulk climbs, so on
    // bulked frames the peak clears the chin line (−0.59 skullR) and the jaw
    // sits INTO the trapezius. The peak also widens with bulk (0.54 → 0.82
    // skullR) to bracket the lower half of the skull sides — the WoW-grunt
    // collar. Mirror: bipedRestPose.
    const neckThickR = Math.max(this.skullR * 0.42, r * 0.55);
    const neckTipR = Math.min(neckThickR, this.skullR * 0.42);
    if (neckThickR >= this.skullR * 0.55) {
      const trapsBury = Math.max(0.47, 0.95 - 1.2 * Math.max(0, this.frame.bulk - 1));
      const trapsR1 = Math.min(0.82, 0.54 + 0.55 * Math.max(0, this.frame.bulk - 1));
      // round 14 (humanoid-anatomy): traps root 0.88 r → 1.04 r — proud of
      // the 1.12 r ribcage so the slope owns the outline. Mirror:
      // bipedRestPose torso.traps.
      sink.seg('torso.traps', 0, this.chestY + r * 0.35 - r * 0.55, 0.02 + hunchZ, 0, this.headY - this.skullR * trapsBury, headZ * 0.6, r * 1.04, this.skullR * trapsR1);
    }
    sink.seg('neck', 0, this.chestY + r * 0.35, 0.02 + hunchZ, 0, this.headY - this.skullR * 0.45, headZ * 0.85, r * 0.52, neckTipR);
    sink.ball('head', 0, this.headY, headZ, this.skullR);
    // round 13 (humanoid-anatomy): same bulk-driven outward push as advance()
    // — arm roots clear the widened bulky torso. Mirror: bipedRestPose.
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + r * 0.22 * Math.max(0, this.frame.bulk - 1);
    const armLen = this.frame.armLengthFt * FT_TO_M;
    const armR = Math.max(r * 0.3, armLen * 0.085);
    // round 2 (humanoid-anatomy): deltoid ball buries the arm root into the
    // chest.
    // round 6 (humanoid-anatomy): near 3:1 shoulder-to-wrist taper (1.48 armR
    // root down to a 0.52 armR wrist) so slim frames stop reading as uniform
    // tubes, and a real HAND in place of the round-2 nub: the wrist steps
    // down into a palm block clearly wider than it (1.02 armR root), the palm
    // cocks ~18° forward so its knuckle end reads in the 3/4 and front
    // panels, and an opposed thumb wedge angles off the palm's lateral-front
    // corner. The palm's basis (fingers ey / lateral ex / front ez) is
    // explicit and well-conditioned — no more degenerate UP→down quaternion.
    // Mirror: skeletonBuilder.bipedRestPose arm loop — constants must stay
    // identical. (The stance formulas keep the round-4 armR * 1.6 term — the
    // stance is a tuned constant now, decoupled from the deltoid's 1.7.)
    // round 17 (humanoid-anatomy): four silhouette stations — deltoid (the
    // 1.7 armR ball) → a real ELBOW NARROWING (0.68 armR, down from 0.8) →
    // the loft adds a brachioradialis flare past it (smoothBipedGeometry) →
    // the WRIST is the narrowest point (0.55 armR) and the fist attaches
    // there, clearly past the elbow now that the links are 0.4 armLen and
    // the wrist hangs low. Mirror: bipedRestPose arm loop.
    // round 20 (humanoid-anatomy): TAPER CONTRAST scales with bulk. Round 19
    // on the orc: "near-constant-width arms look inflated"; the WoW grunt's
    // mass hierarchy runs boulder deltoid → collapsing forearm → tight wrist.
    // The round-17 numbers were tuned on the human, so a bulky frame scaled
    // every station by the same armR and kept one width down the whole arm.
    // The shoulder now grows and the elbow/wrist shrink with bulk. The human
    // wrist narrows too (0.55 → 0.49) — round 19 also read "tube arms with no
    // forearm-to-wrist taper" on the human. Mirror: bipedRestPose arm loop.
    const armBulkT = Math.min(0.6, Math.max(0, this.frame.bulk - 1));
    const shoulderR = armR * (1.48 + 0.5 * armBulkT);
    const elbowR = armR * (0.68 - 0.12 * armBulkT);
    const wristR = armR * (0.49 - 0.06 * armBulkT);
    // round 15 (humanoid-anatomy): FIST SCALE — the round-14 "plain sphere"
    // hands were 0.38–0.44 of skull width; references block fists at
    // ~0.6–0.7. Fist half-width now carries a skull-derived floor (0.6
    // skullR), and the hand splits into a palm block plus a curled finger
    // mass bent toward the knuckle front. Mirror: bipedRestPose arm loop.
    // round 19 (humanoid-anatomy): fist floor 0.6 → 0.45 skullR — Remy: the
    // dwarf hand was "a giant flat slab, near head-size". Mirror:
    // bipedRestPose arm loop.
    const handR = Math.max(armR * 1.05, this.skullR * 0.45);
    const palmLen = handR * 1.35;
    const fingerLen = handR * 0.95;
    for (const sgn of [-1, 1] as const) {
      const side = sgn < 0 ? 'L' : 'R';
      const hand = this.wrist[sgn < 0 ? 0 : 1];
      // round 18 (humanoid-anatomy): shoulders roll forward with the hunch
      V_SH.set(sgn * shoulderX, this.chestY + r * 0.45, 0.02 + hunchZ);
      // round 14 (humanoid-anatomy): elbow tucked mostly BACKWARD — the
      // lateral bend arced the arm into a "banana bow". Mirror:
      // bipedRestPose arm loop.
      V_BEND.set(sgn * 0.45, 0, -1).normalize();
      // round 17 (humanoid-anatomy): links 0.4 armLen (see ARM_LINK_K)
      solveKnee(V_SH, V_HAND.copy(hand), armLen * ARM_LINK_K, armLen * ARM_LINK_K, V_BEND, V_KNEE);
      // deltoid before the upper segment: the segment's later write drives
      // the upperArm bone; the ball only adds shoulder mass at the joint
      // round 20 (humanoid-anatomy): the deltoid ball grows with the same
      // bulk term as shoulderR — the boulder shoulder the WoW grunt leads
      // with. Mirror: bipedRestPose deltoid ball.
      sink.ball('deltoid' + side, V_SH.x, V_SH.y, V_SH.z, armR * (1.7 + 0.5 * armBulkT));
      sink.seg('arm' + side + '.upper', V_SH.x, V_SH.y, V_SH.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, shoulderR, elbowR);
      sink.seg('arm' + side + '.fore', V_KNEE.x, V_KNEE.y, V_KNEE.z, hand.x, hand.y, hand.z, elbowR, wristR);
      // fingers axis: forearm direction cocked forward (+z 0.32 ≈ 18°)
      V_PALM_DIR.copy(hand).sub(V_KNEE).normalize();
      V_PALM_DIR.z += 0.32;
      // round 16 (humanoid-anatomy): lateral cock (~8°) — the knuckle bend
      // pointed dead at the front camera, zero silhouette change. Mirror:
      // bipedRestPose arm loop.
      // round 18 (humanoid-anatomy): cock deepened 0.14 → 0.22 — the thumb
      // crossing must profile to the front camera (camera-aimed-bend rule).
      // Mirror: bipedRestPose arm loop.
      V_PALM_DIR.x += sgn * 0.22;
      V_PALM_DIR.normalize();
      // canonical palm frame — identical to the pose sink's hand-bone rule
      Q_PALM.setFromUnitVectors(UP_Y, V_PALM_DIR);
      // round 15 (humanoid-anatomy): the thumb WRAPS ACROSS the knuckle
      // front — root at the lateral palm edge, tip crossing past the fist
      // midline on the −Z knuckle face (local axes: +Y fingers, sgn·X
      // lateral, −Z front). round 16: silhouette lobe — root at the lateral
      // face (sgn 1.0), fattened to 0.52 handR. Mirror: bipedRestPose.
      // round 18 (humanoid-anatomy): thumb ENLARGED again (0.52 → 0.62 handR
      // root, 0.36 → 0.44 tip), rooted on the lateral-FRONT corner and
      // crossing further past the knuckle face — rounds 16 and 17 both failed
      // to read at panel distance. Mirror: bipedRestPose arm loop.
      V_THUMB_A.set(sgn * handR * 1.05, palmLen * 0.3, -handR * 0.45).applyQuaternion(Q_PALM).add(hand);
      V_THUMB_B.set(sgn * handR * 0.3, palmLen * 1.05, -handR * 0.95).applyQuaternion(Q_PALM).add(hand);
      // thumb first, fingers second, palm LAST: the pose sink's last write
      // per bone wins, so the palm segment defines the hand bone's transform
      sink.seg('hand' + side + '.thumb', V_THUMB_A.x, V_THUMB_A.y, V_THUMB_A.z, V_THUMB_B.x, V_THUMB_B.y, V_THUMB_B.z, handR * 0.62, handR * 0.44);
      V_PALM_TIP.copy(V_PALM_DIR).multiplyScalar(palmLen).add(hand);
      // curled finger mass — continues the palm bent ~50° toward the knuckle
      // front; the bend IS the knuckle plane break. round 16: the root
      // swells past the palm (1.12 handR) — a knuckle step the outline
      // creases around in every view. Mirror: bipedRestPose.
      V_FINGER_B.set(0, fingerLen * 0.64, -fingerLen * 0.77).applyQuaternion(Q_PALM).add(V_PALM_TIP);
      sink.seg(
        'hand' + side + '.fingers',
        V_PALM_TIP.x, V_PALM_TIP.y, V_PALM_TIP.z,
        V_FINGER_B.x, V_FINGER_B.y, V_FINGER_B.z,
        handR * 1.12, handR * 0.68,
      );
      sink.seg(
        'hand' + side + '.palm',
        hand.x, hand.y, hand.z,
        V_PALM_TIP.x, V_PALM_TIP.y, V_PALM_TIP.z,
        handR * 0.88, handR,
      );
      // round 6 (humanoid-anatomy): grip anchor — held gear parents to the
      // hand anchor, so aim it at the FIST CENTER. round 15: the haft rides
      // the knuckle-front pocket under the curled fingers, thumb crossing
      // over it.
      this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos
        .set(0, palmLen * 0.6, -handR * 0.45)
        .applyQuaternion(Q_PALM)
        .add(hand);
    }
    // round 1 (humanoid-anatomy): near 2:1 thigh-to-calf taper (thigh root
    // 1.32 legR down to a 0.5 legR ankle), thighs rooted deeper and wider
    // into the pelvis mass, and the knee bend pushed outward so knees track
    // over the feet instead of pinching knock-kneed inward. Mirror:
    // skeletonBuilder.bipedRestPose leg loop.
    const legR = Math.max(r * 0.36, this.legLenM * 0.105);
    // round 13 (humanoid-anatomy): thigh roots carry a TORSO-derived floor
    // (0.58 r) — the round-12 orc balanced "a fridge on two sticks" because
    // legR runs on leg length while the torso runs on bulk. Bulky frames now
    // root thighs thick enough for the hips they hang from (the knee keeps
    // half the root so the taper stays believable); slim frames are
    // unchanged (legR * 1.32 still wins). Mirror: bipedRestPose leg radii.
    const thighR = Math.max(legR * 1.32, r * 0.58);
    // round 14 (humanoid-anatomy): knee 0.72 → 0.62 legR (root fraction
    // 0.5 → 0.44) — thighs must narrow visibly toward the knee. Mirror:
    // bipedRestPose leg radii.
    // round 18 (humanoid-anatomy): THE KNEE NECK — knee pinches (0.52 legR /
    // 0.4 thighR) and the ankle narrows (0.36 legR) so the loft's calf swell
    // has room to rise and fall (smoothBipedGeometry .shin stations). Mirror:
    // bipedRestPose leg radii.
    const kneeR = Math.max(legR * 0.52, thighR * 0.4);
    // round 19 (humanoid-anatomy): ankle 0.36 → 0.44 legR — Remy: "pinched
    // ankles". Mirror: bipedRestPose leg radii.
    const ankleR = legR * 0.44;
    // round 5 (humanoid-anatomy): heel-to-toe wedge feet — a tapered segment
    // from a heel BEHIND the ankle to a toe box in front, sole flat on the
    // ground (each end's center rides at its own radius), replacing the
    // heel-less nub balls. Both knee bend vectors are exact x-mirrors with a
    // small outward lean (0.1; round 1's 0.28 fought a knock-kneed crouch
    // that no longer exists — near-straight legs need the knee tracking
    // straight over the toes). Mirror: skeletonBuilder.bipedRestPose leg loop.
    const heelR = legR * 0.62;
    const toeR = legR * 0.5;
    for (const [i, leg] of this.legs.entries()) {
      const side = i === 0 ? 'L' : 'R';
      const sgn = i === 0 ? -1 : 1;
      V_HIP.set(leg.pos.x, this.pelvisY - r * 0.3, 0);
      // round 14 (humanoid-anatomy): outward knee lean 0.1 → 0.02 — orc
      // knees bowed out, dwarf shins with them. Mirror: bipedRestPose.
      V_BEND.set(sgn * 0.02, 0, 1).normalize();
      solveKnee(V_HIP, V_HAND.copy(leg.pos), this.legLenM * 0.52, this.legLenM * 0.52, V_BEND, V_KNEE);
      sink.seg('leg' + side + '.thigh', V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, thighR, kneeR);
      sink.seg('leg' + side + '.shin', V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, kneeR, ankleR);
      sink.seg(
        'foot' + side,
        leg.pos.x, leg.pos.y + heelR, leg.pos.z - legR * 0.7,
        leg.pos.x, leg.pos.y + toeR, leg.pos.z + legR * 1.75,
        heelR, toeR,
      );
    }
  }
}

/* ------------------------------------------------------- quad + hexapod */

class MultiLegDriver extends BaseDriver {
  private readonly legs: TreadmillLeg[] = [];
  private readonly legAnchorsX: number[] = [];
  private readonly legAnchorsZ: number[] = [];
  private bodyY = 0;
  private bob = 0;
  private readonly bodyLen: number;
  private readonly isHexa: boolean;

  constructor(frame: Frame, isHexa: boolean) {
    super(frame);
    this.isHexa = isHexa;
    this.bodyLen = this.hM * 1.5;
    const stance = (frame.stanceWidthFt * FT_TO_M) / 2;
    if (isHexa) {
      const zs = [this.bodyLen * 0.32, 0, -this.bodyLen * 0.32];
      for (let i = 0; i < 3; i++) {
        for (const sgn of [-1, 1] as const) {
          const phase = ((i + (sgn > 0 ? 1 : 0)) % 2) * 0.5; // tripod gait
          this.legs.push(new TreadmillLeg(sgn * stance, zs[i], phase, { duty: 0.55, liftH: this.hM * 0.07 }));
          this.legAnchorsX.push(sgn * stance * 0.4);
          this.legAnchorsZ.push(zs[i]);
        }
      }
    } else {
      const zf = this.bodyLen * 0.36;
      const zb = -this.bodyLen * 0.36;
      const defs: Array<[number, number, number]> = [
        [-stance, zf, 0],
        [stance, zb, 0],
        [stance, zf, 0.5],
        [-stance, zb, 0.5],
      ];
      for (const [x, z, phase] of defs) {
        this.legs.push(new TreadmillLeg(x, z, phase, { liftH: this.hM * 0.08 }));
        this.legAnchorsX.push(x * 0.75);
        this.legAnchorsZ.push(z * 0.95);
      }
    }
  }

  protected advance(): void {
    const stride = this.strideHalf();
    for (const leg of this.legs) leg.update(this.gaitPhase, stride);
    // grounded wing beat (the quad dragon carries membrane wing parts)
    this.flap = this.groundedWingBeat();
    this.wingFold = this.groundedWingFold();
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.02;
    this.bodyY = this.hM * (this.isHexa ? 0.55 : 0.8) + this.bob;
    const headZ = this.bodyLen * 0.55;
    const headY = this.bodyY + this.hM * (this.isHexa ? 0.15 : 0.35);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.bodyY + this.baseR * 0.4, this.bodyLen * 0.3);
    this.setAnchor('back', 0, this.bodyY + this.baseR * 0.75, 0);
    this.setAnchor('hips', 0, this.bodyY, -this.bodyLen * 0.3);
    this.setAnchor('tailRoot', 0, this.bodyY + this.baseR * 0.2, -this.bodyLen * 0.48);
    this.setAnchor('handL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('handR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('hipL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
    this.setAnchor('hipR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR * (this.isHexa ? 0.85 : 1);
    // spine: rear -> mid -> front (horizontal body)
    sink.seg('spine.rear', 0, this.bodyY, -this.bodyLen * 0.33, 0, this.bodyY + this.hM * 0.02, 0, r * 0.95, r);
    sink.seg('spine.front', 0, this.bodyY + this.hM * 0.02, 0, 0, this.bodyY + this.hM * 0.04, this.bodyLen * 0.33, r, r * 0.85);
    const head = this.pose.anchors.head.pos;
    sink.seg('neck', 0, this.bodyY + this.hM * 0.05, this.bodyLen * 0.32, head.x, head.y - this.hr * 0.4, head.z - this.hr * 0.3, r * 0.5, r * 0.38);
    sink.ball('head', head.x, head.y, head.z, this.hr);
    const legR = Math.max(r * (this.isHexa ? 0.24 : 0.3), this.legLenM * (this.isHexa ? 0.06 : 0.09));
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      V_HIP.set(this.legAnchorsX[i], this.bodyY - r * 0.1, this.legAnchorsZ[i]);
      V_BEND.set(this.isHexa ? Math.sign(this.legAnchorsX[i]) : 0, this.isHexa ? 0.9 : 0, this.legAnchorsZ[i] >= 0 ? 1 : -1).normalize();
      const l = this.legLenM * 0.55;
      solveKnee(V_HIP, V_HAND.copy(leg.pos), l, l, V_BEND, V_KNEE);
      sink.seg('leg' + i + '.upper', V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, legR, legR * 0.85);
      sink.seg('leg' + i + '.lower', V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, legR * 0.85, legR * 0.6);
      sink.ball('foot' + i, leg.pos.x, leg.pos.y + legR * 0.3, leg.pos.z + legR * 0.3, legR * 0.8);
    }
  }
}

/* ----------------------------------------------------------------- hopper */

class HopperDriver extends BaseDriver {
  private hopT = 0;
  private squash = 0;

  protected advance(_t: number, dt: number): void {
    const period = 1.15;
    if (this.speed > 0.01) {
      this.hopT = (this.hopT + dt / period) % 1;
    } else {
      this.hopT = 0;
    }
    const u = this.hopT;
    const AIR0 = 0.38;
    const AIR1 = 0.82;
    let s = 0;
    let air = 0;
    if (this.speed > 0.01) {
      if (u < 0.26) s = smooth(u / 0.26) * 0.38;
      else if (u < AIR0) s = 0.38 - smooth((u - 0.26) / (AIR0 - 0.26)) * 0.75;
      else if (u < AIR1) {
        const v = (u - AIR0) / (AIR1 - AIR0);
        air = Math.sin(Math.PI * v);
        s = -0.32 * (1 - v * 0.6);
      } else {
        const v = (u - AIR1) / (1 - AIR1);
        s = 0.45 * Math.exp(-4 * v) * Math.cos(v * 9);
      }
    } else {
      s = Math.sin(this.t * 2.2) * 0.05; // idle breathing squish
    }
    this.squash = s;
    this.verticalOffsetM = air * this.hM * (0.35 + 0.35 * this.speedFactor);
    const ky = 1 - s * 0.55;
    const headY = this.hM * 0.82 * ky;
    this.setHeadAnchors(0, headY, this.hr * 0.15);
    this.setAnchor('hips', 0, this.hM * 0.3 * ky, 0);
    this.setAnchor('chest', 0, this.hM * 0.55 * ky, this.hM * 0.05);
    this.setAnchor('back', 0, this.hM * 0.6 * ky, -this.hM * 0.12);
    this.setAnchor('tailRoot', 0, this.hM * 0.28 * ky, -this.hM * 0.14);
    for (const sgn of [-1, 1] as const) {
      const lag = Math.sin(this.t * 6 - 1.2) * 0.04 - s * 0.08;
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.28, this.hM * (0.42 + lag) * ky, this.hM * 0.1);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.2, this.hM * 0.18 * ky, 0);
    }
  }

  buildBody(sink: SegmentSink): void {
    const sq = this.squash;
    const ky = 1 - sq * 0.55;
    const kxz = 1 + sq * 0.45;
    const r = this.baseR * 1.25;
    const y = (v: number) => 0.02 + (v - 0.02) * ky;
    // squat torso column: base -> mid -> top (squash via endpoint motion)
    sink.seg('torso.lower', 0, y(this.hM * 0.12), 0, 0, y(this.hM * 0.42), this.hM * 0.01 * kxz, r * 1.05, r * 0.95);
    sink.seg('torso.upper', 0, y(this.hM * 0.42), this.hM * 0.01 * kxz, 0, y(this.hM * 0.66), this.hM * 0.02 * kxz, r * 0.95, r * 0.8);
    sink.ball('head', 0, y(this.hM * 0.82), this.hM * 0.03, this.hr);
    for (const sgn of [-1, 1] as const) {
      const side = sgn < 0 ? 'L' : 'R';
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos;
      sink.seg('arm' + side, sgn * this.hM * 0.2, y(this.hM * 0.5), this.hM * 0.05, hand.x, hand.y, hand.z, r * 0.26, r * 0.2);
      sink.ball('hand' + side, hand.x, hand.y, hand.z, r * 0.28);
    }
  }
}

/* ---------------------------------------------------------- flyer + float */

class AirborneDriver extends BaseDriver {
  constructor(frame: Frame, private readonly flapping: boolean) {
    super(frame);
  }

  protected advance(t: number): void {
    this.flap = this.flapping ? Math.sin(t * 9) * 0.65 : 0;
    const bob = this.flapping
      ? Math.sin(t * 9 - Math.PI / 2) * this.hM * 0.04
      : Math.sin(t * 1.6) * this.hM * 0.06;
    this.verticalOffsetM = this.hM * (this.flapping ? 0.9 : 0.55) + bob;
    // body floats around local origin; the assembler lifts the body root
    const headZ = this.hM * (this.flapping ? 0.28 : 0.05);
    const headY = this.hM * (this.flapping ? 0.16 : 0.3);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.hM * 0.03, this.hM * 0.12);
    this.setAnchor('back', 0, this.hM * 0.1, -this.hM * 0.02);
    this.setAnchor('hips', 0, -this.hM * 0.05, -this.hM * 0.1);
    this.setAnchor('tailRoot', 0, 0, -this.hM * 0.22);
    const dang = Math.sin(this.t * 9 + 1.4) * this.hM * 0.02;
    for (const sgn of [-1, 1] as const) {
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.12, -this.hM * 0.16 + dang, this.hM * 0.08);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.1, -this.hM * 0.2 + dang, -this.hM * 0.02);
    }
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR;
    const head = this.pose.anchors.head.pos;
    if (this.flapping) {
      // bird fuselage: tail -> belly -> chest, neck to the head, tail fin
      sink.seg('body.rear', 0, this.hM * 0.02, -this.hM * 0.18, 0, 0, -this.hM * 0.02, r * 0.55, r * 0.95);
      sink.seg('body.front', 0, 0, -this.hM * 0.02, 0, this.hM * 0.02, this.hM * 0.13, r * 0.95, r * 0.75);
      sink.seg('neck', 0, this.hM * 0.04, this.hM * 0.13, head.x, head.y - this.hr * 0.3, head.z - this.hr * 0.2, r * 0.4, r * 0.32);
      sink.ball('head', head.x, head.y, head.z, this.hr);
      sink.seg('tail', 0, this.hM * 0.03, -this.hM * 0.18, 0, this.hM * 0.06, -this.hM * 0.32, r * 0.4, r * 0.22);
      const dang = Math.sin(this.t * 9 + 1.4) * this.hM * 0.02;
      for (const sgn of [-1, 1] as const) {
        const side = sgn < 0 ? 'L' : 'R';
        sink.seg('foot' + side, sgn * this.hM * 0.08, -this.hM * 0.08, this.hM * 0.02, sgn * this.hM * 0.1, -this.hM * 0.2 + dang, -this.hM * 0.02, r * 0.2, r * 0.14);
      }
    } else {
      // floater: a hovering mass with side lobes and a crown-ward head
      sink.seg('body.core', 0, -this.hM * 0.08, 0, 0, this.hM * 0.14, this.hM * 0.02, r * 1.15, r * 0.95);
      sink.seg('body.lobeL', -r * 0.9, -this.hM * 0.03, 0, -r * 0.25, this.hM * 0.05, 0, r * 0.5, r * 0.7);
      sink.seg('body.lobeR', r * 0.9, -this.hM * 0.03, 0, r * 0.25, this.hM * 0.05, 0, r * 0.5, r * 0.7);
      sink.ball('head', head.x, head.y, head.z, this.hr * 1.05);
    }
  }
}

/* ------------------------------------------------------------------- plan */

/**
 * Drives a compiled text-to-creature PlanSpec: a spine in one of four stances
 * plus free appendage chains animated by kind — legs stride on the treadmill
 * math, arms counter-swing, tails wag, tentacles wave, wings flap, necks bob
 * with a head at each end. Everything is emitted as connected tapered
 * segments with stable ids (`spine.N`, `<chainId>.N`).
 */
class PlanDriver extends BaseDriver {
  private readonly spec: PlanSpec;
  private readonly legTreads = new Map<string, TreadmillLeg>();
  /** Spine joint positions front→rear, refreshed each advance. */
  private readonly spinePts: Vector3[] = [];
  private readonly sockets: PlanHeadSocket[] = [];
  private spineTopY = 0;
  private legReachM = 0;
  /** Legless bulky horizontal body — breathes and mounds (oozes). */
  private readonly moundBody: boolean;
  /** round 16 (creature-anatomy): mound flatten — the mound's spine sweeps at
   * 0.8 × the profile radius (less dome height) while lateral gel LOBES
   * (decorative flank balls, spine.lobeL/R ids) rebuild the width at ground
   * level, so the whole body — buried volume included, in BOTH the segment
   * and skinned render paths — is clearly wider than tall (~0.65 height to
   * width). A circular sweep alone can never be: the round-15 silhouette
   * panel (no ground plane) showed the full circle as a taller-than-wide
   * egg. Constants; radii stay frame-constant per id. */
  private static readonly MOUND_FLATTEN = 0.8;
  /** Flank-lobe placement, fractions of the local (flattened) spine radius. */
  private static readonly MOUND_LOBE_OFFSET = 1.0;
  private static readonly MOUND_LOBE_R = 0.68;
  /** Spine runs vertically (upright, or a compact floater). Constant per
   * spec — round 24 (creature-anatomy) hoisted it from advance() so the
   * wing-fold and anchor logic can read it any time. */
  private verticalBody = false;
  /** round 24 (creature-anatomy): boulder-plate body (surface 'rock'). */
  private readonly rocky: boolean;
  /** True when the plan animates wings — chain wings OR polished wing mesh
   * parts (the Emberwing lesson: big bodies hang wingsMembrane as garnish,
   * which the driver cannot see; the assembler passes the hint). */
  private readonly winged: boolean;
  /** round 9 (creature-anatomy): the blueprint carries a finRidge garnish —
   * the driver emits the dorsal crest itself, riding the live spine stations
   * (the anchor-bezier chain part detached laterally from the slither coil). */
  private readonly crested: boolean;

  constructor(frame: Frame, spec: PlanSpec, wingedHint = false, crestedHint = false) {
    super(frame);
    this.spec = spec;
    this.winged = wingedHint || spec.chains.some((c) => c.kind === 'wing');
    this.crested = crestedHint;
    this.rocky = spec.surface === 'rock';
    // constant per spec (round 24): upright, or a compact floater
    this.verticalBody =
      spec.stance === 'upright' || (spec.stance === 'floating' && spec.bodyLenM <= spec.bodyRadM * 4.2);
    const legs = spec.chains.filter((c) => c.kind === 'leg');
    this.legReachM = legs.length
      ? Math.max(...legs.map((c) => c.links.reduce((n, l) => n + l.lenM, 0)))
      : 0;
    this.moundBody =
      spec.stance === 'horizontal' && legs.length === 0 && spec.bodyLenM < spec.bodyRadM * 7;
    for (const chain of legs) {
      const stanceX = spec.bodyRadM * 1.15 * (chain.side === 0 ? 0.3 : chain.side);
      const restZ = this.attachZ(chain.attach);
      this.legTreads.set(
        chain.id,
        new TreadmillLeg(stanceX, restZ, chain.phaseOffset, { liftH: this.hM * 0.07 }),
      );
    }
    for (let i = 0; i < spec.spine.segments + 1; i++) this.spinePts.push(new Vector3());
  }

  /** attach 0 (front) – 1 (rear) → local z (+z forward). */
  private attachZ(attach: number): number {
    return (0.5 - attach) * this.spec.bodyLenM;
  }

  /** Body center height for the current stance. */
  private bodyY(): number {
    const s = this.spec;
    switch (s.stance) {
      case 'upright':
        return Math.max(this.legReachM * 0.92, s.bodyRadM * 1.2);
      case 'horizontal':
        // round 4 (creature-anatomy): a mound SETTLES — its tube center sinks
        // below its radius so the fattest circumference meets the ground and
        // the visible base is the widest line (a slumped ooze, not a balloon
        // resting on a tangent point).
        // round 16 (creature-anatomy): sink 0.78 → 0.5, paired with the
        // MOUND_FLATTEN radii and the flank lobes — at 0.78 the round-15
        // silhouette read "a taller-than-wide egg — an inflated balloon, not
        // settled liquid". The deeper sink buries more of the tube so the
        // dome above ground is low and the ground line stays the widest.
        // (box-bodied mounds — the gelatinous cube — keep the shallow 0.78
        // settle: their flat bottom already meets the ground, and the deep
        // sink would bury a quarter of the cube)
        return this.legReachM > 0
          ? this.legReachM * 0.88
          : s.bodyRadM * (this.moundBody ? (s.spine.shape === 'box' ? 0.78 : 0.5) : 1.05);
      case 'serpentine':
        return s.bodyRadM * 1.02;
      case 'floating':
        return this.hM * 0.5 + Math.sin(this.t * 1.6) * this.hM * 0.05;
    }
  }

  protected advance(): void {
    const s = this.spec;
    const stride = this.strideHalf();
    for (const tread of this.legTreads.values()) tread.update(this.gaitPhase, stride);
    this.flap = this.winged ? this.groundedWingBeat() : 0;
    // round 24 (creature-anatomy): upright winged walkers (celestial) rest
    // with wings HALF-OPEN — the full fold draped the feather fan into a
    // "turkey tail" and it vanished in the front view. Guardians hold their
    // wings as an identity statement even at idle.
    const foldCap = this.verticalBody ? 0.45 : 1;
    this.wingFold = this.winged ? Math.min(foldCap, this.groundedWingFold()) : 0;

    // spine joints front→rear
    const y0 = this.bodyY();
    // floating bodies hang VERTICAL (head up, wisp down) — ghosts, orbs,
    // eyestalk tyrants; horizontal float stays available via lengthFt (the
    // compiler marks it in bodyLenM vs height)
    this.verticalBody = s.stance === 'upright' || (s.stance === 'floating' && s.bodyLenM <= s.bodyRadM * 4.2);
    const upright = this.verticalBody;
    const n = s.spine.segments;
    for (let i = 0; i <= n; i++) {
      const u = i / n; // 0 front/top → 1 rear/bottom
      const arch = Math.sin(u * Math.PI) * s.spine.arch * s.bodyRadM * 2;
      if (upright) {
        const half = s.bodyLenM * 0.5;
        const topY = s.stance === 'floating' ? y0 + half : Math.max(y0 + s.bodyLenM, s.bodyRadM * 2);
        // A creature WITH legs stands on them: the torso tube runs hips→crown
        // and legs root at hip height (y0). Legless uprights keep the robed
        // column that nearly reaches the ground (wraiths, mounds).
        const bottomY =
          s.stance === 'floating' ? y0 - half : this.legTreads.size > 0 ? y0 : y0 * 0.35;
        this.spinePts[i].set(0, topY - u * (topY - bottomY), arch);
      } else {
        const serp = s.stance === 'serpentine';
        // round 2 (creature-anatomy): a serpentine creature REARS. The front
        // third of the spine rises into a vertical S-curve carrying the head
        // high while the rear body grounds and undulates — the round-1
        // verdict's "fallen leek" was this exact missing stance. Speed-aware:
        // coiled-tall at idle, a lower forward lunge in motion.
        const REAR_U = 0.38; // spine fraction that leaves the ground
        const v = serp && u < REAR_U ? (REAR_U - u) / REAR_U : 0; // 1 at head
        const riseM = serp ? s.bodyLenM * 0.26 * (1 - 0.45 * this.speedFactor) : 0;
        const lift = riseM * Math.pow(v, 1.35);
        // slither is the star: amplitude keys off body LENGTH, idles softly,
        // and fades out along the raised neck (a rearing front holds steady).
        // round 7 (creature-anatomy): amplitude 0.05L → 0.13L and spatial
        // frequency 4.5 → 7.0 — the round-6 top view read as a dead-sapling
        // stick because the grounded trunk carried under half a wavelength at
        // ±0.2 m on an 8 m body. The plan view must show a real S-COIL whose
        // lateral throw rivals the trunk's own width.
        const wave = serp
          ? Math.sin(this.gaitPhase * Math.PI * 2 + u * 7.0) *
            Math.max(s.bodyRadM * 1.1, s.bodyLenM * 0.13) *
            (0.55 + 0.45 * this.speedFactor) *
            (1 - v * 0.85)
          : 0;
        // legless bulky horizontals breathe like a mound (ooze idle squash)
        const breath = this.moundBody ? Math.sin(this.t * 2.2) * s.bodyRadM * 0.1 : 0;
        const moundZ = this.moundBody ? 0.55 : 1;
        // round 4 (creature-anatomy): a serpent's belly RESTS ON THE GROUND
        // along its whole length — each station's center rides at its own
        // profile radius, so the body taper carries the spine line down to a
        // grounded pointed tail tip instead of a constant-height hose whose
        // thin tail floats at mid-body height.
        const yStation = serp ? Math.max(spineRadiusAt(s, u) * 1.02, 0.02) : y0;
        let z = this.attachZ(u) * moundZ;
        if (v > 0) {
          // the raised arc spends length on height: pull its horizontal reach
          // inward, bow backward mid-rise then carry forward at the top — S
          const zBase = this.attachZ(REAR_U);
          z = zBase + (this.attachZ(u) - zBase) * (1 - v * 0.55) +
            riseM * (v * 0.3 - Math.sin(v * Math.PI) * 0.08);
        }
        this.spinePts[i].set(wave, yStation + arch + breath * Math.sin(u * Math.PI) + lift, z);
      }
    }

    // head sockets (needed before anchors)
    this.refreshSockets();

    // anchors — every one, every frame
    const front = this.spinePts[0];
    const rear = this.spinePts[n];
    const mid = this.spinePts[Math.floor(n / 2)];
    const first = this.sockets[0];
    this.setHeadAnchors(first.x, first.y, first.z);
    this.setAnchor('chest', front.x, front.y + s.bodyRadM * 0.3, front.z);
    // wings/back gear ride the SHOULDERS on horizontal bodies (u≈0.3, the
    // chest mass) — mid-body mounting put dragon wings at the waist
    // round 24 (creature-anatomy): VERTICAL bodies mount at the shoulder
    // line too — u≈0.12 near the spine top, pushed BEHIND the torso. The
    // old mid-spine anchor hung the celestial's feather fan at the hip
    // ("turkey tail", round-23 verdict).
    const backPt = s.stance === 'horizontal'
      ? this.spinePts[Math.max(1, Math.round(n * 0.3))]
      : this.verticalBody
        ? this.spinePts[Math.max(0, Math.round(n * 0.12))]
        : mid;
    if (this.verticalBody) {
      this.setAnchor('back', backPt.x, backPt.y + s.bodyRadM * 0.1, backPt.z - s.bodyRadM * 0.6);
    } else {
      this.setAnchor('back', backPt.x, backPt.y + s.bodyRadM * 0.8, backPt.z);
    }
    this.setAnchor('hips', rear.x, rear.y, rear.z);
    this.setAnchor('tailRoot', rear.x, rear.y + s.bodyRadM * 0.15, rear.z);
    const armTips = this.chainTips('arm');
    this.setAnchor('handL', ...(armTips.L ?? [front.x - s.bodyRadM, front.y, front.z]));
    this.setAnchor('handR', ...(armTips.R ?? [front.x + s.bodyRadM, front.y, front.z]));
    const legRoots = this.chainTips('leg');
    this.setAnchor('hipL', ...(legRoots.L ?? [rear.x - s.bodyRadM * 0.7, rear.y, rear.z]));
    this.setAnchor('hipR', ...(legRoots.R ?? [rear.x + s.bodyRadM * 0.7, rear.y, rear.z]));
  }

  /** First left/right tip positions for a chain kind (anchor mapping). */
  private chainTips(kind: 'arm' | 'leg'): { L?: [number, number, number]; R?: [number, number, number] } {
    const out: { L?: [number, number, number]; R?: [number, number, number] } = {};
    for (const chain of this.spec.chains) {
      if (chain.kind !== kind) continue;
      const pts = this.chainPoints(chain);
      const tip = pts[pts.length - 1];
      if (chain.side <= 0 && !out.L) out.L = [tip.x, tip.y, tip.z];
      if (chain.side >= 0 && !out.R) out.R = [tip.x, tip.y, tip.z];
    }
    return out;
  }

  /** Joint positions (root first) for one chain in its current pose. */
  private chainPoints(chain: PlanSpec['chains'][number]): Vector3[] {
    const s = this.spec;
    const rootZ = this.attachZ(chain.attach);
    const upright = s.stance === 'upright';
    // root rides the spine at attach, lifted to heightFrac on the body —
    // unless the chain is PARENTED to a torso (the tauric seam), in which
    // case it roots near that torso's tip (shoulders below the head seat).
    let root: Vector3;
    if (chain.parentId) {
      const parent = s.chains.find((c) => c.id === chain.parentId)!;
      const pts = this.chainPoints(parent); // depth 1 by validation (no torso towers)
      const tip = pts[pts.length - 1];
      const below = pts.length > 1 ? pts[pts.length - 2] : tip;
      const shoulder = tip.clone().lerp(below, 0.18);
      const parentR = parent.links[parent.links.length - 1].rM;
      root = new Vector3(
        shoulder.x + chain.side * (parentR + s.bodyRadM * 0.12),
        shoulder.y,
        shoulder.z,
      );
    } else {
      const spineU = Math.min(1, Math.max(0, chain.attach));
      const idx = Math.min(s.spine.segments, Math.round(spineU * s.spine.segments));
      const sp = this.spinePts[idx];
      // Root-mass round 1: legs and wings bias their root joint INSIDE the
      // hull (0.45 vs the old 0.85 surface tangent) so the compiled root
      // swell erupts through the body wall — the junction reads as a muscled
      // haunch/shoulder, not a pipe glued to the flank.
      // round 14 (creature-anatomy): mound pseudopods root INSIDE too — a gel
      // arm must erupt through its own membrane, not hang off a tangent.
      const inset =
        chain.kind === 'leg' || chain.kind === 'wing' || (this.moundBody && chain.kind === 'tentacle')
          ? 0.45
          : 0.85;
      // round 2 (creature-anatomy): serpentine chains root at the LIVE spine
      // point — the reared front pulls its z inward, so the flat rootZ would
      // strand necks floating ahead of the raised body.
      // round 14 (creature-anatomy): MOUND chains too. The mound compresses
      // its spine z by 0.55 (moundZ), but roots still used the flat rootZ —
      // the ooze's rear smear (attach 0.85) rooted at z −0.53 when the dome
      // ends at −0.42: a pseudopod born OUTSIDE the membrane, the round-13
      // "two misaligned objects" verdict. Every mound chain now roots at the
      // live compressed spine point.
      // round 19 (creature-anatomy): serpentine neck roots BURY inside the
      // riser — heightFrac 0.8+ lifted crown-neck roots half a radius ABOVE
      // the trunk's cap, so each neck tube's own domed root cap floated as
      // the round-18 "hard shelf/ring seam ... socketed on, not grown from
      // the body". Rooting at (and slightly below) the crown center starts
      // every neck INSIDE the trunk dome, so it emerges through the hide.
      const buriedNeck = s.stance === 'serpentine' && chain.kind === 'neck';
      root = new Vector3(
        sp.x + chain.side * s.bodyRadM * inset,
        sp.y +
          (this.verticalBody || buriedNeck ? 0 : (chain.heightFrac - 0.5) * s.bodyRadM * 1.6) -
          (buriedNeck ? s.bodyRadM * 0.3 : 0),
        this.verticalBody
          ? sp.z + s.bodyRadM * 0.2
          : s.stance === 'serpentine' || this.moundBody
            ? sp.z
            : rootZ,
      );
    }
    const total = chain.links.reduce((nn, l) => nn + l.lenM, 0);
    const pts: Vector3[] = [root];

    if (chain.kind === 'leg') {
      const tread = this.legTreads.get(chain.id)!;
      const foot = new Vector3(tread.pos.x, tread.pos.y, tread.pos.z);
      if (chain.links.length === 2) {
        // hind legs (rooted rear-half) bend their hocks BACKWARD like real
        // digitigrade haunches; forelegs keep the forward knee
        V_BEND.set(chain.side * 0.25, 0, chain.attach > 0.5 ? -1 : 1).normalize();
        solveKnee(root, foot, chain.links[0].lenM, chain.links[1].lenM, V_BEND, V_KNEE);
        pts.push(V_KNEE.clone(), foot);
      } else {
        // n links: seed the joints along a root→foot bezier bulged toward the
        // bend, then let FABRIK pull the tip onto the foot.
        //
        // The bezier placed each joint by CURVE PARAMETER, not by arc length,
        // so the drawn links never matched chain.links[j].lenM — a 3+ link limb
        // stretched and squashed as the foot moved. Seeding from the same
        // bezier keeps the authored bend direction; FABRIK then holds every
        // link at its true length, and the per-joint cone stops the limb
        // folding back through itself.
        const bulge = Math.max(0, total - root.distanceTo(foot)) * 0.6 + s.bodyRadM * 0.2;
        const mid = root.clone().add(foot).multiplyScalar(0.5);
        mid.z += bulge;
        const joints: Vector3[] = [root.clone()];
        let acc = 0;
        for (let j = 0; j < chain.links.length - 1; j++) {
          acc += chain.links[j].lenM / total;
          joints.push(bezier2(root, mid, foot, acc));
        }
        joints.push(foot.clone());
        solveFabrikPoints(
          joints,
          chain.links.map((l) => l.lenM),
          foot,
          { jointLimits: legJointLimits(chain.links.length) },
        );
        for (let j = 1; j < joints.length; j++) pts.push(joints[j]);
      }
      return pts;
    }

    // direction seeds per kind (unit-ish, then per-link motion)
    const dir = new Vector3();
    if (chain.kind === 'torso') {
      // an upright sub-spine: straight up with a slight forward lean and a
      // gentle gait sway (the rider's torso)
      const sway = Math.sin(this.gaitPhase * Math.PI * 2) * 0.04 * this.speedFactor;
      dir.set(sway, 1, 0.16);
    } else if (chain.kind === 'tail') dir.set(chain.side * 0.15, 0.12, -1);
    else if (chain.kind === 'tentacle') {
      // round 8 (creature-anatomy): pseudopod droop — tentacles LEAVE the
      // body falling (-0.55, was -0.12). A tentacle held level reads as a
      // stiff spider leg (the ooze's persistent "translucent tick"); dropping
      // the seed direction plus the per-link sag below lays resting tentacles
      // onto the ground clamp, where they drag as melting stubs.
      dir.set(chain.side === 0 ? 0.4 : chain.side, -0.55, 0.35);
      // siblings fan around the body — six tentacles are a crown, not a comb
      const sibs = this.spec.chains.filter((c) => c.kind === 'tentacle' && c.side === chain.side);
      if (sibs.length > 1) {
        const which = sibs.findIndex((c) => c.id === chain.id);
        dir.applyAxisAngle(V_UP, (which / (sibs.length - 1) - 0.5) * 1.9 * (chain.side || 1));
      }
    }
    else if (chain.kind === 'neck') {
      // 2026-07-28: ~45deg per therapsid reference (was 57deg). round 2
      // (creature-anatomy): serpentine necks ride an already-reared spine —
      // they strike FORWARD (jaws leading) rather than periscoping higher.
      if (this.spec.stance === 'serpentine') dir.set(chain.side * 0.2, 0.6, 1.0);
      else dir.set(chain.side * 0.2, 0.95, upright ? 0.3 : 0.95);
    }
    else if (chain.kind === 'wing') dir.set(chain.side === 0 ? 0.9 : chain.side, 0.35, -0.15);
    else {
      // arm: down-forward hang for walkers; a gentle drape for floaters —
      // level enough to radiate when many, hanging enough to read spectral
      // when few
      const droop = this.spec.stance === 'floating' ? -0.22 : -0.55;
      dir.set(chain.side === 0 ? 0.5 : chain.side, droop, 0.5);
      // siblings fan around the body — twelve radial arms are a starburst,
      // not two bundled brooms (same treatment tentacles get)
      const sibs = this.spec.chains.filter((c) => c.kind === 'arm' && c.side === chain.side);
      if (sibs.length > 1) {
        const which = sibs.findIndex((c) => c.id === chain.id);
        dir.applyAxisAngle(V_UP, (which / (sibs.length - 1) - 0.5) * 2.4 * (chain.side || 1));
      }
    }
    dir.normalize();

    // Necks fan out so multi-head creatures separate their heads. Floaters
    // (beholders) crown FULL CIRCLE; walkers fan forward.
    let neckWhich = -1;
    let neckCount = 1;
    if (chain.kind === 'neck') {
      const necks = this.spec.chains.filter((c) => c.kind === 'neck');
      const which = necks.findIndex((c) => c.id === chain.id);
      neckWhich = which;
      neckCount = necks.length;
      if (necks.length > 1) {
        if (this.spec.stance === 'floating') {
          dir.applyAxisAngle(V_UP, (which / necks.length) * Math.PI * 2);
        } else if (this.spec.stance === 'serpentine') {
          // round 12 (creature-anatomy): HYDRA CROWN. Rounds 8-11 spread the
          // WHOLE neck direction per index, so flanker skulls left the trunk
          // sideways at shoulder height and the round-11 verdict read them as
          // "miniature clone heads ... at each shoulder". Every neck now
          // leaves the shared front root on the SAME steep rising line — one
          // muscular base climbing out of the reared S — and all separation
          // happens per-link toward the tip (the crown fan in the link loop
          // below): skulls fan apart only at the TOP, nothing at shoulder
          // height. Deterministic: no time term.
          dir.set(0, 0.85, 0.62).normalize();
        } else {
          const spread = which / (necks.length - 1) - 0.5;
          dir.x += spread * 1.6;
          // round 11 (creature-anatomy): ALL heads carry HIGH in the reared
          // fan; no head ever sinks toward belly height. Deterministic:
          // keyed off the neck's index, not time.
          dir.y -= Math.abs(spread) * 0.18;
          dir.z += Math.abs(spread) * 0.3;
          // Decisive per-index yaws: the FIRST neck swings wide and yaws hard
          // outward (the distracted sentry), the LAST yaws the other way (the
          // wary watcher) — both still striking HIGH.
          if (which === 0) {
            dir.applyAxisAngle(V_UP, -0.6);
          } else if (which === necks.length - 1) {
            dir.applyAxisAngle(V_UP, 0.5);
          }
          dir.normalize();
        }
      }
    }

    const cur = root.clone();
    const perp = new Vector3(-dir.z, 0, dir.x).normalize();
    for (let j = 0; j < chain.links.length; j++) {
      const link = chain.links[j];
      const step = dir.clone();
      if (chain.kind === 'tail') {
        const wag = Math.sin(this.t * 2.4 + j * 0.9) * (0.28 + 0.2 * this.speedFactor);
        step.applyAxisAngle(V_UP, wag * (j + 1) * 0.35);
        step.y -= j * 0.16; // droop toward the tip
      } else if (chain.kind === 'tentacle') {
        // round 8 (creature-anatomy): the wave rides the GROUND — lateral
        // ripple stays (perp), but the vertical component shrank (0.22 →
        // 0.08) and every link now sags hard (-0.28 - j*0.2, was -j*0.08).
        // With the ground clamp below, no tentacle holds a straight line in
        // the air at idle: they droop, touch down, and drag.
        const wave = Math.sin(this.t * 3.1 + j * 1.15 + chain.attach * 6);
        step.addScaledVector(perp, wave * 0.35).addScaledVector(V_UP, wave * 0.08 - 0.28 - j * 0.2);
      } else if (chain.kind === 'wing') {
        step.y += this.flap * (0.55 + j * 0.5);
      } else if (chain.kind === 'neck') {
        // arc up and outward; only ease off near the tip so heads ride high
        step.y += Math.sin(this.t * 0.8 + chain.attach * 3) * 0.06 - j * 0.03;
        // round 12 (creature-anatomy): CROWN FAN for serpentine multi-necks —
        // the outward yaw GROWS with the link index, so the fat first links
        // hug the shared rising line (one branching trunk) and the skulls fan
        // apart only at the top. The tip yaw also turns each flanker head
        // outward (head forward = tip minus prev, the round-10 lesson), and
        // flankers ease slightly BELOW the hero at the tip — beside and
        // below, never dropping toward the body. Deterministic: keyed off the
        // neck's index, not time.
        if (neckCount > 1 && this.spec.stance === 'serpentine') {
          const spread = neckWhich / (neckCount - 1) - 0.5;
          const tipFrac = (j + 1) / chain.links.length;
          // round 13 (creature-anatomy): ASYMMETRIC fan — equal ± yaws and
          // equal droops read "broccoli-symmetric" (round-12 verdict). Each
          // neck takes its own yaw gain and droop by index, so the crown's
          // silhouette staggers instead of mirroring. Deterministic.
          const yawGain = 1.9 + 0.4 * Math.sin(neckWhich * 2.7 + 0.8);
          step.applyAxisAngle(V_UP, spread * yawGain * tipFrac);
          step.y -= Math.abs(spread) * (0.44 + 0.12 * Math.sin(neckWhich * 1.9)) * tipFrac;
        } else if (neckCount > 1 && this.spec.stance !== 'floating' && j === chain.links.length - 1) {
          // round 10-11 (creature-anatomy): non-serpentine walkers keep the
          // decisive last-link YAW kinks — heads turn, never drop.
          if (neckWhich === 0) step.applyAxisAngle(V_UP, -0.75);
          else if (neckWhich === neckCount - 1) step.applyAxisAngle(V_UP, 0.6);
        }
      } else if (chain.kind === 'arm') {
        const swing = Math.sin(this.gaitPhase * Math.PI * 2 + (chain.side < 0 ? 0.5 : 0) * Math.PI * 2) *
          0.5 * this.speedFactor;
        step.z += swing;
      }
      step.normalize().multiplyScalar(link.lenM);
      cur.add(step);
      // keep grounded kinds from digging in
      if (cur.y < link.rM) cur.y = link.rM;
      pts.push(cur.clone());
    }
    return pts;
  }

  /** S-neck joints for neckless heads on horizontal bodies (buildBody draws them). */
  private readonly autoNecks = new Map<number, { base: Vector3; mid: Vector3; top: Vector3 }>();

  private refreshSockets(): void {
    const s = this.spec;
    this.sockets.length = 0;
    this.autoNecks.clear();
    s.heads.forEach((head, hi) => {
      // low-slung bodies have tiny frame heights; keep heads readable
      // relative to body thickness too (0.4: eyestalk heads must stay small
      // on bulky bodies — the neck-carry floor matches this in compile)
      const baseR = Math.max(this.hr, s.bodyRadM * 0.4) * head.sizeScale;
      if (head.chainId) {
        const chain = s.chains.find((c) => c.id === head.chainId)!;
        const pts = this.chainPoints(chain);
        const tip = pts[pts.length - 1];
        const prev = pts[pts.length - 2] ?? tip;
        const f = tip.clone().sub(prev);
        f.y *= 0.4; // faces look mostly outward, not skyward
        if (f.lengthSq() < 1e-8) f.set(0, 0, 1);
        f.normalize();
        this.sockets.push({
          x: tip.x + f.x * baseR * 0.5,
          y: tip.y + baseR * 0.35,
          z: tip.z + f.z * baseR * 0.5,
          r: baseR,
          fx: f.x, fy: f.y, fz: f.z,
          eyes: head.eyes,
        });
        return;
      }
      const front = this.spinePts[0];
      if (s.stance === 'floating' || this.moundBody) {
        // a floating orb or an ooze mound IS the head: embed it at the core so
        // the face lives on the mass, not a periscope lump on a neck
        const core = this.spinePts[Math.floor(this.spinePts.length / 2)];
        this.sockets.push({
          x: core.x,
          y: core.y + baseR * 0.15,
          // round 21 (creature-anatomy): 0.55 → 0.85 — the face socket rides
          // at the membrane surface so the eyes sit ON the gel as distinct
          // highlighted spheres instead of dull shapes sunk deep inside it.
          z: core.z + s.bodyRadM * 0.85,
          r: baseR,
          fx: 0, fy: 0, fz: 1,
          eyes: head.eyes,
        });
        return;
      }
      if (s.stance === 'upright') {
        // round 24 (creature-anatomy): rocky bodies SINK the skull — the head
        // sits low between the shoulder boulders (design language: "a small
        // or absent head sunk low between huge shoulders"), pushed forward so
        // the face zone clears the chest plates.
        // round 24 (creature-anatomy), second pass: the first rocky socket sat
        // AT the spine top, so the shoulder boulders swallowed the whole face
        // and the face panel captured a blank chest plate. The face zone now
        // rides FORWARD of the plate ring (bodyRad-relative, not head-relative)
        // in the notch between the shoulders, low — a brow shelf over a dark
        // hollow, exactly the reference's read.
        this.sockets.push({
          x: front.x,
          y: front.y + (this.rocky ? s.bodyRadM * 0.2 : baseR * 0.9),
          z: front.z + (this.rocky ? s.bodyRadM * 1.05 + baseR * 0.45 : baseR * 0.15),
          r: baseR,
          fx: 0, fy: 0, fz: 1,
          eyes: head.eyes,
        });
        return;
      }
      // horizontal/serpentine neckless heads ride an auto S-neck: proud above
      // the shoulder line, not hanging vulture-low off the spine front —
      // diagonal, not a periscope.
      // round 21 (creature-anatomy): HIGHER, LONGER carriage — the round-20
      // dragon front panel collapsed the tucked head into the chest ("one
      // dark mess"). The skull now rides higher and further forward so head
      // and chest separate in the front view.
      const rise = s.bodyRadM * 2.15 + baseR * 0.85;
      const fwd = s.bodyRadM * 2.3;
      const bob = Math.sin(this.t * 0.8 + hi) * s.bodyRadM * 0.08;
      const base = front.clone();
      const mid = new Vector3(front.x, front.y + rise * 0.55 + bob * 0.4, front.z + fwd * 0.35);
      const top = new Vector3(front.x, front.y + rise + bob, front.z + fwd);
      this.autoNecks.set(hi, { base, mid, top });
      this.sockets.push({
        x: top.x,
        y: top.y + baseR * 0.3,
        z: top.z + baseR * 0.45,
        r: baseR,
        // round 21 (creature-anatomy): LEVEL muzzle (was fy -0.12) — the
        // downcast tuck showed the pale jaw underside stacked on the chest
        // in the front panel ("one dark mess"). A level carriage holds the
        // head clear of the chest read.
        fx: 0, fy: 0.02, fz: 1,
        eyes: head.eyes,
      });
    });
  }

  headSockets(): PlanHeadSocket[] {
    return this.sockets.map((s) => ({ ...s, eyes: { ...s.eyes } }));
  }

  buildBody(sink: SegmentSink): void {
    const s = this.spec;
    const n = s.spine.segments;
    const boxBody = s.spine.shape === 'box';
    if (boxBody && !sink.box) {
      throw new Error('entities3d: this creature has a box body — the sink must implement box()');
    }
    // Smooth mode (Dragon Forge technique): sinks that implement tube() get
    // continuous swept bodies; others (crowd bake, collectors, wireframe)
    // keep the rigid per-segment fallback. Translucent FLOATING bodies stay
    // on segments — the layered pale look reads as mist (the ghost).
    // round 6 (creature-anatomy): translucent GROUNDED bodies keep the smooth
    // tube — a gel ooze must hold its slumped mound; flipping it to stacked
    // segment balls just because opacity < 1 turned translucency into a
    // geometry change.
    const misty = s.opacity !== undefined && s.opacity < 1 && s.stance === 'floating';
    const smooth = !boxBody && !misty && typeof sink.tube === 'function';
    // round 4 (creature-anatomy): the torso TAPERS INTO the tail. When a tail
    // chain roots at the spine rear, the spine's final radius snaps to the
    // tail's root-link radius so the two tubes meet as one continuous surface
    // — the round-3 verdict's "flat disc from which the tail sprouts" was the
    // full-width spine end cap facing the camera behind a thinner tail root.
    const rearTail = s.chains.find((c) => c.kind === 'tail' && !c.parentId && c.attach > 0.85);
    const seamR = rearTail ? Math.max(0.008, rearTail.links[0].rM) : null;
    // round 16 (creature-anatomy): the mound sweeps FLATTER than its profile
    // (MOUND_FLATTEN) — the lost width comes back as ground-level flank lobes
    // below, so the settled gel is wider than tall in every render path
    const moundFlatten = this.moundBody && !boxBody ? PlanDriver.MOUND_FLATTEN : 1;
    const spineR = (u: number): number =>
      (seamR !== null && u === 1 ? seamR : spineRadiusAt(s, u)) * moundFlatten;
    // spine radius: THE shared profile (spineProfile.spineRadiusAt) — taper+bulge
    // for legacy plans, three-lobe chest/waist/hips when spine.mass is set
    if (smooth) {
      const flat: number[] = [];
      const radii: number[] = [];
      for (let i = 0; i <= n; i++) {
        const p = this.spinePts[i];
        flat.push(p.x, p.y, p.z);
        radii.push(spineR(i / n));
      }
      // round 18 (creature-anatomy): serpentine trunks carry scale-ring VALUE
      // bands — the round-17 verdict read the trunk as "a smooth vinyl tube
      // ... zero ornament". Darkened rings ride the countershade tint (value,
      // never displacement — the toon ramp erases relief at sheet distance),
      // fading at the belly so the scute strip stays clean. Count follows the
      // segment count (deterministic, frame-constant per id).
      // round 24 (creature-anatomy): strength 0.45 → 0.62 — the round-23
      // verdict still read the trunk as "a smooth tube"; the scale rings
      // must land a full toon band darker (Valheim serpent scale texture).
      const bands =
        s.stance === 'serpentine' && !this.moundBody
          ? { count: Math.min(18, Math.max(8, Math.round(n * 1.25))), strength: 0.62 }
          : undefined;
      sink.tube!('spine', flat, radii, bands);
    } else {
      for (let i = 0; i < n; i++) {
        const a = this.spinePts[i];
        const b = this.spinePts[i + 1];
        const uA = i / n;
        const uB = (i + 1) / n;
        // rigid fallback now honors the same profile (bulge included) — the
        // crowd bake silhouette finally matches the smooth tube
        const rA = spineR(uA);
        const rB = spineR(uB);
        if (boxBody) {
          const side = Math.max(rA, rB) * 2.15;
          sink.box!(`spine.${i}`, a.x, a.y, a.z, b.x, b.y, b.z, side, side);
        } else {
          sink.seg(`spine.${i}`, a.x, a.y, a.z, b.x, b.y, b.z, rA, rB);
        }
      }
    }
    // round 8 (creature-anatomy): POOLING GEL SKIRT — gravity owns a mound's
    // silhouette. The round-7 ooze verdict: "widest mid-air ... no
    // ground-contact skirt". A ground-station collar per spine joint (axis
    // up, rooted at the floor) lathes a concave flare from a rim at
    // ~1.35 × the local body radius on the ground line up into the dome
    // wall (inner lip 0.78 r at 0.27 r height sits INSIDE the settled tube,
    // whose half-width at that height is ~0.86 r) — so the widest line of
    // the whole body is its ground contact. Radii are frame-constant per id
    // (collar geometry caches by id); only x/z follow the breathing spine.
    if (this.moundBody && sink.collar) {
      // round 23 (creature-anatomy): every other station — each collar spans
      // its whole local circle so the halved ring still overlaps into one
      // continuous ground rim; the ~1k triangles fund the gel core.
      for (let i = 0; i <= n; i += 2) {
        const p = this.spinePts[i];
        const rHere = spineR(i / n);
        // round 13 (creature-anatomy): IRREGULAR SKIRT LINE — the round-12
        // silhouette read as "a nearly perfect featureless circle". Each
        // station's rim reach wobbles by a deterministic pseudo-hash of its
        // index (frame-constant per id — the geometry contract holds), so the
        // ground-contact line reads as a settled splat, not a compass circle.
        // round 14 (creature-anatomy): the skirt REGISTERS to the dome. The
        // round-13 apron reached 1.22–1.64 × rHere with an x-offset per
        // station while the dome's ground half-width is only ~0.85 × rHere —
        // the pale membrane rim traced the dome, the fat green skirt traced
        // its own splat, and the critic read two misaligned objects. The rim
        // now derives from the SAME live circle the tube draws: inner lip
        // inside the dome wall, outer rim just past the dome's widest line —
        // widest-at-ground holds, but the skirt hugs the body it belongs to.
        // Stations whose circle never reaches the ground grow no skirt.
        // round 16 (creature-anatomy): keep in sync with bodyY's mound sink
        // (0.5) — rHere already carries MOUND_FLATTEN via spineR
        const yCenter = s.bodyRadM * 0.5; // the settled tube's center height
        const ghw = Math.sqrt(Math.max(0, rHere * rHere - yCenter * yCenter));
        if (ghw < s.bodyRadM * 0.05) continue;
        const wob = 0.5 + 0.5 * Math.sin(i * 7.13 + 1.7);
        const inner = Math.max(0.008, ghw * 0.7);
        // outer rim: past the dome's GROUND width (widest-at-ground) but never
        // past its widest mid-height line — from the top the skirt must hide
        // under the dome edge, or the rim highlight traces an inner contour
        const outer = Math.min(ghw + rHere * 0.16 * (0.5 + wob), rHere * 1.04);
        sink.collar(
          `spine.skirt${i}`,
          p.x, 0.01, p.z,
          0, 1, 0,
          inner,
          Math.max(0.02, outer - inner),
        );
      }
      // round 16 (creature-anatomy): FLANK LOBES — gel slumping OUT of the
      // dome at ground level. The flattened dome (MOUND_FLATTEN) sheds
      // height; these decorative balls rebuild the width beside it, so the
      // full body — buried volume included, in the ground-free silhouette
      // panel too — reads clearly wider than tall. Ids are decorative
      // (spine.lobeL/R…): the segment renderer draws them in the gel skin,
      // the skinned path routes them to its decorative delegate, and no
      // bones are created. Radii frame-constant per id; x/z ride the
      // breathing spine like the skirt.
      // round 23 (creature-anatomy): every OTHER station — 18 lobes was both
      // the "matte opaque lobe pile" verdict and ~4k triangles the 30k budget
      // needed back for the gel core. Fewer, bigger, asymmetric slumps.
      for (let i = 0; i <= n; i += 2) {
        const p = this.spinePts[i];
        const rHere = spineR(i / n);
        const rl = rHere * PlanDriver.MOUND_LOBE_R;
        if (rl < s.bodyRadM * 0.12) continue; // no micro-beads at the taper
        const wob = Math.sin(i * 5.21 + 0.9) * 0.12;
        for (const [tag, sgn] of [['L', -1], ['R', 1]] as const) {
          // round 23 (creature-anatomy): ASYMMETRIC SLUMPED LOBES — the
          // round-22 front panel read the mirror-perfect lobe pairs as a
          // seated gorilla (shoulder lobes + belly + fists). Each side now
          // carries its own deterministic radius factor and the lobes sit
          // lower (0.45 → 0.36 rl): settled liquid never slumps twice the
          // same way.
          const aFac = 1 + 0.2 * Math.sin(i * 3.9 + (sgn > 0 ? 0.7 : 2.3));
          sink.ball(
            `spine.lobe${tag}${i}`,
            p.x + sgn * rHere * (PlanDriver.MOUND_LOBE_OFFSET + wob),
            rl * aFac * 0.36,
            p.z + rHere * wob * sgn,
            rl * aFac,
          );
        }
      }
      // round 20 (creature-anatomy): DRIP LOBES pooling at the ground line —
      // the round-19 ooze verdict: "it lacks drip lobes pooling at the
      // ground line". Small mostly-buried droplet balls sit just PAST the
      // skirt rim at deterministic azimuths (frame-constant per id), each
      // one reading as gel that ran off the mound and puddled. They render
      // in the gel skin with the one-surface depth twin, so they merge into
      // the translucent mass instead of reading as pebbles.
      for (let i = 0; i <= n; i += 3) {
        const p = this.spinePts[i];
        const rHere = spineR(i / n);
        const yC = s.bodyRadM * 0.5;
        const ghw2 = Math.sqrt(Math.max(0, rHere * rHere - yC * yC));
        if (ghw2 < s.bodyRadM * 0.15) continue;
        const az = Math.sin(i * 3.77 + 0.6) * Math.PI; // deterministic spread
        const rd = rHere * (0.14 + 0.08 * (0.5 + 0.5 * Math.sin(i * 9.31)));
        const reach = ghw2 + rHere * 0.22 + rd * 0.6;
        sink.ball(
          `spine.drip${i}`,
          p.x + Math.cos(az) * reach,
          rd * 0.42, // mostly sunk: a pooled drip, not a marble
          p.z + Math.sin(az) * reach * 0.8,
          rd,
        );
      }
    }
    // round 13 (creature-anatomy): GEL INTERIOR — the round-12 verdict: "an
    // empty glass dome — no internal core, no suspended debris". The mound
    // now carries an opaque NUCLEUS (a darker irregular mass, offset from
    // center) and three debris chunks suspended at varied depths. The
    // renderer resolves `interior.*` ids to opaque materials (segmentBody);
    // positions ride the breathing spine plus a slow deterministic drift so
    // the chunks read as suspended in the gel, not pinned to it. Radii are
    // frame-constant per id.
    if (this.moundBody) {
      const core = this.spinePts[Math.floor(this.spinePts.length / 2)];
      const R = s.bodyRadM;
      const sway = Math.sin(this.t * 0.9);
      // round 21 (creature-anatomy): the dark NUCLEUS is GONE — from the
      // face camera an opaque core at mound center always sits behind the
      // eye row, and the round-20 verdict read the pairing as "an ambiguous
      // pill/mouth" ("resolve it into clearly separate eyes ... or remove
      // it"). The pale debris chunks stay for the suspended-in-gel read.
      sink.ball('interior.chunk0', core.x + R * 0.38, core.y + R * 0.2 + sway * R * 0.05, core.z + R * 0.4, R * 0.15);
      sink.ball('interior.chunk1', core.x - R * 0.44, core.y - R * 0.12, core.z - R * 0.42, R * 0.18);
      sink.ball('interior.chunk2', core.x + R * 0.08, core.y + R * 0.4 - sway * R * 0.04, core.z - R * 0.3, R * 0.11);
      // round 22 (creature-anatomy): SMALL SUSPENDED FLECKS — the round-21
      // verdict: "no internal suspended matter" (three chunks alone vanish
      // at panel distance). Six pale flecks hang at varied depths with slow
      // deterministic drift; radii stay well under the chunks' so they read
      // as suspended grit, never a second nucleus pill.
      // round 23 (creature-anatomy): flecks PUSH OUT to the membrane band —
      // the new opaque gel core (segmentBody addGelCore, 0.85 of the dome)
      // swallowed the old center-suspended flecks. They now hang in the
      // translucent shell between core and skin (horizontal reach ~0.85 R),
      // where the membrane still shades over them.
      const drift = Math.sin(this.t * 0.7 + 1.3);
      sink.ball('interior.chunk3', core.x + R * 0.62, core.y + R * 0.45 + drift * R * 0.03, core.z + R * 0.58, R * 0.055);
      sink.ball('interior.chunk4', core.x - R * 0.78, core.y + R * 0.34 - sway * R * 0.03, core.z + R * 0.35, R * 0.05);
      sink.ball('interior.chunk5', core.x - R * 0.3, core.y + R * 0.22 + drift * R * 0.025, core.z - R * 0.82, R * 0.065);
      sink.ball('interior.chunk6', core.x + R * 0.83, core.y + R * 0.18 + sway * R * 0.02, core.z - R * 0.25, R * 0.045);
      sink.ball('interior.chunk7', core.x - R * 0.72, core.y + R * 0.4, core.z + R * 0.45, R * 0.06);
      // round 22 (creature-anatomy): WET SPECULAR HIGHLIGHT — an unlit
      // near-white lens (segmentBody `interior.gloss*`) pressed just inside
      // the dome's upper-front-left quadrant, where the toon key light
      // lands. The translucent front shades over it, so it reads as a gloss
      // hotspot ON the wet dome instead of the deleted sticker-edge rim.
      // Eyeball fix (first round-22 capture): a single R*0.34 flat lens at
      // the crown read as a BLOWHOLE disc — the highlight is now smaller,
      // rounder, off-center on the light-facing flank, with the classic
      // small trailing second dot.
      // round 23: glints ride OUT with the flecks — inside the opaque core
      // they vanished; on the upper light-facing flank they read as the wet
      // hotspot through the membrane again.
      sink.ball('interior.gloss0', core.x - R * 0.66, core.y + R * 0.55, core.z + R * 0.48, R * 0.2);
      sink.ball('interior.gloss1', core.x - R * 0.5, core.y + R * 0.68, core.z + R * 0.26, R * 0.085);
    }
    // round 9 (creature-anatomy): driver-owned dorsal crest. The finRidge
    // chain part rode a 3-anchor bezier and detached laterally from the
    // slithering trunk — the round-8 top view showed floating teardrops half
    // a body-width off the spine. The crest samples the LIVE spine polyline
    // every frame.
    // round 10 (creature-anatomy): the cones + web strip read as a PICKET
    // FENCE (round-9 verdict). The crest is now ONE continuous serrated fin
    // loft (sink.fin): a single ribbon rooted inside the trunk whose upper
    // edge rises into blunt raked serrations. Sinks without fin() (crowd
    // bake, collectors, wireframe) keep the per-blade segment path.
    if (this.crested && s.stance !== 'floating' && !this.verticalBody && sink.fin) {
      // round 19 (creature-anatomy): the crest CLIMBS THE RISER. U0 was 0.26
      // — behind the reared front third — so the trunk column the sheets
      // actually show carried no ornament and the round-18 verdict read "a
      // smooth vinyl tube". The run now starts just behind the neck crown,
      // and the fin offsets along the spine's live DORSAL NORMAL (perp to the
      // tangent in the sagittal plane) instead of world +Y: on the vertical
      // riser +Y points along the column and buried the whole fin inside it.
      const STATIONS = 44;
      const TEETH = 12;
      const U0 = 0.06;
      const U1 = 0.975;
      const base: number[] = [];
      const top: number[] = [];
      const widths: number[] = [];
      for (let k = 0; k < STATIONS; k++) {
        const uu = (k / (STATIONS - 1));
        const u = U0 + (U1 - U0) * uu;
        const f = u * n;
        const i0 = Math.min(n - 1, Math.floor(f));
        const w = f - i0;
        const a = this.spinePts[i0];
        const b = this.spinePts[i0 + 1];
        const px = a.x + (b.x - a.x) * w;
        const py = a.y + (b.y - a.y) * w;
        const pz = a.z + (b.z - a.z) * w;
        // polyline tangent (front→rear) rakes the serration tips backward
        let tx = b.x - a.x;
        let ty = b.y - a.y;
        let tz = b.z - a.z;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        // dorsal normal = X̂ × tangent (sagittal): +Y on the grounded run,
        // tilting rearward-horizontal up the riser so the crest always crowns
        // the trunk's top line
        let dy = -tz;
        let dz = ty;
        const dl = Math.hypot(dy, dz);
        if (dl < 1e-4) {
          dy = 1;
          dz = 0;
        } else {
          dy /= dl;
          dz /= dl;
        }
        const rHere = spineR(u);
        // envelope holds presence at the crown end (the riser is the panel
        // star), peaks mid-run, and closes at the tail; serration is a blunt
        // |sin| tooth wave riding it — heights are functions of u only, so
        // the loft's widths stay frame-constant per station
        const env = Math.sin((0.16 + 0.84 * uu) * Math.PI);
        const serr = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(uu * Math.PI * TEETH)), 0.6);
        const h = rHere * (0.5 + 1.05 * env) * serr;
        base.push(px, py + dy * rHere * 0.35, pz + dz * rHere * 0.35); // rooted INSIDE the trunk
        top.push(
          px + tx * h * 0.4,
          py + dy * (rHere * 0.35 + h) + ty * h * 0.4,
          pz + dz * (rHere * 0.35 + h) + tz * h * 0.4,
        );
        widths.push(Math.max(0.012, rHere * 0.26));
      }
      sink.fin('crest', base, top, widths);
    } else if (this.crested && s.stance !== 'floating' && !this.verticalBody) {
      // round 19 (creature-anatomy): fallback blades climb the riser too
      // (same U0 + dorsal-normal reasoning as the fin loft above)
      const blades = 14;
      const U0 = 0.08;
      const U1 = 0.97;
      let prevX = 0;
      let prevY = 0;
      let prevZ = 0;
      let prevR = 0;
      for (let k = 0; k < blades; k++) {
        const u = U0 + ((U1 - U0) * k) / (blades - 1);
        const f = u * n;
        const i0 = Math.min(n - 1, Math.floor(f));
        const w = f - i0;
        const a = this.spinePts[i0];
        const b = this.spinePts[i0 + 1];
        const px = a.x + (b.x - a.x) * w;
        const py = a.y + (b.y - a.y) * w;
        const pz = a.z + (b.z - a.z) * w;
        // polyline tangent (front→rear) for the swept-back blade rake
        let tx = b.x - a.x;
        let ty = b.y - a.y;
        let tz = b.z - a.z;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        let dy = -tz;
        let dz = ty;
        const dl = Math.hypot(dy, dz);
        if (dl < 1e-4) {
          dy = 1;
          dz = 0;
        } else {
          dy /= dl;
          dz /= dl;
        }
        const rHere = spineR(u);
        const h = rHere * (1.05 + Math.sin(u * Math.PI) * 0.5);
        sink.seg(
          `crest.${k}`,
          px, py + dy * rHere * 0.45, pz + dz * rHere * 0.45,
          px + tx * h * 0.5, py + dy * (rHere * 0.45 + h) + ty * h * 0.5, pz + dz * (rHere * 0.45 + h) + tz * h * 0.5,
          Math.max(0.012, rHere * 0.38),
          Math.max(0.005, rHere * 0.05),
        );
        const webY = py + dy * rHere * 0.78;
        if (k > 0) {
          sink.seg(
            `crest.web${k - 1}`,
            prevX, prevY, prevZ,
            px, webY, pz,
            Math.max(0.01, prevR * 0.34),
            Math.max(0.01, rHere * 0.34),
          );
        }
        prevX = px;
        prevY = webY;
        prevZ = pz;
        prevR = rHere;
      }
    }
    // chains
    const SMOOTH_KINDS = new Set(['tail', 'tentacle', 'neck', 'torso']);
    for (const chain of s.chains) {
      const pts = this.chainPoints(chain);
      if (smooth && SMOOTH_KINDS.has(chain.kind)) {
        // one continuous tube per organic chain; limbs (legs/arms/wings) keep
        // crisp rigid bones + IK joints
        const flat: number[] = [];
        const radii: number[] = [];
        for (let j = 0; j < pts.length; j++) {
          flat.push(pts[j].x, pts[j].y, pts[j].z);
          const link = chain.links[Math.min(j, chain.links.length - 1)];
          // round 4 (creature-anatomy): tails end in a POINT (0.12 of the
          // last link), not a 0.55-wide capped stub — the tube's domed end
          // cap turns a near-zero final radius into a sharp tip. Necks keep
          // 0.55: a sculpted head covers that end.
          // round 6 (creature-anatomy, round-5 leftover): tentacles soften to
          // 0.45 — the 0.12 needle point made the ooze's pseudopods read as
          // rigid tusks/thorns; a pseudopod MELTS to a rounded droplet end.
          const tipEnd = chain.kind === 'tail' ? 0.12 : chain.kind === 'tentacle' ? 0.45 : 0.55;
          const tipTaper = j === pts.length - 1 ? tipEnd : 1;
          radii.push(Math.max(0.008, link.rM * tipTaper));
        }
        // round 18 (creature-anatomy): serpentine NECK chains carry the same
        // scale-ring value banding as the trunk — one banded skin from trunk
        // through neck hides the trunk/neck junction ring instead of cutting
        // a new material seam there.
        const chainBands =
          s.stance === 'serpentine' && !this.moundBody && chain.kind === 'neck'
            ? { count: Math.min(12, Math.max(5, chain.links.length * 2)), strength: 0.45 }
            : undefined;
        sink.tube!(chain.id, flat, radii, chainBands);
      } else {
        for (let j = 0; j < chain.links.length; j++) {
          const a = pts[j];
          const b = pts[j + 1];
          // round 2 (creature-anatomy): inter-link taper FLOWS — each link
          // ends at the NEXT link's authored radius (the old 0.85 factor
          // re-stepped radii back UP at every joint, erasing the compiled
          // thigh→ankle swell), and the tip link finishes at 0.6 of its own
          // radius so ankles and chain tips render visibly slim.
          const isTip = j === chain.links.length - 1;
          // round 4 (creature-anatomy): rigid tails/tentacles match the smooth
          // tube's pointed 0.12 tip so the crowd-bake silhouette agrees.
          const tipF = chain.kind === 'tail' || chain.kind === 'tentacle' ? 0.12 : 0.6;
          let r0 = Math.max(0.008, chain.links[j].rM);
          let r1 = Math.max(0.008, isTip ? chain.links[j].rM * tipF : chain.links[j + 1].rM);
          // round 11 (creature-anatomy): CALF MASS — the round-10 dragon
          // verdict read "tube-thin below the knee, sticks under a heavy
          // body". The haunch's root swell carries INTO the shin so the knee
          // flows instead of stepping; the ankle keeps the slim authored 0.6
          // tip.
          // round 20 (creature-anatomy): calf 0.62 → 0.45, CAPPED at 1.8× the
          // authored shin — the 0.62 rule times the swollen root made the
          // knee as fat as the mid-thigh (0.289 vs 0.31 visible on the
          // round-19 dragon), and its 0.98-radius joint sphere erased the
          // taper: "thigh ~= ankle width". The knee is now ankle-CLASS, so
          // the limb reads haunch → knee → foot at ~3:1 in silhouette.
          if (chain.kind === 'leg') {
            const kneeR = (jj: number): number =>
              Math.max(chain.links[jj + 1].rM, Math.min(chain.links[jj].rM * 0.45, chain.links[jj + 1].rM * 1.8));
            if (j > 0) r0 = Math.max(r0, kneeR(j - 1));
            if (!isTip) r1 = Math.max(r1, kneeR(j));
          }
          sink.seg(`${chain.id}.${j}`, a.x, a.y, a.z, b.x, b.y, b.z, r0, r1);
        }
      }
      // junction blend collar: a smoothing skirt where the chain root meets
      // the body (slice 1 of the softness dial — reach comes compiled as
      // blendM meters; 0 = hard clip, nothing emitted)
      // (round 19 tried a forced collar at serpentine neck roots for the
      // "socketed on" seam — the lathed flares wrapped the riser as floating
      // donut rings. The seam fix is ROOT BURIAL in chainPoints instead.)
      if (chain.blendM > 0.02 && sink.collar) {
        const rootPt = pts[0];
        if (this.moundBody && chain.kind === 'tentacle') {
          // round 16 (creature-anatomy): mound pseudopod collars lie FLAT.
          // The boosted root collars lathed around the near-horizontal stub
          // axes as VERTICAL rings towering over the dome (collar top 0.67 m
          // vs dome 0.44 m on the ooze fixture) — in the ground-free
          // silhouette panel those rings, not the dome, drew the round-15
          // taller-than-wide egg. A ground-plane collar (axis up, reach
          // capped) melts the stub into the pooling skirt instead.
          sink.collar(
            `${chain.id}.collar`,
            rootPt.x, 0.01, rootPt.z,
            0, 1, 0,
            Math.max(0.008, chain.links[0].rM),
            Math.min(chain.blendM, s.bodyRadM * 0.5),
          );
        } else {
          const nextPt = pts[1] ?? rootPt;
          let ax = nextPt.x - rootPt.x;
          let ay = nextPt.y - rootPt.y;
          let az = nextPt.z - rootPt.z;
          const alen = Math.hypot(ax, ay, az);
          if (alen < 1e-6) {
            ax = 0; ay = -1; az = 0;
          } else {
            ax /= alen; ay /= alen; az /= alen;
          }
          sink.collar(
            `${chain.id}.collar`,
            rootPt.x, rootPt.y, rootPt.z,
            ax, ay, az,
            Math.max(0.008, chain.links[0].rM),
            chain.blendM,
          );
        }
      }
      // energy rings hover at interior joints, facing along the chain
      if (chain.jointRings && sink.ring) {
        for (let j = 1; j < chain.links.length; j++) {
          const joint = pts[j];
          const prev = pts[j - 1];
          const next = pts[j + 1];
          const nx = next.x - prev.x;
          const ny = next.y - prev.y;
          const nz = next.z - prev.z;
          const rM = chain.links[j].rM;
          sink.ring(
            `${chain.id}.ring${j - 1}`,
            joint.x, joint.y, joint.z,
            nx, ny, nz,
            Math.max(0.03, rM * 2.4),
            Math.max(0.008, rM * 0.28),
          );
        }
      }
      // stylized hand: palm ball + three splayed fingers at the tip
      if (chain.tips === 'hand') {
        const tip = pts[pts.length - 1];
        const prev = pts[pts.length - 2] ?? tip;
        V_HAND.set(tip.x - prev.x, tip.y - prev.y, tip.z - prev.z);
        if (V_HAND.lengthSq() < 1e-8) V_HAND.set(0, 0, 1);
        V_HAND.normalize();
        const lastR = chain.links[chain.links.length - 1].rM;
        // round 24 (creature-anatomy): rocky bodies carry CLAW-MASS hands —
        // the design language's "oversized claw masses, the biggest limbs on
        // the body". The palm boulder grows past the forearm gauge and three
        // thick claws rake DOWNWARD to hooked points instead of splaying as
        // level fingers.
        const palmR = Math.max(0.02, lastR * (this.rocky ? 2.05 : 1.5));
        sink.ball(`${chain.id}.palm`, tip.x, tip.y, tip.z, palmR);
        // round 24 (creature-anatomy), second pass: the first rocky hand grew
        // three PENCIL SPIKES off a ball — the opposite of the reference's
        // "oversized claw masses, the biggest limbs on the body". Rock claws
        // are SHORT and FAT: barely longer than the palm, near palm gauge at
        // the root, blunt-tapered rather than needled.
        const fingerLen = palmR * (this.rocky ? 0.95 : 1.9);
        const fingerR = Math.max(0.006, lastR * (this.rocky ? 0.95 : 0.38));
        for (let f = 0; f < 3; f++) {
          V_BEND.copy(V_HAND).applyAxisAngle(V_UP, (f - 1) * 0.42);
          if (this.rocky) {
            V_BEND.y -= 0.85; // claws dig toward the ground
            V_BEND.normalize();
          }
          sink.seg(
            `${chain.id}.finger${f}`,
            tip.x + V_HAND.x * palmR * 0.6,
            tip.y + V_HAND.y * palmR * 0.6,
            tip.z + V_HAND.z * palmR * 0.6,
            tip.x + V_BEND.x * (palmR * 0.6 + fingerLen),
            tip.y + V_BEND.y * (palmR * 0.6 + fingerLen),
            tip.z + V_BEND.z * (palmR * 0.6 + fingerLen),
            fingerR,
            this.rocky ? Math.max(0.008, fingerR * 0.42) : fingerR * 0.7,
          );
          if (this.rocky) {
            // one plate boulder per claw: the fist is a CLUSTER of rocks
            sink.ball(
              `plate.${chain.id}.knuck${f}`,
              tip.x + V_BEND.x * (palmR * 0.6 + fingerLen * 0.35),
              tip.y + V_BEND.y * (palmR * 0.6 + fingerLen * 0.35),
              tip.z + V_BEND.z * (palmR * 0.6 + fingerLen * 0.35),
              fingerR * 1.15,
            );
          }
        }
        if (this.rocky) {
          // knuckle boulder capping the claw mass — the fist reads as one
          // rock chunk, not a ball with sticks
          sink.ball(`plate.${chain.id}.knuckle`, tip.x + V_HAND.x * palmR * 0.5, tip.y + palmR * 0.45, tip.z + V_HAND.z * palmR * 0.5, palmR * 0.85);
        }
      }
      // round 24 (creature-anatomy): ROCKY LIMBS ARE BOULDER STACKS — two
      // overlapping plate boulders per link (separate silhouette forms, per
      // the elemental design language: "3-6 overlapping rock plates per
      // limb, not one smooth loft") plus a dark recessed joint ball between
      // links. Radii derive from the authored link gauges and index-hash
      // wobbles only — frame-constant per id; positions ride the live limb.
      if (this.rocky && (chain.kind === 'arm' || chain.kind === 'leg')) {
        for (let j = 0; j < chain.links.length; j++) {
          const a = pts[j];
          const b2 = pts[j + 1];
          const rL = chain.links[j].rM;
          const seed = chain.attach * 7 + (chain.side + 1) * 1.7 + j * 3.1;
          // three plates per link, pushed OFF the limb axis so each one owns a
          // bump in the outline. (Round-24 first pass hugged the axis at 0.2
          // rL and only fattened the limb into a smooth tube.) An upright
          // elemental's limbs run near-vertical, so the x/z offsets are the
          // perpendicular directions.
          // TRUE perpendicular frame per link. The first attempt offset plates
          // in world x/z, which for a diagonal arm runs ALONG the limb — the
          // plates slid inside the segment and the arms rendered as smooth
          // dark tubes with the torso plated beside them.
          V_LIMB_D.set(b2.x - a.x, b2.y - a.y, b2.z - a.z);
          if (V_LIMB_D.lengthSq() < 1e-10) V_LIMB_D.set(0, -1, 0);
          V_LIMB_D.normalize();
          V_LIMB_U.copy(Math.abs(V_LIMB_D.y) > 0.9 ? V_FWD_Z : V_UP).cross(V_LIMB_D).normalize();
          V_LIMB_V.copy(V_LIMB_D).cross(V_LIMB_U).normalize();
          for (const [pk, k] of [['a', 0.2], ['b', 0.45], ['c', 0.7], ['d', 0.92]] as const) {
            const th = seed * 2.1 + k * 6.4;
            const ox = (Math.cos(th) * V_LIMB_U.x + Math.sin(th) * V_LIMB_V.x) * rL * 0.55;
            const oy = (Math.cos(th) * V_LIMB_U.y + Math.sin(th) * V_LIMB_V.y) * rL * 0.55;
            const oz = (Math.cos(th) * V_LIMB_U.z + Math.sin(th) * V_LIMB_V.z) * rL * 0.55;
            sink.ball(
              `plate.${chain.id}.${j}${pk}`,
              a.x + (b2.x - a.x) * k + ox,
              a.y + (b2.y - a.y) * k + oy,
              a.z + (b2.z - a.z) * k + oz,
              rL * (1.02 + 0.16 * Math.sin(seed * 2.3 + k * 11)),
            );
          }
          if (j > 0) {
            sink.ball(`dark.${chain.id}.joint${j}`, a.x, a.y, a.z, Math.max(0.01, Math.min(rL, chain.links[j - 1].rM) * 0.94));
          }
        }
      }
      if (chain.kind === 'leg') {
        const tip = pts[pts.length - 1];
        const r = Math.max(0.012, chain.links[chain.links.length - 1].rM * 1.1);
        // round 14 (creature-anatomy): REAL FEET on plan legs — the round-13
        // dragon verdict: "the forefeet are stubby three-nub blobs where the
        // drake hangs long knuckled talons". The nub ball is now the ANKLE
        // boss (kept as `${chain.id}.foot` — the skeleton's terminal bone
        // rides it), a heel-to-toe wedge plants the sole (the biped foot
        // pattern adapted to the quad stance), and three splayed toe wedges
        // run forward, each ending in a claw that tapers to a hooked point.
        // All radii are frame-constant per id.
        sink.ball(`${chain.id}.foot`, tip.x, tip.y + r * 0.5, tip.z - r * 0.1, r * 0.85);
        // round 24 (creature-anatomy): JOINTED LIMBS END IN A POINT. A 3+
        // link chain is an arthropod leg (the Carapace Crawler's eight
        // four-link legs); a crab or spider plants a single tapered tarsus
        // claw, not a plantigrade sole with three splayed toes. The toed
        // foot below stays for the 2-link vertebrate legs it was drawn for
        // (dragon, elemental, quadrupeds).
        //
        // This is also where the crawler's triangle budget lives: the toed
        // foot costs ~1.6k body triangles (3.2k with the ink shell) per leg,
        // so eight of them ran the fixture to 44.5k against the 30k budget.
        // One tarsus per leg is both the correct anatomy and ~5x cheaper.
        if (chain.links.length >= 3) {
          sink.seg(
            `${chain.id}.tarsus`,
            tip.x, tip.y + r * 0.4, tip.z - r * 0.15,
            tip.x, Math.max(0.004, r * 0.06), tip.z + r * 1.5,
            r * 0.55, 0.01,
          );
        } else if (chain.links.length >= 2) {
          // sole wedge: heel behind the ankle to a toe box in front, each
          // end's center riding at its own radius so the sole sits flat
          sink.seg(
            `${chain.id}.toePad`,
            tip.x, r * 0.62, tip.z - r * 0.85,
            tip.x, r * 0.5, tip.z + r * 1.0,
            r * 0.62, r * 0.5,
          );
          for (const [ti, splay] of [-0.55, 0, 0.55].entries()) {
            const bx = tip.x + splay * r * 0.55;
            const by = r * 0.34;
            const bz = tip.z + r * 0.85;
            const ex = tip.x + splay * r * 1.35;
            const ey = r * 0.26;
            const ez = tip.z + r * 1.9;
            sink.seg(`${chain.id}.toe${ti}`, bx, by, bz, ex, ey, ez, r * 0.4, r * 0.28);
            // claw: hooks forward and down off the toe knuckle to a point
            sink.seg(
              `${chain.id}.toe${ti}c`,
              ex, ey, ez,
              tip.x + splay * r * 1.6, r * 0.05, tip.z + r * 2.55,
              r * 0.24, 0.012,
            );
          }
        }
      }
    }
    // round 24 (creature-anatomy): ROCKY TORSO — the body IS the element.
    // Overlapping boulder plates climb the spine with dark recessed seams
    // between them (strong value breaks INSIDE the body), two huge shoulder
    // boulders crown the top, moss patches sit on crown and shoulders, a
    // crystal cluster fans off one shoulder (unlit accent = glow), and a
    // crack-glow seam crosses the chest plates. All radii key off the
    // frame-constant spine profile + index hashes; positions ride the live
    // spine points.
    if (this.rocky) {
      const R = s.bodyRadM;
      // A RING of plates per spine station, not one lump per station. The
      // first round-24 capture put a single boulder per station INSIDE the
      // smooth spine loft: no silhouette break, no value break, "one uniform
      // brown lump". Four plates per station now sit centered ON the hull
      // (offset = rHere, so each boulder half-protrudes) at staggered
      // azimuths, and a DARK ring rides between stations at 0.86 rHere — the
      // recessed seam is visible in the gaps the plates leave.
      const PLATE_AZ = 4;
      // station 0 is the shoulder line: the explicit shoulder boulders and the
      // face zone own it. A plate ring there walled the face in (the round-24
      // second capture: the face panel framed a blank chest plate).
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        const rHere = spineR(u);
        const p = this.spinePts[i];
        for (let a = 0; a < PLATE_AZ; a++) {
          // half-step stagger per row: plates of adjacent rows interlock
          const th = (a / PLATE_AZ) * Math.PI * 2 + (i % 2) * (Math.PI / PLATE_AZ) + 0.3;
          const wob = 1 + 0.18 * Math.sin(i * 7.1 + a * 2.9);
          sink.ball(
            `plate.spine${i}_${a}`,
            p.x + Math.cos(th) * rHere * 0.92,
            p.y + Math.sin(i * 5.7 + a * 1.7) * rHere * 0.1,
            p.z + Math.sin(th) * rHere * 0.92,
            rHere * 0.66 * wob,
          );
        }
        if (i < n) {
          const pn = this.spinePts[i + 1];
          const rSeam = Math.min(rHere, spineR((i + 1) / n));
          for (let a = 0; a < PLATE_AZ; a++) {
            const th = ((a + 0.5) / PLATE_AZ) * Math.PI * 2 + (i % 2) * (Math.PI / PLATE_AZ) + 0.3;
            sink.ball(
              `dark.seam${i}_${a}`,
              (p.x + pn.x) / 2 + Math.cos(th) * rSeam * 0.86,
              (p.y + pn.y) / 2,
              (p.z + pn.z) / 2 + Math.sin(th) * rSeam * 0.86,
              rSeam * 0.4,
            );
          }
        }
      }
      const topPt = this.spinePts[0];
      // SHOULDER BOULDERS — the reference's mass hierarchy: the widest forms
      // on the body, riding proud above and outboard of the chest so the head
      // sits in a notch between them.
      for (const [tag, sg] of [['L', -1], ['R', 1]] as const) {
        sink.ball(`plate.shoulder${tag}`, topPt.x + sg * R * 1.05, topPt.y + R * 0.34, topPt.z - R * 0.05, R * 0.92);
        sink.ball(`plate.shoulderTop${tag}`, topPt.x + sg * R * 0.86, topPt.y + R * 0.86, topPt.z - R * 0.12, R * 0.6);
        sink.ball(`dark.armpit${tag}`, topPt.x + sg * R * 1.0, topPt.y - R * 0.34, topPt.z, R * 0.42);
        sink.ball(`moss.shoulder${tag}`, topPt.x + sg * R * 0.92, topPt.y + R * 1.14, topPt.z - R * 0.06, R * 0.42);
      }
      sink.ball('moss.crown', topPt.x, topPt.y + R * 0.72, topPt.z - R * 0.2, R * 0.5);
      // crystal cluster fanning up and out off the RIGHT shoulder — the
      // earth-golem accent. Fat bases, hard points: at panel distance a
      // pencil-thin shard is nothing (round-24 first capture).
      for (let c = 0; c < 5; c++) {
        const bx = topPt.x + R * (0.92 + 0.16 * Math.sin(c * 2.1));
        const by = topPt.y + R * 0.72;
        const bz = topPt.z + (c - 2) * R * 0.3;
        const len = R * (0.9 + 0.34 * Math.sin(c * 3.7 + 1));
        sink.seg(
          `glow.crystal${c}`,
          bx, by, bz,
          bx + R * 0.34 * Math.sin(c * 1.9 - 0.6), by + len, bz + R * 0.18 * Math.cos(c * 2.7),
          R * 0.2,
          R * 0.03,
        );
      }
      // crack-glow seams raking across the chest plates, proud of the surface
      const chestPt = this.spinePts[Math.min(1, n)];
      const rChest = spineR(Math.min(1, n) / n);
      sink.seg(
        'glow.crack0',
        chestPt.x - R * 0.5, chestPt.y + R * 0.34, chestPt.z + rChest * 1.1,
        chestPt.x + R * 0.16, chestPt.y - R * 0.5, chestPt.z + rChest * 1.2,
        R * 0.08,
        R * 0.025,
      );
      sink.seg(
        'glow.crack1',
        chestPt.x + R * 0.42, chestPt.y + R * 0.1, chestPt.z + rChest * 1.15,
        chestPt.x + R * 0.1, chestPt.y - R * 0.62, chestPt.z + rChest * 1.05,
        R * 0.06,
        R * 0.02,
      );
    }
    // auto S-necks for neckless horizontal heads.
    // round 8 (creature-anatomy): chest-to-skull TAPER — the round-7 dragon
    // verdict read "a constant-width hose neck". The base now roots wide
    // (0.85 bodyR class, chest-mass gauge) and the taper runs continuously
    // down to a 0.36 bodyR tip that slips into the sculpted occiput.
    // round 9 (creature-anatomy): the round-8 taper DID NOT RENDER — the wide
    // base segment buried itself in the chest, so the visible upper segment
    // ran 0.52 → 0.36 bodyR, a near-hose. The base now roots INSIDE the chest
    // mass (lerped back along the spine) at full chest gauge, and the taper
    // steepens through the VISIBLE run: 1.05 → 0.58 → 0.3 bodyR — the side
    // panel must show the neck growing out of the chest.
    for (const [hi, neck] of this.autoNecks) {
      const r = this.sockets[hi] ? this.sockets[hi].r : s.bodyRadM;
      const inner = this.spinePts[Math.min(1, n)];
      const bx = neck.base.x + (inner.x - neck.base.x) * 0.3;
      const by = neck.base.y + (inner.y - neck.base.y) * 0.3;
      const bz = neck.base.z + (inner.z - neck.base.z) * 0.3;
      // round 11 (creature-anatomy): MUSCLED skull junction — the round-10
      // verdict read the neck "goose-thin right behind the skull". The upper
      // station now runs 0.66 → 0.44 bodyR so the last visible stretch of
      // neck is a muscular column the skull sits ON, not a straw it balances
      // on; the sculpted occiput still swallows the 0.44 tip.
      // round 18 (creature-anatomy): the neck is now FIVE short segments
      // sampled along a quadratic bezier through base → mid → top — the old
      // two rigid cones met at neck.mid with a ~35° bend, and the joint
      // sphere bulging at that crease was the round-17 "hard visible segment
      // seam ring at mid-neck". Five stations cut the per-joint bend below
      // ~10°, so the same seg+joint-sphere path renders one continuous
      // tapering curve. Radii ride the round-9/11 profile (chest gauge →
      // mid → muscled skull junction), piecewise-linear and MATCHED at every
      // joint — no radius step anywhere.
      // round 23 (creature-anatomy): THICK MUSCULAR COLUMN — the round-22
      // verdict read "a swan neck with a small cat-like head". The skull grew
      // (fixtures sizeScale 1.95) but the neck kept its round-11 gauge, so
      // the bigger head sat on the same slim S-curve. The visible run now
      // carries drake mass: mid 0.66 → 0.82 bodyR, tip 0.44 → 0.56 bodyR
      // (the 1.95 skull's occiput still swallows the wider tip). Base cap
      // rises with it so the root reads as chest muscle, not a stalk.
      const rBase = Math.min(s.bodyRadM * 1.15, r * 1.35);
      const rMid = Math.min(s.bodyRadM * 0.82, r * 1.05);
      const rTip = Math.min(s.bodyRadM * 0.56, r * 0.8);
      const NECK_SEGS = 5;
      const neckPt = (t: number): [number, number, number] => {
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        return [
          a * bx + b * neck.mid.x + c * neck.top.x,
          a * by + b * neck.mid.y + c * neck.top.y,
          a * bz + b * neck.mid.z + c * neck.top.z,
        ];
      };
      const neckR = (t: number): number =>
        t < 0.5 ? rBase + (rMid - rBase) * (t / 0.5) : rMid + (rTip - rMid) * ((t - 0.5) / 0.5);
      for (let k = 0; k < NECK_SEGS; k++) {
        const t0 = k / NECK_SEGS;
        const t1 = (k + 1) / NECK_SEGS;
        const p0 = neckPt(t0);
        const p1 = neckPt(t1);
        sink.seg(`head${hi}.neckS${k}`, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], neckR(t0), neckR(t1));
      }
    }
    // heads (+ optional snouts, cilia lash rings)
    this.sockets.forEach((socket, i) => {
      // formed heads are sculpted meshes owned by the assembler — a ball here
      // would poke through the skull. round 21 (creature-anatomy): mound
      // bodies skip the ball too — the mound IS the head (the socket is
      // embedded at the core), and the dark ball inside the translucent gel
      // read as "an ambiguous pill/mouth" (round-20 ooze verdict). Eyes and
      // cilia still ride the socket.
      if (!s.heads[i].form && !this.moundBody) sink.ball(`head${i}`, socket.x, socket.y, socket.z, socket.r);
      // round 24 (creature-anatomy): the ROCKY FACE ZONE — a brow plate
      // overhangs the face and two unlit GLOW eyes sit sunk beneath it
      // (solid spheres: they survive a 360° orbit). This replaces the
      // assembler's white cartoon eyeballs (the plan authors eyes.count 0).
      if (this.rocky) {
        const rr = socket.r;
        // face frame: right = forward × up (forward is near-horizontal)
        const rx = -socket.fz;
        const rz = socket.fx;
        // THE FACE ZONE, three forms deep (design language: "a readable face
        // zone with minimal features ... menace comes from the brow shadow"):
        //   dark.hollow — a near-black cavity the eyes sit inside
        //   plate.brow  — a light rock shelf OVERHANGING it (the value break
        //                 that makes the hollow read as shadow, not paint)
        //   plate.jaw   — a blunt chin mass under the hollow, so the zone has
        //                 a top and a bottom in the silhouette
        // The eyes are solid orbit-safe spheres on an unlit material, set
        // deep enough that the brow crops them from above in every camera.
        sink.ball(
          `dark.hollow${i}`,
          socket.x + socket.fx * rr * 0.34,
          socket.y + rr * 0.05,
          socket.z + socket.fz * rr * 0.34,
          rr * 0.86,
        );
        sink.ball(
          `plate.brow${i}`,
          socket.x + socket.fx * rr * 0.5,
          socket.y + rr * 0.82,
          socket.z + socket.fz * rr * 0.5,
          rr * 1.02,
        );
        sink.ball(
          `plate.jaw${i}`,
          socket.x + socket.fx * rr * 0.34,
          socket.y - rr * 0.78,
          socket.z + socket.fz * rr * 0.34,
          rr * 0.82,
        );
        for (const [tag, sg] of [['L', -1], ['R', 1]] as const) {
          sink.ball(
            `glow.eye${i}${tag}`,
            socket.x + rx * sg * rr * 0.42 + socket.fx * rr * 0.86,
            socket.y + rr * 0.1,
            socket.z + rz * sg * rr * 0.42 + socket.fz * rr * 0.86,
            rr * 0.3,
          );
        }
      }
      if (s.heads[i].cilia) {
        // a ring of twitching lashes around the face rim, in the plane facing
        // the look direction
        const rimR = socket.r * 0.98;
        const upX = 0;
        const upY = 1;
        const upZ = 0;
        // right = forward × up (socket forward is near-horizontal by contract)
        const rx = socket.fz * upY - socket.fy * upZ;
        const ry = socket.fx * upZ - socket.fz * upX;
        const rz = socket.fy * upX - socket.fx * upY;
        const lashCount = 10;
        for (let c = 0; c < lashCount; c++) {
          const ang = (c / lashCount) * Math.PI * 2;
          const twitch = Math.sin(this.t * 7 + c * 1.7) * 0.12;
          const ox = rx * Math.cos(ang) + upX * Math.sin(ang);
          const oy = ry * Math.cos(ang) + upY * Math.sin(ang);
          const oz = rz * Math.cos(ang) + upZ * Math.sin(ang);
          const baseX = socket.x + ox * rimR * 0.82 + socket.fx * socket.r * 0.45;
          const baseY = socket.y + oy * rimR * 0.82 + socket.fy * socket.r * 0.45;
          const baseZ = socket.z + oz * rimR * 0.82 + socket.fz * socket.r * 0.45;
          const len = socket.r * (0.34 + twitch);
          sink.seg(
            `head${i}.cilia${c}`,
            baseX, baseY, baseZ,
            baseX + ox * len, baseY + oy * len, baseZ + oz * len,
            Math.max(0.006, socket.r * 0.07),
            Math.max(0.004, socket.r * 0.03),
          );
        }
      }
      // formed heads carry their own muzzle/jaw — the cone snout would double it
      const snout = s.heads[i].form ? undefined : s.heads[i].snout;
      if (snout) {
        const len = socket.r * snout.lengthScale;
        sink.seg(
          `head${i}.snout`,
          socket.x, socket.y - socket.r * 0.15, socket.z,
          socket.x + socket.fx * len,
          socket.y - socket.r * 0.15 + (snout.droop - 0.15) * len * 0.6,
          socket.z + socket.fz * len,
          socket.r * 0.42,
          socket.r * 0.2,
        );
      }
    });
  }
}

const V_UP = new Vector3(0, 1, 0);
const V_FWD_Z = new Vector3(0, 0, 1);
/** round 24 (creature-anatomy): per-link orthonormal frame for rocky boulder
 * plates — direction plus the two perpendiculars they ring around. */
const V_LIMB_D = new Vector3();
const V_LIMB_U = new Vector3();
const V_LIMB_V = new Vector3();

/** Quadratic bezier point (allocates — driver-construction and per-frame chain math only). */
/**
 * A multi-link limb may kink hard at each joint, but it must not fold back
 * through itself. 75 degrees is loose enough to leave every authored insect and
 * arachnid bend untouched, and tight enough to reject the fold.
 */
const LEG_JOINT_LIMIT = new BallSocketConstraint(75, 0, 0);
const LEG_LIMITS_BY_LENGTH = new Map<number, readonly (JointConstraint | null)[]>();

/** Per-joint limits for a leg of `linkCount` links. Entry 0 is never used. */
function legJointLimits(linkCount: number): readonly (JointConstraint | null)[] {
  let limits = LEG_LIMITS_BY_LENGTH.get(linkCount);
  if (!limits) {
    limits = Array.from({ length: linkCount }, (_, j) => (j === 0 ? null : LEG_JOINT_LIMIT));
    LEG_LIMITS_BY_LENGTH.set(linkCount, limits);
  }
  return limits;
}

function bezier2(a: Vector3, m: Vector3, b: Vector3, u: number): Vector3 {
  const w = 1 - u;
  return new Vector3(
    w * w * a.x + 2 * w * u * m.x + u * u * b.x,
    w * w * a.y + 2 * w * u * m.y + u * u * b.y,
    w * w * a.z + 2 * w * u * m.z + u * u * b.z,
  );
}

/* ------------------------------------------------------------------ entry */

export function createGaitDriver(
  gait: Gait,
  frame: Frame,
  planSpec?: PlanSpec,
  /** Body-level facts the driver cannot derive from a Frame. `winged`: the
   * blueprint carries wing mesh parts (garnish) — plan drivers need this to
   * beat wings that are not chain appendages. `crested`: the blueprint
   * carries a finRidge garnish — the plan driver emits the dorsal crest
   * along its live spine (round 9). */
  opts?: { winged?: boolean; crested?: boolean },
): GaitDriver {
  switch (gait) {
    case 'biped':
      return new BipedDriver(frame);
    case 'quad':
      return new MultiLegDriver(frame, false);
    case 'hexapod':
      return new MultiLegDriver(frame, true);
    case 'hopper':
      return new HopperDriver(frame);
    case 'flyer':
      return new AirborneDriver(frame, true);
    case 'float':
      return new AirborneDriver(frame, false);
    case 'plan': {
      if (!planSpec) throw new Error('entities3d: plan gait needs a planSpec (compile a CreaturePlan first)');
      return new PlanDriver(frame, planSpec, opts?.winged, opts?.crested);
    }
    default: {
      const never: never = gait;
      throw new Error(`entities3d: unknown gait "${never as string}"`);
    }
  }
}
