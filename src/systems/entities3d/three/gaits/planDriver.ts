/**
 * @file gaits/planDriver.ts — PlanDriver, the compiled-PlanSpec driver.
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09) as ONE class, deliberately. The
 * recon packet proposed cutting it three ways (core / bodyBuilder / advance);
 * a full read says that cut is not available today. advance(), buildBody(),
 * chainPoints() and refreshSockets() all read and write the same private
 * instance state (spec, spinePts, sockets, autoNecks, legTreads, moundBody,
 * verticalBody, rocky, crested, legReachM) and call each other's private
 * helpers (attachZ, spineAt, chainPoints). Splitting the methods across files
 * would mean widening that state to public or introducing mixins — a behavior
 * and API change, not a file move. See the task result for what a later safe
 * split would need.
 *
 * Everything below is verbatim from gaits.ts; only the class declaration gained
 * an `export`.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Vector3 } from 'three';
import type { Frame, PlanSpec, SegmentSink } from '../../types';
import { solveKnee } from '../ik';
import { solveFabrikPoints } from '../fabrik';
import { TreadmillLeg } from '../legs';
import { spineRadiusAt } from '../../textPlan/spineProfile';
import { BaseDriver } from './baseDriver';
import type { PlanHeadSocket } from './poseUtils';
import { bezier2, legJointLimits, V_BEND, V_HAND, V_KNEE } from './poseUtils';

/**
 * PlanDriver arm joint stations (2026-08-15). Fractions of the SMALLER of the
 * two link gauges that meet at the joint, so a joint can never end up wider
 * than the limb it interrupts.
 *
 * The elbow pinch is moderate — an elbow is a narrowing, not a hinge pin. The
 * wrist pinch is hard, and the tip taper harder still, because the palm mass
 * that follows is 1.5x the last link gauge: the wrist has to be the narrowest
 * point on the arm for the hand to read as a hand and not as the end of a
 * sausage.
 */
const ARM_ELBOW_PINCH = 0.62;
const ARM_WRIST_PINCH = 0.46;
const ARM_WRIST_TIP = 0.42;

/** round 25 (creature-anatomy): fore/hind mass-event stations (PlanDriver
 * quadruped withers, brisket, haunches). Two scratch vectors, never one — the
 * shoulder and hip points are live at the same time. */
const MASS_FORE = new Vector3();
const MASS_REAR = new Vector3();
const MASS_MID = new Vector3();

/* ------------------------------------------------------------------- plan */

/**
 * Drives a compiled text-to-creature PlanSpec: a spine in one of four stances
 * plus free appendage chains animated by kind — legs stride on the treadmill
 * math, arms counter-swing, tails wag, tentacles wave, wings flap, necks bob
 * with a head at each end. Everything is emitted as connected tapered
 * segments with stable ids (`spine.N`, `<chainId>.N`).
 */
export class PlanDriver extends BaseDriver {
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
      // 2026-08-15 (Remy, live eyeball): "all bipedal creatures seem to have
      // this weird 'lean forward'". attachZ maps a chain's attach fraction
      // onto the body's LENGTH axis, which is +z for a HORIZONTAL body. An
      // upright body's length axis is Y — the spine loop below maps u to
      // height and leaves z to the arch alone — but the leg treads still
      // planted their rest position at attachZ(attach). A leg attached at the
      // hips (attach 0.9 on the gnoll) therefore planted its foot
      // (0.5 - 0.9) * bodyLenM = 0.4 body-lengths BEHIND the column, and the
      // torso stood over its own heels: the whole creature read as about to
      // fall forward. On plan 19f48ed2 that was a 0.19 m forward drift from
      // hip to crown over 1.46 m of height.
      //
      // An upright plan now plants under its own column. The forward shape of
      // the body stays with `spine.arch`, which bows the spine (sin(u*pi),
      // zero at BOTH ends) instead of tipping the body — a curved back, not a
      // tilted one.
      const restZ = this.verticalBody ? 0 : this.attachZ(chain.attach);
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

  /** Live spine point at a continuous station u (0 front → 1 rear), lerped
   * between the two nearest joints. round 25 (creature-anatomy): the quad
   * mass events sit at fractional stations that no segment count lands on. */
  private spineAt(u: number, out: Vector3): Vector3 {
    const n = this.spec.spine.segments;
    const x = Math.min(n, Math.max(0, u * n));
    const i = Math.min(n - 1, Math.floor(x));
    return out.copy(this.spinePts[i]).lerp(this.spinePts[i + 1], x - i);
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
        // round 25 (creature-anatomy): TALLER, and a real S. The round-24
        // verdict: "the body lies flat on the grass as a bent noodle with no
        // S-curve lift ... the Valheim serpent rears in a tall S". The rise
        // was 0.26 bodyLen over the front 38% — one monotone arc, which is a
        // J, not an S — and on a 26 ft body that is barely two body radii of
        // height. Half the spine now leaves the ground, the rise is 0.42
        // bodyLen, and the z bow below turns the climb into a genuine
        // back-then-forward S in the side profile.
        const REAR_U = 0.5; // spine fraction that leaves the ground
        const v = serp && u < REAR_U ? (REAR_U - u) / REAR_U : 0; // 1 at head
        const riseM = serp ? s.bodyLenM * 0.42 * (1 - 0.45 * this.speedFactor) : 0;
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
          // round 25 (creature-anatomy): the back-bow deepens 0.08 → 0.34 of
          // the rise. At 0.08 the column climbed dead straight and the whole
          // profile read as one bent noodle; the bow is what makes the side
          // view an S — the mid-rise leans BACK over the coil, then the neck
          // carries the skull forward again at the top.
          z = zBase + (this.attachZ(u) - zBase) * (1 - v * 0.55) +
            riseM * (v * 0.38 - Math.sin(v * Math.PI) * 0.34);
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
      // round 27 (creature-anatomy): FLOATERS CROWN their tentacles. The
      // generated Beholder's ten eyestalks took the ooze droop + sag + ground
      // clamp and rendered as spider legs planted on the grass — a floating
      // tyrant read as a grounded tick. On a floating stance the stalks now
      // leave UP-AND-OUT and arc outward per link (below); grounded bodies
      // keep the pseudopod droop untouched.
      const stalky = this.spec.stance === 'floating';
      dir.set(chain.side === 0 ? 0.4 : chain.side, stalky ? 0.5 : -0.55, 0.35);
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
      // round 26 (creature-anatomy): UPRIGHT WALKERS HANG THEIR ARMS. The
      // (±1, −0.55, 0.5) seed is a radiate pose — right for a ghost's drape
      // or a twelve-arm starburst, but on an upright biped plan (the gnoll)
      // one lanky arm per side left the shoulder SIDEWAYS: the T-pose
      // starfish read. A single upright arm now leaves mostly DOWN with a
      // slight outward and forward lean; multi-arm frames and floaters keep
      // the radiate seed.
      const droop = this.spec.stance === 'floating' ? -0.22 : -0.55;
      const armSibs = this.spec.chains.filter((c) => c.kind === 'arm' && c.side === chain.side);
      if (this.spec.stance === 'upright' && armSibs.length <= 1 && chain.side !== 0) {
        dir.set(chain.side * 0.38, -1, 0.18);
      } else {
        dir.set(chain.side === 0 ? 0.5 : chain.side, droop, 0.5);
      }
      // siblings fan around the body — twelve radial arms are a starburst,
      // not two bundled brooms (same treatment tentacles get)
      if (armSibs.length > 1) {
        const which = armSibs.findIndex((c) => c.id === chain.id);
        dir.applyAxisAngle(V_UP, (which / (armSibs.length - 1) - 0.5) * 2.4 * (chain.side || 1));
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
        if (this.spec.stance === 'floating') {
          // round 27 (creature-anatomy): the eyestalk crown — a slow sway
          // instead of the ground-drag ripple, and each link bends OUTWARD
          // toward the tip so the crown opens like a fan around the orb.
          const sway = Math.sin(this.t * 1.7 + j * 0.9 + chain.attach * 6);
          step.addScaledVector(perp, sway * 0.1);
          step.y += 0.22 - j * 0.42;
        } else {
          // round 8 (creature-anatomy): the wave rides the GROUND — lateral
          // ripple stays (perp), but the vertical component shrank (0.22 →
          // 0.08) and every link now sags hard (-0.28 - j*0.2, was -j*0.08).
          // With the ground clamp below, no tentacle holds a straight line in
          // the air at idle: they droop, touch down, and drag.
          const wave = Math.sin(this.t * 3.1 + j * 1.15 + chain.attach * 6);
          step.addScaledVector(perp, wave * 0.35).addScaledVector(V_UP, wave * 0.08 - 0.28 - j * 0.2);
        }
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
        // round 24 (creature-anatomy): THE ANCHOR FEATURE. The round-23 verdict
        // read the ooze as having "no anchor feature ... a formless pile", and
        // the round-24 sheets show why: the mound compresses its spine z by
        // 0.55, so a socket at 0.85 bodyRad sat OUTSIDE the membrane, down at
        // skirt height where the drip lobes hid it. Only the top panel ever saw
        // the eyes. The face zone now rides the dome's upper-front quadrant —
        // on the gel, above the skirt, angled up-and-forward so every ground
        // camera catches it.
        this.sockets.push({
          x: core.x,
          y: core.y + (this.moundBody ? s.bodyRadM * 0.55 : baseR * 0.15),
          z: core.z + s.bodyRadM * (this.moundBody ? 0.5 : 0.85),
          r: baseR,
          fx: 0, fy: this.moundBody ? 0.35 : 0, fz: 1,
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
      // round 24: the glints ride the dome's upper-front-left, just off the
      // face zone. At the round-23 positions the opaque gel core (0.85 of the
      // dome) sat in front of them from every ground camera and the round-23
      // verdict read "no anchor feature ... no core highlight".
      sink.ball('interior.gloss0', core.x - R * 0.46, core.y + R * 0.74, core.z + R * 0.36, R * 0.22);
      sink.ball('interior.gloss1', core.x - R * 0.26, core.y + R * 0.86, core.z + R * 0.14, R * 0.095);
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
      // round 24 (creature-anatomy): FEWER, HEAVIER SPIKES. The round-23
      // verdict wanted Valheim's serpent dorsal spikes against our "token red
      // dorsal ridge"; 12 shallow teeth on a 44-station loft read as a saw
      // edge, not spines. Nine teeth with a far deeper valley (see `serr`)
      // give each spike its own silhouette peak.
      const TEETH = 9;
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
        // round 24: valley 0.55 → 0.26 and peak envelope 1.05 → 1.55 — the
        // spikes must rise clear of the back line and drop nearly to the hide
        // between, so the outline shows teeth rather than a corrugated ridge.
        const serr = 0.26 + 0.74 * Math.pow(Math.abs(Math.sin(uu * Math.PI * TEETH)), 0.8);
        const h = rHere * (0.5 + 1.55 * env) * serr;
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
          // 2026-08-15 (Remy, live eyeball on a generated gnoll, annotated on
          // the arm): the plan arm chain showed its elbow and wrist as faint
          // seams and nothing else. A joint that only exists in the topology
          // does not exist for a viewer — the toon ramp quantizes a smooth
          // radius step into one band, and a flush stack of same-gauge forms
          // has no silhouette event at all (the campaign's binding render
          // lesson). The biped arm has carried a shoulder→elbow→wrist station
          // ladder since round 20; the plan path never got one.
          //
          // Plan arms now PINCH at every interior joint, so each link bulges
          // past a valley the ink outline scallops, and the wrist pinches
          // harder than the elbow so the palm below reads as a separate mass
          // on the end of a narrow wrist. Same shape as the leg's kneeR rule
          // directly above, tuned for an arm.
          //
          // Silhouette carries the joint on its own here; the value channel is
          // the inverse-hull ink, which now has a real notch to sink into
          // (that is precisely the condition the campaign's knee-crease and
          // finger-valley note says a value step needs). Dedicated `dark.`
          // valley balls were built and then cut: at 192 triangles each they
          // put the centaur fixture over PLAN_TRIANGLE_BUDGET, and the
          // silhouette event is the half that survives any ramp.
          const tipF =
            chain.kind === 'tail' || chain.kind === 'tentacle' ? 0.12
            : chain.kind === 'arm' ? ARM_WRIST_TIP
            : 0.6;
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
          if (chain.kind === 'arm' && chain.links.length >= 2) {
            // gauge AT the joint between link jj and link jj+1. On a 3+ link
            // arm the LAST interior joint is the wrist (the palm hangs off the
            // tip) and everything before it is an elbow; a 2-link arm's only
            // interior joint is the elbow and its wrist is the tip taper.
            const jointR = (jj: number): number =>
              Math.max(
                0.006,
                Math.min(chain.links[jj].rM, chain.links[jj + 1].rM) *
                  (chain.links.length >= 3 && jj === chain.links.length - 2
                    ? ARM_WRIST_PINCH
                    : ARM_ELBOW_PINCH),
              );
            if (j > 0) r0 = jointR(j - 1);
            if (!isTip) r1 = jointR(j);
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
      // hand / paw at the chain tip
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
        // A paw keyed ONLY to the forearm gauge is a stick paw on a stick arm.
        // The gnoll's forearm is thinner than the inverse-hull ink line
        // (hM * 0.011), so its hand rendered as a bulb of outline with nothing
        // inside — no palm to see, never mind digits. A flesh paw now also has
        // a floor keyed to the creature's own height, the way the biped hand
        // floors on skull radius (`handR = max(armR * 1.05, skullR * 0.45)`),
        // capped against the body radius so a twelve-armed radial floater does
        // not sprout twelve dinner plates. Rocky claw masses keep their own
        // rule — the design language wants them oversized on purpose.
        const palmR = this.rocky
          ? Math.max(0.02, lastR * 2.05)
          : Math.max(0.02, lastR * 1.5, Math.min(this.hM * 0.032, s.bodyRadM * 0.55));
        if (this.rocky) {
          sink.ball(`${chain.id}.palm`, tip.x, tip.y, tip.z, palmR);
          // round 24 (creature-anatomy), second pass: the first rocky hand grew
          // three PENCIL SPIKES off a ball — the opposite of the reference's
          // "oversized claw masses, the biggest limbs on the body". Rock claws
          // are SHORT and FAT: barely longer than the palm, near palm gauge at
          // the root, blunt-tapered rather than needled.
          const fingerLen = palmR * 0.95;
          const fingerR = Math.max(0.006, lastR * 0.95);
          for (let f = 0; f < 3; f++) {
            V_BEND.copy(V_HAND).applyAxisAngle(V_UP, (f - 1) * 0.42);
            V_BEND.y -= 0.85; // claws dig toward the ground
            V_BEND.normalize();
            sink.seg(
              `${chain.id}.finger${f}`,
              tip.x + V_HAND.x * palmR * 0.6,
              tip.y + V_HAND.y * palmR * 0.6,
              tip.z + V_HAND.z * palmR * 0.6,
              tip.x + V_BEND.x * (palmR * 0.6 + fingerLen),
              tip.y + V_BEND.y * (palmR * 0.6 + fingerLen),
              tip.z + V_BEND.z * (palmR * 0.6 + fingerLen),
              fingerR,
              Math.max(0.008, fingerR * 0.42),
            );
            // one plate boulder per claw: the fist is a CLUSTER of rocks
            sink.ball(
              `plate.${chain.id}.knuck${f}`,
              tip.x + V_BEND.x * (palmR * 0.6 + fingerLen * 0.35),
              tip.y + V_BEND.y * (palmR * 0.6 + fingerLen * 0.35),
              tip.z + V_BEND.z * (palmR * 0.6 + fingerLen * 0.35),
              fingerR * 1.15,
            );
          }
          // knuckle boulder capping the claw mass — the fist reads as one
          // rock chunk, not a ball with sticks
          sink.ball(`plate.${chain.id}.knuckle`, tip.x + V_HAND.x * palmR * 0.5, tip.y + palmR * 0.45, tip.z + V_HAND.z * palmR * 0.5, palmR * 0.85);
        } else {
          // 2026-08-15 (Remy, live eyeball on a generated gnoll): the flesh paw
          // was "oddly proportioned and a strange 'ball' for a palm" — one
          // sphere with three pencils poked into it. A sphere has no front, no
          // back and no knuckle line, so the hand read as a knob from every
          // camera, and the pencil digits were thinner than the ink outline
          // that drew them.
          //
          // The paw now follows the recipe that won the biped grip hand
          // (smoothBipedGeometry, round 21): a palm BLOCK that widens from the
          // wrist to a real knuckle plane, digits whose root spheres BULGE PAST
          // the palm gauge so the outline scallops between them, and near-black
          // VALLEY balls sunk into the gaps the silhouette already cut. Three
          // digits plus an opposed thumb — a paw, not a mitten.

          // hand frame: forward along the arm, a lateral axis across the palm,
          // and the palm normal. Near the degenerate case (an arm hanging dead
          // vertical, V_HAND parallel to up) the lateral axis comes off +Z
          // instead, which is well conditioned there.
          V_PAW_SIDE.copy(Math.abs(V_HAND.y) > 0.9 ? V_FWD_Z : V_UP).cross(V_HAND).normalize();
          V_PAW_UP.copy(V_HAND).cross(V_PAW_SIDE).normalize();

          const palmLen = palmR * 1.15;
          // knuckle line: where the digits root and the palm is widest
          V_PAW_KNUCKLE.copy(V_HAND).multiplyScalar(palmLen).add(tip);
          // THE BLOCK, and it keeps the `<chain>.palm` id: this is still the
          // skeleton's terminal hand bone, now a seg rather than a ball, and
          // planSkeleton.pushTerminal binds it from the rest segment so the
          // bone carries the palm's orientation instead of an identity
          // quaternion. Emitting a buried boss ball alongside it just to
          // satisfy the old ball-shaped contract cost 384 triangles a hand and
          // rendered nothing.
          //
          // Narrow at the wrist (which the arm chain now pinches to match),
          // widening into the knuckle plane — a wedge, never a ball.
          sink.seg(
            `${chain.id}.palm`,
            tip.x, tip.y, tip.z,
            V_PAW_KNUCKLE.x, V_PAW_KNUCKLE.y, V_PAW_KNUCKLE.z,
            palmR * 0.66, palmR * 0.98,
          );
          const digitLen = palmR * 1.5;
          const digitR = Math.max(0.006, palmR * 0.44);
          // THREE digits, as before — but two forward fingers and an opposed
          // thumb rather than a symmetric three-prong fork. The digit count is
          // held at three on purpose: a fourth costs 400 triangles per hand and
          // puts the centaur fixture over PLAN_TRIANGLE_BUDGET.
          //
          // Each finger roots OUTBOARD of the palm's own gauge, so its root
          // sphere (segmentBody caps every segment end at r * 0.98) stands
          // proud of the block as a knuckle instead of sinking into it — the
          // "bulge past the valley radius" rule that gave the biped grip hand
          // its scallops. They also SPLAY hard, which is what keeps the gap
          // between them wider than the ink hull all the way down: parallel
          // digits at this scale get inked shut into one mitten.
          for (let f = 0; f < 2; f++) {
            const across = (f - 0.5) * palmR * 0.86;
            V_PAW_A.copy(V_PAW_SIDE).multiplyScalar(across).add(V_PAW_KNUCKLE);
            // digits also curl DOWN off the knuckle plane: a straight-ahead
            // digit profiles to nothing in the front panel (the campaign's
            // "cock small forms so the bend profiles to at least one camera").
            V_BEND.copy(V_HAND)
              .addScaledVector(V_PAW_SIDE, (f - 0.5) * 0.9)
              .addScaledVector(V_PAW_UP, -0.45)
              .normalize();
            V_PAW_B.copy(V_BEND).multiplyScalar(digitLen).add(V_PAW_A);
            sink.seg(
              `${chain.id}.finger${f}`,
              V_PAW_A.x, V_PAW_A.y, V_PAW_A.z,
              V_PAW_B.x, V_PAW_B.y, V_PAW_B.z,
              digitR, digitR * 0.55,
            );
          }
          // the dark VALLEY between the two fingers — the value half of the
          // grip-hand recipe, sunk into the notch the splay already cut and
          // sized well under the digit gauge so it darkens the gap without
          // filling the scallop the outline draws there. `dark.` carries a
          // darkened body tone and no ink shell of its own.
          V_PAW_B.copy(V_PAW_KNUCKLE).addScaledVector(V_HAND, palmR * 0.18);
          sink.ball(
            `dark.${chain.id}.valley`,
            V_PAW_B.x, V_PAW_B.y, V_PAW_B.z,
            Math.max(0.005, digitR * 0.6),
          );
          // the thumb: opposed, rooted back along the palm on the inboard side
          // and swinging across the front of the block. It is what stops the
          // paw reading as a symmetric three-prong fork from every angle.
          const thumbSide = chain.side === 0 ? 1 : -chain.side;
          V_PAW_A.copy(V_PAW_SIDE)
            .multiplyScalar(thumbSide * palmR * 0.62)
            .addScaledVector(V_HAND, palmLen * 0.34)
            .add(tip);
          V_BEND.copy(V_HAND)
            .addScaledVector(V_PAW_SIDE, thumbSide * 0.85)
            .addScaledVector(V_PAW_UP, -0.3)
            .normalize();
          V_PAW_B.copy(V_BEND).multiplyScalar(digitLen * 0.78).add(V_PAW_A);
          sink.seg(
            `${chain.id}.thumb`,
            V_PAW_A.x, V_PAW_A.y, V_PAW_A.z,
            V_PAW_B.x, V_PAW_B.y, V_PAW_B.z,
            digitR * 1.05, digitR * 0.62,
          );
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
    // round 25 (creature-anatomy): QUADRUPED MASS EVENTS. The round-24 verdict
    // on the Beast Large archetype: "a uniform-diameter grey tube runs from
    // shoulder to hip with no ribcage, no shoulder hump and no haunch swell",
    // against a Valheim boar and a WoW worg that both "put a large mass event
    // at the shoulder, taper the waist, differentiate fore from hind".
    //
    // A three-lobe spine profile alone can never fix this: the swept tube is a
    // surface of revolution, so a radius change moves the WHOLE ring and reads
    // as a gentle bulge in every direction at once — no landmark. A real
    // quadruped's mass is anisotropic: the withers rise ABOVE the spine line,
    // the haunches swell OUTBOARD and rearward, the brisket hangs BELOW the
    // chest. Each is emitted here as its own form, so the silhouette carries
    // three named events from every camera. Body tone and body ink, so they
    // merge into one animal instead of reading as bolted-on balls; only the
    // part that protrudes past the tube shows an outline at all.
    if (!this.verticalBody && !this.moundBody && this.legTreads.size >= 4) {
      const shoulderU = 0.16;
      const hipU = 0.82;
      const shoulder = this.spineAt(shoulderU, MASS_FORE);
      const hip = this.spineAt(hipU, MASS_REAR);
      const rS = spineRadiusAt(s, shoulderU);
      const rH = spineRadiusAt(s, hipU);
      // round-25 eyeball fix: SEGMENTS, NOT BALLS. The first pass emitted one
      // sphere per landmark and the capture read them as joint balls bolted
      // onto a tube — a sphere is isotropic, so it can only ever say "lump
      // here", never "mass running this way". Every landmark is now a TAPERED
      // SEGMENT running along the direction the muscle actually runs, thick at
      // its root and thinning into the body, so each one merges at one end and
      // breaks the silhouette at the other.
      const backMid = this.spineAt(0.42, MASS_MID);
      // WITHERS: a crest running from over the shoulder blades back along the
      // spine, dying out at mid-back — the tallest point of a boar's or a
      // worg's topline, and what makes the back SLOPE instead of run flat
      sink.seg(
        'mass.withers',
        shoulder.x, shoulder.y + rS * 0.52, shoulder.z - rS * 0.1,
        backMid.x, backMid.y + rS * 0.16, backMid.z,
        rS * 0.82, rS * 0.16,
      );
      // BRISKET: the chest keel hanging below and ahead of the shoulder, the
      // forequarter depth that cuts the tube's flat belly line
      sink.seg(
        'mass.brisket',
        shoulder.x, shoulder.y - rS * 0.34, shoulder.z + rS * 0.62,
        shoulder.x, shoulder.y - rS * 0.5, shoulder.z - rS * 0.5,
        rS * 0.62, rS * 0.3,
      );
      for (const [tag, sg] of [['L', -1], ['R', 1]] as const) {
        // HAUNCH: a teardrop from the top of the hip, swelling outboard and
        // rearward and tapering down into the thigh — the widest point of the
        // rear silhouette from above and a rump curve from the side
        sink.seg(
          `mass.haunch${tag}`,
          hip.x + sg * rH * 0.2, hip.y + rH * 0.36, hip.z - rH * 0.2,
          hip.x + sg * rH * 0.62, hip.y - rH * 0.62, hip.z - rH * 0.5,
          rH * 0.92, rH * 0.4,
        );
        // SHOULDER: the fore mass, deliberately SMALLER and shorter than the
        // haunch — the fore/hind differentiation the verdict asked for reads
        // as a size relationship between two forms, not as two limb radii
        sink.seg(
          `mass.shoulder${tag}`,
          shoulder.x + sg * rS * 0.18, shoulder.y + rS * 0.18, shoulder.z + rS * 0.2,
          shoulder.x + sg * rS * 0.6, shoulder.y - rS * 0.6, shoulder.z + rS * 0.05,
          rS * 0.6, rS * 0.3,
        );
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
            const mx = (p.x + pn.x) / 2;
            const my = (p.y + pn.y) / 2;
            const mz = (p.z + pn.z) / 2;
            // round 25 (creature-anatomy): DEEPER RECESS. The round-24 seam
            // ball sat at 0.86 rHere with r 0.4 — mostly buried, so the joint
            // read as a hairline between cobbles rather than the "deep dark
            // recessed joints" the earth-golem references cut. It now sits
            // further in (0.72) and runs wider, so the gap between two plates
            // is a real dark trench with the plates' lit faces on both sides.
            sink.ball(
              `dark.seam${i}_${a}`,
              mx + Math.cos(th) * rSeam * 0.72,
              my,
              mz + Math.sin(th) * rSeam * 0.72,
              rSeam * 0.56,
            );
            // round 25: CRACK GLOW IN THE JOINTS. The round-24 verdict —
            // "there is no crack glow anywhere in the body, leaving the whole
            // mass one flat mid-grey". Round 24 lit exactly two chest seams;
            // every other joint was unlit. A thin unlit ember line now runs
            // the length of every second seam, so the glow reads as the light
            // BETWEEN the stones (the reference's molten-core language) from
            // any camera, not as two decals on the front.
            if ((i + a) % 2 === 0) {
              // round-25 eyeball fix: 0.95 → 1.34 rSeam. The plates crown at
              // ~1.58 rHere (centre 0.92 + radius 0.66), so an ember line at
              // 0.95 sat BEHIND them and the first capture still showed no
              // glow between the stones. The line now runs in the open gap.
              const nx = Math.cos(th) * rSeam * 1.34;
              const nz = Math.sin(th) * rSeam * 1.34;
              sink.seg(
                `glow.seam${i}_${a}`,
                p.x + nx, p.y, p.z + nz,
                pn.x + nx * 0.86, pn.y, pn.z + nz * 0.86,
                rSeam * 0.075,
                rSeam * 0.03,
              );
            }
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
/** Paw scratch (PlanDriver hand tips): the palm frame's lateral and normal
 * axes, the knuckle-line point, and two endpoint scratches. All live at the
 * same time inside one hand, so they cannot share a vector. */
const V_PAW_SIDE = new Vector3();
const V_PAW_UP = new Vector3();
const V_PAW_KNUCKLE = new Vector3();
const V_PAW_A = new Vector3();
const V_PAW_B = new Vector3();
/** round 24 (creature-anatomy): per-link orthonormal frame for rocky boulder
 * plates — direction plus the two perpendiculars they ring around. */
const V_LIMB_D = new Vector3();
const V_LIMB_U = new Vector3();
const V_LIMB_V = new Vector3();

