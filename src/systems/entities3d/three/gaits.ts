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
import type { Anchor, Frame, Gait, SegmentSink } from '../types';
import { ANCHORS, FT_TO_M, headRadiusM, heightM } from '../types';
import { smooth, solveKnee } from './ik';
import { TreadmillLeg } from './legs';

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
  /** Wing flap angle in radians; 0 for non-flyers. */
  readonly flap: number;
  /** Extra body lift (hopper airtime, flyer altitude), applied by the assembler. */
  readonly verticalOffsetM: number;
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

abstract class BaseDriver implements GaitDriver {
  readonly pose = makePose();
  gaitPhase = 0;
  flap = 0;
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

  /** Standard head-cluster anchors around a head center. */
  protected setHeadAnchors(hx: number, hy: number, hz: number): void {
    const r = this.hr;
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

  constructor(frame: Frame) {
    super(frame);
    const stance = (frame.stanceWidthFt * FT_TO_M) / 2;
    this.legs = [
      new TreadmillLeg(-stance, 0.01, 0, { liftH: this.hM * 0.06 }),
      new TreadmillLeg(stance, 0.01, 0.5, { liftH: this.hM * 0.06 }),
    ];
  }

  protected advance(): void {
    const stride = this.strideHalf();
    for (const leg of this.legs) leg.update(this.gaitPhase, stride);
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.014 * (0.4 + this.speedFactor);
    this.sway = Math.sin(this.gaitPhase * Math.PI * 2) * this.hM * 0.011;
    this.pelvisY = this.legLenM * 1.0 + this.bob;
    this.chestY = this.pelvisY + (this.hM - this.legLenM) * 0.45;
    // keep the head clear of the chest blob so stocky frames still read as
    // head-on-shoulders instead of one pear-shaped mass
    this.headY = this.hM - this.hr * 0.7 + this.bob;
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + this.baseR * 0.35;
    // arms: counter-swing to the legs; hang forward-and-easy when idle
    for (const sgn of [-1, 1] as const) {
      const phaseOff = sgn < 0 ? 0.5 : 0;
      const swing = Math.sin((this.gaitPhase + phaseOff) * Math.PI * 2) * 0.55 * this.speedFactor;
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'];
      hand.pos.set(
        sgn * (shoulderX + this.baseR * 0.05),
        this.pelvisY + this.hM * 0.015,
        Math.sin(swing) * this.frame.armLengthFt * FT_TO_M * 0.42 + this.hM * 0.045,
      );
      // tilt held gear slightly forward and away from the body so it reads
      hand.quat.setFromEuler(EULER.set(swing * 0.5 + 0.22, 0, sgn * -0.3));
    }
    this.setAnchor('hips', this.sway, this.pelvisY, 0);
    this.setAnchor('hipL', -Math.abs(this.legs[0].pos.x) * 0.8, this.pelvisY - this.baseR * 0.3, 0);
    this.setAnchor('hipR', Math.abs(this.legs[1].pos.x) * 0.8, this.pelvisY - this.baseR * 0.3, 0);
    this.setAnchor('chest', this.sway * 0.6, this.chestY, this.baseR * 0.15);
    this.setAnchor('back', this.sway * 0.6, this.chestY + this.baseR * 0.15, -this.baseR * 0.85);
    this.setAnchor('tailRoot', this.sway, this.pelvisY - this.baseR * 0.2, -this.baseR * 0.8);
    this.setHeadAnchors(0, this.headY, this.hr * 0.25);
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR;
    const midY = this.pelvisY + (this.chestY - this.pelvisY) * 0.5;
    // torso: pelvis -> waist -> chest, then a neck up to the head
    sink.seg('torso.pelvis', this.sway, this.pelvisY - r * 0.35, 0, this.sway * 0.6, midY, 0.01, r * 0.92, r * 0.8);
    sink.seg('torso.chest', this.sway * 0.6, midY, 0.01, 0, this.chestY + r * 0.35, 0.02, r * 0.8, r * 0.95);
    const headZ = this.hr * 0.25;
    sink.seg('neck', 0, this.chestY + r * 0.3, 0.02, 0, this.headY - this.hr * 0.55, headZ * 0.7, r * 0.34, r * 0.3);
    sink.ball('head', 0, this.headY, headZ, this.hr);
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2;
    const armLen = this.frame.armLengthFt * FT_TO_M;
    const armR = Math.max(r * 0.3, armLen * 0.085);
    for (const sgn of [-1, 1] as const) {
      const side = sgn < 0 ? 'L' : 'R';
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos;
      V_SH.set(sgn * shoulderX, this.chestY + r * 0.45, 0.02);
      V_BEND.set(sgn, 0, -0.4).normalize();
      solveKnee(V_SH, V_HAND.copy(hand), armLen * 0.52, armLen * 0.52, V_BEND, V_KNEE);
      sink.seg('arm' + side + '.upper', V_SH.x, V_SH.y, V_SH.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, armR, armR * 0.85);
      sink.seg('arm' + side + '.fore', V_KNEE.x, V_KNEE.y, V_KNEE.z, hand.x, hand.y, hand.z, armR * 0.85, armR * 0.7);
      sink.ball('hand' + side, hand.x, hand.y, hand.z, armR * 1.15);
    }
    const legR = Math.max(r * 0.36, this.legLenM * 0.105);
    for (const [i, leg] of this.legs.entries()) {
      const side = i === 0 ? 'L' : 'R';
      V_HIP.set(leg.pos.x * 0.8, this.pelvisY - r * 0.2, 0);
      V_BEND.set(0, 0, 1);
      solveKnee(V_HIP, V_HAND.copy(leg.pos), this.legLenM * 0.52, this.legLenM * 0.52, V_BEND, V_KNEE);
      sink.seg('leg' + side + '.thigh', V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, legR, legR * 0.85);
      sink.seg('leg' + side + '.shin', V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, legR * 0.85, legR * 0.6);
      sink.ball('foot' + side, leg.pos.x, leg.pos.y + legR * 0.35, leg.pos.z + legR * 0.55, legR * 0.85);
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

/* ------------------------------------------------------------------ entry */

export function createGaitDriver(gait: Gait, frame: Frame): GaitDriver {
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
    default: {
      const never: never = gait;
      throw new Error(`entities3d: unknown gait "${never as string}"`);
    }
  }
}
