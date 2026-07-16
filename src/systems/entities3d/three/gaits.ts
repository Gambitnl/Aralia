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
  /** Wing flap angle in radians; 0 for non-flyers. */
  readonly flap: number;
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

  constructor(frame: Frame, spec: PlanSpec) {
    super(frame);
    this.spec = spec;
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
        return this.legReachM > 0 ? this.legReachM * 0.88 : s.bodyRadM * 1.05;
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
    this.flap = s.chains.some((c) => c.kind === 'wing')
      ? Math.sin(this.t * 6) * (0.25 + 0.45 * this.speedFactor)
      : 0;

    // spine joints front→rear
    const y0 = this.bodyY();
    const upright = s.stance === 'upright';
    const n = s.spine.segments;
    for (let i = 0; i <= n; i++) {
      const u = i / n; // 0 front/top → 1 rear/bottom
      const arch = Math.sin(u * Math.PI) * s.spine.arch * s.bodyRadM * 2;
      if (upright) {
        const topY = Math.max(y0 + s.bodyLenM, s.bodyRadM * 2);
        this.spinePts[i].set(0, topY - u * (topY - y0 * 0.35), arch);
      } else {
        // slither is the star: amplitude keys off body LENGTH, and idles softly
        const wave =
          s.stance === 'serpentine'
            ? Math.sin(this.gaitPhase * Math.PI * 2 + u * 4.5) *
              Math.max(s.bodyRadM * 0.6, s.bodyLenM * 0.05) *
              (0.55 + 0.45 * this.speedFactor)
            : 0;
        // legless bulky horizontals breathe like a mound (ooze idle squash)
        const breath = this.moundBody ? Math.sin(this.t * 2.2) * s.bodyRadM * 0.1 : 0;
        const moundZ = this.moundBody ? 0.55 : 1;
        this.spinePts[i].set(wave, y0 + arch + breath * Math.sin(u * Math.PI), this.attachZ(u) * moundZ);
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
    this.setAnchor('back', mid.x, mid.y + s.bodyRadM * 0.8, mid.z);
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
    // root rides the spine at attach, lifted to heightFrac on the body
    const spineU = Math.min(1, Math.max(0, chain.attach));
    const idx = Math.min(s.spine.segments, Math.round(spineU * s.spine.segments));
    const sp = this.spinePts[idx];
    const root = new Vector3(
      sp.x + chain.side * s.bodyRadM * 0.85,
      sp.y + (chain.heightFrac - 0.5) * s.bodyRadM * 1.6,
      upright ? sp.z + s.bodyRadM * 0.2 : rootZ,
    );
    const total = chain.links.reduce((nn, l) => nn + l.lenM, 0);
    const pts: Vector3[] = [root];

    if (chain.kind === 'leg') {
      const tread = this.legTreads.get(chain.id)!;
      const foot = new Vector3(tread.pos.x, tread.pos.y, tread.pos.z);
      if (chain.links.length === 2) {
        V_BEND.set(chain.side * 0.25, 0, 1).normalize();
        solveKnee(root, foot, chain.links[0].lenM, chain.links[1].lenM, V_BEND, V_KNEE);
        pts.push(V_KNEE.clone(), foot);
      } else {
        // n links: joints along a root→foot bezier bulged toward the bend
        const bulge = Math.max(0, total - root.distanceTo(foot)) * 0.6 + s.bodyRadM * 0.2;
        const mid = root.clone().add(foot).multiplyScalar(0.5);
        mid.z += bulge;
        let acc = 0;
        for (let j = 0; j < chain.links.length - 1; j++) {
          acc += chain.links[j].lenM / total;
          pts.push(bezier2(root, mid, foot, acc));
        }
        pts.push(foot);
      }
      return pts;
    }

    // direction seeds per kind (unit-ish, then per-link motion)
    const dir = new Vector3();
    if (chain.kind === 'tail') dir.set(chain.side * 0.15, 0.12, -1);
    else if (chain.kind === 'tentacle') {
      dir.set(chain.side === 0 ? 0.4 : chain.side, -0.12, 0.35);
      // siblings fan around the body — six tentacles are a crown, not a comb
      const sibs = this.spec.chains.filter((c) => c.kind === 'tentacle' && c.side === chain.side);
      if (sibs.length > 1) {
        const which = sibs.findIndex((c) => c.id === chain.id);
        dir.applyAxisAngle(V_UP, (which / (sibs.length - 1) - 0.5) * 1.9 * (chain.side || 1));
      }
    }
    else if (chain.kind === 'neck') dir.set(chain.side * 0.2, 1.15, upright ? 0.3 : 0.75);
    else if (chain.kind === 'wing') dir.set(chain.side === 0 ? 0.9 : chain.side, 0.35, -0.15);
    else dir.set(chain.side === 0 ? 0.5 : chain.side, -0.55, 0.5); // arm: down-forward hang
    dir.normalize();

    // Necks fan out so multi-head creatures separate their heads.
    if (chain.kind === 'neck') {
      const necks = this.spec.chains.filter((c) => c.kind === 'neck');
      const which = necks.findIndex((c) => c.id === chain.id);
      if (necks.length > 1) {
        const spread = which / (necks.length - 1) - 0.5;
        dir.x += spread * 1.6;
        dir.normalize();
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
        const wave = Math.sin(this.t * 3.1 + j * 1.15 + chain.attach * 6);
        step.addScaledVector(perp, wave * 0.35).addScaledVector(V_UP, wave * 0.22 - j * 0.08);
      } else if (chain.kind === 'wing') {
        step.y += this.flap * (0.55 + j * 0.5);
      } else if (chain.kind === 'neck') {
        // arc up and outward; only ease off near the tip so heads ride high
        step.y += Math.sin(this.t * 0.8 + chain.attach * 3) * 0.06 - j * 0.03;
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
      // relative to body thickness too
      const baseR = Math.max(this.hr, s.bodyRadM * 0.85) * head.sizeScale;
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
          z: core.z + s.bodyRadM * 0.55,
          r: baseR,
          fx: 0, fy: 0, fz: 1,
          eyes: head.eyes,
        });
        return;
      }
      if (s.stance === 'upright') {
        this.sockets.push({
          x: front.x,
          y: front.y + baseR * 0.9,
          z: front.z + baseR * 0.15,
          r: baseR,
          fx: 0, fy: 0, fz: 1,
          eyes: head.eyes,
        });
        return;
      }
      // horizontal/serpentine neckless heads ride an auto S-neck: proud above
      // the shoulder line, not hanging vulture-low off the spine front —
      // diagonal, not a periscope.
      const rise = s.bodyRadM * 1.6 + baseR * 0.7;
      const fwd = s.bodyRadM * 1.8;
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
        fx: 0, fy: -0.12, fz: 1,
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
    // spine: rear-thick per taper, front toward heads
    for (let i = 0; i < n; i++) {
      const a = this.spinePts[i];
      const b = this.spinePts[i + 1];
      const uA = i / n;
      const uB = (i + 1) / n;
      const rA = Math.max(0.01, s.bodyRadM * (s.spine.taper + (1 - s.spine.taper) * uA));
      const rB = Math.max(0.01, s.bodyRadM * (s.spine.taper + (1 - s.spine.taper) * uB));
      sink.seg(`spine.${i}`, a.x, a.y, a.z, b.x, b.y, b.z, rA, rB);
    }
    // chains
    for (const chain of s.chains) {
      const pts = this.chainPoints(chain);
      for (let j = 0; j < chain.links.length; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const r0 = Math.max(0.008, chain.links[j].rM);
        const r1 = Math.max(0.008, chain.links[Math.min(j + 1, chain.links.length - 1)].rM * 0.85);
        sink.seg(`${chain.id}.${j}`, a.x, a.y, a.z, b.x, b.y, b.z, r0, r1);
      }
      if (chain.kind === 'leg') {
        const tip = pts[pts.length - 1];
        const r = Math.max(0.012, chain.links[chain.links.length - 1].rM * 1.1);
        sink.ball(`${chain.id}.foot`, tip.x, tip.y + r * 0.3, tip.z + r * 0.4, r);
        // toe segments: claws at silhouette level, from parts we already have
        if (chain.links.length >= 2) {
          for (const [ti, splay] of [-0.5, 0.5].entries()) {
            sink.seg(
              `${chain.id}.toe${ti}`,
              tip.x, tip.y + r * 0.25, tip.z + r * 0.3,
              tip.x + splay * r * 1.3, tip.y + r * 0.1, tip.z + r * 2.1,
              r * 0.42, r * 0.2,
            );
          }
        }
      }
    }
    // auto S-necks for neckless horizontal heads
    for (const [hi, neck] of this.autoNecks) {
      const r = this.sockets[hi] ? this.sockets[hi].r : s.bodyRadM;
      sink.seg(`head${hi}.neckS0`, neck.base.x, neck.base.y, neck.base.z, neck.mid.x, neck.mid.y, neck.mid.z, Math.min(s.bodyRadM * 0.55, r * 0.9), Math.min(s.bodyRadM * 0.46, r * 0.78));
      sink.seg(`head${hi}.neckS1`, neck.mid.x, neck.mid.y, neck.mid.z, neck.top.x, neck.top.y, neck.top.z, Math.min(s.bodyRadM * 0.46, r * 0.78), Math.min(s.bodyRadM * 0.38, r * 0.66));
    }
    // heads (+ optional snouts)
    this.sockets.forEach((socket, i) => {
      sink.ball(`head${i}`, socket.x, socket.y, socket.z, socket.r);
      const snout = s.heads[i].snout;
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

/** Quadratic bezier point (allocates — driver-construction and per-frame chain math only). */
function bezier2(a: Vector3, m: Vector3, b: Vector3, u: number): Vector3 {
  const w = 1 - u;
  return new Vector3(
    w * w * a.x + 2 * w * u * m.x + u * u * b.x,
    w * w * a.y + 2 * w * u * m.y + u * u * b.y,
    w * w * a.z + 2 * w * u * m.z + u * u * b.z,
  );
}

/* ------------------------------------------------------------------ entry */

export function createGaitDriver(gait: Gait, frame: Frame, planSpec?: PlanSpec): GaitDriver {
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
      return new PlanDriver(frame, planSpec);
    }
    default: {
      const never: never = gait;
      throw new Error(`entities3d: unknown gait "${never as string}"`);
    }
  }
}
