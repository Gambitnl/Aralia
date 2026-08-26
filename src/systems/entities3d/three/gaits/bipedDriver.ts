/**
 * @file gaits/bipedDriver.ts — the humanoid walker: treadmill legs, the
 * counter-swinging arm chain, the wave gesture, and the full hand solve
 * (palm frame, digits, grip wrap).
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09), verbatim. The scratch objects
 * below moved with it because no other driver touches them; the four shared
 * ones come from poseUtils. Constants here MIRROR skeletonBuilder.bipedRestPose
 * — that pairing is unchanged by the split.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Frame, SegmentSink } from '../../types';
import { FT_TO_M } from '../../types';
import { solveKnee } from '../ik';
import { ARM_LINK_K, bipedHandDigits, bipedShoulderOutM, bipedSkullRadiusM, bipedSlimT } from '../skeletonBuilder';
import { TreadmillLeg } from '../legs';
import { BaseDriver } from './baseDriver';
import { V_BEND, V_HAND, V_HIP, V_KNEE, wrapIntersectYZ } from './poseUtils';

const EULER = new Euler();

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
// real-finger update: grip-anchor basis scratch.
const M_GRIP = new Matrix4();

/* ------------------------------------------------------------------ biped */

export class BipedDriver extends BaseDriver {
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
  /** Joint-angle wave (2026-08-23): the elbow placed by angle in advance(),
   * read back by the arm solve instead of the knee solver. */
  private readonly waveElbow: [Vector3, Vector3] = [new Vector3(), new Vector3()];

  /** True when the given side performs a wave this frame: both sides for
   * 'wave_both'; for 'wave', the right hand unless it grips a weapon. */
  private waves(sgn: 1 | -1): boolean {
    if (this.gesture === 'wave_both') return true;
    if (this.gesture !== 'wave') return false;
    return sgn === (this.grips?.R ? -1 : 1);
  }

  constructor(
    frame: Frame,
    /** Real-finger update: which hands hold a HAFT weapon (assembler-derived
     * from the blueprint's gear parts). A grip hand wraps its digits around
     * the haft and re-aims the gear anchor so the weapon runs through them. */
    private readonly grips?: { L?: boolean; R?: boolean },
  ) {
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
    // round 22 (humanoid-anatomy): slim frames pull their feet IN (0.68 →
    // 0.58). Widening a slim shoulder also widens a shoulder-derived stance,
    // which is why every earlier attempt at the human's shoulder-to-pelvis
    // ratio cancelled itself out. Mirror: skeletonBuilder.bipedRestPose.
    const stanceFloorK = 0.68 - 0.34 * Math.min(0.5, Math.max(0, frame.bulk - 1)) - 0.1 * bipedSlimT(frame);
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
    // round 21 (humanoid-anatomy): slim frames SHORTEN the neck (0.46 → 0.36
    // lift) — round 20 read the human head as sitting on "a long column neck"
    // that slopes into a hood-like trapezius. Mirror: bipedRestPose neckLift.
    // round 18 (humanoid-anatomy): FORWARD HUNCH — per-species idle posture
    // (Frame.hunch, set from speciesProfiles; the orc's trapezius-dominant
    // lean — round 17: ours "stands bolt upright"). The head drops into the
    // traps and everything above the belt shifts forward (see buildBody).
    // Mirror: skeletonBuilder.bipedRestPose.
    const hunch = this.frame.hunch ?? 0;
    // round 23 (humanoid-anatomy): THE HUNCH ATE THE ORC'S NECK. Visible neck
    // is skullR·(neckLift − 0.35·hunch); solving the three subjects gives human
    // 0.35 skullR, dwarf 0.26 and ORC 0.05 — the round-22 verdict's "there is
    // no neck", and the reason four rounds of neck work never reached the orc:
    // hunch is orc-only, it is subtracted from headY, and neckLift was already
    // sitting on its 0.26 floor so nothing was left to give. The head-drop is
    // now added back into the lift, so the hunch still leans the skull FORWARD
    // into the traps (hunchZ, untouched) without deleting the gap it leans out
    // of. Frames without a hunch are bit-identical. Mirror: bipedRestPose.
    // round 24 (humanoid-anatomy): UPRIGHT BIG HEADS KEEP THEIR CHIN — the
    // lift floor rises with the skull excess, hunch-gated. Full note:
    // skeletonBuilder.bipedRestPose bigHead. Mirror: bipedRestPose.
    const bigHead = Math.max(0, this.frame.headScale - 1) * Math.max(0, 1 - 1.5 * hunch);
    const neckLift = Math.min(0.62, Math.max(0.26 + 1.0 * bigHead, 0.36 - 0.28 * Math.max(0, this.frame.bulk - 1)) + 0.35 * hunch);
    const hunchZ = this.hM * 0.09 * hunch;
    this.headY = this.chestY + this.baseR * 0.35 + this.skullR * (0.59 + neckLift) - this.skullR * 0.35 * hunch;
    // round 13 (humanoid-anatomy): bulky frames push the whole arm chain
    // outward (shoulderOut) — the round-12 orc's left arm fused into the
    // widened torso in the top panel. Mirror: bipedRestPose shoulder terms.
    // round 22 (humanoid-anatomy): the HAND anchor takes the bulky push plus
    // only HALF the slim push (bipedShoulderOutM carries the full one for the
    // shoulder joint), so a slim upper arm slants inward from a widened
    // shoulder to a wrist that stays by the hip. Mirror: bipedRestPose
    // shoulderXAnchor.
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + this.baseR * 0.35
      + this.baseR * 0.22 * Math.max(0, this.frame.bulk - 1) + this.baseR * 0.34 * bipedSlimT(this.frame);
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
      if (this.waves(sgn)) {
        // wave gesture: the wrist rises beside the head and rocks with the
        // beat; buildBody extends the digits and rocks the palm to match.
        // A GRIP hand salutes HIGHER and FURTHER OUT — the wrapped fist and
        // its weapon must clear the head and any hat (Remy's wizard eyeball:
        // the staff fist parked in front of the hat brim).
        // joint-angle wave (2026-08-23): the upper arm rises to a fixed
        // elevation and the forearm points up from the elbow, so every arm
        // length keeps the same shape. The hand-target wave flared the elbow
        // on a long-armed rig (stylized B) and pinned short arms to the head.
        // The shoulder lifts with the gesture (mirrored in the arm solve).
        const gripSide = !!this.grips?.[sgn < 0 ? 'L' : 'R'];
        const elev = gripSide ? 0.75 : 0.35; // upper arm above horizontal
        const fwd = 0.35; // and forward of the frontal plane
        const rock = Math.sin(this.t * 5.2) * 0.22;
        V_SH.set(sgn * shoulderX, this.chestY + this.baseR * 0.45 + this.baseR * 0.16, 0.02 + hunchZ);
        V_BEND.set(sgn * Math.cos(elev) * Math.cos(fwd), Math.sin(elev), Math.cos(elev) * Math.sin(fwd)).normalize();
        const elbow = this.waveElbow[sgn < 0 ? 0 : 1].copy(V_SH).addScaledVector(V_BEND, armLink);
        // forearm: up, leaning a little inward and forward; the rock swings it
        V_BEND.set(-sgn * (0.25 - rock), 0.92, 0.3).normalize();
        hand.pos.copy(elbow).addScaledVector(V_BEND, armLink);
      } else {
        hand.pos.set(
          sgn * (shoulderX + this.baseR * 0.05),
          handY,
          // round 18 (humanoid-anatomy): wrists ride forward with the hunched
          // shoulders (same hunchZ both sides keeps the hang solve exact)
          Math.sin(swing) * this.frame.armLengthFt * FT_TO_M * 0.42 + this.hM * 0.045 + hunchZ,
        );
      }
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
    // round 22 (humanoid-anatomy): slim frames widen the UPPER CHEST (1.12 →
    // 1.20 r) — the round-21 verdict's "widen the human deltoid/upper-chest
    // volume". Waist pinch untouched, so only the V grows. Mirror:
    // skeletonBuilder.bipedRestPose torso.chest.
    const slimT = bipedSlimT(this.frame);
    sink.seg('torso.chest', this.sway * 0.6, beltY, 0.007, 0, this.chestY + r * 0.35, 0.02 + hunchZ, r * waistK, r * (1.12 + 0.08 * slimT));
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
      // round 24 (humanoid-anatomy): the peak stays BELOW the chin on upright
      // big-headed frames — full note: skeletonBuilder.bipedRestPose bigHead.
      // Mirror: bipedRestPose torso.traps.
      const bigHead = Math.max(0, this.frame.headScale - 1) * Math.max(0, 1 - 1.5 * (this.frame.hunch ?? 0));
      const trapsBury = Math.max(0.47 + 1.6 * bigHead, 0.95 - 1.2 * Math.max(0, this.frame.bulk - 1));
      // round 21 (humanoid-anatomy): the slim trapezius narrows (0.54 → 0.46) so
      // the human neck stops reading as a hood; bulky frames keep the round-10
      // wedge width. Mirror: bipedRestPose.
      const trapsR1 = Math.min(0.82, 0.46 + 0.8 * Math.max(0, this.frame.bulk - 1));
      // round 14 (humanoid-anatomy): traps root 0.88 r → 1.04 r — proud of
      // the 1.12 r ribcage so the slope owns the outline. Mirror:
      // bipedRestPose torso.traps.
      sink.seg('torso.traps', 0, this.chestY + r * 0.35 - r * 0.55, 0.02 + hunchZ, 0, this.headY - this.skullR * trapsBury, headZ * 0.6, r * 1.04, this.skullR * trapsR1);
    }
    sink.seg('neck', 0, this.chestY + r * 0.35, 0.02 + hunchZ, 0, this.headY - this.skullR * 0.45, headZ * 0.85, r * 0.52, neckTipR);
    sink.ball('head', 0, this.headY, headZ, this.skullR);
    // round 13 (humanoid-anatomy): same bulk-driven outward push as advance()
    // — arm roots clear the widened bulky torso. Mirror: bipedRestPose.
    // round 22 (humanoid-anatomy): the shoulder JOINT carries the full push,
    // bulky term + slim floor (bipedShoulderOutM). Mirror: bipedRestPose
    // shoulderXBody.
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + bipedShoulderOutM(this.frame);
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
    // round 22 (humanoid-anatomy): the SLIM half of the same contrast term —
    // armBulkT is 0 at bulk 1, so the human collected none of round 20's taper
    // work ("one constant-diameter tube from deltoid to wrist"). Mirror:
    // skeletonBuilder.bipedRestPose arm loop.
    const armBulkT = Math.min(0.6, Math.max(0, this.frame.bulk - 1));
    const shoulderR = armR * (1.48 + 0.5 * armBulkT + 0.42 * slimT);
    const elbowR = armR * (0.68 - 0.12 * armBulkT - 0.06 * slimT);
    const wristR = armR * (0.49 - 0.06 * armBulkT - 0.04 * slimT);
    // round 15 (humanoid-anatomy): FIST SCALE — the round-14 "plain sphere"
    // hands were 0.38–0.44 of skull width; references block fists at
    // ~0.6–0.7. Fist half-width now carries a skull-derived floor (0.6
    // skullR), and the hand splits into a palm block plus a curled finger
    // mass bent toward the knuckle front. Mirror: bipedRestPose arm loop.
    // round 19 (humanoid-anatomy): fist floor 0.6 → 0.45 skullR — Remy: the
    // dwarf hand was "a giant flat slab, near head-size". Mirror:
    // bipedRestPose arm loop.
    // hand-research round 4 (Remy: "the hands are like fat balls") — the
    // skull-floored fist plus REAL curled digits out-massed the round-19
    // budget: the digit curl extends the envelope ~0.5 handR past the palm,
    // so the same handR now draws a bigger fist. Scale down: skull floor
    // 0.45 → 0.40, arm term 1.05 → 1.0, palm 1.35 → 1.28 handR. Mirror:
    // skeletonBuilder.bipedRestPose.
    const handR = Math.max(armR * 1.0, this.skullR * 0.4);
    const palmLen = handR * 1.28;
    const fingerLen = handR * 0.95;
    for (const sgn of [-1, 1] as const) {
      const side = sgn < 0 ? 'L' : 'R';
      const hand = this.wrist[sgn < 0 ? 0 : 1];
      // round 18 (humanoid-anatomy): shoulders roll forward with the hunch
      const waving = this.waves(sgn);
      V_SH.set(sgn * shoulderX, this.chestY + r * 0.45, 0.02 + hunchZ);
      // clavicle update: a waving shoulder RISES — the whole arm root (deltoid
      // ball + upper-arm segment + the derived clavicle bone) lifts with the
      // gesture instead of the hand climbing off a frozen shoulder. Rest pose
      // never waves, so the skeletonBuilder mirror stays exact.
      if (waving) V_SH.y += r * 0.16;
      // round 14 (humanoid-anatomy): elbow tucked mostly BACKWARD — the
      // lateral bend arced the arm into a "banana bow". Mirror:
      // bipedRestPose arm loop.
      V_BEND.set(sgn * 0.45, 0, -1);
      V_BEND.normalize();
      // round 17 (humanoid-anatomy): links 0.4 armLen (see ARM_LINK_K)
      // the joint-angle wave already placed its elbow (see the hand block)
      if (waving) V_KNEE.copy(this.waveElbow[sgn < 0 ? 0 : 1]);
      else solveKnee(V_SH, V_HAND.copy(hand), armLen * ARM_LINK_K, armLen * ARM_LINK_K, V_BEND, V_KNEE);
      // deltoid before the upper segment: the segment's later write drives
      // the upperArm bone; the ball only adds shoulder mass at the joint
      // round 20 (humanoid-anatomy): the deltoid ball grows with the same
      // bulk term as shoulderR — the boulder shoulder the WoW grunt leads
      // with. Mirror: bipedRestPose deltoid ball.
      // round 22 (humanoid-anatomy): + the slim floor. Mirror: bipedRestPose.
      sink.ball('deltoid' + side, V_SH.x, V_SH.y, V_SH.z, armR * (1.7 + 0.5 * armBulkT + 0.5 * slimT));
      sink.seg('arm' + side + '.upper', V_SH.x, V_SH.y, V_SH.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, shoulderR, elbowR);
      sink.seg('arm' + side + '.fore', V_KNEE.x, V_KNEE.y, V_KNEE.z, hand.x, hand.y, hand.z, elbowR, wristR);
      // real-finger update: palm frame + digit emission. A GRIP hand (this
      // side holds a haft weapon — createGaitDriver opts.grips) re-aims the
      // palm INWARD so the canonical transport lands the knuckle row (local
      // sgn·X) near world-up: the digits then wrap around a haft that runs
      // along that row, and the gear anchor adopts the same axis, so the
      // weapon passes exactly through the wrapped fingers. A free hand keeps
      // the round-18 hanging palm and the relaxed curl from the shared
      // layout. Mirror (free path): skeletonBuilder.bipedRestPose arm loop.
      // a GRIP hand that waves keeps its wrap — the raised weapon salute
      // (an open palm with a floating sword read as a dropped weapon)
      const grip = !!this.grips?.[side];
      if (waving && !grip) {
        // wave gesture: palm out toward the viewer, fingers up, and the
        // whole hand rocks side to side with the beat (sgn-mirrored, so a
        // both-hands wave rocks symmetrically)
        V_PALM_DIR.set(sgn * (0.15 + Math.sin(this.t * 5.2) * 0.38), 1, 0.05).normalize();
      } else if (grip) {
        // solved numerically: this palm dir maps the knuckle row (the haft
        // axis) to ≈(0.02, 0.86, 0.52) — a near-vertical blade with a clean
        // forward lean and no inward cross over the chest
        V_PALM_DIR.set(-sgn * 0.85, -0.25, 0.45).normalize();
      } else {
        // fingers axis: forearm direction with a mild forward cock. Round 4
        // (hand research): the round-16/18 camera-aimed cocks (z 0.32,
        // lateral sgn·0.22) existed so the PAINTED thumb faced the camera —
        // real digits made them a twist that pointed the hanging fists
        // inward ("the positioning of the hands don't make any sense").
        // The hang is near-neutral now: knuckles forward, palm at the thigh.
        // Mirror: skeletonBuilder.bipedRestPose arm loop.
        V_PALM_DIR.copy(hand).sub(V_KNEE).normalize();
        V_PALM_DIR.z += 0.24;
        V_PALM_DIR.x += sgn * 0.08;
        V_PALM_DIR.normalize();
      }
      // canonical palm frame — identical to the pose sink's hand-bone rule
      Q_PALM.setFromUnitVectors(UP_Y, V_PALM_DIR);
      const digits = bipedHandDigits(sgn, handR, palmLen, fingerLen);
      if (grip) {
        // wrap circle: centered on the haft line (the fist-center anchor, cy
        // cz below), radius = haft + finger flesh. Each finger stays in its
        // own x-plane — the knuckle row runs ALONG the haft — and both links
        // re-aim onto the circle at their exact rest lengths.
        const cy = palmLen * 0.6;
        const cz = -handR * 0.45;
        const R = handR * 0.56;
        for (const f of digits.fingers) {
          [f.j1.y, f.j1.z] = wrapIntersectYZ(f.root.y, f.root.z, f.len0, cy, cz, R, 'minZ');
          f.j1.x = f.root.x;
          [f.tip.y, f.tip.z] = wrapIntersectYZ(f.j1.y, f.j1.z, f.len1, cy, cz, R, 'minY');
          f.tip.x = f.root.x;
        }
        // the thumb OPPOSES around the haft: tip at ~40° around the wrap
        // circle, elbow bent thumbward (round-2 spec — lengths preserved)
        digits.thumb.j1.set(sgn * 0.759 * handR, 1.024 * handR, -0.624 * handR);
        digits.thumb.tip.set(sgn * 0.3 * handR, 1.239 * handR, -0.81 * handR);
      } else if (waving) {
        // wave gesture: EXTENDED digits with the researched asymmetric fan
        // (pinky −14° … index +8°, ~22° total) and a light per-digit flex —
        // four straight parallel fingers read as a rake, not a hand
        const D = Math.PI / 180;
        for (const f of digits.fingers) {
          const s = f.col.waveSplay * D;
          const fp = f.col.waveFlex * D;
          const fd = (f.col.waveFlex * 1.6) * D;
          V_FINGER_B.set(sgn * Math.sin(s) * Math.cos(fp), Math.cos(s) * Math.cos(fp), -Math.sin(fp)).normalize();
          f.j1.copy(f.root).addScaledVector(V_FINGER_B, f.len0);
          V_FINGER_B.set(sgn * Math.sin(s) * Math.cos(fd), Math.cos(s) * Math.cos(fd), -Math.sin(fd)).normalize();
          f.tip.copy(f.j1).addScaledVector(V_FINGER_B, f.len1);
        }
        // thumb opens ~53° from the finger bundle with an out-of-plane lift
        // (round-2 spec) — a clean triangular thumb-index negative space
        V_FINGER_B.set(sgn * 0.74, 0.56, -0.37).normalize();
        digits.thumb.j1.copy(digits.thumb.a).addScaledVector(V_FINGER_B, digits.thumb.len0);
        V_FINGER_B.set(sgn * 0.42, 0.8, -0.43).normalize();
        digits.thumb.tip.copy(digits.thumb.j1).addScaledVector(V_FINGER_B, digits.thumb.len1);
        // Remy 2026-08-19: "the hand is 'backwards' when waving". With the
        // fingers-up palm dir the canonical transport is near identity, so
        // the KNUCKLE side (local +Z) faced the viewer. The hand bone cannot
        // carry twist (minimal-rotation transport), but the digits ride their
        // own bones — roll the whole digit set 180° about the finger axis
        // (palm-local (x,z) → (−x,−z), a proper rotation, lengths exact) so
        // the palm side with the thumb-index fan faces the viewer.
        for (const f of digits.fingers) {
          for (const p of [f.root, f.j1, f.tip]) { p.x = -p.x; p.z = -p.z; }
        }
        for (const p of [digits.thumb.a, digits.thumb.j1, digits.thumb.tip]) { p.x = -p.x; p.z = -p.z; }
      }
      // emission order: thenar, thumba, thumbb, finger0a..finger3b, palm
      // LAST — the pose sink's last write per bone wins, so the palm drives
      // the hand bone and thumba (after thenar2) drives its own bone
      for (let ti = 0; ti < 3; ti++) {
        V_THUMB_A.copy(digits.thenar[ti].p).applyQuaternion(Q_PALM).add(hand);
        V_THUMB_B.copy(digits.thenar[ti + 1].p).applyQuaternion(Q_PALM).add(hand);
        sink.seg(`hand${side}.thenar${ti}`, V_THUMB_A.x, V_THUMB_A.y, V_THUMB_A.z, V_THUMB_B.x, V_THUMB_B.y, V_THUMB_B.z, digits.thenar[ti].r, digits.thenar[ti + 1].r);
      }
      V_THUMB_A.copy(digits.thumb.a).applyQuaternion(Q_PALM).add(hand);
      V_THUMB_B.copy(digits.thumb.j1).applyQuaternion(Q_PALM).add(hand);
      sink.seg('hand' + side + '.thumba', V_THUMB_A.x, V_THUMB_A.y, V_THUMB_A.z, V_THUMB_B.x, V_THUMB_B.y, V_THUMB_B.z, digits.thumb.r0, digits.thumb.r1);
      V_THUMB_A.copy(digits.thumb.tip).applyQuaternion(Q_PALM).add(hand);
      sink.seg('hand' + side + '.thumbb', V_THUMB_B.x, V_THUMB_B.y, V_THUMB_B.z, V_THUMB_A.x, V_THUMB_A.y, V_THUMB_A.z, digits.thumb.r1, digits.thumb.r2);
      for (const [fi, f] of digits.fingers.entries()) {
        // hands round 2 (part-quality campaign; Remy 2026-08-21: "disconnected
        // sausages"): the digit's DRAWN root extends ~0.35 handR back into the
        // palm block along its own axis, so the knuckle seam hides inside the
        // mass — the root-embed rule every other limb junction already obeys.
        // Pose math (root/j1/tip, grip solve) is untouched; only the emitted
        // tube grows. Mirror: bipedRestPose finger emission.
        V_THUMB_A.copy(f.root).sub(f.j1).normalize().multiplyScalar(handR * 0.35).add(f.root);
        V_PALM_TIP.copy(V_THUMB_A).applyQuaternion(Q_PALM).add(hand);
        V_FINGER_B.copy(f.j1).applyQuaternion(Q_PALM).add(hand);
        sink.seg(`hand${side}.finger${fi}a`, V_PALM_TIP.x, V_PALM_TIP.y, V_PALM_TIP.z, V_FINGER_B.x, V_FINGER_B.y, V_FINGER_B.z, f.r0, f.r1);
        V_PALM_TIP.copy(f.tip).applyQuaternion(Q_PALM).add(hand);
        sink.seg(`hand${side}.finger${fi}b`, V_FINGER_B.x, V_FINGER_B.y, V_FINGER_B.z, V_PALM_TIP.x, V_PALM_TIP.y, V_PALM_TIP.z, f.r1, f.r2);
      }
      V_PALM_TIP.copy(V_PALM_DIR).multiplyScalar(palmLen).add(hand);
      sink.seg(
        'hand' + side + '.palm',
        hand.x, hand.y, hand.z,
        V_PALM_TIP.x, V_PALM_TIP.y, V_PALM_TIP.z,
        handR * 0.88, handR,
      );
      // round 6 (humanoid-anatomy): grip anchor — held gear parents to the
      // hand anchor, so aim it at the FIST CENTER (the wrap-circle center).
      const anchor = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'];
      anchor.pos
        .set(0, palmLen * 0.6, -handR * 0.45)
        .applyQuaternion(Q_PALM)
        .add(hand);
      if (grip) {
        // the weapon's +Y (blade axis) runs along the mapped knuckle row and
        // its +Z faces the knuckle front — the haft threads the digit wrap
        V_THUMB_A.set(sgn, 0, 0).applyQuaternion(Q_PALM); // blade axis
        V_THUMB_B.set(0, 0, -1).applyQuaternion(Q_PALM); // edge facing
        V_FINGER_B.copy(V_THUMB_A).cross(V_THUMB_B); // weapon +X = Y×Z
        M_GRIP.makeBasis(V_FINGER_B, V_THUMB_A, V_THUMB_B);
        anchor.quat.setFromRotationMatrix(M_GRIP);
      }
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
    // round 21 (humanoid-anatomy): knee pinches again (0.46 legR / 0.35
    // thighR) — round 20: "thigh and shin are close to the same width".
    // Mirror: bipedRestPose leg radii.
    const kneeR = Math.max(legR * 0.46, thighR * 0.35);
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
    // round 21 (humanoid-anatomy): THE BOOT — width past the ankle, a splayed
    // toe so the foot's length profiles to the front camera, and a shin that
    // stops at the ankle instead of running to the floor. Full diagnosis in
    // smoothBipedGeometry.footStations. Mirror: bipedRestPose leg loop.
    // round 22 (humanoid-anatomy): slim frames get their own boot floor and a
    // bigger toe splay — the round-21 boot landed on the dwarf and left the
    // human "small rounded nubs". Mirror: bipedRestPose leg loop.
    const footHalfW = Math.max(ankleR * (1.78 + 0.5 * slimT), legR * (0.8 + 0.14 * slimT));
    const heelBack = legR * 0.9;
    const toeFwd = legR * 2.1;
    const heelH = legR * 0.62;
    const toeH = legR * 0.34;
    // round 23 (humanoid-anatomy): harder toe splay — the only front-camera
    // channel for a left/right foot difference. Mirror: bipedRestPose.
    const toeOutX = legR * (0.85 + 0.1 * slimT);
    for (const [i, leg] of this.legs.entries()) {
      const side = i === 0 ? 'L' : 'R';
      const sgn = i === 0 ? -1 : 1;
      V_HIP.set(leg.pos.x, this.pelvisY - r * 0.3, 0);
      // round 14 (humanoid-anatomy): outward knee lean 0.1 → 0.02 — orc
      // knees bowed out, dwarf shins with them. Mirror: bipedRestPose.
      V_BEND.set(sgn * 0.02, 0, 1).normalize();
      solveKnee(V_HIP, V_HAND.copy(leg.pos), this.legLenM * 0.52, this.legLenM * 0.52, V_BEND, V_KNEE);
      sink.seg('leg' + side + '.thigh', V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, thighR, kneeR);
      sink.seg('leg' + side + '.shin', V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y + legR * 0.34, leg.pos.z, kneeR, ankleR);
      sink.seg(
        'foot' + side,
        leg.pos.x, leg.pos.y + heelH, leg.pos.z - heelBack,
        leg.pos.x + sgn * toeOutX, leg.pos.y + toeH, leg.pos.z + toeFwd,
        footHalfW, footHalfW * 0.72,
      );
    }
  }
}

